import { HttpError } from './http.js';

/**
 * Freno de intentos de inicio de sesión. Cuenta los fallos por nombre de
 * usuario y origen, de modo que una ráfaga de contraseñas contra una cuenta se
 * detiene antes de acertar y un único cliente no puede bloquear a nadie más.
 *
 * El recuento vive en memoria del proceso: basta para la demostración
 * académica y no añade dependencias. Un despliegue con varias instancias
 * necesitaría llevarlo a PostgreSQL o a un almacén compartido.
 */
export function createLoginThrottle({ limit = 10, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const attempts = new Map();

  function prune(moment) {
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= moment) attempts.delete(key);
    }
  }

  return {
    check(key) {
      const moment = now();
      prune(moment);
      const entry = attempts.get(key);
      if (!entry || entry.failures < limit) return;

      const seconds = Math.max(1, Math.ceil((entry.resetAt - moment) / 1000));
      throw new HttpError(
        429,
        'too_many_attempts',
        'Se alcanzó el número de intentos permitidos. Espera unos minutos antes de volver a intentarlo.',
        { 'Retry-After': String(seconds) },
      );
    },

    fail(key) {
      const moment = now();
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= moment) {
        attempts.set(key, { failures: 1, resetAt: moment + windowMs });
        return;
      }
      entry.failures += 1;
    },

    succeed(key) {
      attempts.delete(key);
    },
  };
}
