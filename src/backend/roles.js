/**
 * Roles del sistema (RN-07).
 *
 * `ADMIN` administra el catálogo y el inventario. `USER` consulta el catálogo y
 * gestiona sus propias reservas. Viven en su propio módulo para que las tablas
 * de rutas puedan declarar el rol que exigen sin depender del módulo de
 * cuentas ni, con él, del cálculo de hashes.
 */
export const roles = { admin: 'ADMIN', user: 'USER' };

export const roleValues = Object.values(roles);
