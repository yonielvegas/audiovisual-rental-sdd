import { HttpError, notFound } from './http.js';

const parameter = /:([a-zA-Z][a-zA-Z0-9]*)/g;
const reserved = /[.*+?^${}()|[\]\\]/g;

function compile(template) {
  const names = [...template.matchAll(parameter)].map(([, name]) => name);
  const source = template.replace(reserved, '\\$&').replace(parameter, '([^/]+)');
  return { pattern: new RegExp(`^${source}$`), names };
}

// Una ruta declara sus métodos y, con `admin`, exige autorización administrativa.
// Así el control de acceso de RT-02 se resuelve en un solo lugar antes de
// invocar el manejador y antes de leer el cuerpo de la petición.
export function createRoutes(definitions) {
  return definitions.map(([template, methods]) => ({ ...compile(template), methods }));
}

export function matchRoute(routes, method, pathname) {
  const verb = method === 'HEAD' ? 'GET' : method;
  for (const route of routes) {
    const match = route.pattern.exec(pathname);
    if (!match) continue;

    const entry = route.methods[verb];
    if (!entry) {
      throw new HttpError(405, 'method_not_allowed', `El recurso no admite el método ${method}.`, {
        Allow: Object.keys(route.methods).sort().join(', '),
      });
    }

    const params = Object.fromEntries(route.names.map((name, index) => [name, match[index + 1]]));
    return { ...entry, params };
  }
  return null;
}

export const routeNotFound = () => notFound('El recurso solicitado no existe.');
