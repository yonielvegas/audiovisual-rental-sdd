import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogSeed, startApp } from './helpers/server.js';

// Atajo para las pruebas: el inventario siempre se administra con una sesión
// de rol ADMIN, igual que en la aplicación.
async function withAdmin(context, options) {
  const client = await startApp(context, options);
  return { client, admin: await client.as('admin') };
}

// AC-02 · RF-02. El catálogo público se consulta sin sesión y el filtro por
// categoría devuelve solo los equipos de la categoría elegida.
test('publica las categorías del catálogo sin requerir sesión', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const response = await client.get('/api/categories');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(response.body, {
    categories: [
      { id: 2, name: 'Audio', equipmentCount: 1 },
      { id: 1, name: 'Cámaras', equipmentCount: 2 },
    ],
  });
});

test('publica los equipos del catálogo y su categoría sin requerir sesión', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const response = await client.get('/api/equipment');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.equipment.map(({ name }) => name), [
    'Micrófono de cañón',
    'Cámara de cine compacta',
    'Cámara de documental',
  ]);
  const [microphone] = response.body.equipment;
  assert.deepEqual(microphone.category, { id: 2, name: 'Audio' });
  assert.equal(microphone.description, 'Incluye pistola y zepelín.');
  // La unidad MIC-001 está inactiva, así que no cuenta como inventario disponible.
  assert.equal(microphone.activeUnits, 0);
});

test('filtra los equipos por categoría y conserva solo la categoría elegida', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const response = await client.get('/api/equipment?categoryId=1');
  assert.equal(response.status, 200);
  assert.equal(response.body.equipment.length, 2);
  for (const item of response.body.equipment) {
    assert.deepEqual(item.category, { id: 1, name: 'Cámaras' });
  }
  assert.deepEqual(response.body.equipment.map(({ activeUnits }) => activeUnits), [2, 0]);
});

test('rechaza un filtro de categoría inválido o inexistente', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const invalid = await client.get('/api/equipment?categoryId=abc');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'invalid_request');

  const missing = await client.get('/api/equipment?categoryId=99');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'not_found');
});

test('publica un equipo del catálogo por su identificador', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const response = await client.get('/api/equipment/1');
  assert.equal(response.status, 200);
  assert.equal(response.body.equipment.name, 'Cámara de cine compacta');
  assert.equal(response.body.equipment.activeUnits, 2);

  assert.equal((await client.get('/api/equipment/404')).status, 404);
});

// AC-03 · RF-03, RT-02, RN-07. Solo una cuenta con rol ADMIN administra el
// inventario. La ausencia de sesión y el rol insuficiente se distinguen.
test('rechaza la administración del inventario sin sesión y conserva el inventario', async (context) => {
  const { client, admin } = await withAdmin(context, { seed: catalogSeed });
  const before = await admin.get('/api/units');

  for (const attempt of [
    client.post('/api/categories', { body: { name: 'Iluminación' } }),
    client.patch('/api/categories/1', { body: { name: 'Cámaras de cine' } }),
    client.post('/api/equipment', { body: { categoryId: 1, name: 'Trípode' } }),
    client.patch('/api/equipment/1', { body: { name: 'Otro nombre' } }),
    client.post('/api/units', { body: { equipmentId: 1, inventoryCode: 'CAM-003' } }),
    client.patch('/api/units/1', { body: { active: false } }),
    client.get('/api/units'),
  ]) {
    const response = await attempt;
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'unauthenticated');
    // El 401 no anuncia ningún esquema HTTP: la sesión se abre en /acceso.
    assert.equal(response.headers.get('www-authenticate'), null);
  }

  const after = await admin.get('/api/units');
  assert.deepEqual(after.body, before.body);
  assert.deepEqual((await client.get('/api/categories')).body.categories.map(({ name }) => name), ['Audio', 'Cámaras']);
});

