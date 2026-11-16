# Arquitectura

Estado: diseño inicial. La infraestructura descrita para la Issue 3 se adopta como decisión técnica de preparación. Las decisiones de comportamiento del MVP se revisarán con el equipo antes de implementar la lógica de negocio.

## Stack

| Componente | Elección | Justificación |
| --- | --- | --- |
| Frontend | HTML, CSS y JavaScript del navegador en `src/frontend/` | Las páginas comparten un layout y estilos glassmorphism. Los módulos se pueden extender cuando lleguen los flujos funcionales. Consulta la [guía de UI/UX](../docs/ui-ux.md). |
| Backend | Node.js 24, módulos ESM y HTTP de Node en `src/backend/` | Una sola herramienta ejecuta el servidor, los módulos de infraestructura y las pruebas. Sirve las páginas, los recursos estáticos y la API con una dependencia de ejecución, el cliente PostgreSQL `pg`. |
| Persistencia | PostgreSQL 17, SQL versionado en `db/migrations/` | Permite transacciones y restricciones al reservar por unidad e intervalo. La misma versión se utiliza en desarrollo y en CI. |
| Ejecución | Docker Compose | Define servicios, dependencias y comprobaciones de arranque en un solo archivo reproducible. |
| Pruebas y CI | `node:test`, pruebas de humo contra Compose y GitHub Actions | Validan el contrato HTTP con dependencias controladas y, en un segundo nivel, demuestran integración con PostgreSQL real. |

## Despliegue local

El navegador solicita la página y consulta `GET /api/health` en el mismo origen. El servicio `app` ejecuta Node, sirve el frontend y expone la API. Mantener el mismo origen simplifica la configuración del navegador y permite agregar sesiones en una fase posterior. Solo `app` publica un puerto local.

1. `db` inicia PostgreSQL y comprueba que acepta conexiones. Un volumen persistente conserva su contenido.
2. `migrate` se ejecuta cuando `db` está listo. Aplica migraciones pendientes en una transacción y registra sus versiones. Un bloqueo transaccional serializa ejecuciones concurrentes.
3. `app` se inicia cuando `migrate` termina correctamente. Consulta PostgreSQL para informar el estado de disponibilidad. Responde HTTP 503 si la conexión o la consulta falla.

Las credenciales y el puerto se configuran por variables de entorno. `.env.example` contiene valores de desarrollo ficticios. `.env` es local. La API devuelve un estado estable y el servidor puede registrar errores sin exponer credenciales al cliente.

## Evolución funcional propuesta

- Catálogo e inventario ya usan rutas y consultas separadas de la infraestructura común: una tabla de rutas declarativa (`src/backend/router.js`), la validación y las operaciones del dominio (`src/backend/inventory.js`) y el acceso a PostgreSQL (`src/backend/inventory-store.js`). Cada unidad tiene un identificador estable y un código único.
- La disponibilidad representará una lectura en un instante; la confirmación de la reserva se decidirá al escribir en la base de datos.
- Una restricción de exclusión GiST sobre la unidad y un rango `tstzrange` evitará solapamientos activos incluso con pedidos concurrentes. Se propone `btree_gist` para combinar el identificador de unidad con el rango.
- El control de acceso se resuelve en un solo punto: cada ruta declara si exige rol administrativo y el backend lo verifica antes de leer el cuerpo de la petición. La identificación del actor vive aislada en `src/backend/access.js`, hoy con credenciales de entorno, y se sustituirá por la sesión que acuerde RF-01 sin tocar las rutas.

Referencias técnicas: [orden de inicio de Docker Compose](https://docs.docker.com/compose/how-tos/startup-order/), [pool de node-postgres](https://node-postgres.com/apis/pool) y [restricciones de rangos de PostgreSQL](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT).
