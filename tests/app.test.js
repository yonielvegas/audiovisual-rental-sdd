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
  const response = await fetch(client.base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(await response.text(), /equipos audiovisuales/i);
  assert.equal(check.mock.callCount(), 0);
});

test('sirve la fotografía y enlaza la landing con el catálogo', async (context) => {
  const check = context.mock.fn(async () => {});
  const client = await startApp(context, { checkDatabase: check });
  const home = await (await fetch(client.base)).text();
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

  const response = await fetch(`${client.base}/catalogo`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  const catalog = await response.text();
  assert.match(catalog, /href="\/catalogo" aria-current="page"/);
  assert.match(catalog, /Catálogo de equipos/);
  assert.match(catalog, /id="category-filters"/);
  assert.match(catalog, /id="equipment-list"/);
  assert.match(catalog, /src="\/catalog.js"/);
  assert.match(catalog, /href="\/"/);

  const module = await fetch(`${client.base}/catalog.js`);
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /javascript/);
  assert.match(await module.text(), /\/api\/equipment/);
});

test('sirve la página de administración del inventario y su módulo', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const response = await fetch(`${client.base}/inventario`);
  assert.equal(response.status, 200);
  const page = await response.text();
  assert.match(page, /href="\/inventario" aria-current="page"/);
  assert.match(page, /Administración del inventario/);
  assert.match(page, /id="unit-form"/);
  assert.match(page, /src="\/inventory.js"/);

  const module = await fetch(`${client.base}/inventory.js`);
  assert.equal(module.status, 200);
  assert.match(await module.text(), /\/api\/units/);
});

test('responde 404 con el formato de error del contrato', async (context) => {
  const client = await startApp(context);
  const response = await client.get('/pagina-inexistente');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'not_found');
  assert.match(response.headers.get('content-type'), /^application\/json/);
});
