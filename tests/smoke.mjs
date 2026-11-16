import assert from 'node:assert/strict';

const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? 'http://localhost:8080');
const databaseDown = process.argv.includes('--database-down');

function request(path) {
  return fetch(new URL(path, baseUrl), {
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
}

const home = await request('/');
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
  const asset = await request(url);
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
assert.match(catalogHtml, /Eric Ruiz/);
assert.match(catalogHtml, /issues\/4/);
assert.match(catalogHtml, /Volver al inicio/);

const health = await request('/api/health');
const expectedStatus = databaseDown ? 503 : 200;
const expectedBody = databaseDown
  ? { status: 'unavailable', database: 'down' }
  : { status: 'ok', database: 'up' };
assert.equal(health.status, expectedStatus, `GET /api/health debe devolver HTTP ${expectedStatus}`);
assert.match(health.headers.get('content-type') ?? '', /^application\/json\b/i);
assert.deepEqual(await health.json(), expectedBody, 'Contrato de salud inesperado');

console.log(`Inicio, catálogo y ${assets.length + 1} recursos estáticos correctos. Salud HTTP ${health.status}.`);
