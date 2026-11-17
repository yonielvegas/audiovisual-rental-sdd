import { conflict, invalidRequest } from '../../src/backend/http.js';

// Doble para reglas HTTP. La garantía concurrente se prueba exclusivamente
// contra PostgreSQL real en reservations.postgres.test.js.
export function createMemoryReservationStore({ inventoryStore, now = Date.now }) {
  const rows = [];
  const overlaps = (row, start, end) => row.status === 'confirmed' && row.start < end && row.end > start;
  const view = async ({ userId: _owner, unitId, ...row }) => ({ ...row, unit: await inventoryStore.findUnit(unitId) });
  return {
    transaction: (work) => work(null),
    async conflictingUnitIds({ unitIds, start, end }) {
      return rows.filter((row) => unitIds.includes(row.unitId) && overlaps(row, start, end)).map((row) => row.unitId);
    },
    async insert(_client, input) {
      if (Date.parse(input.start) <= now()) throw invalidRequest('El inicio debe ser futuro.', 'start_not_future');
      if (rows.some((row) => row.unitId === input.unitId && overlaps(row, input.start, input.end))) {
        throw conflict('reservation_overlap', 'La unidad ya está reservada.');
      }
      const row = { ...input, id: rows.length + 1, status: 'confirmed', createdAt: new Date(now()).toISOString(), cancelledAt: null };
      rows.push(row);
      return view(row);
    },
    async listOwn(userId) {
      return Promise.all(rows.filter((row) => row.userId === userId).sort((a, b) => b.start.localeCompare(a.start) || b.id - a.id).map(view));
    },
    async cancelOwn({ userId, id }) {
      const row = rows.find((item) => item.id === id && item.userId === userId);
      if (!row) return null;
      if (row.status !== 'confirmed' || Date.parse(row.start) <= now()) {
        throw conflict('reservation_not_cancellable', 'La reserva ya no se puede cancelar.');
      }
      row.status = 'cancelled';
      row.cancelledAt = new Date(now()).toISOString();
      return view(row);
    },
  };
}
