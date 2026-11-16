export const sessionCookieName = 'sesion';

export function readCookie(request, name) {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * La cookie de sesión es `HttpOnly` para que ningún script pueda leerla,
 * `SameSite=Lax` para que no viaje en peticiones de escritura iniciadas desde
 * otro sitio, y `Secure` cuando el despliegue sirve HTTPS.
 */
export function sessionCookie(value, { maxAge, secure }) {
  const parts = [
    `${sessionCookieName}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export const expiredSessionCookie = ({ secure }) => sessionCookie('', { maxAge: 0, secure });
