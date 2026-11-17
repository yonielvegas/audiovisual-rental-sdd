import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseInstant, parseInterval } from '../src/backend/reservations.js';
import { catalogSeed, startApp } from './helpers/server.js';

const start = '2035-04-10T15:00:00.000Z';
const end = '2035-04-10T16:00:00.000Z';
const booking = { unitId: 1, start, end };
const availability = (input = {}) => `/api/availability?${new URLSearchParams({ equipmentId: 1, start, end, ...input })}`;

test('normaliza desplazamientos y fechas bisiestas sin perder milisegundos', () => {
  assert.equal(parseInstant('2035-04-10T10:00:00-05:00'), start);
  assert.equal(parseInstant('2035-04-10t17:00:00.001+02:00'), '2035-04-10T15:00:00.001Z');
  assert.equal(parseInstant('2036-02-29T00:00:00z'), '2036-02-29T00:00:00.000Z');
  assert.deepEqual(parseInterval({ start: '2035-04-10T10:00:00-05:00', end }), { start, end });
});

for (const value of [null, 123, '', '2035-04-10', '2035-04-10T15:00:00', '2035-02-29T10:00:00Z',
  '2036-02-30T10:00:00Z', '2035-13-01T00:00:00Z', '2035-04-10T24:00:00Z', '2035-04-10T15:00:60Z',
  '2035-04-10T15:00:00-00:00', '2035-04-10T15:00:00+24:00', '2035-04-10T15:00:00+01:60',
  '2035-04-10T15:00:00.0001Z', '0000-01-01T00:00:00Z']) {
  test(`rechaza el instante inválido ${JSON.stringify(value)}`, () => {
    assert.throws(() => parseInstant(value), { status: 400, code: 'invalid_interval' });
  });
}

test('rechaza intervalos iguales o invertidos después de normalizar la zona', () => {
  assert.throws(() => parseInterval({ start, end: '2035-04-10T10:00:00-05:00' }), { code: 'invalid_interval' });
  assert.throws(() => parseInterval({ start: end, end: start }), { code: 'invalid_interval' });
});

test('AC-04: descuenta reservas y unidades retiradas; admite horarios contiguos', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });
  const member = await client.as('member');
  assert.equal((await member.post('/api/reservations', { body: booking })).status, 201);
  assert.deepEqual((await client.get(availability())).body.units.map((unit) => unit.id), [2]);
  assert.equal((await client.get(availability({ start: end, end: '2035-04-10T17:00:00Z' }))).body.units.length, 2);
  assert.equal((await client.get(availability({ equipmentId: 3 }))).body.units.length, 0);
  assert.equal((await client.get(availability({ equipmentId: 999 }))).status, 404);
  assert.equal((await client.get(availability({ end: start }))).status, 400);
});

test('exige sesión antes de leer el cuerpo y protege la página de reservas', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });
  assert.equal((await client.post('/api/reservations', { body: 'JSON roto', contentType: 'text/plain' })).status, 401);
  assert.equal((await client.get('/api/reservations')).status, 401);
  assert.equal((await client.patch('/api/reservations/1', { body: {} })).status, 401);
  const page = await client.get('/reservas');
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('location'), '/acceso?siguiente=%2Freservas');
  assert.equal((await client.get('/disponibilidad')).status, 200);
  const member = await client.as('member');
  assert.equal((await member.get('/reservas')).status, 200);
});

test('AC-05: rechaza solapamientos, permite otra unidad y usa el titular de la sesión', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });
  const member = await client.as('member');
  const admin = await client.as('admin');
  const created = await member.post('/api/reservations', { body: { ...booking, userId: 1, status: 'cancelled' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.reservation.status, 'confirmed');
  const conflict = await admin.post('/api/reservations', { body: booking });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'reservation_overlap');
  assert.equal((await admin.post('/api/reservations', { body: { ...booking, unitId: 2 } })).status, 201);
  assert.equal((await member.get('/api/reservations')).body.reservations.length, 1);
  assert.equal((await admin.get('/api/reservations')).body.reservations.length, 1);
});

test('AC-07: oculta reservas ajenas, conserva la cancelación y libera el intervalo', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });
  const member = await client.as('member');
  const admin = await client.as('admin');
  const { body: { reservation } } = await member.post('/api/reservations', { body: booking });
  assert.deepEqual((await admin.get('/api/reservations')).body.reservations, []);
  assert.equal((await admin.patch(`/api/reservations/${reservation.id}`, { body: { status: 'cancelled' } })).status, 404);
  assert.equal((await member.patch(`/api/reservations/${reservation.id}`, { body: { status: 'confirmed' } })).status, 400);
  const cancelled = await member.patch(`/api/reservations/${reservation.id}`, { body: { status: 'cancelled' } });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.reservation.status, 'cancelled');
  assert.ok(cancelled.body.reservation.cancelledAt);
  assert.equal((await member.get('/api/reservations')).body.reservations.length, 1);
  assert.equal((await client.get(availability())).body.units.length, 2);
  assert.equal((await member.patch(`/api/reservations/${reservation.id}`, { body: { status: 'cancelled' } })).status, 409);
  assert.equal((await admin.post('/api/reservations', { body: booking })).status, 201);
});

test('aplica inicio futuro y cancelación estrictamente anterior al inicio, sin plazo mínimo', async (context) => {
  let clock = Date.parse(start) - 1;
  const client = await startApp(context, { seed: catalogSeed, now: () => new Date(clock) });
  const member = await client.as('member');
  const created = await member.post('/api/reservations', { body: booking });
  assert.equal(created.status, 201);
  assert.equal((await member.patch(`/api/reservations/${created.body.reservation.id}`, { body: { status: 'cancelled' } })).status, 200);
  const second = await member.post('/api/reservations', { body: booking });
  clock++;
  assert.equal((await member.patch(`/api/reservations/${second.body.reservation.id}`, { body: { status: 'cancelled' } })).status, 409);
  const past = await member.post('/api/reservations', { body: { ...booking, unitId: 2 } });
  assert.equal(past.status, 400);
  assert.equal(past.body.error.code, 'start_not_future');
});

test('mantiene el contrato de inventario para unidades retiradas y equipos despublicados', async (context) => {
  const client = await startApp(context, { seed: catalogSeed });
  const admin = await client.as('admin');
  const member = await client.as('member');
  await admin.patch('/api/equipment/1', { body: { published: false } });
  assert.equal((await member.post('/api/reservations', { body: booking })).status, 201);
  await admin.patch('/api/units/2', { body: { active: false } });
  assert.equal((await member.post('/api/reservations', { body: { ...booking, unitId: 2 } })).status, 409);
  assert.equal((await member.post('/api/reservations', { body: { ...booking, unitId: 999 } })).status, 409);
});
