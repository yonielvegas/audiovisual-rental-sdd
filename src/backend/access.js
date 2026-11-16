import { roles } from './roles.js';
import { readCookie, sessionCookieName } from './cookies.js';
import { forbidden, unauthenticated } from './http.js';

/**
 * Resuelve quién hace la petición a partir de la cookie de sesión (RF-01).
 *
 * Devuelve `{ id, username, role }` o `null`. Es el único punto del backend
 * que traduce una petición HTTP en un actor, de modo que las rutas solo
 * declaran qué rol exigen.
 */
export function createSessionActorResolver({ accounts }) {
  return (request) => accounts.resolveSession(readCookie(request, sessionCookieName));
}

export const anonymousActorResolver = () => null;

// RN-07 y RT-02. La falta de sesión y el rol insuficiente se distinguen para
// que el cliente sepa si debe identificarse o si su cuenta no basta.
export function requireRole(actor, role) {
  if (!actor) {
    throw unauthenticated('Esta operación requiere haber iniciado sesión.');
  }
  if (actor.role !== role) {
    throw forbidden(
      role === roles.admin
        ? 'La cuenta no tiene permisos para administrar el inventario.'
        : 'La cuenta no tiene permisos para esta operación.',
    );
  }
  return actor;
}

export const requireAdmin = (actor) => requireRole(actor, roles.admin);
