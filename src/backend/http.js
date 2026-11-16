import { Buffer } from 'node:buffer';

const bodyLimit = 8 * 1024;

// Los errores de negocio se publican como `{ "error": { "code", "message" } }`
// según el contrato de specs/api.md. El estado y el código viajan en la excepción
// para que las rutas no tengan que construir la respuesta.
export class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export const invalidRequest = (message, code = 'invalid_request') => new HttpError(400, code, message);
// Sin cabecera `WWW-Authenticate`: la sesión se establece en `/acceso`, no
// con un esquema de autenticación HTTP que el navegador pueda negociar.
export const unauthenticated = (message) => new HttpError(401, 'unauthenticated', message);
export const forbidden = (message) => new HttpError(403, 'forbidden', message);
export const notFound = (message) => new HttpError(404, 'not_found', message);
export const conflict = (code, message) => new HttpError(409, code, message);

export function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

export function sendEmpty(response, status = 204, headers = {}) {
  response.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  response.end();
}

export function sendError(response, error) {
  if (error instanceof HttpError) {
    sendJson(response, error.status, { error: { code: error.code, message: error.message } }, error.headers);
    return;
  }

  // Los detalles internos quedan en el servidor. El cliente recibe una respuesta estable.
  console.error('Fallo no controlado al atender la petición.', error);
  sendJson(response, 500, {
    error: { code: 'internal_error', message: 'La solicitud no se pudo completar.' },
  });
}

export async function readJsonBody(request) {
  if (!/^application\/json\s*(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw invalidRequest('El cuerpo debe enviarse con Content-Type application/json.', 'invalid_content_type');
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > bodyLimit) {
      throw new HttpError(413, 'payload_too_large', 'El cuerpo de la solicitud excede el límite permitido.');
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    throw invalidRequest('Se requiere un cuerpo JSON con los datos de la operación.');
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw invalidRequest('El cuerpo no contiene JSON válido.');
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest('El cuerpo debe ser un objeto JSON.');
  }
  return body;
}
