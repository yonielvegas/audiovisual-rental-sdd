import { conflict, invalidRequest } from './http.js';

const uniqueViolation = '23505';
const foreignKeyViolation = '23503';
const checkViolation = '23514';

const conflicts = new Map([
  ['categories_name_unique', () => conflict('category_name_taken', 'Ya existe una categoría con ese nombre.')],
  ['equipment_name_unique', () => conflict('equipment_name_taken', 'La categoría ya tiene un equipo con ese nombre.')],
  ['units_inventory_code_unique', () => conflict('inventory_code_taken', 'El código de inventario ya identifica a otra unidad.')],
]);

// La unicidad la decide PostgreSQL, no una comprobación previa en la
// aplicación, para que dos solicitudes simultáneas no puedan registrar el mismo
// código de inventario (RN-01).
// Una clave foránea puede fallar por dos motivos opuestos: la fila referenciada
// no existe al insertar, o todavía la referencian otras al borrar.
const inUse = new Map([
  ['equipment_category_id_fkey', () => conflict('category_in_use', 'La categoría todavía agrupa equipos. Muévelos o bórralos antes.')],
  ['units_equipment_id_fkey', () => conflict('equipment_in_use', 'El equipo todavía tiene unidades registradas. Bórralas antes.')],
]);

function translate(error) {
  if (error?.code === uniqueViolation && conflicts.has(error.constraint)) {
    return conflicts.get(error.constraint)();
  }
  if (error?.code === foreignKeyViolation && inUse.has(error.constraint)) {
    return inUse.get(error.constraint)();
  }
  if (error?.code === foreignKeyViolation) {
    return invalidRequest('La solicitud referencia un registro que no existe.', 'reference_not_found');
  }
  if (error?.code === checkViolation) {
    return invalidRequest('Los datos enviados no cumplen las restricciones del inventario.');
  }
  return error;
}

const categoryRow = (row) => ({ id: row.id, name: row.name, equipmentCount: row.equipment_count });

const equipmentRow = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: { id: row.category_id, name: row.category_name },
  activeUnits: row.active_units,
});

const unitRow = (row) => ({
  id: row.id,
  inventoryCode: row.inventory_code,
  active: row.active,
  equipment: {
    id: row.equipment_id,
    name: row.equipment_name,
    category: { id: row.category_id, name: row.category_name },
  },
});

const categorySelect = `
  SELECT c.id,
         c.name,
         (SELECT count(*) FROM audiovisual.equipment e WHERE e.category_id = c.id)::int AS equipment_count
  FROM audiovisual.categories c
`;

const equipmentSelect = `
  SELECT e.id,
         e.name,
         e.description,
         c.id AS category_id,
         c.name AS category_name,
         (SELECT count(*) FROM audiovisual.units u WHERE u.equipment_id = e.id AND u.active)::int AS active_units
  FROM audiovisual.equipment e
  JOIN audiovisual.categories c ON c.id = e.category_id
`;

const unitSelect = `
  SELECT u.id,
         u.inventory_code,
         u.active,
         e.id AS equipment_id,
         e.name AS equipment_name,
         c.id AS category_id,
         c.name AS category_name
  FROM audiovisual.units u
  JOIN audiovisual.equipment e ON e.id = u.equipment_id
  JOIN audiovisual.categories c ON c.id = e.category_id
`;

/**
 * Almacén de catálogo e inventario sobre PostgreSQL. Recibe un pool de `pg`
 * para poder abrir una transacción cuando una escritura debe coordinarse con
 * las reservas que se estén confirmando.
 */
