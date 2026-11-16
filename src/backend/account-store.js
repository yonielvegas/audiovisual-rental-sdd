import { emailTaken, usernameTaken } from './accounts.js';
import { invalidRequest } from './http.js';

const uniqueViolation = '23505';
const checkViolation = '23514';

const conflicts = new Map([
  ['users_username_unique', usernameTaken],
  ['users_email_unique', emailTaken],
]);

function translate(error) {
  if (error?.code === uniqueViolation && conflicts.has(error.constraint)) {
    return conflicts.get(error.constraint)();
  }
  if (error?.code === checkViolation) {
    return invalidRequest('Los datos de la cuenta no cumplen las restricciones del sistema.');
  }
  return error;
}

const userRow = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role,
});

/**
 * Almacén de cuentas y sesiones sobre PostgreSQL. La unicidad del nombre de
 * usuario y del correo la decide un índice único, no una comprobación previa,
 * para que dos registros simultáneos no puedan crear la misma cuenta.
 */
export function createAccountStore({ pool }) {
  async function run(text, values = []) {
    try {
      return await pool.query(text, values);
    } catch (error) {
      throw translate(error);
    }
  }

  return {
    async findUserByUsername(username) {
      const result = await run(
        'SELECT id, username, email, password_hash, role FROM audiovisual.users WHERE username = $1',
        [username],
      );
      return result.rows.length ? userRow(result.rows[0]) : null;
    },

    async findUserById(id) {
      const result = await run(
        'SELECT id, username, email, password_hash, role FROM audiovisual.users WHERE id = $1',
        [id],
      );
      return result.rows.length ? userRow(result.rows[0]) : null;
    },

    async createUser({ username, email, passwordHash, role }) {
      const result = await run(
        `INSERT INTO audiovisual.users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, password_hash, role`,
        [username, email, passwordHash, role],
      );
      return userRow(result.rows[0]);
    },

    async createSession({ tokenHash, userId, expiresAt }) {
      await run(
        'INSERT INTO audiovisual.sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
        [tokenHash, userId, expiresAt],
      );
    },

    // Valida y refresca la sesión en una sola ida y vuelta. Una sesión
    // caducada no se devuelve, aunque su fila siga existiendo.
    async touchSession(tokenHash, { at }) {
      const result = await run(
        `WITH refreshed AS (
           UPDATE audiovisual.sessions
              SET last_seen_at = $2
            WHERE token_hash = $1 AND expires_at > $2
            RETURNING user_id, expires_at
         )
         SELECT u.id, u.username, u.role, r.expires_at
           FROM refreshed r
           JOIN audiovisual.users u ON u.id = r.user_id`,
        [tokenHash, at],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        expiresAt: row.expires_at,
        user: { id: row.id, username: row.username, role: row.role },
      };
    },

    async deleteSession(tokenHash) {
      const result = await run('DELETE FROM audiovisual.sessions WHERE token_hash = $1', [tokenHash]);
      return result.rowCount > 0;
    },

    async deleteSessionsOfUser(userId) {
      const result = await run('DELETE FROM audiovisual.sessions WHERE user_id = $1', [userId]);
      return result.rowCount;
    },

    // Las sesiones caducadas ya no autentican; esta limpieza solo evita que la
    // tabla crezca sin límite.
    async deleteExpiredSessions(at = new Date()) {
      const result = await run('DELETE FROM audiovisual.sessions WHERE expires_at <= $1', [at]);
      return result.rowCount;
    },
  };
}
