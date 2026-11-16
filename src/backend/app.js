import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const frontend = new URL('../frontend/', import.meta.url);
const assets = [
  ['/', 'index.html', 'text/html; charset=utf-8'],
  ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
  ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
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
  const staticFiles = await Promise.all(assets.map(async ([path, file, type]) => [
    path, { type, content: await readFile(new URL(file, frontend)) },
  ]));
  const routes = new Map(staticFiles);

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