test('rechaza con 403 a una cuenta autenticada sin permisos de administración', async (context) => {
  const { client, admin } = await withAdmin(context, { seed: catalogSeed });
  const member = await client.as('member');

  const created = await member.post('/api/units', { body: { equipmentId: 1, inventoryCode: 'CAM-900' } });
  assert.equal(created.status, 403);
  assert.equal(created.body.error.code, 'forbidden');

  assert.equal((await member.patch('/api/units/1', { body: { active: false } })).status, 403);
  assert.equal((await member.get('/api/units')).status, 403);

  const units = await admin.get('/api/units');
  assert.deepEqual(units.body.units.map(({ inventoryCode }) => inventoryCode), ['CAM-001', 'CAM-002', 'MIC-001']);
  assert.equal(units.body.units.find(({ id }) => id === 1).active, true);
});

test('no exige sesión para las consultas públicas del catálogo', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });

  const response = await client.get('/api/categories', { cookie: 'sesion=inventada' });
  assert.equal(response.status, 200);
});

// AC-03 · RN-01. Dos unidades del mismo equipo se distinguen por su código y el
// intento duplicado se rechaza sin alterar el inventario.
test('registra dos unidades del mismo equipo y distingue sus identificadores', async (context) => {
  const { admin } = await withAdmin(context, {
    seed: { categories: [{ name: 'Cámaras' }], equipment: [{ categoryId: 1, name: 'Cámara de cine compacta' }] },
  });

  const first = await admin.post('/api/units', { body: { equipmentId: 1, inventoryCode: 'CAM-010' } });
  const second = await admin.post('/api/units', { body: { equipmentId: 1, inventoryCode: 'CAM-011' } });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(first.headers.get('location'), `/api/units/${first.body.unit.id}`);
  assert.notEqual(first.body.unit.id, second.body.unit.id);
  assert.notEqual(first.body.unit.inventoryCode, second.body.unit.inventoryCode);
  assert.equal(first.body.unit.equipment.id, second.body.unit.equipment.id);
  assert.equal(first.body.unit.active, true);

  const units = await admin.get('/api/units?equipmentId=1');
  assert.deepEqual(units.body.units.map(({ inventoryCode }) => inventoryCode), ['CAM-010', 'CAM-011']);
});

test('rechaza un código de inventario repetido y conserva la unidad existente', async (context) => {
  const { admin } = await withAdmin(context, {
    seed: {
      categories: [{ name: 'Cámaras' }],
      equipment: [{ categoryId: 1, name: 'Cámara A' }, { categoryId: 1, name: 'Cámara B' }],
      units: [{ equipmentId: 1, inventoryCode: 'CAM-010' }],
    },
  });

  const sameEquipment = await admin.post('/api/units', { body: { equipmentId: 1, inventoryCode: 'CAM-010' } });
  assert.equal(sameEquipment.status, 409);
  assert.equal(sameEquipment.body.error.code, 'inventory_code_taken');

  // El código identifica la unidad en todo el inventario, no solo dentro de un equipo.
  assert.equal((await admin.post('/api/units', { body: { equipmentId: 2, inventoryCode: 'CAM-010' } })).status, 409);

  // La comparación normaliza mayúsculas y espacios, igual que el almacenamiento.
  assert.equal((await admin.post('/api/units', { body: { equipmentId: 1, inventoryCode: ' cam-010 ' } })).status, 409);

  const units = await admin.get('/api/units');
  assert.equal(units.body.units.length, 1);
  assert.equal(units.body.units[0].inventoryCode, 'CAM-010');
});

test('rechaza un código de inventario con formato inválido', async (context) => {
  const { admin } = await withAdmin(context, {
    seed: { categories: [{ name: 'Cámaras' }], equipment: [{ categoryId: 1, name: 'Cámara A' }] },
  });

  for (const inventoryCode of ['', 'AB', 'CAM 010', 'CÁM-010', '-CAM-010', 'C'.repeat(25)]) {
    const response = await admin.post('/api/units', { body: { equipmentId: 1, inventoryCode } });
    assert.equal(response.status, 400, `El código ${JSON.stringify(inventoryCode)} debe rechazarse`);
    assert.equal(response.body.error.code, 'invalid_inventory_code');
  }
  assert.deepEqual((await admin.get('/api/units')).body.units, []);
});

