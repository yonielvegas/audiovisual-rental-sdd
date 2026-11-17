import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/backend/app.js';
import { createAccounts } from '../src/backend/accounts.js';
import { createAccountStore } from '../src/backend/account-store.js';
import { createSessionActorResolver } from '../src/backend/access.js';
import { createInventory } from '../src/backend/inventory.js';
import { createInventoryStore } from '../src/backend/inventory-store.js';
import { hashPassword } from '../src/backend/passwords.js';
import { createReservations } from '../src/backend/reservations.js';
import { createReservationStore } from '../src/backend/reservation-store.js';
import { createLoginThrottle } from '../src/backend/throttle.js';

if (process.env.RESERVATION_TEST_DATABASE !== '1') {
  throw new Error('Usa una base migrada de pruebas y habilita RESERVATION_TEST_DATABASE=1. Esta suite inserta y limpia sus propias fixtures.');
}

function barrier(participants) {
  let arrived = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  return async () => {
    if (++arrived === participants) release();
    await Promise.race([ready, delay(5000, undefined, { ref: false }).then(() => { throw new Error('No llegaron ambas transacciones al bloqueo compartido.'); })]);
  };
}

test('RF-04 a RF-06 contra PostgreSQL real y dos instancias HTTP', { timeout: 60_000 }, async (context) => {
  const marker = randomUUID().replaceAll('-', '').slice(0, 12);
  const appNames = [`reservas-a-${marker}`, `reservas-b-${marker}`];
  const pool = new pg.Pool({ application_name: appNames[0], connectionTimeoutMillis: 3000 });
  const otherPool = new pg.Pool({ application_name: appNames[1], connectionTimeoutMillis: 3000 });
  const inventory = createInventory({ store: createInventoryStore({ pool }) });
  const store = createReservationStore({ pool });
  const accountStore = createAccountStore({ pool });
  const users = [];
  const servers = [];
  let category;
  let equipment;
  let rendezvous = null;

  context.after(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
    try {
      if (equipment) {
        await pool.query('DELETE FROM audiovisual.reservations WHERE unit_id IN (SELECT id FROM audiovisual.units WHERE equipment_id = $1)', [equipment.id]);
        await pool.query('DELETE FROM audiovisual.units WHERE equipment_id = $1', [equipment.id]);
        await pool.query('DELETE FROM audiovisual.equipment WHERE id = $1', [equipment.id]);
      }
      if (category) await pool.query('DELETE FROM audiovisual.categories WHERE id = $1', [category.id]);
      await pool.query('DELETE FROM audiovisual.users WHERE id = ANY($1::int[])', [users.map((user) => user.id)]);
    } finally {
      await Promise.all([pool.end(), otherPool.end()]);
    }
  });

  category = await inventory.createCategory({ name: `Prueba reservas ${marker}` });
  equipment = await inventory.createEquipment({ categoryId: category.id, name: `Cámara ${marker}` });
  const units = [];
  for (let n = 0; n < 3; n++) {
    units.push(await inventory.createUnit({ equipmentId: equipment.id, inventoryCode: `R-${marker}-${n}`, active: n < 2 }));
  }
  const password = `prueba-${randomUUID()}`;
  const passwordHash = await hashPassword(password);
  for (const role of ['USER', 'ADMIN']) {
    users.push(await accountStore.createUser({ username: `res-${marker}-${role.toLowerCase()}`, passwordHash, email: null, role }));
  }

  async function backend(databasePool) {
    const accounts = createAccounts({ store: createAccountStore({ pool: databasePool }), throttle: createLoginThrottle() });
    const realInventory = createInventory({ store: createInventoryStore({ pool: databasePool }) });
    const reservableInventory = {
      ...realInventory,
      async lockActiveUnit(client, id) {
        const unit = await realInventory.lockActiveUnit(client, id);
        if (rendezvous) await rendezvous();
        return unit;
      },
    };
    const server = await createApp({
      checkDatabase: () => databasePool.query('SELECT 1'), inventory: realInventory, accounts,
      reservations: createReservations({ inventory: reservableInventory, store: createReservationStore({ pool: databasePool }) }),
      resolveActor: createSessionActorResolver({ accounts }),
    });
    server.listen(0, '127.0.0.1');
    servers.push(server);
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    return async (method, path, body, cookie) => {
      const response = await fetch(`${base}${path}`, {
        method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual',
      });
      return {
        status: response.status, body: await response.json(),
        cookie: response.headers.get('set-cookie')?.split(';')[0],
      };
    };
  }

  const [a, b] = await Promise.all([backend(pool), backend(otherPool)]);
  const login = async (request, user) => {
    const response = await request('POST', '/api/sessions', { username: user.username, password });
    assert.equal(response.status, 200);
    return response.cookie;
  };
  const [cookieA, cookieB] = await Promise.all([login(a, users[0]), login(b, users[1])]);
  const create = (request, cookie, interval, unitId = units[0].id) => request('POST', '/api/reservations', { unitId, ...interval }, cookie);
  const cancel = (request, cookie, id) => request('PATCH', `/api/reservations/${id}`, { status: 'cancelled' }, cookie);
  const slot = (n) => {
    const at = Date.now() + (7 + n) * 86_400_000;
    return { start: new Date(at).toISOString(), end: new Date(at + 3_600_000).toISOString() };
  };
  const availability = (interval) => a('GET', `/api/availability?${new URLSearchParams({ equipmentId: equipment.id, ...interval })}`);
  async function persisted(interval, count) {
    const result = await pool.query(
      `SELECT id FROM audiovisual.reservations WHERE unit_id = $1 AND status = 'confirmed'
        AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
      [units[0].id, interval.start, interval.end],
    );
    assert.equal(result.rowCount, count);
  }
  async function waitForLock(queryPart) {
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const result = await pool.query(
        `SELECT 1 FROM pg_stat_activity WHERE application_name = ANY($1::text[])
          AND wait_event_type = 'Lock' AND query LIKE $2`, [appNames, `%${queryPart}%`],
      );
      if (result.rowCount) return;
      await delay(20);
    }
    assert.fail(`No se observó espera de bloqueo en ${queryPart}`);
  }

  await context.test('AC-04/05: contrato real, doble reserva secuencial y estado persistido', async () => {
    const interval = slot(0);
    assert.deepEqual((await availability(interval)).body.units.map(({ id }) => id), units.slice(0, 2).map(({ id }) => id));
    assert.equal((await create(a, cookieA, interval)).status, 201);
    assert.equal((await create(b, cookieB, interval)).status, 409);
    await persisted(interval, 1);
    assert.deepEqual((await availability(interval)).body.units.map(({ id }) => id), [units[1].id]);
    assert.equal((await create(b, cookieB, interval, units[1].id)).status, 201);
    const adjacent = { start: interval.end, end: new Date(Date.parse(interval.end) + 3_600_000).toISOString() };
    assert.equal((await availability(adjacent)).body.units.length, 2);
    assert.equal((await create(b, cookieB, adjacent)).status, 201);
    assert.equal((await availability({ start: interval.end, end: interval.end })).status, 400);
  });

  await context.test('AC-06: ocho disputas reales; ambas transacciones alcanzan el bloqueo antes de insertar', async () => {
    for (let n = 1; n <= 8; n++) {
      const interval = slot(n);
      rendezvous = barrier(2);
      let responses;
      try {
        const shifted = n % 2 ? interval : { ...interval, start: new Date(Date.parse(interval.start) + 1000).toISOString() };
        responses = await Promise.all([create(a, cookieA, interval), create(b, cookieB, shifted)]);
      } finally {
        rendezvous = null;
      }
      assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
      assert.equal(responses.find(({ status }) => status === 409).body.error.code, 'reservation_overlap');
      await persisted(interval, 1);
    }
  });

  await context.test('la exclusión SQL espera una transacción sin confirmar y rechaza al competidor directo', async () => {
    const interval = slot(10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sql = 'INSERT INTO audiovisual.reservations (user_id, unit_id, starts_at, ends_at) VALUES ($1, $2, $3, $4)';
      const params = [users[0].id, units[0].id, interval.start, interval.end];
      await client.query(sql, params);
      const competing = otherPool.query(sql, [users[1].id, ...params.slice(1)]);
      const rejected = assert.rejects(competing, { code: '23P01', constraint: 'reservations_no_overlap' });
      await waitForLock('INSERT INTO audiovisual.reservations');
      await client.query('COMMIT');
      await rejected;
      await persisted(interval, 1);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  await context.test('AC-07: aislamiento del titular, cancelación persistida, reuso y conflicto al repetir', async () => {
    const interval = slot(11);
    const created = await create(a, cookieA, interval);
    const id = created.body.reservation.id;
    const own = await b('GET', '/api/reservations', null, cookieB);
    assert.ok(own.body.reservations.every((reservation) => reservation.id !== id));
    assert.equal((await cancel(b, cookieB, id)).status, 404);
    const responses = await Promise.all([cancel(a, cookieA, id), cancel(a, cookieA, id)]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
    const result = await pool.query('SELECT status, cancelled_at FROM audiovisual.reservations WHERE id = $1', [id]);
    assert.equal(result.rows[0].status, 'cancelled');
    assert.ok(result.rows[0].cancelled_at instanceof Date);
    await persisted(interval, 0);
    assert.equal((await availability(interval)).body.units.length, 2);
    assert.equal((await create(b, cookieB, interval)).status, 201);
  });

  await context.test('política de futuro, cancelación sin 24 horas y rechazo tras el inicio', async () => {
    const near = { start: new Date(Date.now() + 60_000).toISOString(), end: new Date(Date.now() + 120_000).toISOString() };
    const created = await create(a, cookieA, near);
    assert.equal(created.status, 201);
    assert.equal((await cancel(a, cookieA, created.body.reservation.id)).status, 200);
    const past = { start: new Date(Date.now() - 60_000).toISOString(), end: new Date(Date.now() + 60_000).toISOString() };
    assert.equal((await create(a, cookieA, past)).body.error.code, 'start_not_future');
    const result = await pool.query(
      'INSERT INTO audiovisual.reservations (user_id, unit_id, starts_at, ends_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [users[0].id, units[0].id, past.start, past.end],
    );
    assert.equal((await cancel(a, cookieA, result.rows[0].id)).status, 409);
    await persisted(past, 1);
  });

  await context.test('inventario: una desactivación sin confirmar bloquea y luego impide la reserva', async () => {
    const interval = slot(12);
    const client = await pool.connect();
    let response;
    try {
      await client.query('BEGIN');
      await client.query('UPDATE audiovisual.units SET active = false WHERE id = $1', [units[0].id]);
      response = create(b, cookieB, interval);
      await waitForLock('FOR SHARE OF u');
      await client.query('COMMIT');
      assert.equal((await response).status, 409);
      await persisted(interval, 0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await response;
      await inventory.updateUnit(units[0].id, { active: true });
    }
  });

  await context.test('inventario: el bloqueo de reserva retiene la unidad; retirar conserva el historial', async () => {
    const interval = slot(13);
    const client = await pool.connect();
    let updating;
    try {
      await client.query('BEGIN');
      assert.ok(await inventory.lockActiveUnit(client, units[0].id));
      const reservation = await store.insert(client, { userId: users[0].id, unitId: units[0].id, ...interval });
      updating = inventory.updateUnit(units[0].id, { active: false });
      await waitForLock('FOR UPDATE');
      await client.query('COMMIT');
      await updating;
      await persisted(interval, 1);
      const own = await a('GET', '/api/reservations', null, cookieA);
      assert.equal(own.body.reservations.find(({ id }) => id === reservation.id).unit.active, false);
      assert.equal((await cancel(a, cookieA, reservation.id)).status, 200);
      assert.deepEqual((await availability(interval)).body.units.map(({ id }) => id), [units[1].id]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await updating;
      await inventory.updateUnit(units[0].id, { active: true });
    }
  });

  await context.test('respeta unidades activas de equipos despublicados y rechaza retiradas', async () => {
    const interval = slot(14);
    await inventory.updateEquipment(equipment.id, { published: false });
    assert.equal((await availability(interval)).body.units.length, 2);
    assert.equal((await create(a, cookieA, interval)).status, 201);
    assert.equal((await create(a, cookieA, interval, units[2].id)).body.error.code, 'unit_unavailable');
    await persisted(interval, 1);
  });

  await context.test('revalida el plazo de cancelación después de esperar un bloqueo de fila', async () => {
    const result = await pool.query(
      `INSERT INTO audiovisual.reservations (user_id, unit_id, starts_at, ends_at)
       VALUES ($1, $2, clock_timestamp() + interval '1 second', clock_timestamp() + interval '1 hour') RETURNING id`,
      [users[0].id, units[1].id],
    );
    const id = result.rows[0].id;
    const client = await pool.connect();
    let cancelling;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM audiovisual.reservations WHERE id = $1 FOR UPDATE', [id]);
      cancelling = cancel(b, cookieA, id);
      await waitForLock('FOR UPDATE');
      await client.query('SELECT pg_sleep(1.1)');
      await client.query('COMMIT');
      assert.equal((await cancelling).status, 409);
      assert.equal((await pool.query('SELECT status FROM audiovisual.reservations WHERE id = $1', [id])).rows[0].status, 'confirmed');
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await cancelling;
    }
  });

  await context.test('revalida el inicio futuro después de esperar la unidad física', async () => {
    const interval = { start: new Date(Date.now() + 1000).toISOString(), end: new Date(Date.now() + 7200_000).toISOString() };
    const client = await pool.connect();
    let creating;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM audiovisual.units WHERE id = $1 FOR UPDATE', [units[0].id]);
      creating = create(b, cookieB, interval);
      await waitForLock('FOR SHARE OF u');
      await client.query('SELECT pg_sleep(1.1)');
      await client.query('COMMIT');
      assert.equal((await creating).body.error.code, 'start_not_future');
      const saved = await pool.query(
        'SELECT id FROM audiovisual.reservations WHERE unit_id = $1 AND starts_at = $2 AND ends_at = $3',
        [units[0].id, interval.start, interval.end],
      );
      assert.equal(saved.rowCount, 0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await creating;
    }
  });

  await context.test('la base no contiene ninguna pareja confirmada superpuesta en las fixtures', async () => {
    const result = await pool.query(
      `SELECT a.id FROM audiovisual.reservations a JOIN audiovisual.reservations b
         ON a.unit_id = b.unit_id AND a.id < b.id
        AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
        WHERE a.status = 'confirmed' AND b.status = 'confirmed' AND a.unit_id = ANY($1::int[])`,
      [units.map(({ id }) => id)],
    );
    assert.equal(result.rowCount, 0);
  });
});
