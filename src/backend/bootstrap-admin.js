import pg from 'pg';
import { checkPassword, normalizeUsername, roles } from './accounts.js';
import { hashPassword, verifyPassword } from './passwords.js';

/**
 * Alta e idempotencia de la cuenta administrativa.
 *
 * La contraseña llega por entorno (`ADMIN_PASSWORD`) y nunca aparece en el
 * código ni en el repositorio: `.env` está en `.gitignore` y `.env.example`
 * solo lleva un marcador. El proceso se ejecuta junto a las migraciones, así
 * que una instalación limpia queda con la cuenta lista sin pasos manuales.
 *
 * Si la cuenta ya existe, se asegura el rol y solo se vuelve a guardar el hash
 * cuando la contraseña configurada dejó de coincidir. Así una reejecución no
 * invalida las sesiones abiertas sin motivo.
 */
const username = process.env.ADMIN_USERNAME ?? 'admin';
const password = process.env.ADMIN_PASSWORD;

if (!password) {
  console.warn('ADMIN_PASSWORD no está configurada. No se creó ninguna cuenta administrativa.');
  process.exit(0);
}

let name;
try {
  name = normalizeUsername(username);
  checkPassword(password);
} catch (error) {
  console.error(`La configuración de la cuenta administrativa no es válida. ${error.message}`);
  process.exit(1);
}

const client = new pg.Client({ connectionTimeoutMillis: 5000 });
await client.connect();
try {
  const existing = await client.query(
    'SELECT id, password_hash, role FROM audiovisual.users WHERE username = $1',
    [name],
  );

  if (existing.rows.length === 0) {
    await client.query(
      'INSERT INTO audiovisual.users (username, password_hash, role) VALUES ($1, $2, $3)',
      [name, await hashPassword(password), roles.admin],
    );
    console.log(`Cuenta administrativa «${name}» creada con el rol ${roles.admin}.`);
  } else {
    const account = existing.rows[0];
    const matches = await verifyPassword(account.password_hash, password);
    if (matches && account.role === roles.admin) {
      console.log(`La cuenta administrativa «${name}» ya estaba al día.`);
    } else {
      await client.query(
        'UPDATE audiovisual.users SET password_hash = $2, role = $3, updated_at = now() WHERE id = $1',
        [account.id, matches ? account.password_hash : await hashPassword(password), roles.admin],
      );
      // Un cambio de contraseña o de rol invalida lo que ya estuviera abierto.
      await client.query('DELETE FROM audiovisual.sessions WHERE user_id = $1', [account.id]);
      console.log(`Cuenta administrativa «${name}» actualizada y sesiones anteriores cerradas.`);
    }
  }
} finally {
  await client.end();
}