export function createInventoryStore({ pool }) {
  async function run(text, values = []) {
    try {
      return await pool.query(text, values);
    } catch (error) {
      throw translate(error);
    }
  }

  async function transaction(work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw translate(error);
    } finally {
      client.release();
    }
  }

  async function findCategory(id) {
    const result = await run(`${categorySelect} WHERE c.id = $1`, [id]);
    return result.rows.length ? categoryRow(result.rows[0]) : null;
  }

  async function findEquipment(id) {
    const result = await run(`${equipmentSelect} WHERE e.id = $1`, [id]);
    return result.rows.length ? equipmentRow(result.rows[0]) : null;
  }

  async function findUnit(id) {
    const result = await run(`${unitSelect} WHERE u.id = $1`, [id]);
    return result.rows.length ? unitRow(result.rows[0]) : null;
  }

  return {
    findCategory,
    findEquipment,
    findUnit,

    async listCategories() {
      const result = await run(`${categorySelect} ORDER BY c.name`);
      return result.rows.map(categoryRow);
    },

    async createCategory({ name }) {
      const inserted = await run('INSERT INTO audiovisual.categories (name) VALUES ($1) RETURNING id', [name]);
      return findCategory(inserted.rows[0].id);
    },

    async updateCategory(id, { name }) {
      const updated = await run(
        'UPDATE audiovisual.categories SET name = $2, updated_at = now() WHERE id = $1 RETURNING id',
        [id, name],
      );
      return updated.rows.length ? findCategory(updated.rows[0].id) : null;
    },

    async deleteCategory(id) {
      const result = await run('DELETE FROM audiovisual.categories WHERE id = $1', [id]);
      return result.rowCount > 0;
    },

    async listEquipment({ categoryId = null } = {}) {
      const result = await run(
        `${equipmentSelect} WHERE ($1::int IS NULL OR e.category_id = $1) ORDER BY c.name, e.name`,
        [categoryId],
      );
      return result.rows.map(equipmentRow);
    },

    async createEquipment({ categoryId, name, description }) {
      const inserted = await run(
        'INSERT INTO audiovisual.equipment (category_id, name, description) VALUES ($1, $2, $3) RETURNING id',
        [categoryId, name, description],
      );
      return findEquipment(inserted.rows[0].id);
    },

    async updateEquipment(id, { categoryId, name, description }) {
      const updated = await run(
        `UPDATE audiovisual.equipment
            SET category_id = coalesce($2, category_id),
                name = coalesce($3, name),
                description = coalesce($4, description),
                updated_at = now()
          WHERE id = $1
          RETURNING id`,
        [id, categoryId ?? null, name ?? null, description ?? null],
      );
      return updated.rows.length ? findEquipment(updated.rows[0].id) : null;
    },

    async deleteEquipment(id) {
      const result = await run('DELETE FROM audiovisual.equipment WHERE id = $1', [id]);
      return result.rowCount > 0;
    },

    async listUnits({ equipmentId = null, active = null } = {}) {
      const result = await run(
        `${unitSelect}
          WHERE ($1::int IS NULL OR u.equipment_id = $1)
            AND ($2::boolean IS NULL OR u.active = $2)
          ORDER BY u.inventory_code`,
        [equipmentId, active],
      );
      return result.rows.map(unitRow);
    },

    async createUnit({ equipmentId, inventoryCode, active }) {
      const inserted = await run(
        'INSERT INTO audiovisual.units (equipment_id, inventory_code, active) VALUES ($1, $2, $3) RETURNING id',
        [equipmentId, inventoryCode, active],
      );
      return findUnit(inserted.rows[0].id);
    },

    // La actualización toma el bloqueo exclusivo de la unidad. Una reserva que
    // se esté confirmando mantiene el bloqueo compartido de `lockActiveUnit`,
    // así que la desactivación espera a que esa transacción termine.
    updateUnit(id, { inventoryCode, active }) {
      return transaction(async (client) => {
        const locked = await client.query('SELECT id FROM audiovisual.units WHERE id = $1 FOR UPDATE', [id]);
        if (locked.rows.length === 0) return null;

        await client.query(
          `UPDATE audiovisual.units
              SET inventory_code = coalesce($2, inventory_code),
                  active = coalesce($3, active),
                  updated_at = now()
            WHERE id = $1`,
          [id, inventoryCode ?? null, active ?? null],
        );
        const result = await client.query(`${unitSelect} WHERE u.id = $1`, [id]);
        return unitRow(result.rows[0]);
      });
    },

    // Contrato para Reservas: devuelve la unidad activa y la retiene con un
    // bloqueo compartido dentro de la transacción de quien llama.
    async lockActiveUnit(client, id) {
      try {
        const result = await client.query(`${unitSelect} WHERE u.id = $1 AND u.active FOR SHARE OF u`, [id]);
        return result.rows.length ? unitRow(result.rows[0]) : null;
      } catch (error) {
        throw translate(error);
      }
    },
  };
}
