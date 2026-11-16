import { once } from 'node:events';
import { createApp } from '../../src/backend/app.js';
import { createTokenActorResolver } from '../../src/backend/access.js';
import { createInventory } from '../../src/backend/inventory.js';
import { createMemoryInventoryStore } from './memory-inventory-store.js';

export const credentials = {
  admin: 'credencial-administrativa-de-prueba',
  member: 'credencial-de-cuenta-sin-permisos',
};

const accounts = [
  { id: 'inventario-admin', role: 'admin', token: credentials.admin },
  { id: 'cuenta-demo', role: 'member', token: credentials.member },
];

/**
 * Levanta la aplicación con un almacén en memoria y devuelve un cliente HTTP
 * que sabe enviar credenciales. Las pruebas comprueban el contrato publicado,
 * no los detalles internos de los módulos.
 */
export async function startApp(context, { checkDatabase = async () => {}, seed } = {}) {
  const store = createMemoryInventoryStore(seed);
  const app = await createApp({
    checkDatabase,
    inventory: createInventory({ store }),
    resolveActor: createTokenActorResolver(accounts),
  });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  context.after(() => new Promise((resolve, reject) => {
    app.close((error) => (error ? reject(error) : resolve()));
  }));

  const base = `http://127.0.0.1:${app.address().port}`;

  async function call(method, path, { token, body, contentType } = {}) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = contentType ?? 'application/json';
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body: text ? JSON.parse(text) : null,
    };
  }

  return {
    base,
    store,
    get: (path, options) => call('GET', path, options),
    post: (path, options) => call('POST', path, options),
    patch: (path, options) => call('PATCH', path, options),
    delete: (path, options) => call('DELETE', path, options),
    admin: {
      post: (path, body) => call('POST', path, { token: credentials.admin, body }),
      patch: (path, body) => call('PATCH', path, { token: credentials.admin, body }),
      get: (path) => call('GET', path, { token: credentials.admin }),
    },
  };
}

export const catalogSeed = {
  categories: [{ name: 'Cámaras' }, { name: 'Audio' }],
  equipment: [
    { categoryId: 1, name: 'Cámara de cine compacta', description: 'Cuerpo con montura intercambiable.' },
    { categoryId: 1, name: 'Cámara de documental' },
    { categoryId: 2, name: 'Micrófono de cañón', description: 'Incluye pistola y zepelín.' },
  ],
  units: [
    { equipmentId: 1, inventoryCode: 'CAM-001' },
    { equipmentId: 1, inventoryCode: 'CAM-002' },
    { equipmentId: 3, inventoryCode: 'MIC-001', active: false },
  ],
};