test('normaliza el código de inventario al registrar la unidad', async (context) => {
  const { admin } = await withAdmin(context, {
    seed: { categories: [{ name: 'Cámaras' }], equipment: [{ categoryId: 1, name: 'Cámara A' }] },
  });

  const created = await admin.post('/api/units', { body: { equipmentId: 1, inventoryCode: '  cam-012  ' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.unit.inventoryCode, 'CAM-012');
});

test('mantiene estable el identificador de la unidad al corregir su código', async (context) => {
  const { admin } = await withAdmin(context, {
    seed: {
      categories: [{ name: 'Cámaras' }],
      equipment: [{ categoryId: 1, name: 'Cámara A' }],
      units: [{ equipmentId: 1, inventoryCode: 'CAM-010' }, { equipmentId: 1, inventoryCode: 'CAM-011' }],
    },
  });

  const renamed = await admin.patch('/api/units/1', { body: { inventoryCode: 'cam-099' } });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.unit.id, 1);
  assert.equal(renamed.body.unit.inventoryCode, 'CAM-099');

  const taken = await admin.patch('/api/units/1', { body: { inventoryCode: 'CAM-011' } });
  assert.equal(taken.status, 409);
  assert.equal(taken.body.error.code, 'inventory_code_taken');
  assert.equal((await admin.get('/api/units/1')).body.unit.inventoryCode, 'CAM-099');
});

test('conserva la unidad desactivada en el inventario y la retira del catálogo', async (context) => {
  const { client, admin } = await withAdmin(context, {
    seed: {
      categories: [{ name: 'Cámaras' }],
      equipment: [{ categoryId: 1, name: 'Cámara A' }],
      units: [{ equipmentId: 1, inventoryCode: 'CAM-010' }, { equipmentId: 1, inventoryCode: 'CAM-011' }],
    },
  });

  const deactivated = await admin.patch('/api/units/1', { body: { active: false } });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.unit.active, false);

  assert.equal((await admin.get('/api/units')).body.units.length, 2);
  assert.equal((await client.get('/api/equipment/1')).body.equipment.activeUnits, 1);

  const reactivated = await admin.patch('/api/units/1', { body: { active: true } });
  assert.equal(reactivated.body.unit.active, true);
  assert.equal((await client.get('/api/equipment/1')).body.equipment.activeUnits, 2);
});

test('rechaza registrar una unidad de un equipo inexistente', async (context) => {
  const { admin } = await withAdmin(context, { seed: { categories: [{ name: 'Cámaras' }] } });

  const response = await admin.post('/api/units', { body: { equipmentId: 77, inventoryCode: 'CAM-077' } });
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'not_found');
});

// RF-03. Administración de categorías y equipos con las autorizaciones previstas.
test('crea y modifica categorías con una cuenta autorizada', async (context) => {
  const { admin } = await withAdmin(context);

  const created = await admin.post('/api/categories', { body: { name: '  Iluminación  ' } });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.category, { id: 1, name: 'Iluminación', equipmentCount: 0 });
  assert.equal(created.headers.get('location'), '/api/categories/1');

  const renamed = await admin.patch('/api/categories/1', { body: { name: 'Iluminación de estudio' } });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.category.name, 'Iluminación de estudio');

  const duplicated = await admin.post('/api/categories', { body: { name: 'iluminación de estudio' } });
  assert.equal(duplicated.status, 409);
  assert.equal(duplicated.body.error.code, 'category_name_taken');

  assert.equal((await admin.patch('/api/categories/42', { body: { name: 'Otra' } })).status, 404);
});

test('rechaza una categoría sin nombre o con un cambio vacío', async (context) => {
  const { admin } = await withAdmin(context, { seed: { categories: [{ name: 'Cámaras' }] } });

  assert.equal((await admin.post('/api/categories', { body: { name: '   ' } })).status, 400);
  assert.equal((await admin.post('/api/categories', { body: { name: 42 } })).status, 400);
  assert.equal((await admin.post('/api/categories', { body: { name: 'C'.repeat(81) } })).status, 400);

  const empty = await admin.patch('/api/categories/1', { body: {} });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'invalid_request');
});

