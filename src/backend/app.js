import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { anonymousActorResolver, requireAdmin } from './access.js';
import { sendError, sendJson } from './http.js';
import { inventoryRoutes } from './inventory-routes.js';
import { createRoutes, matchRoute, routeNotFound } from './router.js';

const frontend = new URL('../frontend/', import.meta.url);

// Cada página declara la marca de navegación que el layout debe activar.
const pages = [
  { path: '/', file: 'index.html', nav: 'home', title: 'Reservas de equipos audiovisuales' },
  { path: '/catalogo', file: 'catalog.html', nav: 'catalog', title: 'Catálogo de equipos | Alquiler audiovisual' },
  { path: '/inventario', file: 'inventory.html', nav: 'inventory', title: 'Inventario | Alquiler audiovisual' },
];
const navMarks = pages.map(({ nav }) => nav);

const assets = [
  ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
  ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
  ['/catalog.js', 'catalog.js', 'text/javascript; charset=utf-8'],
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

export async function createApp({ checkDatabase, inventory, resolveActor = anonymousActorResolver }) {
  const layout = await readFile(new URL('layout.html', frontend), 'utf8');
  const pageRoutes = await Promise.all(pages.map(async ({ path, file, nav, title }) => {
    const fields = { title, content: await readFile(new URL(file, frontend), 'utf8') };
    for (const mark of navMarks) {
      fields[`${mark}-current`] = mark === nav ? ' aria-current="page"' : '';
    }
    const html = layout.replace(/\{\{([a-z-]+)\}\}/g, (_, field) => fields[field] ?? '');
    return [path, { type: 'text/html; charset=utf-8', content: Buffer.from(html) }];
  }));
  const staticRoutes = await Promise.all(assets.map(async ([path, file, type]) => [
    path, { type, content: await readFile(new URL(file, frontend)) },
  ]));
  const documents = new Map([...pageRoutes, ...staticRoutes]);

  const apiRoutes = createRoutes([
    healthRoute(checkDatabase),
    ...(inventory ? inventoryRoutes(inventory) : []),
  ]);

  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        const route = matchRoute(apiRoutes, request.method, url.pathname);
        if (!route) throw routeNotFound();

        // El rol se resuelve solo donde la operación lo exige, de modo que las
        // consultas públicas del catálogo nunca dependen de una credencial.
        if (route.admin) requireAdmin(resolveActor(request));

        await route.handler({ request, response, params: route.params, query: url.searchParams });
        return;
      }

      const document = documents.get(url.pathname);
      if (document && (request.method === 'GET' || request.method === 'HEAD')) {
        response.writeHead(200, {
          'Content-Type': document.type,
          'Content-Length': document.content.length,
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(request.method === 'HEAD' ? undefined : document.content);
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
