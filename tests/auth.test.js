import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sessionLifetimeMs } from '../src/backend/accounts.js';
import { createLoginThrottle } from '../src/backend/throttle.js';
import { catalogSeed, credentials, startApp } from './helpers/server.js';

// AC-01 · RF-01. Registro con datos válidos, acceso posterior y rechazo de una
// entrada inválida y de una contraseña incorrecta.
test('registra una cuenta, la deja con el rol USER y abre su sesión', async (context) => {
  const client = await startApp(context);

  const created = await client.post('/api/users', {
    body: { username: '  Nueva.Persona ', email: ' Persona@Ejemplo.COM ', password: 'contrasena-valida' },
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.user, { id: created.body.user.id, username: 'nueva.persona', role: 'USER' });
  assert.equal(created.body.redirect, '/catalogo');

  // La respuesta nunca devuelve la contraseña ni su hash.
  assert.equal(created.text.includes('contrasena-valida'), false);
  assert.equal(created.text.includes('argon2'), false);
  assert.equal('passwordHash' in created.body.user, false);

  const current = await client.get('/api/sessions/current');
  assert.equal(current.body.user.username, 'nueva.persona');
});

test('marca la cookie de sesión como HttpOnly, SameSite=Lax y de ámbito raíz', async (context) => {
  const client = await startApp(context);

  const response = await client.post('/api/sessions', { body: credentials.admin });
  assert.equal(response.status, 200);
  const [cookie] = response.setCookie;
  assert.match(cookie, /^sesion=[^;]+/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, new RegExp(`Max-Age=${Math.floor(sessionLifetimeMs / 1000)}`));
  // Sin HTTPS configurado la cookie no lleva Secure, porque el navegador la descartaría.
  assert.equal(/Secure/.test(cookie), false);

  // La credencial de sesión no es el nombre ni el identificador de la cuenta.
  const value = cookie.split(';')[0].slice('sesion='.length);
  assert.ok(value.length >= 40);
  assert.equal(value.includes('admin'), false);
});

test('rechaza un registro inválido y conserva el número de cuentas', async (context) => {
  const client = await startApp(context);

  const attempts = [
    [{ username: 'ab', password: 'contrasena-valida' }, 'invalid_username'],
    [{ username: 'Con Espacios', password: 'contrasena-valida' }, 'invalid_username'],
    [{ username: 'persona-valida', password: 'corta12' }, 'invalid_password'],
    [{ username: 'persona-valida', password: 'c'.repeat(201) }, 'invalid_password'],
    [{ username: 'persona-valida', email: 'no-es-correo', password: 'contrasena-valida' }, 'invalid_email'],
    [{ password: 'contrasena-valida' }, 'invalid_request'],
    [{ username: 'persona-valida' }, 'invalid_request'],
  ];
  for (const [body, code] of attempts) {
    const response = await client.post('/api/users', { body });
    assert.equal(response.status, 400, `${JSON.stringify(body)} debe rechazarse`);
    assert.equal(response.body.error.code, code);
    assert.deepEqual(response.setCookie, []);
  }

  // Ninguno de los intentos creó una cuenta utilizable.
  const login = await client.post('/api/sessions', { body: { username: 'persona-valida', password: 'contrasena-valida' } });
  assert.equal(login.status, 401);
});

test('rechaza un nombre de usuario o un correo ya registrados', async (context) => {
  const client = await startApp(context);
  await client.post('/api/users', { body: { username: 'repetida', email: 'repetida@ejemplo.com', password: 'contrasena-valida' } });

  const sameName = await client.post('/api/users', { body: { username: 'Repetida', password: 'otra-contrasena' } });
  assert.equal(sameName.status, 409);
  assert.equal(sameName.body.error.code, 'username_taken');

  const sameEmail = await client.post('/api/users', {
    body: { username: 'distinta', email: 'REPETIDA@ejemplo.com', password: 'otra-contrasena' },
  });
  assert.equal(sameEmail.status, 409);
  assert.equal(sameEmail.body.error.code, 'email_taken');
});

test('acepta la contraseña correcta y rechaza la incorrecta con el mismo mensaje que una cuenta inexistente', async (context) => {
  const client = await startApp(context);

  const valid = await client.post('/api/sessions', { body: credentials.admin });
  assert.equal(valid.status, 200);

  const wrongPassword = await client.post('/api/sessions', {
    body: { username: credentials.admin.username, password: 'contrasena-incorrecta' },
  });
  const unknownUser = await client.post('/api/sessions', {
    body: { username: 'cuenta.inexistente', password: 'contrasena-incorrecta' },
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownUser.status, 401);
  // El mismo mensaje en ambos casos: la respuesta no revela qué cuentas existen.
  assert.deepEqual(wrongPassword.body, unknownUser.body);
  assert.equal(wrongPassword.body.error.code, 'unauthenticated');
});

// RF-01 y RN-07. El rol decide a dónde llega cada persona y qué puede hacer.
test('lleva al administrador al inventario y a una cuenta usuaria al catálogo', async (context) => {
  const client = await startApp(context);

  const admin = await client.post('/api/sessions', { body: credentials.admin });
  assert.equal(admin.body.user.role, 'ADMIN');
  assert.equal(admin.body.redirect, '/inventario');

  const member = await client.post('/api/sessions', { body: credentials.member });
  assert.equal(member.body.user.role, 'USER');
  assert.equal(member.body.redirect, '/catalogo');
});

test('informa de la sesión actual y la olvida al cerrarla', async (context) => {
  const client = await startApp(context);

  const anonymous = await client.get('/api/sessions/current');
  assert.equal(anonymous.status, 200);
  assert.equal(anonymous.body.user, null);

  const session = await client.as('member');
  const signedIn = await session.get('/api/sessions/current');
  assert.equal(signedIn.body.user.username, credentials.member.username);

  const cookie = session.cookie();
  const closed = await session.logout();
  assert.equal(closed.status, 204);
  assert.match(closed.setCookie[0], /^sesion=;/);
  assert.match(closed.setCookie[0], /Max-Age=0/);

  // La credencial anterior ya no vale, aunque el cliente la conserve.
  const reused = await client.get('/api/sessions/current', { cookie });
  assert.equal(reused.body.user, null);
  assert.equal(client.accountStore.openSessions(), 0);
});

test('cierra sesión sin error cuando no había ninguna abierta', async (context) => {
  const client = await startApp(context);
  const response = await client.delete('/api/sessions/current');
  assert.equal(response.status, 204);
  assert.match(response.setCookie[0], /Max-Age=0/);
});

test('ignora una cookie de sesión caducada, manipulada o desconocida', async (context) => {
  let instant = new Date('2026-11-15T10:00:00Z');
  const client = await startApp(context, { now: () => instant });

  const session = await client.as('admin');
  const cookie = session.cookie();
  assert.equal((await client.get('/api/sessions/current', { cookie })).body.user.role, 'ADMIN');

  instant = new Date(instant.getTime() + sessionLifetimeMs + 1000);
  assert.equal((await client.get('/api/sessions/current', { cookie })).body.user, null);
  assert.equal((await client.get('/api/units', { cookie })).status, 401);

  for (const invalid of ['sesion=inventada', 'sesion=', `${cookie}x`]) {
    assert.equal((await client.get('/api/sessions/current', { cookie: invalid })).body.user, null);
  }
});

test('frena los intentos repetidos de inicio de sesión', async (context) => {
  const client = await startApp(context, { throttle: createLoginThrottle({ limit: 3, windowMs: 60_000 }) });
  const wrong = { username: credentials.admin.username, password: 'contrasena-incorrecta' };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal((await client.post('/api/sessions', { body: wrong })).status, 401);
  }

  const blocked = await client.post('/api/sessions', { body: wrong });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'too_many_attempts');
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);

  // La credencial correcta también espera: el freno protege la cuenta.
  assert.equal((await client.post('/api/sessions', { body: credentials.admin })).status, 429);
});

