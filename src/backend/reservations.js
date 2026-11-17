import { conflict, invalidRequest, notFound } from './http.js';
import { parseIdentifier } from './inventory.js';

const instantPattern = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?([Zz]|[+-]\d{2}:\d{2})$/;

// Date.parse acepta fechas como el 30 de febrero. Validamos primero el
// calendario local y la zona, sin redondear precisión que cambie solapamientos.
export function parseInstant(value) {
  const match = typeof value === 'string' ? instantPattern.exec(value) : null;
  if (!match) throw invalidRequest('Usa una fecha RFC 3339 con zona horaria y hasta tres decimales.', 'invalid_interval');
  const [, year, month, day, hour, minute, second, fraction = '', zone] = match;
  const calendar = `${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}Z`;
  const local = new Date(calendar);
  const offsetValid = /^[Zz]$/.test(zone)
    || (zone !== '-00:00' && Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4)) <= 59);
  const valid = Number(year) >= 1 && local.getUTCFullYear() === Number(year)
    && local.getUTCMonth() + 1 === Number(month) && local.getUTCDate() === Number(day)
    && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60 && offsetValid;
  const instant = new Date(`${calendar.slice(0, -1)}${zone.toUpperCase()}`);
  if (!valid || !Number.isFinite(instant.getTime()) || instant.getUTCFullYear() < 1 || instant.getUTCFullYear() > 9999) {
    throw invalidRequest('La fecha o su zona horaria no son válidas.', 'invalid_interval');
  }
  return instant.toISOString();
}

export function parseInterval({ start, end }) {
  const interval = { start: parseInstant(start), end: parseInstant(end) };
  if (interval.start >= interval.end) {
    throw invalidRequest('El inicio debe ser anterior al fin.', 'invalid_interval');
  }
  return interval;
}

export function createReservations({ store, inventory, now = Date.now }) {
  return {
    async availability(input) {
      const equipmentId = parseIdentifier(input.equipmentId, 'El identificador del equipo');
      const interval = parseInterval(input);
      const candidates = await inventory.listActiveUnits({ equipmentId });
      const busy = new Set(await store.conflictingUnitIds({ unitIds: candidates.map(({ id }) => id), ...interval }));
      return { equipmentId, ...interval, units: candidates.filter(({ id }) => !busy.has(id)) };
    },

    async create(userId, body) {
      const unitId = parseIdentifier(body.unitId, 'El identificador de la unidad');
      const interval = parseInterval(body);
      if (Date.parse(interval.start) <= now()) {
        throw invalidRequest('La reserva debe comenzar en el futuro.', 'start_not_future');
      }
      return store.transaction(async (client) => {
        const unit = await inventory.lockActiveUnit(client, unitId);
        if (!unit) throw conflict('unit_unavailable', 'La unidad no está en servicio. Consulta otra unidad.');
        return store.insert(client, { userId, unitId, ...interval });
      });
    },

    listOwn(userId) {
      return store.listOwn(userId);
    },

    async cancelOwn(userId, id, body) {
      const identifier = parseIdentifier(id, 'El identificador de la reserva');
      if (body.status !== 'cancelled' || Object.keys(body).some((key) => key !== 'status')) {
        throw invalidRequest('Solo se permite cambiar el estado a cancelled.');
      }
      const reservation = await store.cancelOwn({ userId, id: identifier });
      if (!reservation) throw notFound('La reserva indicada no existe.');
      return reservation;
    },
  };
}
