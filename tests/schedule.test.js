import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialSchedule, localDateTime, minimumScheduleTime, hourInPeriod, clockTime } from '../src/frontend/reservation-schedule.js';

test('el horario mínimo comienza en el siguiente minuto, incluso en el segundo cero', () => {
  for (const seconds of [0, 37, 59]) {
    const now = new Date(2035, 5, 10, 10, 38, seconds);
    assert.equal(localDateTime(minimumScheduleTime(now)), '2035-06-10T10:39');
  }
});

test('el siguiente minuto cruza correctamente de día, mes y año', () => {
  assert.equal(localDateTime(minimumScheduleTime(new Date(2035, 11, 31, 23, 59, 59))), '2036-01-01T00:00');
});

test('la devolución mínima es posterior a la recogida, incluso si termina en otro día', () => {
  const now = new Date(2035, 5, 10, 10, 38);
  const start = new Date(2035, 5, 11, 23, 59);
  assert.equal(localDateTime(minimumScheduleTime(now, start)), '2035-06-12T00:00');
});

test('un enlace con fechas pasadas se abre con un intervalo futuro válido', () => {
  const now = new Date(2035, 5, 10, 10, 38, 42);
  const requested = new URLSearchParams({ start: new Date(2035, 5, 9, 10).toISOString(), end: new Date(2035, 5, 9, 11).toISOString() });
  const result = initialSchedule(requested, now);
  assert.equal(localDateTime(result.start), '2035-06-10T10:39');
  assert.equal(result.end - result.start, 3_600_000);
});

test('conserva el horario futuro del enlace de acceso y repara un fin anterior al inicio', () => {
  const now = new Date(2035, 5, 10, 10, 38);
  const start = new Date(2035, 5, 11, 16, 25);
  const end = new Date(2035, 5, 11, 18, 40);
  const requested = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  assert.deepEqual(initialSchedule(requested, now), { start, end });
  requested.set('end', new Date(2035, 5, 11, 15).toISOString());
  const repaired = initialSchedule(requested, now);
  assert.equal(repaired.end - repaired.start, 3_600_000);
});

test('un enlace con fechas ausentes o inválidas recibe valores seguros', () => {
  const now = new Date(2035, 5, 10, 10, 38, 50);
  for (const requested of [new URLSearchParams(), new URLSearchParams({ start: 'fecha inválida', end: 'otra' })]) {
    const result = initialSchedule(requested, now);
    assert.ok(result.start > now);
    assert.equal(result.end - result.start, 3_600_000);
  }
});


test('AM/PM distingue medianoche, mediodía y las horas de ambos periodos', () => {
  assert.equal(hourInPeriod(12, 'AM'), 0);
  assert.equal(hourInPeriod(12, 'PM'), 12);
  assert.equal(hourInPeriod(1, 'AM'), 1);
  assert.equal(hourInPeriod(1, 'PM'), 13);
  assert.equal(clockTime(new Date(2035, 5, 10, 0, 5)), '12:05 AM');
  assert.equal(clockTime(new Date(2035, 5, 10, 12, 5)), '12:05 PM');
  for (let hour = 0; hour < 24; hour++) {
    const [time, period] = clockTime(new Date(2035, 5, 10, hour, 39)).split(' ');
    assert.equal(hourInPeriod(Number(time.split(':')[0]), period), hour);
  }
});
