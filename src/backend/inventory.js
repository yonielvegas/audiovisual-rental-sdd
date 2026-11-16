import { invalidRequest, notFound } from './http.js';

export const limits = {
  categoryName: 80,
  equipmentName: 120,
  equipmentDescription: 600,
  inventoryCode: 24,
};

// RN-01. El código identifica la etiqueta física de la unidad. Se acepta en
// mayúsculas, dígitos y guiones para que sea legible sobre el equipo.
export const inventoryCodePattern = /^[A-Z0-9][A-Z0-9-]{2,23}$/;
const identifierPattern = /^[1-9][0-9]{0,8}$/;

function requireText(value, label, maximum) {
  if (typeof value !== 'string') {
    throw invalidRequest(`${label} debe enviarse como texto.`);
  }
  const text = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (!text) {
    throw invalidRequest(`${label} es obligatorio.`);
  }
  if (text.length > maximum) {
    throw invalidRequest(`${label} admite hasta ${maximum} caracteres.`);
  }
  return text;
}

function optionalDescription(value) {
  if (typeof value !== 'string') {
    throw invalidRequest('La descripción debe enviarse como texto.');
  }
  const text = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (text.length > limits.equipmentDescription) {
    throw invalidRequest(`La descripción admite hasta ${limits.equipmentDescription} caracteres.`);
  }
  return text;
}

function requireInventoryCode(value) {
  if (typeof value !== 'string') {
    throw invalidRequest('El código de inventario debe enviarse como texto.');
  }
  const code = value.normalize('NFC').trim().toUpperCase();
  if (!inventoryCodePattern.test(code)) {
    throw invalidRequest(
      'El código de inventario usa de 3 a 24 caracteres entre letras, dígitos y guiones, y empieza por una letra o un dígito.',
      'invalid_inventory_code',
    );
  }
  return code;
}

export function parseIdentifier(value, label) {
  const text = typeof value === 'number' && Number.isInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || !identifierPattern.test(text)) {
    throw invalidRequest(`${label} debe ser un identificador entero positivo.`);
  }
  return Number(text);
}

function requireActive(value) {
  if (typeof value !== 'boolean') {
    throw invalidRequest('El estado activo debe enviarse como booleano.');
  }
  return value;
}

function present(body, field) {
  return Object.hasOwn(body, field) && body[field] !== undefined;
}

/**
 * Operaciones de catálogo e inventario de RF-02 y RF-03.
 *
 * El servicio valida y normaliza las entradas y delega la persistencia y la
 * unicidad en el almacén inyectado. La autorización vive en la tabla de rutas,
 * de modo que las consultas de este servicio también sirven como contrato en
 * proceso para Reservas. Consulta docs/inventory-contract.md.
 */
