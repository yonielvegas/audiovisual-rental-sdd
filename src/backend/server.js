import pg from 'pg';
import { createApp } from './app.js';
import { createTokenActorResolver, minimumCredentialLength } from './access.js';
import { createInventory } from './inventory.js';
import { createInventoryStore } from './inventory-store.js';

const pool = new pg.Pool({
  connectionTimeoutMillis: 2000,
  query_timeout: 2000,
});

pool.on('error', (error) => {
  console.warn('Conexión inactiva de PostgreSQL interrumpida.', error.code ?? error.name);
});

// Frontera de acceso provisional hasta que RF-01 defina registro y sesión. Las
// credenciales se configuran por entorno y nunca se registran en el log.
const accounts = [
  { id: 'inventario-admin', role: 'admin', token: process.env.INVENTORY_ADMIN_TOKEN },
  { id: 'cuenta-demo', role: 'member', token: process.env.INVENTORY_MEMBER_TOKEN },
];
for (const { id, role, token } of accounts) {
  if (token === undefined || token === '') continue;
  if (token.length < minimumCredentialLength) {
    console.warn(`Credencial de ${role} ignorada: ${id} requiere al menos ${minimumCredentialLength} caracteres.`);
  }
}
if (!process.env.INVENTORY_ADMIN_TOKEN) {
  console.warn('INVENTORY_ADMIN_TOKEN no está configurada. La administración del inventario responderá 401.');
}

const store = createInventoryStore({ pool });

const app = await createApp({
  checkDatabase: () => pool.query('SELECT 1'),
  inventory: createInventory({ store }),
  resolveActor: createTokenActorResolver(accounts),
});

app.listen(8080, '0.0.0.0', () => {
  console.log('Aplicación disponible en el puerto 8080.');
});

function stop() {
  app.close(async () => {
    await pool.end();
  });
}

process.once('SIGTERM', stop);
process.once('SIGINT', stop);
