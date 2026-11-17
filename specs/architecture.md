# Arquitectura

Estado: arquitectura del MVP integrado en main. La infraestructura de la Issue #3 soporta los módulos de catálogo, cuentas, inventario y reservas.

## Stack

| Componente | Elección | Justificación |
| --- | --- | --- |
| Frontend | HTML, CSS y JavaScript del navegador en `src/frontend/` | Las páginas comparten un layout y estilos glassmorphism. Catálogo, inventario, cuentas y reservas usan esa base visual. Consulta la [guía de UI/UX](../docs/ui-ux.md). |
| Backend | Node.js 24, módulos ESM y HTTP de Node en `src/backend/` | Una sola herramienta ejecuta el servidor, los módulos de infraestructura y las pruebas. Sirve las páginas, los recursos estáticos y la API con `pg` para PostgreSQL y `@node-rs/argon2` para el hash de contraseñas. |
| Persistencia | PostgreSQL 17, SQL versionado en `db/migrations/` | Permite transacciones y restricciones al reservar por unidad e intervalo. La misma versión se utiliza en desarrollo y en CI. |
| Ejecución | Docker Compose | Define servicios, dependencias y comprobaciones de arranque en un solo archivo reproducible. |
| Pruebas y CI | `node:test`, pruebas de humo contra Compose y GitHub Actions | Validan el contrato HTTP con dependencias controladas y, en un segundo nivel, demuestran integración con PostgreSQL real. |

## Despliegue local

El navegador solicita la página y consulta `GET /api/health` en el mismo origen. El servicio `app` ejecuta Node, sirve el frontend y expone la API. Mantener el mismo origen simplifica la configuración y el uso de la cookie de sesión. Solo `app` publica un puerto local.

1. `db` inicia PostgreSQL y comprueba que acepta conexiones. Un volumen persistente conserva su contenido.
2. `migrate` se ejecuta cuando `db` está listo. Aplica migraciones pendientes en una transacción y registra sus versiones. Un bloqueo transaccional serializa ejecuciones concurrentes.
3. `app` se inicia cuando `migrate` termina correctamente. Consulta PostgreSQL para informar el estado de disponibilidad. Responde HTTP 503 si la conexión o la consulta falla.

El paso `migrate` aplica las migraciones y a continuación ejecuta `bootstrap-admin.js`, que deja lista la cuenta administrativa con la contraseña que llega por entorno. El proceso es idempotente: solo vuelve a calcular el hash cuando la contraseña configurada dejó de coincidir, y en ese caso cierra las sesiones anteriores de esa cuenta.

Las credenciales y el puerto se configuran por variables de entorno. `.env.example` contiene valores de desarrollo ficticios. `.env` es local. La API devuelve un estado estable y el servidor puede registrar errores sin exponer credenciales al cliente.

## Módulos funcionales

- Catálogo e inventario ya usan rutas y consultas separadas de la infraestructura común: una tabla de rutas declarativa (`src/backend/router.js`), la validación y las operaciones del dominio (`src/backend/inventory.js`) y el acceso a PostgreSQL (`src/backend/inventory-store.js`). Cada unidad tiene un identificador estable y un código único.
- La disponibilidad es una lectura orientativa; la confirmación se decide al escribir en PostgreSQL. `reservations.js` valida las reglas, `reservation-routes.js` adapta HTTP y `reservation-store.js` controla transacciones y persistencia.
- La migración `006-reservations.sql` usa `btree_gist` y una exclusión GiST parcial sobre unidad y `tstzrange` para impedir solapamientos confirmados. La transacción comprueba la unidad con `lockActiveUnit`, reintenta hasta dos veces ante interbloqueo y traduce el conflicto de exclusión a HTTP 409.
- El control de acceso se resuelve en un solo punto: cada ruta declara el rol que exige y el backend lo verifica antes de leer el cuerpo de la petición. `src/backend/access.js` traduce la cookie de sesión en un actor `{ id, username, role }`; las cuentas y las sesiones viven en `src/backend/accounts.js` y `src/backend/account-store.js`, y las contraseñas se procesan solo en `src/backend/passwords.js`.

Referencias técnicas: [orden de inicio de Docker Compose](https://docs.docker.com/compose/how-tos/startup-order/), [pool de node-postgres](https://node-postgres.com/apis/pool) y [restricciones de rangos de PostgreSQL](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT).
