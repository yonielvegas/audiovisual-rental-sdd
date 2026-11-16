import { randomBytes, createHash } from 'node:crypto';
import { HttpError, invalidRequest, unauthenticated } from './http.js';
import { hashPassword, spendVerificationTime, verifyPassword } from './passwords.js';
import { roles } from './roles.js';

export { roles };

export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const passwordLimits = { minimum: 8, maximum: 200 };

// Doce horas de validez absoluta. Cerrar sesión borra la sesión en el acto, de
// modo que la caducidad solo cubre el caso de no cerrarla.
export const sessionLifetimeMs = 12 * 60 * 60 * 1000;

const sessionTokenBytes = 32;

export const hashSessionToken = (token) => createHash('sha256').update(token, 'utf8').digest('hex');

export function normalizeUsername(value) {
  if (typeof value !== 'string') {
    throw invalidRequest('El nombre de usuario debe enviarse como texto.');
  }
  const username = value.normalize('NFKC').trim().toLowerCase();
  if (!usernamePattern.test(username)) {
    throw invalidRequest(
      'El nombre de usuario usa de 3 a 32 caracteres entre letras minúsculas, dígitos, punto, guion y guion bajo, y empieza por una letra o un dígito.',
      'invalid_username',
    );
  }
  return username;
}

export function checkPassword(value) {
  if (typeof value !== 'string') {
    throw invalidRequest('La contraseña debe enviarse como texto.');
  }
  if (value.length < passwordLimits.minimum || value.length > passwordLimits.maximum) {
    throw invalidRequest(
      `La contraseña debe tener entre ${passwordLimits.minimum} y ${passwordLimits.maximum} caracteres.`,
      'invalid_password',
    );
  }
  return value;
}

function normalizeEmail(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw invalidRequest('El correo debe enviarse como texto.');
  }
  const email = value.normalize('NFKC').trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !emailPattern.test(email)) {
    throw invalidRequest('El correo no tiene un formato válido.', 'invalid_email');
  }
  return email;
}

// Representación pública de una cuenta. Nunca incluye el hash ni el correo de
// otras personas, y es la única forma en la que las rutas devuelven usuarios.
export const publicUser = (user) => ({ id: user.id, username: user.username, role: user.role });

// El rol decide a dónde llega la persona después de identificarse.
export const landingPathFor = (role) => (role === roles.admin ? '/inventario' : '/catalogo');

/**
 * Registro, inicio y cierre de sesión de RF-01.
 *
 * El servicio valida las entradas, guarda únicamente el hash Argon2id de la
 * contraseña y mantiene las sesiones del lado del servidor, de modo que cerrar
 * sesión las revoca de inmediato.
 */
export function createAccounts({ store, throttle, now = () => new Date() }) {
  async function openSession(user) {
    const token = randomBytes(sessionTokenBytes).toString('base64url');
    const expiresAt = new Date(now().getTime() + sessionLifetimeMs);
    await store.createSession({ tokenHash: hashSessionToken(token), userId: user.id, expiresAt });
    return { token, expiresAt, user: publicUser(user) };
  }

  return {
    sessionLifetimeMs,

    async register(body) {
      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email);
      const password = checkPassword(body.password);

      // El registro público nunca concede permisos de administración.
      const user = await store.createUser({
        username,
        email,
        passwordHash: await hashPassword(password),
        role: roles.user,
      });
      return openSession(user);
    },

    async authenticate(body, { origin = 'desconocido' } = {}) {
      const username = normalizeUsername(body.username);
      const password = checkPassword(body.password);
      const key = `${username}|${origin}`;
      throttle?.check(key);

      const user = await store.findUserByUsername(username);
      // La misma respuesta para una cuenta inexistente y una contraseña
      // incorrecta, y el mismo coste de verificación, para no revelar qué
      // nombres de usuario están registrados.
      const valid = user
        ? await verifyPassword(user.passwordHash, password)
        : (await spendVerificationTime(password), false);

      if (!valid) {
        throttle?.fail(key);
        throw unauthenticated('El nombre de usuario o la contraseña no son correctos.');
      }

      throttle?.succeed(key);
      return openSession(user);
    },

    // Resuelve el actor de una petición. Devuelve `null` cuando no hay sesión
    // válida, de modo que las rutas públicas sigan funcionando sin cookie.
    async resolveSession(token) {
      if (!token) return null;
      const session = await store.touchSession(hashSessionToken(token), { at: now() });
      return session ? { id: session.user.id, username: session.user.username, role: session.user.role } : null;
    },

    async closeSession(token) {
      if (!token) return false;
      return store.deleteSession(hashSessionToken(token));
    },

    async closeEverySessionOf(userId) {
      return store.deleteSessionsOfUser(userId);
    },
  };
}

export const usernameTaken = () => new HttpError(409, 'username_taken', 'Ese nombre de usuario ya está registrado.');
export const emailTaken = () => new HttpError(409, 'email_taken', 'Ese correo ya está registrado.');
