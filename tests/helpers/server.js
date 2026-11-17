import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createAccounts, roles } from '../../src/backend/accounts.js';
import { createApp } from '../../src/backend/app.js';
import { createSessionActorResolver } from '../../src/backend/access.js';
import { createInventory } from '../../src/backend/inventory.js';
import { hashPassword } from '../../src/backend/passwords.js';
import { createLoginThrottle } from '../../src/backend/throttle.js';
import { createMemoryAccountStore } from './memory-account-store.js';
import { createMemoryInventoryStore } from './memory-inventory-store.js';
import { createMemoryReservationStore } from './memory-reservation-store.js';
import { createReservations } from '../../src/backend/reservations.js';

// Cuentas ficticias de la suite. Las contraseñas se generan en cada ejecución,
// de modo que ninguna queda escrita en el repositorio. La contraseña real del
// administrador vive solo en el entorno de cada instalación.
const inventedPassword = (label) => `ficticia-${label}-${randomUUID()}`;

export const credentials = {
  admin: { username: 'admin', password: inventedPassword('admin') },
  member: { username: 'persona.usuaria', password: inventedPassword('persona') },
};

// Argon2id es deliberadamente costoso, así que las cuentas sembradas comparten
// un hash calculado una sola vez para toda la suite.
const hashes = new Map();
async function hashOnce(password) {
  if (!hashes.has(password)) hashes.set(password, await hashPassword(password));
  return hashes.get(password);
}

/**
 * Levanta la aplicación con almacenes en memoria y devuelve un cliente HTTP
 * que conserva la cookie de sesión. Las pruebas ejercitan el contrato
 * publicado, incluido el inicio de sesión real.
 */
export async function startApp(context, {
  checkDatabase = async () => {},
  seed,
  accounts: seedAccounts = ['admin', 'member'],
  throttle,
  now,
} = {}) {
  const inventoryStore = createMemoryInventoryStore(seed);
  const accountStore = createMemoryAccountStore();

  // Las cuentas se siembran a la vez: ninguna depende de la anterior.
  await Promise.all(seedAccounts.map(async (name) => accountStore.seedUser({
    username: credentials[name].username,
    passwordHash: await hashOnce(credentials[name].password),
    role: name === 'admin' ? roles.admin : roles.user,
  })));

  const accounts = createAccounts({
    store: accountStore,
    throttle: throttle ?? createLoginThrottle(),
    ...(now ? { now } : {}),
  });

  const inventory = createInventory({ store: inventoryStore });
  const app = await createApp({
    checkDatabase,
    inventory,
    reservations: createReservations({
      store: createMemoryReservationStore({ inventoryStore, ...(now ? { now } : {}) }), inventory, ...(now ? { now } : {}),
    }),
    accounts,
    resolveActor: createSessionActorResolver({ accounts }),
  });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  context.after(() => new Promise((resolve, reject) => {
    app.close((error) => (error ? reject(error) : resolve()));
  }));

  const base = `http://127.0.0.1:${app.address().port}`;

  // Cada cliente guarda su propia cookie, de modo que una prueba pueda usar
  // dos sesiones distintas a la vez.
  function createClient() {
    let cookie = null;

    async function call(method, path, { body, contentType, cookie: override, redirect = 'manual' } = {}) {
      const headers = { Accept: 'application/json' };
      const sent = override === undefined ? cookie : override;
      if (sent) headers.Cookie = sent;
      if (body !== undefined) headers['Content-Type'] = contentType ?? 'application/json';

      let payload;
      if (body !== undefined) {
        payload = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(`${base}${path}`, { method, headers, redirect, body: payload });

      const setCookie = response.headers.getSetCookie?.() ?? [];
      for (const entry of setCookie) {
        const [pair] = entry.split(';');
        cookie = pair.startsWith('sesion=') && pair !== 'sesion=' ? pair : null;
      }

      const text = await response.text();
      const isJson = (response.headers.get('content-type') ?? '').startsWith('application/json');
      return {
        status: response.status,
        headers: response.headers,
        setCookie,
        body: text && isJson ? JSON.parse(text) : null,
        text,
      };
    }

    return {
      base,
      get: (path, options) => call('GET', path, options),
      post: (path, options) => call('POST', path, options),
      patch: (path, options) => call('PATCH', path, options),
      delete: (path, options) => call('DELETE', path, options),
      login: (account) => call('POST', '/api/sessions', { body: credentials[account] ?? account }),
      logout: () => call('DELETE', '/api/sessions/current'),
      cookie: () => cookie,
      forget: () => { cookie = null; },
    };
  }

  const anonymous = createClient();
  const client = {
    base,
    inventoryStore,
    accountStore,
    accounts,
    createClient,
    ...anonymous,
    async as(account) {
      const session = createClient();
      const response = await session.login(account);
      if (response.status >= 400) {
        throw new Error(`No se pudo iniciar sesión como ${account}: ${response.status}`);
      }
      return session;
    },
  };
  return client;
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
