import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { forbidden, unauthenticated } from './http.js';

// Longitud mínima para que una credencial de desarrollo sea aceptada. Una
// credencial más corta se ignora al configurar el servicio.
export const minimumCredentialLength = 16;

const bearer = /^Bearer$/i;

function sameToken(expected, received) {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Resuelve el actor de una petición a partir de credenciales portadoras.
 *
 * RF-01 define el registro y la sesión definitivos y todavía no está
 * implementado, así que el inventario usa esta frontera provisional: el backend
 * identifica rol y cuenta a partir de credenciales configuradas por entorno. Al
 * llegar RF-01 solo se sustituye esta función, porque las rutas únicamente
 * dependen de que devuelva `{ id, role }` o `null`.
 */
export function createTokenActorResolver(accounts = []) {
  const configured = accounts.filter(
    (account) => typeof account.token === 'string' && account.token.length >= minimumCredentialLength,
  );

  return function resolveActor(request) {
    const header = request.headers.authorization;
    if (!header) return null;

    const [scheme, token, ...rest] = header.trim().split(/\s+/);
    if (!bearer.test(scheme ?? '') || !token || rest.length > 0) {
      throw unauthenticated('La credencial debe enviarse como "Authorization: Bearer <credencial>".');
    }

    const account = configured.find((candidate) => sameToken(candidate.token, token));
    if (!account) {
      throw unauthenticated('La credencial no corresponde a una cuenta activa.');
    }
    return { id: account.id, role: account.role };
  };
}

export const anonymousActorResolver = () => null;

// RN-07 y RT-02. Solo una cuenta autorizada administra el inventario. La
// ausencia de sesión y el rol insuficiente se distinguen para que el cliente
// sepa si debe autenticarse o solicitar permisos.
export function requireAdmin(actor) {
  if (!actor) {
    throw unauthenticated('Esta operación del inventario requiere una sesión administrativa.');
  }
  if (actor.role !== 'admin') {
    throw forbidden('La cuenta no tiene permisos para administrar el inventario.');
  }
  return actor;
}
