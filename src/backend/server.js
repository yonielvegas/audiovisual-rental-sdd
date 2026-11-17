import pg from 'pg';
import { createAccounts } from './accounts.js';
import { createAccountStore } from './account-store.js';
import { createApp } from './app.js';
import { createSessionActorResolver } from './access.js';
import { createInventory } from './inventory.js';
import { createInventoryStore } from './inventory-store.js';
import { createLoginThrottle } from './throttle.js';
import { createReservations } from './reservations.js';
import { createReservationStore } from './reservation-store.js';

const pool = new pg.Pool({
  connectionTimeoutMillis: 2000,
  query_timeout: 2000,
});

pool.on('error', (error) => {
  console.warn('Conexión inactiva de PostgreSQL interrumpida.', error.code ?? error.name);
});

const accountStore = createAccountStore({ pool });
const accounts = createAccounts({ store: accountStore, throttle: createLoginThrottle() });

// La cookie de sesión solo lleva `Secure` cuando el despliegue sirve HTTPS. En
// desarrollo local el origen es http, donde `Secure` impediría conservarla.
const secureCookie = process.env.SESSION_COOKIE_SECURE === 'true';
if (!secureCookie) {
  console.warn('SESSION_COOKIE_SECURE no está activa. Usa HTTPS y actívala fuera de desarrollo local.');
}

const inventory = createInventory({ store: createInventoryStore({ pool }) });
const app = await createApp({
  checkDatabase: () => pool.query('SELECT 1'),
  inventory,
  reservations: createReservations({ store: createReservationStore({ pool }), inventory }),
  accounts,
  resolveActor: createSessionActorResolver({ accounts }),
  secureCookie,
});

app.listen(8080, '0.0.0.0', () => {
  console.log('Aplicación disponible en el puerto 8080.');
});

// Las sesiones caducadas dejan de autenticar al instante; esta limpieza
// periódica solo evita que la tabla crezca sin límite.
const cleanup = setInterval(() => {
  accountStore.deleteExpiredSessions().catch((error) => {
    console.warn('No se pudieron limpiar las sesiones caducadas.', error.code ?? error.name);
  });
}, 60 * 60 * 1000);
cleanup.unref();

function stop() {
  clearInterval(cleanup);
  app.close(async () => {
    await pool.end();
  });
}

process.once('SIGTERM', stop);
process.once('SIGINT', stop);
