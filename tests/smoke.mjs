import assert from 'node:assert/strict';

const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? 'http://localhost:8080');
const databaseDown = process.argv.includes('--database-down');

function request(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json, text/html' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
}

async function json(path, options) {
  const response = await request(path, options);
  const payload = await response.json();
  return { status: response.status, payload };
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
assert.match(catalogHtml, /Catálogo de equipos/);
assert.match(catalogHtml, /id="category-filters"/);
assert.match(catalogHtml, /src="\/catalog.js"/);

const inventoryPage = await request('/inventario');
assert.equal(inventoryPage.status, 200);
assert.match(await inventoryPage.text(), /Administración del inventario/);

const health = await request('/api/health');
const expectedStatus = databaseDown ? 503 : 200;
const expectedBody = databaseDown
  ? { status: 'unavailable', database: 'down' }
  : { status: 'ok', database: 'up' };
assert.equal(health.status, expectedStatus, `GET /api/health debe devolver HTTP ${expectedStatus}`);
assert.match(health.headers.get('content-type') ?? '', /^application\/json\b/i);
assert.deepEqual(await health.json(), expectedBody, 'Contrato de salud inesperado');

let inventorySummary = 'Inventario omitido.';
const adminToken = process.env.INVENTORY_ADMIN_TOKEN;
const memberToken = process.env.INVENTORY_MEMBER_TOKEN;

// AC-03 contra PostgreSQL real: unicidad del código de inventario y permisos.
// Los datos quedan identificados por la marca de la ejecución para no
// interferir con otras comprobaciones sobre el mismo volumen.
if (!databaseDown && adminToken) {
  const run = Date.now().toString(36).toUpperCase();
  const admin = { token: adminToken };

  const category = await json('/api/categories', { ...admin, method: 'POST', body: { name: `Humo ${run}` } });
  assert.equal(category.status, 201, 'La creación de la categoría debe devolver HTTP 201');
  const categoryId = category.payload.category.id;

  const equipment = await json('/api/equipment', {
    ...admin,
    method: 'POST',
    body: { categoryId, name: `Equipo de humo ${run}`, description: 'Registro de prueba automatizada.' },
  });
  assert.equal(equipment.status, 201, 'La creación del equipo debe devolver HTTP 201');
  const equipmentId = equipment.payload.equipment.id;

  const first = await json('/api/units', { ...admin, method: 'POST', body: { equipmentId, inventoryCode: `SMK-${run}-1` } });
  const second = await json('/api/units', { ...admin, method: 'POST', body: { equipmentId, inventoryCode: `SMK-${run}-2` } });
  assert.equal(first.status, 201, 'La primera unidad debe registrarse');
  assert.equal(second.status, 201, 'La segunda unidad debe registrarse');
  assert.notEqual(first.payload.unit.id, second.payload.unit.id, 'Cada unidad debe tener su propio identificador');

  const duplicated = await json('/api/units', {
    ...admin,
    method: 'POST',
    body: { equipmentId, inventoryCode: `smk-${run}-1` },
  });
  assert.equal(duplicated.status, 409, 'El código repetido debe devolver HTTP 409');
  assert.equal(duplicated.payload.error.code, 'inventory_code_taken');

  const anonymous = await json('/api/units', { method: 'POST', body: { equipmentId, inventoryCode: `SMK-${run}-3` } });
  assert.equal(anonymous.status, 401, 'El inventario no se modifica sin sesión');

  if (memberToken) {
    const member = await json('/api/units', {
      token: memberToken,
      method: 'POST',
      body: { equipmentId, inventoryCode: `SMK-${run}-4` },
    });
    assert.equal(member.status, 403, 'Una cuenta sin permisos debe recibir HTTP 403');
  }

  const units = await json(`/api/units?equipmentId=${equipmentId}`, admin);
  assert.equal(units.status, 200);
  assert.deepEqual(
    units.payload.units.map(({ inventoryCode }) => inventoryCode),
    [`SMK-${run}-1`, `SMK-${run}-2`],
    'El inventario debe conservar las dos unidades registradas',
  );

  const publicCategories = await json('/api/categories');
  assert.equal(publicCategories.status, 200);
  assert.ok(
    publicCategories.payload.categories.some(({ id }) => id === categoryId),
    'El catálogo público debe mostrar la categoría registrada',
  );

  const filtered = await json(`/api/equipment?categoryId=${categoryId}`);
  assert.equal(filtered.status, 200);
  assert.deepEqual(filtered.payload.equipment.map(({ id }) => id), [equipmentId]);
  assert.equal(filtered.payload.equipment[0].activeUnits, 2);

  inventorySummary = `Inventario ${run}: dos unidades registradas, duplicado 409, sin sesión 401${memberToken ? ', sin permisos 403' : ''}.`;
} else if (!databaseDown) {
  inventorySummary = 'Inventario omitido: configura INVENTORY_ADMIN_TOKEN para comprobarlo.';
}

console.log(`Inicio, catálogo, inventario y ${assets.length + 1} recursos estáticos correctos. Salud HTTP ${health.status}.`);
console.log(inventorySummary);
