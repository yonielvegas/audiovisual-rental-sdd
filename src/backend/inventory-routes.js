import { roles } from './roles.js';
import { readJsonBody, sendEmpty, sendJson } from './http.js';

/**
 * Tabla de rutas del catálogo e inventario (specs/api.md).
 *
 * Las rutas públicas de RF-02 se consultan sin sesión. Las marcadas con
 * `role: roles.admin` exigen una sesión con rol ADMIN antes de leer el cuerpo,
 * de modo que una petición sin permisos nunca llega a modificar el inventario.
 *
 * Las unidades físicas no tienen borrado: salen de servicio con `active: false`
 * y conservan su fila, porque las reservas referencian su identificador. Ver
 * docs/inventory-contract.md.
 */
export function inventoryRoutes(inventory) {
  return [
    ['/api/categories', {
      GET: {
        handler: async ({ response }) => {
          sendJson(response, 200, { categories: await inventory.listCategories() });
        },
      },
      POST: {
        role: roles.admin,
        handler: async ({ request, response }) => {
          const category = await inventory.createCategory(await readJsonBody(request));
          sendJson(response, 201, { category }, { Location: `/api/categories/${category.id}` });
        },
      },
    }],

    ['/api/categories/:id', {
      PATCH: {
        role: roles.admin,
        handler: async ({ request, response, params }) => {
          const category = await inventory.updateCategory(params.id, await readJsonBody(request));
          sendJson(response, 200, { category });
        },
      },
      DELETE: {
        role: roles.admin,
        handler: async ({ response, params }) => {
          await inventory.deleteCategory(params.id);
          sendEmpty(response);
        },
      },
    }],

    ['/api/equipment', {
      GET: {
        handler: async ({ response, query }) => {
          const equipment = await inventory.listEquipment({ categoryId: query.get('categoryId') });
          sendJson(response, 200, { equipment });
        },
      },
      POST: {
        role: roles.admin,
        handler: async ({ request, response }) => {
          const equipment = await inventory.createEquipment(await readJsonBody(request));
          sendJson(response, 201, { equipment }, { Location: `/api/equipment/${equipment.id}` });
        },
      },
    }],

    ['/api/equipment/:id', {
      GET: {
        handler: async ({ response, params }) => {
          sendJson(response, 200, { equipment: await inventory.getEquipment(params.id) });
        },
      },
      PATCH: {
        role: roles.admin,
        handler: async ({ request, response, params }) => {
          const equipment = await inventory.updateEquipment(params.id, await readJsonBody(request));
          sendJson(response, 200, { equipment });
        },
      },
      DELETE: {
        role: roles.admin,
        handler: async ({ response, params }) => {
          await inventory.deleteEquipment(params.id);
          sendEmpty(response);
        },
      },
    }],

    ['/api/units', {
      GET: {
        role: roles.admin,
        handler: async ({ response, query }) => {
          const units = await inventory.listUnits({ equipmentId: query.get('equipmentId') });
          sendJson(response, 200, { units });
        },
      },
      POST: {
        role: roles.admin,
        handler: async ({ request, response }) => {
          const unit = await inventory.createUnit(await readJsonBody(request));
          sendJson(response, 201, { unit }, { Location: `/api/units/${unit.id}` });
        },
      },
    }],

    ['/api/units/:id', {
      GET: {
        role: roles.admin,
        handler: async ({ response, params }) => {
          sendJson(response, 200, { unit: await inventory.getUnit(params.id) });
        },
      },
      PATCH: {
        role: roles.admin,
        handler: async ({ request, response, params }) => {
          const unit = await inventory.updateUnit(params.id, await readJsonBody(request));
          sendJson(response, 200, { unit });
        },
      },
    }],
  ];
}
