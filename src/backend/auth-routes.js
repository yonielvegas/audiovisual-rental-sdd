import { landingPathFor } from './accounts.js';
import { expiredSessionCookie, readCookie, sessionCookie, sessionCookieName } from './cookies.js';
import { readJsonBody, sendJson } from './http.js';

const maxAgeOf = (lifetimeMs) => Math.floor(lifetimeMs / 1000);

/**
 * Registro, inicio de sesión, cierre de sesión y consulta de la sesión actual
 * (RF-01). Una única interfaz identifica a cualquier persona y el rol decide a
 * dónde llega después.
 */
export function authRoutes(accounts, { secureCookie = false } = {}) {
  function established(response, status, { token, user }) {
    sendJson(
      response,
      status,
      { user, redirect: landingPathFor(user.role) },
      { 'Set-Cookie': sessionCookie(token, { maxAge: maxAgeOf(accounts.sessionLifetimeMs), secure: secureCookie }) },
    );
  }

  // Identifica el origen de la petición solo para frenar intentos repetidos.
  // No se registra ni se devuelve al cliente.
  const originOf = (request) => request.socket.remoteAddress ?? 'desconocido';

  return [
    ['/api/users', {
      POST: {
        handler: async ({ request, response }) => {
          const body = await readJsonBody(request);
          const session = await accounts.register(body);
          established(response, 201, session);
        },
      },
    }],

    ['/api/sessions', {
      POST: {
        handler: async ({ request, response }) => {
          const body = await readJsonBody(request);
          const session = await accounts.authenticate(body, { origin: originOf(request) });
          established(response, 200, session);
        },
      },
    }],

    ['/api/sessions/current', {
      GET: {
        actor: true,
        handler: async ({ response, actor }) => {
          sendJson(response, 200, {
            user: actor ? { id: actor.id, username: actor.username, role: actor.role } : null,
          });
        },
      },
      DELETE: {
        handler: async ({ request, response }) => {
          await accounts.closeSession(readCookie(request, sessionCookieName));
          // Se borra la cookie aunque no hubiera sesión, para que el navegador
          // no conserve una credencial inservible.
          response.writeHead(204, {
            'Set-Cookie': expiredSessionCookie({ secure: secureCookie }),
            'Cache-Control': 'no-store',
          });
          response.end();
        },
      },
    }],
  ];
}
