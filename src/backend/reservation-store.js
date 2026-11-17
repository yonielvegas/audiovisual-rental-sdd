import { conflict, invalidRequest } from './http.js';

function translate(error) {
  if (error.code === '23P01' && error.constraint === 'reservations_no_overlap') {
    return conflict('reservation_overlap', 'La unidad ya está reservada en ese horario. Consulta la disponibilidad de nuevo.');
  }
  return error;
}

const select = `
  SELECT r.id, r.starts_at, r.ends_at, r.status, r.created_at, r.cancelled_at,
         u.id AS unit_id, u.inventory_code, u.active,
         e.id AS equipment_id, e.name AS equipment_name,
         c.id AS category_id, c.name AS category_name
    FROM audiovisual.reservations r
    JOIN audiovisual.units u ON u.id = r.unit_id
    JOIN audiovisual.equipment e ON e.id = u.equipment_id
    JOIN audiovisual.categories c ON c.id = e.category_id
`;

function view(row) {
  return {
    id: row.id, start: row.starts_at.toISOString(), end: row.ends_at.toISOString(),
    status: row.status, createdAt: row.created_at.toISOString(),
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    unit: {
      id: row.unit_id, inventoryCode: row.inventory_code, active: row.active,
      equipment: { id: row.equipment_id, name: row.equipment_name, category: { id: row.category_id, name: row.category_name } },
    },
  };
}

export function createReservationStore({ pool }) {
  async function find(client, id, userId) {
    const result = await client.query(`${select} WHERE r.id = $1 AND r.user_id = $2`, [id, userId]);
    return result.rows.length ? view(result.rows[0]) : null;
  }

  async function transaction(work) {
    // Dos inserciones GiST simultáneas pueden formar un interbloqueo en vez
    // de devolver 23P01. Reintentar TODA la transacción, ya revertida, permite
    // que la exclusión decida de nuevo contra la ganadora confirmada. `work`
    // solo realiza operaciones en la base, sin efectos externos repetibles.
    for (let attempt = 0; ; attempt++) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code !== '40P01' || attempt >= 2) throw translate(error);
      } finally {
        client.release();
      }
    }
  }

  return {
    transaction,

    async conflictingUnitIds({ unitIds, start, end }) {
      const result = await pool.query(
        `SELECT DISTINCT unit_id FROM audiovisual.reservations
          WHERE unit_id = ANY($1::int[]) AND status = 'confirmed'
            AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
        [unitIds, start, end],
      );
      return result.rows.map(({ unit_id }) => unit_id);
    },

    async insert(client, { userId, unitId, start, end }) {
      // Revalidar con el reloj de la base después de esperar el bloqueo de la
      // unidad: una solicitud no puede reservar un inicio que ya pasó al esperar.
      const result = await client.query(
        `INSERT INTO audiovisual.reservations (user_id, unit_id, starts_at, ends_at)
         SELECT $1, $2, $3::timestamptz, $4::timestamptz
          WHERE $3::timestamptz > clock_timestamp() RETURNING id`,
        [userId, unitId, start, end],
      );
      if (!result.rows.length) throw invalidRequest('La reserva debe comenzar en el futuro.', 'start_not_future');
      return find(client, result.rows[0].id, userId);
    },

    async listOwn(userId) {
      const result = await pool.query(`${select} WHERE r.user_id = $1 ORDER BY r.starts_at DESC, r.id DESC`, [userId]);
      return result.rows.map(view);
    },

    cancelOwn({ userId, id }) {
      return transaction(async (client) => {
        const locked = await client.query(
          'SELECT id FROM audiovisual.reservations WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId],
        );
        if (!locked.rows.length) return null;
        // Comprobar el reloj DESPUÉS de adquirir el bloqueo: puede haber
        // comenzado el alquiler mientras esta petición esperaba otra escritura.
        const result = await client.query(
          `UPDATE audiovisual.reservations SET status = 'cancelled', cancelled_at = clock_timestamp()
            WHERE id = $1 AND status = 'confirmed' AND starts_at > clock_timestamp() RETURNING id`, [id],
        );
        if (!result.rows.length) {
          throw conflict('reservation_not_cancellable', 'Solo puedes cancelar una reserva confirmada antes de su inicio.');
        }
        return find(client, id, userId);
      });
    },
  };
}
