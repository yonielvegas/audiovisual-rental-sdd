import pg from 'pg';
import { createApp } from './app.js';

const pool = new pg.Pool({
  connectionTimeoutMillis: 2000,
  query_timeout: 2000,
});

pool.on('error', (error) => {
  console.warn('Conexión inactiva de PostgreSQL interrumpida.', error.code ?? error.name);
});

const app = await createApp({
  checkDatabase: () => pool.query('SELECT 1'),
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
