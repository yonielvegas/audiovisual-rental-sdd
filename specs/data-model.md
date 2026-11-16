# Modelo de datos

Modelo lógico de catálogo, disponibilidad, cuentas y reservas. Las tablas de categorías, equipos y unidades físicas están implementadas en `db/migrations/002-inventory.sql`. Las de cuentas y reservas se crearán al abordar sus funcionalidades.

| Entidad | Campos propuestos | Restricciones |
| --- | --- | --- |
| Usuario | `id`, `email`, credencial almacenada de forma segura, `role` | Correo único según la normalización que acuerde el equipo. El registro público no concede permisos de administración. |
| Categoría | `id`, `name`, `created_at`, `updated_at` | Nombre requerido, sin espacios al borde y de hasta 80 caracteres. Único comparando el nombre en minúsculas. **Implementada.** |
| Equipo | `id`, `category_id`, `name`, `description`, `created_at`, `updated_at` | Categoría requerida y referenciada. Nombre requerido de hasta 120 caracteres y único dentro de su categoría. Descripción opcional de hasta 600 caracteres. **Implementada.** |
| Unidad física | `id`, `equipment_id`, `inventory_code`, `active`, `created_at`, `updated_at` | Equipo requerido y referenciado. Código único en todo el inventario con formato `^[A-Z0-9][A-Z0-9-]{2,23}$`. Activa por omisión. **Implementada.** |
| Reserva | `id`, `user_id`, `unit_id`, `starts_at`, `ends_at`, `status`, `created_at`, `cancelled_at` | Usuario y unidad referenciados. Inicio anterior al fin. Estado `confirmed` o `cancelled`. |

Una categoría agrupa equipos, un equipo agrupa unidades físicas y cada reserva apunta a un titular y una unidad. PostgreSQL usa `timestamptz` para los instantes. El contrato representa las respuestas temporales en UTC.

## Identidad de las unidades físicas

`units.id` es el identificador estable: se genera con `GENERATED ALWAYS AS IDENTITY`, no cambia y no se reutiliza, de modo que una reserva puede referenciarlo con una clave foránea. El inventario no ofrece borrado, así que ninguna reserva histórica pierde su unidad; una unidad fuera de servicio pasa a `active = false` y conserva su fila.

`inventory_code` es el identificador legible de la etiqueta física y un índice único lo protege en todo el inventario, no solo dentro de un equipo (RN-01). La aplicación lo normaliza a mayúsculas antes de escribirlo, así que dos escrituras que solo difieren en mayúsculas o espacios compiten por el mismo valor y una de ellas recibe un conflicto. Como el personal puede corregir un código mal etiquetado, no debe usarse como clave foránea. Las garantías completas están en [el contrato de inventario](../docs/inventory-contract.md).

## Integridad de los intervalos

La propuesta usa `btree_gist` y una restricción de exclusión parcial en PostgreSQL que compara igualdad de `unit_id` y superposición del rango `tstzrange(starts_at, ends_at, '[)')` solo para reservas `confirmed`. Así, dos transacciones concurrentes que compiten por la misma unidad e intervalo producen una confirmación y un conflicto. La aplicación traduce el código `23P01` de esa restricción concreta a HTTP 409. Las cancelaciones quedan fuera de la restricción.

El registro verifica que la unidad sigue activa dentro de la transacción de escritura. La coordinación con una desactivación concurrente ya está resuelta: la reserva toma un bloqueo compartido de la fila de la unidad con `lockActiveUnit` y la administración toma el bloqueo exclusivo al actualizarla, de modo que ambas operaciones se serializan. El equipo todavía debe acordar el almacenamiento de sesiones y qué ocurre con las reservas ya confirmadas de una unidad que se desactiva.