test('crea y modifica equipos y valida su categoría', async (context) => {
  const { admin } = await withAdmin(context, { seed: { categories: [{ name: 'Cámaras' }, { name: 'Audio' }] } });

  const created = await admin.post('/api/equipment', {
    body: { categoryId: 1, name: 'Cámara de cine compacta', description: '  Cuerpo con montura intercambiable.  ' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.equipment.description, 'Cuerpo con montura intercambiable.');
  assert.deepEqual(created.body.equipment.category, { id: 1, name: 'Cámaras' });
  assert.equal(created.body.equipment.activeUnits, 0);

  const moved = await admin.patch(`/api/equipment/${created.body.equipment.id}`, { body: { categoryId: 2 } });
  assert.equal(moved.status, 200);
  assert.deepEqual(moved.body.equipment.category, { id: 2, name: 'Audio' });
  assert.equal(moved.body.equipment.name, 'Cámara de cine compacta');

  const duplicated = await admin.post('/api/equipment', { body: { categoryId: 2, name: 'cámara de cine compacta' } });
  assert.equal(duplicated.status, 409);
  assert.equal(duplicated.body.error.code, 'equipment_name_taken');

  assert.equal((await admin.post('/api/equipment', { body: { categoryId: 99, name: 'Trípode' } })).status, 404);
  assert.equal((await admin.patch('/api/equipment/99', { body: { name: 'Trípode' } })).status, 404);
});

test('rechaza un cuerpo que no es JSON válido y no modifica el inventario', async (context) => {
  const { client, admin } = await withAdmin(context, { seed: { categories: [{ name: 'Cámaras' }] } });

  const text = await admin.post('/api/categories', { body: 'name=Audio', contentType: 'text/plain' });
  assert.equal(text.status, 400);
  assert.equal(text.body.error.code, 'invalid_content_type');

  assert.equal((await admin.post('/api/categories', { body: '{"name":' })).status, 400);
  assert.equal((await admin.post('/api/categories', { body: [] })).status, 400);

  assert.equal((await client.get('/api/categories')).body.categories.length, 1);
});

test('informa los métodos admitidos y las rutas inexistentes de la API', async (context) => {
  const client = await startApp(context);

  const method = await client.delete('/api/categories');
  assert.equal(method.status, 405);
  assert.equal(method.body.error.code, 'method_not_allowed');
  assert.equal(method.headers.get('allow'), 'GET, POST');

  const unknown = await client.get('/api/inexistente');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'not_found');
});

// Contrato en proceso que consume Reservas (RF-04, RF-05).
test('expone a Reservas solo las unidades activas del equipo', async (context) => {
  const { createInventory } = await import('../src/backend/inventory.js');
  const { createMemoryInventoryStore } = await import('./helpers/memory-inventory-store.js');
  const store = createMemoryInventoryStore({
    categories: [{ name: 'Cámaras' }],
    equipment: [{ categoryId: 1, name: 'Cámara A' }],
    units: [
      { equipmentId: 1, inventoryCode: 'CAM-010' },
      { equipmentId: 1, inventoryCode: 'CAM-011', active: false },
    ],
  });
  const inventory = createInventory({ store });

  const active = await inventory.listActiveUnits({ equipmentId: 1 });
  assert.deepEqual(active.map(({ inventoryCode }) => inventoryCode), ['CAM-010']);

  assert.equal((await inventory.findActiveUnit(1)).id, 1);
  assert.equal(await inventory.findActiveUnit(2), null);
  assert.equal((await inventory.lockActiveUnit(null, 1)).inventoryCode, 'CAM-010');
  assert.equal(await inventory.lockActiveUnit(null, 2), null);

  await assert.rejects(() => inventory.listActiveUnits({ equipmentId: 99 }), { status: 404 });
  await assert.rejects(() => inventory.findActiveUnit('cero'), { status: 400 });
});