test('libera el freno después de un inicio de sesión correcto', async (context) => {
  const client = await startApp(context, { throttle: createLoginThrottle({ limit: 3, windowMs: 60_000 }) });
  const wrong = { username: credentials.admin.username, password: 'contrasena-incorrecta' };

  await client.post('/api/sessions', { body: wrong });
  await client.post('/api/sessions', { body: wrong });
  assert.equal((await client.post('/api/sessions', { body: credentials.admin })).status, 200);

  await client.post('/api/sessions', { body: wrong });
  await client.post('/api/sessions', { body: wrong });
  assert.equal((await client.post('/api/sessions', { body: wrong })).status, 401);
});

// RT-02. Las rutas administrativas quedan protegidas contra accesos no autorizados.
test('solo el administrador puede modificar el inventario por la API', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });
  const admin = await client.as('admin');
  const member = await client.as('member');

  const unit = { equipmentId: 1, inventoryCode: 'CAM-500' };
  assert.equal((await client.post('/api/units', { body: unit })).status, 401);
  assert.equal((await member.post('/api/units', { body: unit })).status, 403);
  assert.equal((await admin.post('/api/units', { body: unit })).status, 201);

  assert.equal((await member.get('/api/units')).status, 403);
  assert.equal((await admin.get('/api/units')).status, 200);

  // El catálogo público sigue abierto para todas las personas.
  assert.equal((await client.get('/api/categories')).status, 200);
  assert.equal((await member.get('/api/equipment')).status, 200);
});

test('protege la página del inventario y lleva al acceso cuando no hay sesión', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const anonymous = await client.get('/inventario');
  assert.equal(anonymous.status, 302);
  assert.equal(anonymous.headers.get('location'), '/acceso?siguiente=%2Finventario');
  assert.equal(anonymous.text.includes('unit-form'), false);

  const member = await client.as('member');
  const refused = await member.get('/inventario');
  assert.equal(refused.status, 403);
  assert.match(refused.text, /Sin permisos/);
  assert.equal(refused.text.includes('unit-form'), false);

  const admin = await client.as('admin');
  const allowed = await admin.get('/inventario');
  assert.equal(allowed.status, 200);
  assert.match(allowed.text, /id="unit-form"/);
  assert.equal(allowed.headers.get('cache-control'), 'no-store');
});

test('sirve la página de acceso con el formulario de registro y el de inicio de sesión', async (context) => {
  const client = await startApp(context);

  const response = await client.get('/acceso');
  assert.equal(response.status, 200);
  assert.match(response.text, /id="login-form"/);
  assert.match(response.text, /id="register-form"/);
  assert.match(response.text, /src="\/access.js"/);
  assert.match(response.text, /href="\/acceso" aria-current="page"/);

  const module = await client.get('/access.js');
  assert.equal(module.status, 200);
  assert.match(module.text, /\/api\/sessions/);
});

test('rechaza un cuerpo que no es JSON en las rutas de cuentas', async (context) => {
  const client = await startApp(context);

  const form = await client.post('/api/sessions', { body: 'username=admin', contentType: 'text/plain' });
  assert.equal(form.status, 400);
  assert.equal(form.body.error.code, 'invalid_content_type');
  assert.deepEqual(form.setCookie, []);

  const method = await client.patch('/api/sessions/current', { body: {} });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'DELETE, GET');
});
