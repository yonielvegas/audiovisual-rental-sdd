import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { roles } from './roles.js';
import { anonymousActorResolver, requireRole } from './access.js';
import { authRoutes } from './auth-routes.js';
import { sendError, sendJson } from './http.js';
import { inventoryRoutes } from './inventory-routes.js';
import { reservationRoutes } from './reservation-routes.js';
import { createRoutes, matchRoute, routeNotFound } from './router.js';

const frontend = new URL('../frontend/', import.meta.url);

// Cada página declara la marca de navegación que el layout activa y, cuando
// corresponde, el rol que exige para servirse.
const pages = [
  { path: '/', file: 'index.html', nav: 'home', title: 'Reservas de equipos audiovisuales' },
  { path: '/catalogo', file: 'catalog.html', nav: 'catalog', title: 'Catálogo de equipos | Alquiler audiovisual' },
  { path: '/disponibilidad', file: 'availability.html', nav: 'availability', title: 'Disponibilidad | Alquiler audiovisual' },
  { path: '/reservas', file: 'reservations.html', nav: 'reservations', title: 'Mis reservas | Alquiler audiovisual', session: true },
  { path: '/acceso', file: 'access.html', nav: 'access', title: 'Acceder | Alquiler audiovisual' },
  { path: '/inventario', file: 'inventory.html', nav: 'inventory', title: 'Inventario | Alquiler audiovisual', role: roles.admin },
];
const navMarks = pages.map(({ nav }) => nav);

const assets = [
  ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
  ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
  ['/catalog.js', 'catalog.js', 'text/javascript; charset=utf-8'],
  ['/reservations.js', 'reservations.js', 'text/javascript; charset=utf-8'],
  ['/reservation-schedule.js', 'reservation-schedule.js', 'text/javascript; charset=utf-8'],
  ['/access.js', 'access.js', 'text/javascript; charset=utf-8'],
  ['/inventory.js', 'inventory.js', 'text/javascript; charset=utf-8'],
  ['/hero.webp', 'hero.webp', 'image/webp'],
];

function healthRoute(checkDatabase) {
  return ['/api/health', {
    GET: {
      handler: async ({ response }) => {
        try {
          await checkDatabase();
        } catch {
          sendJson(response, 503, { status: 'unavailable', database: 'down' });
          return;
        }
        sendJson(response, 200, { status: 'ok', database: 'up' });
      },
    },
  }];
}

const readMethods = new Set(['GET', 'HEAD']);

function serve(request, response, status, document) {
  response.writeHead(status, {
    'Content-Type': document.type ?? 'text/html; charset=utf-8',
    'Content-Length': document.content.length,
    'X-Content-Type-Options': 'nosniff',
    ...(document.role || document.session ? { 'Cache-Control': 'no-store' } : {}),
  });
  response.end(request.method === 'HEAD' ? undefined : document.content);
}

async function callApi({ routes, resolveActor, request, response, url }) {
  const route = matchRoute(routes, request.method, url.pathname);
  if (!route) throw routeNotFound();

  // El actor solo se resuelve donde la ruta lo necesita, de modo que las
  // consultas públicas del catálogo no consultan la sesión.
  const actor = route.role || route.actor ? await resolveActor(request) : null;
  if (route.role) requireRole(actor, route.role);

  await route.handler({ request, response, actor, params: route.params, query: url.searchParams });
}

// Una ruta administrativa nunca se sirve sin comprobar el rol. Quien no ha
// iniciado sesión va al acceso y vuelve después a esta página. Devuelve `true`
// cuando ya respondió y la petición no debe seguir.
async function guarded({ document, resolveActor, request, response, url, forbiddenPage }) {
  if (!document.role && !document.session) return false;

  const actor = await resolveActor(request);
  if (!actor) {
    const next = encodeURIComponent(url.pathname);
    response.writeHead(302, { Location: `/acceso?siguiente=${next}`, 'Cache-Control': 'no-store' });
    response.end();
    return true;
  }
  if (document.role && actor.role !== document.role) {
    serve(request, response, 403, { content: forbiddenPage, role: document.role });
    return true;
  }
  return false;
}

export async function createApp({
  checkDatabase,
  inventory,
  reservations,
  accounts,
  resolveActor = anonymousActorResolver,
  secureCookie = false,
}) {
  const layout = await readFile(new URL('layout.html', frontend), 'utf8');

  async function render(file, title, nav) {
    const fields = { title, content: await readFile(new URL(file, frontend), 'utf8') };
    for (const mark of navMarks) {
      fields[`${mark}-current`] = mark === nav ? ' aria-current="page"' : '';
    }
    return Buffer.from(layout.replace(/\{\{([a-z-]+)\}\}/g, (_, field) => fields[field] ?? ''));
  }

  const pageRoutes = await Promise.all(pages.map(async (page) => [
    page.path,
    { type: 'text/html; charset=utf-8', content: await render(page.file, page.title, page.nav), role: page.role, session: page.session },
  ]));
  // Las ilustraciones del catálogo se enumeran al arrancar y se sirven desde esa
  // lista, nunca desde la ruta que trae la solicitud: así ninguna petición puede
  // alcanzar un archivo que no sea una de ellas.
  const illustrations = (await readdir(new URL('img/', frontend)))
    .filter((name) => name.endsWith('.svg'))
    .map((name) => [`/img/${name}`, `img/${name}`, 'image/svg+xml; charset=utf-8']);

  const staticRoutes = await Promise.all([...assets, ...illustrations].map(async ([path, file, type]) => [
    path, { type, content: await readFile(new URL(file, frontend)) },
  ]));
  const documents = new Map([...pageRoutes, ...staticRoutes]);
  const forbiddenPage = await render('forbidden.html', 'Sin permisos | Alquiler audiovisual', null);

  const apiRoutes = createRoutes([
    healthRoute(checkDatabase),
    ...(accounts ? authRoutes(accounts, { secureCookie }) : []),
    ...(inventory ? inventoryRoutes(inventory) : []),
    ...(reservations ? reservationRoutes(reservations) : []),
  ]);

  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        await callApi({ routes: apiRoutes, resolveActor, request, response, url });
        return;
      }

      const document = documents.get(url.pathname);
      if (!document || !readMethods.has(request.method)) throw routeNotFound();
      if (await guarded({ document, resolveActor, request, response, url, forbiddenPage })) return;

      serve(request, response, 200, document);
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      sendError(response, error);
    }
  });
}
