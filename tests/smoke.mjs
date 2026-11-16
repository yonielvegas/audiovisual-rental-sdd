import assert from 'node:assert/strict';

const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? 'http://localhost:8080');
const databaseDown = process.argv.includes('--database-down');

// Cada cliente conserva su propia cookie de sesión, de modo que la prueba
// pueda usar a la vez una sesión administrativa, una usuaria y ninguna.
function createClient() {
  let cookie = null;

  async function request(path, { method = 'GET', body, redirect = 'manual' } = {}) {
    const headers = { Accept: 'application/json, text/html' };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(new URL(path, baseUrl), {
      method,
      headers,
      redirect,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    for (const entry of response.headers.getSetCookie?.() ?? []) {
      const [pair] = entry.split(';');
      cookie = pair.startsWith('sesion=') && pair !== 'sesion=' ? pair : null;
    }
    return response;
  }

  return {
    request,
    async json(path, options) {
      const response = await request(path, options);
      return { status: response.status, payload: await response.json() };
    },
  };
}

const guest = createClient();
const request = (path, options) => guest.request(path, options);

const home = await request('/', { redirect: 'error' });
assert.equal(home.status, 200, 'GET / debe devolver HTTP 200');
assert.match(home.headers.get('content-type') ?? '', /^text\/html\b/i);
const html = await home.text();
assert.match(html, /audiovisual/i, 'La página debe identificar el sistema audiovisual');

const assets = [];
for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
  if (!/\brel=["']stylesheet["']/i.test(tag)) continue;
  const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
  assert.ok(href, 'La hoja de estilos debe declarar su ruta');
  assets.push({ path: href, type: /^text\/css\b/i });
}
for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
  assets.push({ path: src, type: /^(?:text|application)\/(?:java|ecma)script\b/i });
}
assert.ok(assets.length > 0, 'La página debe enlazar al menos un recurso estático');

for (const { path, type } of assets) {
  const url = new URL(path, baseUrl);
  assert.equal(url.origin, baseUrl.origin, `El recurso ${path} debe usar el mismo origen`);
  const asset = await request(url.pathname);
  assert.equal(asset.status, 200, `El recurso ${path} debe devolver HTTP 200`);
  assert.match(asset.headers.get('content-type') ?? '', type, `Tipo de contenido incorrecto en ${path}`);
  assert.ok((await asset.text()).trim(), `El recurso ${path} debe tener contenido`);
}

assert.match(html, /href="\/catalogo"[^>]*>\s*Ver catálogo/);
const hero = await request('/hero.webp');
assert.equal(hero.status, 200);
assert.equal(hero.headers.get('content-type'), 'image/webp');
assert.ok((await hero.arrayBuffer()).byteLength > 0);

const catalog = await request('/catalogo');
assert.equal(catalog.status, 200);
const catalogHtml = await catalog.text();
assert.match(catalogHtml, /Catálogo de equipos/);
assert.match(catalogHtml, /id="category-filters"/);
assert.match(catalogHtml, /src="\/catalog.js"/);

const accessPage = await request('/acceso');
assert.equal(accessPage.status, 200);
const accessHtml = await accessPage.text();
assert.match(accessHtml, /id="login-form"/);
assert.match(accessHtml, /id="register-form"/);

// RT-02. La página administrativa no se sirve sin una sesión con rol ADMIN.
const guardedPage = await request('/inventario');
assert.equal(guardedPage.status, 302, 'GET /inventario sin sesión debe redirigir al acceso');
assert.equal(guardedPage.headers.get('location'), '/acceso?siguiente=%2Finventario');

const health = await request('/api/health');
const expectedStatus = databaseDown ? 503 : 200;
const expectedBody = databaseDown
  ? { status: 'unavailable', database: 'down' }
  : { status: 'ok', database: 'up' };
assert.equal(health.status, expectedStatus, `GET /api/health debe devolver HTTP ${expectedStatus}`);
assert.match(health.headers.get('content-type') ?? '', /^application\/json\b/i);
assert.deepEqual(await health.json(), expectedBody, 'Contrato de salud inesperado');

let accountsSummary = 'Cuentas e inventario omitidos.';
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
const adminPassword = process.env.ADMIN_PASSWORD;

// AC-01 y AC-03 contra PostgreSQL real: sesión del administrador sembrado por
// la inicialización, registro público, roles y unicidad del inventario. Los
// datos llevan la marca de la ejecución para no interferir con ejecuciones
// anteriores sobre el mismo volumen.
if (!databaseDown && adminPassword) {
  const run = Date.now().toString(36).toUpperCase();

  const anonymousSession = await guest.json('/api/sessions/current');
  assert.equal(anonymousSession.status, 200);
  assert.equal(anonymousSession.payload.user, null, 'Sin cookie no debe haber sesión');

  const admin = createClient();
  const wrong = await admin.json('/api/sessions', {
    method: 'POST',
    body: { username: adminUsername, password: `${adminPassword}-incorrecta` },
  });
  assert.equal(wrong.status, 401, 'Una contraseña incorrecta debe devolver HTTP 401');

  const signedIn = await admin.json('/api/sessions', {
    method: 'POST',
    body: { username: adminUsername, password: adminPassword },
  });
  assert.equal(signedIn.status, 200, 'El administrador sembrado debe poder iniciar sesión');
  assert.equal(signedIn.payload.user.role, 'ADMIN', 'La cuenta sembrada debe tener el rol ADMIN');
  assert.equal(signedIn.payload.redirect, '/inventario');

  const adminPage = await admin.request('/inventario');
  assert.equal(adminPage.status, 200, 'El administrador debe poder abrir la página del inventario');

  const member = createClient();
  const registered = await member.json('/api/users', {
    method: 'POST',
    body: { username: `humo${run.toLowerCase()}`, password: `contrasena-de-humo-${run}` },
  });
  assert.equal(registered.status, 201, 'El registro público debe crear la cuenta');
  assert.equal(registered.payload.user.role, 'USER', 'El registro público nunca concede permisos de administración');
  assert.equal(registered.payload.redirect, '/catalogo');

  const memberPage = await member.request('/inventario');
  assert.equal(memberPage.status, 403, 'Una cuenta sin permisos no debe abrir la página del inventario');

  const category = await admin.json('/api/categories', { method: 'POST', body: { name: `Humo ${run}` } });
  assert.equal(category.status, 201, 'La creación de la categoría debe devolver HTTP 201');
  const categoryId = category.payload.category.id;

  const equipment = await admin.json('/api/equipment', {
    method: 'POST',
    body: { categoryId, name: `Equipo de humo ${run}`, description: 'Registro de prueba automatizada.' },
  });
  assert.equal(equipment.status, 201, 'La creación del equipo debe devolver HTTP 201');
  const equipmentId = equipment.payload.equipment.id;

  const first = await admin.json('/api/units', { method: 'POST', body: { equipmentId, inventoryCode: `SMK-${run}-1` } });
  const second = await admin.json('/api/units', { method: 'POST', body: { equipmentId, inventoryCode: `SMK-${run}-2` } });
  assert.equal(first.status, 201, 'La primera unidad debe registrarse');
  assert.equal(second.status, 201, 'La segunda unidad debe registrarse');
  assert.notEqual(first.payload.unit.id, second.payload.unit.id, 'Cada unidad debe tener su propio identificador');

  const duplicated = await admin.json('/api/units', {
    method: 'POST',
    body: { equipmentId, inventoryCode: `smk-${run}-1` },
  });
  assert.equal(duplicated.status, 409, 'El código repetido debe devolver HTTP 409');
  assert.equal(duplicated.payload.error.code, 'inventory_code_taken');

  const anonymousWrite = await guest.json('/api/units', {
    method: 'POST',
    body: { equipmentId, inventoryCode: `SMK-${run}-3` },
  });
  assert.equal(anonymousWrite.status, 401, 'El inventario no se modifica sin sesión');

  const memberWrite = await member.json('/api/units', {
    method: 'POST',
    body: { equipmentId, inventoryCode: `SMK-${run}-4` },
  });
  assert.equal(memberWrite.status, 403, 'Una cuenta sin permisos debe recibir HTTP 403');

  const units = await admin.json(`/api/units?equipmentId=${equipmentId}`);
  assert.equal(units.status, 200);
  assert.deepEqual(
    units.payload.units.map(({ inventoryCode }) => inventoryCode),
    [`SMK-${run}-1`, `SMK-${run}-2`],
    'El inventario debe conservar las dos unidades registradas',
  );

  const publicCategories = await guest.json('/api/categories');
  assert.ok(
    publicCategories.payload.categories.some(({ id }) => id === categoryId),
    'El catálogo público debe mostrar la categoría registrada',
  );

  const filtered = await guest.json(`/api/equipment?categoryId=${categoryId}`);
  assert.deepEqual(filtered.payload.equipment.map(({ id }) => id), [equipmentId]);
  assert.equal(filtered.payload.equipment[0].activeUnits, 2);

  // Cerrar sesión revoca la credencial en el acto.
  const signedOut = await admin.request('/api/sessions/current', { method: 'DELETE' });
  assert.equal(signedOut.status, 204);
  const afterLogout = await admin.json('/api/sessions/current');
  assert.equal(afterLogout.payload.user, null, 'La sesión cerrada no debe seguir identificando a nadie');

  accountsSummary = `Cuentas ${run}: administrador ADMIN, registro público USER, 401 sin sesión, 403 sin permisos, 409 por código repetido y cierre de sesión efectivo.`;
} else if (!databaseDown) {
  accountsSummary = 'Cuentas e inventario omitidos: configura ADMIN_PASSWORD para comprobarlos.';
}

console.log(`Inicio, catálogo, acceso y ${assets.length + 1} recursos estáticos correctos. Salud HTTP ${health.status}.`);
console.log(accountsSummary);
