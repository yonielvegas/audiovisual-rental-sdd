import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogSeed, startApp } from './helpers/server.js';

test('devuelve el estado saludable después de comprobar la base', async (context) => {
  const check = context.mock.fn(async () => {});
  const client = await startApp(context, { checkDatabase: check });
  const response = await client.get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(response.body, { status: 'ok', database: 'up' });
  assert.equal(check.mock.callCount(), 1);
});

test('devuelve 503 con respuesta estable si falla PostgreSQL', async (context) => {
  const client = await startApp(context, {
    checkDatabase: async () => { throw new Error('internal error'); },
  });
  const response = await client.get('/api/health');
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { status: 'unavailable', database: 'down' });
});

test('sirve la página de inicio sin depender de PostgreSQL', async (context) => {
  const check = context.mock.fn(async () => {});
  const client = await startApp(context, { checkDatabase: check });
  const response = await client.get('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(response.text, /equipos audiovisuales/i);
  assert.equal(check.mock.callCount(), 0);
});

test('sirve la fotografía y enlaza la landing con el catálogo', async (context) => {
  const check = context.mock.fn(async () => {});
  const client = await startApp(context, { checkDatabase: check });
  const home = (await client.get('/')).text;
  assert.match(home, /href="\/catalogo"[^>]*>\s*Ver catálogo/);
  assert.match(home, /href="\/" aria-current="page"/);
  assert.match(home, /src="\/hero.webp"/);

  const image = await fetch(`${client.base}/hero.webp`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/webp');
  assert.equal(Buffer.from(await image.arrayBuffer()).subarray(8, 12).toString(), 'WEBP');
  assert.equal(check.mock.callCount(), 0);
});

test('sirve la página del catálogo público y su módulo de consulta', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const response = await client.get('/catalogo');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(response.text, /href="\/catalogo" aria-current="page"/);
  assert.match(response.text, /Catálogo de equipos/);
  assert.match(response.text, /id="category-filters"/);
  assert.match(response.text, /id="equipment-list"/);
  assert.match(response.text, /src="\/catalog.js"/);

  const module = await client.get('/catalog.js');
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /javascript/);
  assert.match(module.text, /\/api\/equipment/);
});

test('ofrece el acceso en el layout y oculta el inventario hasta conocer el rol', async (context) => {
  const client = await startApp(context);
  const home = (await client.get('/')).text;

  assert.match(home, /id="session-access"[^>]*href="\/acceso"/);
  assert.match(home, /id="nav-inventory"[^>]*hidden/);
  assert.match(home, /id="session-logout"[^>]*hidden/);

  const module = await client.get('/app.js');
  assert.equal(module.status, 200);
  assert.match(module.text, /\/api\/sessions\/current/);
});

test('responde 404 con el formato de error del contrato', async (context) => {
  const client = await startApp(context);
  const response = await client.get('/pagina-inexistente');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'not_found');
  assert.match(response.headers.get('content-type'), /^application\/json/);
});