export function createInventory({ store }) {
  async function requireCategory(id) {
    const category = await store.findCategory(id);
    if (!category) {
      throw notFound('La categoría indicada no existe.');
    }
    return category;
  }

  return {
    // --- Catálogo público (RF-02) ---

    listCategories() {
      return store.listCategories();
    },

    async listEquipment({ categoryId } = {}) {
      if (categoryId === undefined || categoryId === null || categoryId === '') {
        return store.listEquipment({ categoryId: null });
      }
      const identifier = parseIdentifier(categoryId, 'El filtro categoryId');
      await requireCategory(identifier);
      return store.listEquipment({ categoryId: identifier });
    },

    async getEquipment(id) {
      const equipment = await store.findEquipment(parseIdentifier(id, 'El identificador del equipo'));
      if (!equipment) {
        throw notFound('El equipo indicado no existe.');
      }
      return equipment;
    },

    // --- Administración de categorías (RF-03) ---

    async createCategory(body) {
      return store.createCategory({ name: requireText(body.name, 'El nombre de la categoría', limits.categoryName) });
    },

    async updateCategory(id, body) {
      const identifier = parseIdentifier(id, 'El identificador de la categoría');
      if (!present(body, 'name')) {
        throw invalidRequest('La solicitud no indica ningún cambio. Envía al menos el campo name.');
      }
      const updated = await store.updateCategory(identifier, {
        name: requireText(body.name, 'El nombre de la categoría', limits.categoryName),
      });
      if (!updated) {
        throw notFound('La categoría indicada no existe.');
      }
      return updated;
    },

    // --- Administración de equipos (RF-03) ---

    async createEquipment(body) {
      const categoryId = parseIdentifier(body.categoryId, 'El identificador de la categoría');
      const name = requireText(body.name, 'El nombre del equipo', limits.equipmentName);
      const description = present(body, 'description') ? optionalDescription(body.description) : '';
      await requireCategory(categoryId);
      return store.createEquipment({ categoryId, name, description });
    },

    async updateEquipment(id, body) {
      const identifier = parseIdentifier(id, 'El identificador del equipo');
      const patch = {};
      if (present(body, 'categoryId')) {
        patch.categoryId = parseIdentifier(body.categoryId, 'El identificador de la categoría');
      }
      if (present(body, 'name')) {
        patch.name = requireText(body.name, 'El nombre del equipo', limits.equipmentName);
      }
      if (present(body, 'description')) {
        patch.description = optionalDescription(body.description);
      }
      if (Object.keys(patch).length === 0) {
        throw invalidRequest('La solicitud no indica ningún cambio. Envía categoryId, name o description.');
      }
      if (patch.categoryId !== undefined) {
        await requireCategory(patch.categoryId);
      }

      const updated = await store.updateEquipment(identifier, patch);
      if (!updated) {
        throw notFound('El equipo indicado no existe.');
      }
      return updated;
    },

    // --- Administración de unidades físicas (RF-03, RN-01) ---

    async listUnits({ equipmentId } = {}) {
      if (equipmentId === undefined || equipmentId === null || equipmentId === '') {
        return store.listUnits({ equipmentId: null });
      }
      const identifier = parseIdentifier(equipmentId, 'El filtro equipmentId');
      if (!(await store.findEquipment(identifier))) {
        throw notFound('El equipo indicado no existe.');
      }
      return store.listUnits({ equipmentId: identifier });
    },

    async getUnit(id) {
      const unit = await store.findUnit(parseIdentifier(id, 'El identificador de la unidad'));
      if (!unit) {
        throw notFound('La unidad indicada no existe.');
      }
      return unit;
    },

    async createUnit(body) {
      const equipmentId = parseIdentifier(body.equipmentId, 'El identificador del equipo');
      const inventoryCode = requireInventoryCode(body.inventoryCode);
      const active = present(body, 'active') ? requireActive(body.active) : true;
      if (!(await store.findEquipment(equipmentId))) {
        throw notFound('El equipo indicado no existe.');
      }
      return store.createUnit({ equipmentId, inventoryCode, active });
    },

    async updateUnit(id, body) {
      const identifier = parseIdentifier(id, 'El identificador de la unidad');
      const patch = {};
      if (present(body, 'inventoryCode')) {
        patch.inventoryCode = requireInventoryCode(body.inventoryCode);
      }
      if (present(body, 'active')) {
        patch.active = requireActive(body.active);
      }
      if (Object.keys(patch).length === 0) {
        throw invalidRequest('La solicitud no indica ningún cambio. Envía inventoryCode o active.');
      }

      const updated = await store.updateUnit(identifier, patch);
      if (!updated) {
        throw notFound('La unidad indicada no existe.');
      }
      return updated;
    },

    // --- Contrato en proceso que consume Reservas (RF-04, RF-05) ---

    async listActiveUnits({ equipmentId } = {}) {
      const identifier = parseIdentifier(equipmentId, 'El identificador del equipo');
      if (!(await store.findEquipment(identifier))) {
        throw notFound('El equipo indicado no existe.');
      }
      return store.listUnits({ equipmentId: identifier, active: true });
    },

    async findActiveUnit(id) {
      const unit = await store.findUnit(parseIdentifier(id, 'El identificador de la unidad'));
      return unit && unit.active ? unit : null;
    },

    // Reservas invoca esta función dentro de su propia transacción para que la
    // unidad no pueda desactivarse mientras se confirma la reserva.
    lockActiveUnit(client, id) {
      return store.lockActiveUnit(client, parseIdentifier(id, 'El identificador de la unidad'));
    },
  };
}
