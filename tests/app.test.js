import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/backend/app.js';

async function startApp(context, checkDatabase) {
  const app = await createApp({ checkDatabase });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  context.after(() => new Promise((resolve, reject) => {
    app.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${app.address().port}`;
}

test('devuelve el estado saludable después de comprobar la base', async (context) => {
  const check = context.mock.fn(async () => {});
  const base = await startApp(context, check);
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok', database: 'up' });
  assert.equal(check.mock.callCount(), 1);
});

test('devuelve 503 con respuesta estable si falla PostgreSQL', async (context) => {
  const base = await startApp(context, async () => { throw new Error('internal error'); });
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable', database: 'down' });
});

test('sirve la página de inicio sin depender de PostgreSQL', async (context) => {
  const check = context.mock.fn(async () => {});
  const base = await startApp(context, check);
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(await response.text(), /equipos audiovisuales/i);
  assert.equal(check.mock.callCount(), 0);
});
