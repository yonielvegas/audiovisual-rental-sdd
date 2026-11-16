import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const directory = new URL('../../db/migrations/', import.meta.url);
const lockId = 904692313;
const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
if (files.length === 0 || files.some((name) => !/^\d{3}-[a-z0-9-]+\.sql$/.test(name))) {
  throw new Error('Se requiere al menos una migración con formato NNN-nombre.sql.');
}

const client = new pg.Client({ connectionTimeoutMillis: 5000 });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const result = await client.query('SELECT version FROM public.schema_migrations');
  const applied = new Set(result.rows.map(({ version }) => version));
  const pending = files.filter((file) => !applied.has(file));
  for (const file of pending) {
    const sql = await readFile(new URL(file, directory), 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [file]);
  }

  await client.query('COMMIT');
  console.log(pending.length ? `Migraciones aplicadas: ${pending.join(', ')}.` : 'No hay migraciones pendientes.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
