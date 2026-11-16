# Modelo de datos

Modelo lógico propuesto para catálogo, disponibilidad, cuentas y reservas. La migración de infraestructura se limita a comprobar la gestión de migraciones de PostgreSQL. Las tablas de dominio y sus restricciones se crearán al abordar las funcionalidades correspondientes.

| Entidad | Campos propuestos | Restricciones |
| --- | --- | --- |
| Usuario | `id`, `email`, credencial almacenada de forma segura, `role` | Correo único según la normalización que acuerde el equipo. El registro público no concede permisos de administración. |
| Categoría | `id`, `name` | Nombre requerido. |
| Equipo | `id`, `category_id`, `name`, `description` | Categoría requerida y referenciada. |
| Unidad física | `id`, `equipment_id`, `inventory_code`, `active` | Equipo requerido y referenciado. Código de inventario único. |
| Reserva | `id`, `user_id`, `unit_id`, `starts_at`, `ends_at`, `status`, `created_at`, `cancelled_at` | Usuario y unidad referenciados. Inicio anterior al fin. Estado `confirmed` o `cancelled`. |

Una categoría agrupa equipos, un equipo agrupa unidades físicas y cada reserva apunta a un titular y una unidad. PostgreSQL usa `timestamptz` para los instantes. El contrato representa las respuestas temporales en UTC.

## Integridad de los intervalos

La propuesta usa `btree_gist` y una restricción de exclusión parcial en PostgreSQL que compara igualdad de `unit_id` y superposición del rango `tstzrange(starts_at, ends_at, '[)')` solo para reservas `confirmed`. Así, dos transacciones concurrentes que compiten por la misma unidad e intervalo producen una confirmación y un conflicto. La aplicación traduce el código `23P01` de esa restricción concreta a HTTP 409. Las cancelaciones quedan fuera de la restricción.

El registro verifica que la unidad sigue activa dentro de la transacción de escritura. La coordinación con una desactivación concurrente se detallará junto con la política de inventario. El equipo también debe acordar el almacenamiento de sesiones y la política de cambios en el inventario con historial.
