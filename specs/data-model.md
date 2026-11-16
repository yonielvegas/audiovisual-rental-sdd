# Modelo de datos

Modelo lógico de catálogo, disponibilidad, cuentas y reservas. Las tablas de categorías, equipos y unidades físicas están implementadas en `db/migrations/002-inventory.sql`, sus datos de presentación en `db/migrations/004-catalog-details.sql`, y las de cuentas y sesiones en `db/migrations/003-accounts.sql`. `db/migrations/005-catalog-seed.sql` carga el catálogo de demostración. La tabla de reservas se creará al abordar su funcionalidad.

| Entidad | Campos propuestos | Restricciones |
| --- | --- | --- |
| Usuario | `id`, `username`, `email`, `password_hash`, `role`, `created_at`, `updated_at` | Nombre de usuario requerido y único, normalizado a minúsculas, con formato `^[a-z0-9][a-z0-9._-]{2,31}$`. Correo opcional, normalizado a minúsculas y único cuando se indica. Contraseña guardada solo como hash Argon2id. Rol `ADMIN` o `USER`; el registro público no concede permisos de administración. **Implementada.** |
| Sesión | `token_hash`, `user_id`, `created_at`, `last_seen_at`, `expires_at` | Clave primaria con el SHA-256 de la credencial de sesión, nunca la credencial. Usuario referenciado con borrado en cascada. Caducidad posterior a la creación. **Implementada.** |
| Categoría | `id`, `name`, `created_at`, `updated_at` | Nombre requerido, sin espacios al borde y de hasta 80 caracteres. Único comparando el nombre en minúsculas. **Implementada.** |
| Equipo | `id`, `category_id`, `name`, `description`, `brand`, `model`, `daily_rate_cents`, `image_url`, `published`, `created_at`, `updated_at` | Categoría requerida y referenciada. Nombre requerido de hasta 120 caracteres y único dentro de su categoría. Descripción de hasta 600 caracteres, marca y modelo de hasta 60. Tarifa diaria en céntimos enteros, opcional y no negativa. Imagen opcional, ruta del mismo origen o dirección https. Publicado por omisión. **Implementada.** |
| Unidad física | `id`, `equipment_id`, `inventory_code`, `active`, `created_at`, `updated_at` | Equipo requerido y referenciado. Código único en todo el inventario con formato `^[A-Z0-9][A-Z0-9-]{2,23}$`. Activa por omisión. **Implementada.** |
| Reserva | `id`, `user_id`, `unit_id`, `starts_at`, `ends_at`, `status`, `created_at`, `cancelled_at` | Usuario y unidad referenciados. Inicio anterior al fin. Estado `confirmed` o `cancelled`. |

Una categoría agrupa equipos, un equipo agrupa unidades físicas y cada reserva apunta a un titular y una unidad. PostgreSQL usa `timestamptz` para los instantes. El contrato representa las respuestas temporales en UTC.

## Identidad de las unidades físicas

`units.id` es el identificador estable: se genera con `GENERATED ALWAYS AS IDENTITY`, no cambia y no se reutiliza, de modo que una reserva puede referenciarlo con una clave foránea. El inventario no ofrece borrado, así que ninguna reserva histórica pierde su unidad; una unidad fuera de servicio pasa a `active = false` y conserva su fila.

`inventory_code` es el identificador legible de la etiqueta física y un índice único lo protege en todo el inventario, no solo dentro de un equipo (RN-01). La aplicación lo normaliza a mayúsculas antes de escribirlo, así que dos escrituras que solo difieren en mayúsculas o espacios compiten por el mismo valor y una de ellas recibe un conflicto. Como el personal puede corregir un código mal etiquetado, no debe usarse como clave foránea. Las garantías completas están en [el contrato de inventario](../docs/inventory-contract.md).

## Presentación del catálogo

Marca, modelo, tarifa e imagen son atributos del **equipo**, no de la unidad física: dos unidades del mismo equipo comparten modelo y tarifa y se distinguen por su código de inventario (RN-01). Si en el futuro una unidad concreta necesitara su propia tarifa, el campo bajaría a `units` sin romper lo ya guardado.

`daily_rate_cents` guarda céntimos enteros para no depender de la aritmética en coma flotante, y el MVP opera en una sola moneda, que el contrato acompaña al dato. `NULL` significa que la tarifa todavía no está fijada, que no es lo mismo que una tarifa de cero: el catálogo muestra «Tarifa por confirmar» en el primer caso y un importe en el segundo.

`published` controla la visibilidad pública sin borrar nada. Un equipo despublicado desaparece del catálogo y de su consulta individual para quien no administra el inventario, y sigue visible y editable en la administración. No afecta a las unidades ni a su estado.

## Catálogo de demostración

`005-catalog-seed.sql` deja la base lista para usarse: seis categorías, catorce equipos audiovisuales reales con marca, modelo, descripción, tarifa por día e ilustración, y 34 unidades físicas etiquetadas, dos de ellas retiradas para que el recuento de unidades aptas no coincida con el total. Las ilustraciones son archivos del mismo origen en `src/frontend/img`, de modo que el catálogo no depende de ningún servicio externo; sustituir una por una fotografía solo exige cambiar `image_url` desde la administración. Cada inserción es idempotente contra sus índices únicos, así que la semilla puede volver a aplicarse sobre una base que ya tenga parte de esos registros sin duplicar nada.

## Credenciales y sesiones

El identificador de acceso es `username`, porque la cuenta administrativa entra como `admin` y no como un correo. El correo queda como dato opcional de contacto.

`password_hash` guarda la codificación PHC de Argon2id, que incluye la sal y los parámetros junto al resumen. Subir el coste más adelante no invalida las contraseñas ya almacenadas, porque cada hash recuerda con qué parámetros se calculó. La contraseña en claro no se escribe en ninguna tabla, ni en ningún registro del servidor.

Las sesiones viven en la base, no en la cookie. El cliente recibe 32 bytes aleatorios y la tabla guarda solo su SHA-256, de modo que una copia de la base no permite suplantar una sesión abierta. Cerrar sesión borra la fila, así que la revocación es inmediata; la caducidad de doce horas solo cubre el caso de no cerrarla. El borrado en cascada desde `users` garantiza que eliminar una cuenta cierre todo lo que tuviera abierto.

## Integridad de los intervalos

La propuesta usa `btree_gist` y una restricción de exclusión parcial en PostgreSQL que compara igualdad de `unit_id` y superposición del rango `tstzrange(starts_at, ends_at, '[)')` solo para reservas `confirmed`. Así, dos transacciones concurrentes que compiten por la misma unidad e intervalo producen una confirmación y un conflicto. La aplicación traduce el código `23P01` de esa restricción concreta a HTTP 409. Las cancelaciones quedan fuera de la restricción.

El registro verifica que la unidad sigue activa dentro de la transacción de escritura. La coordinación con una desactivación concurrente ya está resuelta: la reserva toma un bloqueo compartido de la fila de la unidad con `lockActiveUnit` y la administración toma el bloqueo exclusivo al actualizarla, de modo que ambas operaciones se serializan. El equipo todavía debe acordar el almacenamiento de sesiones y qué ocurre con las reservas ya confirmadas de una unidad que se desactiva.
