import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { roles } from './roles.js';
import { anonymousActorResolver, requireRole } from './access.js';
import { authRoutes } from './auth-routes.js';
import { sendError, sendJson } from './http.js';
import { inventoryRoutes } from './inventory-routes.js';
import { createRoutes, matchRoute, routeNotFound } from './router.js';

const frontend = new URL('../frontend/', import.meta.url);

// Cada página declara la marca de navegación que el layout activa y, cuando
// corresponde, el rol que exige para servirse.
const pages = [
  { path: '/', file: 'index.html', nav: 'home', title: 'Reservas de equipos audiovisuales' },
  { path: '/catalogo', file: 'catalog.html', nav: 'catalog', title: 'Catálogo de equipos | Alquiler audiovisual' },
  { path: '/acceso', file: 'access.html', nav: 'access', title: 'Acceder | Alquiler audiovisual' },
  { path: '/inventario', file: 'inventory.html', nav: 'inventory', title: 'Inventario | Alquiler audiovisual', role: roles.admin },
];
const navMarks = pages.map(({ nav }) => nav);

const assets = [
  ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
  ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
  ['/catalog.js', 'catalog.js', 'text/javascript; charset=utf-8'],
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

export async function createApp({
  checkDatabase,
  inventory,
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
    { type: 'text/html; charset=utf-8', content: await render(page.file, page.title, page.nav), role: page.role },
  ]));
  const staticRoutes = await Promise.all(assets.map(async ([path, file, type]) => [
    path, { type, content: await readFile(new URL(file, frontend)) },
  ]));
  const documents = new Map([...pageRoutes, ...staticRoutes]);
  const forbiddenPage = await render('forbidden.html', 'Sin permisos | Alquiler audiovisual', null);

  const apiRoutes = createRoutes([
    healthRoute(checkDatabase),
    ...(accounts ? authRoutes(accounts, { secureCookie }) : []),
    ...(inventory ? inventoryRoutes(inventory) : []),
  ]);

  function serve(response, status, document) {
    response.writeHead(status, {
      'Content-Type': document.type ?? 'text/html; charset=utf-8',
      'Content-Length': document.content.length,
      'X-Content-Type-Options': 'nosniff',
      ...(document.role ? { 'Cache-Control': 'no-store' } : {}),
    });
    return document.content;
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        const route = matchRoute(apiRoutes, request.method, url.pathname);
        if (!route) throw routeNotFound();

        // El actor solo se resuelve donde la ruta lo necesita, de modo que las
        // consultas públicas del catálogo no consultan la sesión.
        const actor = route.role || route.actor ? await resolveActor(request) : null;
        if (route.role) requireRole(actor, route.role);

        await route.handler({ request, response, actor, params: route.params, query: url.searchParams });
        return;
      }

      const document = documents.get(url.pathname);
      if (document && (request.method === 'GET' || request.method === 'HEAD')) {
        if (document.role) {
          // Una ruta administrativa nunca se sirve sin comprobar el rol. Quien
          // no ha iniciado sesión va al acceso y vuelve después a esta página.
          const actor = await resolveActor(request);
          if (!actor) {
            const next = encodeURIComponent(url.pathname);
            response.writeHead(302, { Location: `/acceso?siguiente=${next}`, 'Cache-Control': 'no-store' });
            response.end();
            return;
          }
          if (actor.role !== document.role) {
            const body = serve(response, 403, { content: forbiddenPage, role: document.role });
            response.end(request.method === 'HEAD' ? undefined : body);
            return;
          }
        }

        const body = serve(response, 200, document);
        response.end(request.method === 'HEAD' ? undefined : body);
        return;
      }

      throw routeNotFound();
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      sendError(response, error);
    }
  });
}
