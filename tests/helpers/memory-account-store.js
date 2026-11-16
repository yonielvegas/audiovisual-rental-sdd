import { emailTaken, usernameTaken } from '../../src/backend/accounts.js';

/**
 * Almacén de cuentas y sesiones en memoria con el mismo contrato y las mismas
 * reglas de unicidad que `createAccountStore`. Permite probar autenticación,
 * roles y caducidad de sesión sin PostgreSQL. La unicidad sobre la base real
 * la comprueba `tests/smoke.mjs` contra la composición de Docker.
 */
export function createMemoryAccountStore() {
  const users = new Map();
  const sessions = new Map();
  let nextId = 1;

  const copy = (user) => ({ ...user });

  return {
    async findUserByUsername(username) {
      const user = [...users.values()].find((row) => row.username === username);
      return user ? copy(user) : null;
    },

    async findUserById(id) {
      const user = users.get(id);
      return user ? copy(user) : null;
    },

    async createUser({ username, email, passwordHash, role }) {
      if ([...users.values()].some((row) => row.username === username)) throw usernameTaken();
      if (email && [...users.values()].some((row) => row.email === email)) throw emailTaken();
      const user = { id: nextId++, username, email: email ?? null, passwordHash, role };
      users.set(user.id, user);
      return copy(user);
    },

    async createSession({ tokenHash, userId, expiresAt }) {
      sessions.set(tokenHash, { tokenHash, userId, expiresAt, lastSeenAt: new Date() });
    },

    async touchSession(tokenHash, { at }) {
      const session = sessions.get(tokenHash);
      if (!session || session.expiresAt <= at) return null;
      session.lastSeenAt = at;
      const user = users.get(session.userId);
      return {
        expiresAt: session.expiresAt,
        user: { id: user.id, username: user.username, role: user.role },
      };
    },

    async deleteSession(tokenHash) {
      return sessions.delete(tokenHash);
    },

    async deleteSessionsOfUser(userId) {
      let removed = 0;
      for (const [tokenHash, session] of sessions) {
        if (session.userId === userId && sessions.delete(tokenHash)) removed += 1;
      }
      return removed;
    },

    async deleteExpiredSessions(at = new Date()) {
      let removed = 0;
      for (const [tokenHash, session] of sessions) {
        if (session.expiresAt <= at && sessions.delete(tokenHash)) removed += 1;
      }
      return removed;
    },

    // Solo para las pruebas: inserta una cuenta ya preparada, como hace el
    // proceso de inicialización del administrador.
    async seedUser(user) {
      const row = { id: nextId++, email: null, ...user };
      users.set(row.id, row);
      return copy(row);
    },

    openSessions: () => sessions.size,
  };
}
