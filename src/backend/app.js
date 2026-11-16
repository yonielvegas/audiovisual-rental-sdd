import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const frontend = new URL('../frontend/', import.meta.url);
const pages = [
  ['/', 'index.html', 'Reservas de equipos audiovisuales'],
  ['/catalogo', 'catalog.html', 'Catálogo de equipos | Alquiler audiovisual'],
];
const assets = [
  ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
  ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
  ['/hero.webp', 'hero.webp', 'image/webp'],
];

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

export async function createApp({ checkDatabase }) {
  const layout = await readFile(new URL('layout.html', frontend), 'utf8');
  const pageRoutes = await Promise.all(pages.map(async ([path, file, title]) => {
    const fields = {
      title,
      content: await readFile(new URL(file, frontend), 'utf8'),
      'home-current': path === '/' ? ' aria-current="page"' : '',
      'catalog-current': path === '/catalogo' ? ' aria-current="page"' : '',
    };
    const html = layout.replace(/\{\{([a-z-]+)\}\}/g, (_, field) => fields[field]);
    return [path, { type: 'text/html; charset=utf-8', content: Buffer.from(html) }];
  }));
  const staticRoutes = await Promise.all(assets.map(async ([path, file, type]) => [
    path, { type, content: await readFile(new URL(file, frontend)) },
  ]));
  const routes = new Map([...pageRoutes, ...staticRoutes]);

  return createServer(async (request, response) => {
    const path = request.url.split('?', 1)[0];
    if (request.method === 'GET' && path === '/api/health') {
      try {
        await checkDatabase();
      } catch {
        sendJson(response, 503, { status: 'unavailable', database: 'down' });
        return;
      }
      sendJson(response, 200, { status: 'ok', database: 'up' });
      return;
    }

    const asset = routes.get(path);
    if (asset && (request.method === 'GET' || request.method === 'HEAD')) {
      response.writeHead(200, {
        'Content-Type': asset.type,
        'Content-Length': asset.content.length,
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : asset.content);
      return;
    }

    sendJson(response, 404, { error: 'not_found' });
  });
}
