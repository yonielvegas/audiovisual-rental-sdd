import { conflict } from '../../src/backend/http.js';

/**
 * Almacén de inventario en memoria con las mismas reglas de unicidad y el mismo
 * contrato de datos que `createInventoryStore`. Permite ejecutar las pruebas de
 * consultas y permisos sin PostgreSQL. La unicidad sobre la base real se
 * comprueba en `tests/smoke.mjs` contra la composición de Docker.
 */
export function createMemoryInventoryStore(seed = {}) {
  const categories = new Map();
  const equipment = new Map();
  const units = new Map();
  const next = { category: 1, equipment: 1, unit: 1 };

  const byName = (a, b) => a.name.localeCompare(b.name, 'es');

  const categoryView = (row) => ({
    id: row.id,
    name: row.name,
    equipmentCount: [...equipment.values()].filter((item) => item.categoryId === row.id).length,
  });

  const equipmentView = (row) => {
    const category = categories.get(row.categoryId);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: { id: category.id, name: category.name },
      activeUnits: [...units.values()].filter((unit) => unit.equipmentId === row.id && unit.active).length,
    };
  };

  const unitView = (row) => {
    const item = equipment.get(row.equipmentId);
    const category = categories.get(item.categoryId);
    return {
      id: row.id,
      inventoryCode: row.inventoryCode,
      active: row.active,
      equipment: { id: item.id, name: item.name, category: { id: category.id, name: category.name } },
    };
  };

  function insertCategory({ name }) {
    const taken = [...categories.values()].some((row) => row.name.toLowerCase() === name.toLowerCase());
    if (taken) throw conflict('category_name_taken', 'Ya existe una categoría con ese nombre.');
    const row = { id: next.category++, name };
    categories.set(row.id, row);
    return categoryView(row);
  }

  function insertEquipment({ categoryId, name, description }) {
    const taken = [...equipment.values()].some(
      (row) => row.categoryId === categoryId && row.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) throw conflict('equipment_name_taken', 'La categoría ya tiene un equipo con ese nombre.');
    const row = { id: next.equipment++, categoryId, name, description };
    equipment.set(row.id, row);
    return equipmentView(row);
  }

  function insertUnit({ equipmentId, inventoryCode, active }) {
    const taken = [...units.values()].some((row) => row.inventoryCode === inventoryCode);
    if (taken) throw conflict('inventory_code_taken', 'El código de inventario ya identifica a otra unidad.');
    const row = { id: next.unit++, equipmentId, inventoryCode, active };
    units.set(row.id, row);
    return unitView(row);
  }

  for (const category of seed.categories ?? []) insertCategory(category);
  for (const item of seed.equipment ?? []) insertEquipment({ description: '', ...item });
  for (const unit of seed.units ?? []) insertUnit({ active: true, ...unit });

  return {
    async listCategories() {
      return [...categories.values()].map(categoryView).sort(byName);
    },
    async findCategory(id) {
      const row = categories.get(id);
      return row ? categoryView(row) : null;
    },
    async createCategory(input) {
      return insertCategory(input);
    },
    async updateCategory(id, { name }) {
      const row = categories.get(id);
      if (!row) return null;
      const taken = [...categories.values()].some(
        (other) => other.id !== id && other.name.toLowerCase() === name.toLowerCase(),
      );
      if (taken) throw conflict('category_name_taken', 'Ya existe una categoría con ese nombre.');
      row.name = name;
      return categoryView(row);
    },

    async listEquipment({ categoryId = null } = {}) {
      return [...equipment.values()]
        .filter((row) => categoryId === null || row.categoryId === categoryId)
        .map(equipmentView)
        .sort((a, b) => a.category.name.localeCompare(b.category.name, 'es') || byName(a, b));
    },
    async findEquipment(id) {
      const row = equipment.get(id);
      return row ? equipmentView(row) : null;
    },
    async createEquipment(input) {
      return insertEquipment(input);
    },
    async updateEquipment(id, patch) {
      const row = equipment.get(id);
      if (!row) return null;
      const name = patch.name ?? row.name;
      const categoryId = patch.categoryId ?? row.categoryId;
      const taken = [...equipment.values()].some(
        (other) => other.id !== id && other.categoryId === categoryId && other.name.toLowerCase() === name.toLowerCase(),
      );
      if (taken) throw conflict('equipment_name_taken', 'La categoría ya tiene un equipo con ese nombre.');
      Object.assign(row, { name, categoryId, description: patch.description ?? row.description });
      return equipmentView(row);
    },

    async listUnits({ equipmentId = null, active = null } = {}) {
      return [...units.values()]
        .filter((row) => (equipmentId === null || row.equipmentId === equipmentId)
          && (active === null || row.active === active))
        .map(unitView)
        .sort((a, b) => a.inventoryCode.localeCompare(b.inventoryCode, 'es'));
    },
    async findUnit(id) {
      const row = units.get(id);
      return row ? unitView(row) : null;
    },
    async createUnit(input) {
      return insertUnit(input);
    },
    async updateUnit(id, patch) {
      const row = units.get(id);
      if (!row) return null;
      const inventoryCode = patch.inventoryCode ?? row.inventoryCode;
      const taken = [...units.values()].some((other) => other.id !== id && other.inventoryCode === inventoryCode);
      if (taken) throw conflict('inventory_code_taken', 'El código de inventario ya identifica a otra unidad.');
      Object.assign(row, { inventoryCode, active: patch.active ?? row.active });
      return unitView(row);
    },

    async lockActiveUnit(_client, id) {
      const row = units.get(id);
      return row && row.active ? unitView(row) : null;
    },
  };
}
