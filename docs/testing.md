# Estrategia y evidencia de pruebas

Los escenarios se vinculan con los [criterios de aceptación](../specs/acceptance-criteria.md) y los [resultados esperados](../specs/outcomes.md). La matriz describe pruebas planificadas. El equipo incorporará a cada Pull Request los resultados de las pruebas que efectivamente ejecute.

## Infraestructura de la Issue 3

- **Pruebas automatizadas con `node:test`.** Comprobar la respuesta HTTP de la página de inicio y el contrato de salud con una dependencia de base controlada para reproducir tanto la conexión exitosa como la caída. Comprobar el código de estado y el cuerpo JSON.
- **Integración con PostgreSQL 17.** Arrancar `db`, `migrate` y `app` con Docker Compose en un entorno aislado. Verificar la disponibilidad de PostgreSQL, el resultado de `migrate`, la salud del servicio y la respuesta HTTP de `app`. Repetir las migraciones sobre el mismo volumen de prueba para comprobar que ya no haya versiones por aplicar.
- **Comprobación en navegador.** Abrir la URL indicada en el README y registrar que la página inicial carga. Registrar también la comprobación de arranque desde un clon limpio. La ejecución por otra persona del equipo se registra cuando ocurra.
- **CI.** Revisar el run de GitHub Actions del commit candidato en el PR y vincular el resultado. Si hay un fallo, registrar qué comando falló, corregir y ejecutar nuevamente.

## Pruebas de las siguientes entregas

- **Unitarias.** Cubrir validaciones de credenciales, permisos, datos obligatorios, identificadores de unidad y entradas temporales. Incluir fin igual o anterior al inicio, desplazamiento ausente y dos representaciones del mismo instante.
- **Integración y aceptación.** Usar datos ficticios y cuentas distintas para validar acceso público, administración, disponibilidad y reservas propias. Probar creación seguida de solicitud solapada, contigüidad, simultaneidad en unidades distintas, cancelación y disponibilidad posterior.
- **Concurrencia de la Issue 5.** Ejecutar con PostgreSQL real y al menos dos conexiones independientes. Preparar una unidad libre, iniciar dos solicitudes autenticadas para esa unidad en intervalos superpuestos y sincronizar sus intentos de escritura para ejercer la contención. Comprobar una confirmación, un HTTP 409 y una sola reserva confirmada al consultar la base después de ambas respuestas. Repetir con coincidencia total y parcial. Añadir casos de control con intervalos contiguos y unidades distintas.
- **Resultado para el usuario.** Ejecutar el guion de O-01 a O-04, registrar intentos, resultados y ayudas, y comparar la evidencia con las metas que apruebe el equipo. Utilizar cuentas y equipos ficticios.

## Matriz de trazabilidad

| Criterio | Resultado asociado | Prueba o escenario | Evidencia a adjuntar | Estado inicial |
| --- | --- | --- | --- | --- |
| AC-01 | O-01, O-04 | Registro y sesión con entradas válidas e inválidas. | `tests/auth.test.js` y la sección de cuentas de `tests/smoke.mjs` contra PostgreSQL. | Cubierto por pruebas automatizadas. Demostración con el equipo pendiente. |
| AC-02, AC-03 | O-01, O-03 | Catálogo público, categorías, códigos únicos y permisos. | `tests/inventory.test.js` y la sección de inventario de `tests/smoke.mjs` contra PostgreSQL. Recorrido de los criterios de aceptación del 16 de noviembre de 2026 sobre la base sembrada. | Cubierto por pruebas automatizadas y verificado contra PostgreSQL. Demostración con el equipo pendiente. |
| AC-04 | O-01, O-02 | Disponibilidad con intervalos solapados, contiguos e inválidos. | Reporte de pruebas de disponibilidad. | Pendiente |
| AC-05, AC-06 | O-01, O-02 | Conflicto secuencial y concurrencia sobre una unidad en PostgreSQL. | Reporte de integración con respuestas HTTP y recuento final de reservas. | Pendiente |
| AC-07 | O-04 | Aislamiento por titular, cancelación propia y disponibilidad posterior. | Reporte de integración y evidencia del guion con dos cuentas. | Pendiente |
| AC-08 | Infraestructura | PostgreSQL disponible, migración inicial y segunda ejecución. | Registros de Compose y listado de versiones aplicadas. | Pendiente |
| AC-09 | Infraestructura | Inicio en navegador y salud con PostgreSQL disponible y caído. | Evidencia del navegador y reporte HTTP de 200 y 503. | Pendiente |
| AC-10 | Infraestructura | CI del commit candidato y arranque desde un clon limpio. | Enlace al run de GitHub Actions y registro de instalación. | Pendiente |

Para cada ejecución registra fecha, ejecutor, commit, entorno, comando o pasos, resultado esperado, resultado observado y enlace a la evidencia. Para el cambio inesperado, conserva el criterio actualizado y la prueba correspondiente junto con el resultado anterior y posterior al cambio.

## Pruebas de cuentas, sesión y roles de RF-01

- **`npm test`.** `tests/auth.test.js` cubre el registro válido con normalización del usuario y del correo, siete formas de entrada inválida, los nombres y correos repetidos, el acceso con la contraseña correcta, la respuesta idéntica ante contraseña incorrecta y cuenta inexistente, los atributos de la cookie (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age`, sin `Secure` en http), la redirección por rol, el cierre de sesión con revocación inmediata, el rechazo de cookies caducadas, manipuladas o desconocidas, el freno de intentos repetidos con su liberación, y la protección de la API y de la página del inventario frente a una cuenta sin permisos. Las pruebas comprueban además que ninguna respuesta devuelve la contraseña ni su hash.
- **`npm run test:smoke` con la composición iniciada.** Inicia sesión con la cuenta administrativa que sembró la inicialización, comprueba que su rol es `ADMIN`, registra una cuenta pública y verifica que nace con rol `USER`, que no puede abrir `/inventario` ni escribir en la API, y que cerrar sesión revoca la credencial.
- **CI.** Comprueba en PostgreSQL que la cuenta administrativa existe una sola vez con rol `ADMIN`, que su contraseña se guarda como hash `$argon2id$` y no coincide con el texto plano configurado, que ninguna cuenta registrada públicamente tiene rol distinto de `USER` y que el cierre de sesión dejó la tabla de sesiones sin filas del administrador.

## Pruebas de catálogo e inventario de la Issue 4

- **`npm test`.** `tests/inventory.test.js` ejecuta la aplicación con un almacén en memoria que reproduce el contrato y las reglas de unicidad del almacén de PostgreSQL. Cubre las consultas públicas y su filtro por categoría (AC-02), el rechazo sin sesión y con una cuenta sin permisos sobre las siete rutas administrativas (AC-03, RT-02), la distinción de dos unidades del mismo equipo, el duplicado de código en el mismo equipo, en otro equipo y con otras mayúsculas (AC-03, RN-01), el formato del código, la estabilidad del identificador al corregirlo, la desactivación que conserva la unidad y retira su recuento del catálogo, y la superficie en proceso que consume Reservas.
- **`npm run test:smoke` con la composición iniciada.** Registra una categoría, un equipo y dos unidades reales, comprueba que el código repetido devuelve HTTP 409 contra el índice único de PostgreSQL, que una petición sin credencial devuelve 401 y que una cuenta sin permisos devuelve 403, y vuelve a consultar el catálogo público para comprobar el filtro. Los datos llevan la marca de la ejecución para no interferir con ejecuciones anteriores sobre el mismo volumen.
- **CI.** El flujo comprueba además que `002-inventory.sql` se aplica una sola vez, que el índice `units_inventory_code_unique` existe y es único, y que la tabla de unidades no contiene códigos repetidos después de la prueba de humo.
- **Semilla del catálogo.** `005-catalog-seed.sql` carga catorce equipos audiovisuales reales con marca, modelo, descripción, tarifa por día, ilustración del mismo origen y sus unidades físicas etiquetadas. La prueba de humo comprueba sobre la base real que al menos diez equipos llegan completos al catálogo público, que cada ilustración se sirve con HTTP 200 y tipo `image/svg+xml`, y que la ficha individual coincide con el listado. El flujo de CI repite esa cuenta en SQL y vuelve a aplicar la semilla para comprobar que no duplica registros.

## Evidencia de los criterios de aceptación de la Issue 4, del 16 de noviembre de 2026

Ejecutada por Claude Code contra la composición de Docker en Windows, sobre un volumen vacío recreado con `docker compose down -v` y `docker compose up -d --build`. Node.js 24.22.3 en el contenedor de aplicación y PostgreSQL 17.11 en el de base de datos. La base quedó con la semilla y la cuenta administrativa, sin registros de prueba.

| Criterio de aceptación | Ejecución observada | Resultado |
| --- | --- | --- |
| Las categorías, los equipos y sus unidades físicas se pueden administrar con las autorizaciones previstas. | Dieciocho peticiones a `/api/categories`, `/api/equipment` y `/api/units` con tres clientes: sin sesión, con una cuenta `USER` y con la cuenta `ADMIN`. | Sin sesión, HTTP 401 en las tres creaciones. Con la cuenta `USER`, HTTP 403 en las tres creaciones y en las tres modificaciones. Con la cuenta `ADMIN`, HTTP 201 al crear y HTTP 200 al modificar en los tres casos. Borrar una categoría con equipos y un equipo con unidades devolvió HTTP 409 desde la clave foránea. |
| Cada unidad se distingue por un identificador único y estable en el inventario. | Alta de dos unidades del mismo equipo, intento de repetir el código en otras mayúsculas, corrección de la etiqueta y retirada de la unidad, y recuento sobre el inventario completo. | Dos identificadores distintos. El código repetido devolvió HTTP 409 con el código de error `inventory_code_taken` desde el índice `units_inventory_code_unique`. El identificador no cambió al corregir la etiqueta ni al retirar la unidad. Las 38 unidades presentes tenían 38 códigos y 38 identificadores distintos. |
| El catálogo público muestra las categorías y los equipos consultables. | Consultas sin sesión a `/api/categories`, `/api/equipment`, el filtro por categoría y la ficha individual, más la pantalla `/catalogo` en el navegador. | Seis categorías y catorce equipos publicados, todos con marca, modelo, descripción, tarifa e ilustración. El filtro por «Cámaras» devolvió sus tres equipos y la ficha de la Sony FX3 devolvió 7500 céntimos y tres unidades en servicio. La Blackmagic conserva dos unidades registradas y una apta para alquiler, porque la otra está retirada. Al despublicar un equipo, el visitante pasó a ver trece y su ficha devolvió HTTP 404, mientras la administración siguió viendo los catorce; al volver a publicarlo reapareció. Las catorce ilustraciones se sirvieron con HTTP 200. |
| Las pruebas cubren las consultas, los permisos y la unicidad. | `npm test` y `npm run test:smoke` con la composición en marcha. | 52 pruebas de `node:test` correctas y ninguna fallida. La prueba de humo informó «Catálogo sembrado: 14 equipos completos en 6 categorías y 14 ilustraciones del mismo origen» y la línea de cuentas con 401, 403, 409 y cierre de sesión efectivo. |
| El PR documenta el contrato de inventario que consume Reservas. | Revisión de [docs/inventory-contract.md](inventory-contract.md). | El documento describe la identidad de la unidad, las funciones en proceso `listActiveUnits`, `findActiveUnit` y `lockActiveUnit`, el protocolo de bloqueo compartido frente a la desactivación y los códigos de error. |

Comprobación en el navegador contra `http://localhost:8080`, con la composición sembrada:

| Pantalla | Ejecución observada | Resultado |
| --- | --- | --- |
| `/catalogo` sin sesión | Carga del catálogo, buscador, los cinco ordenamientos, filtros por categoría y ficha de detalle. | Catorce tarjetas con imagen, categoría, nombre, marca y modelo, descripción, tarifa y unidades. El buscador encontró por marca («canon»: dos equipos), por modelo («mkh»: uno) y sin tildes («camara»: las tres cámaras). Las tarifas ordenaron 85, 75 y 65 dólares de mayor a menor, y 15, 18 y 18 de menor a mayor. Los chips mostraron el recuento por categoría y fijaron `?categoria=1` en la dirección. La ficha mostró marca, modelo, tarifa, unidades e identificador, y el foco volvió a la tarjeta al cerrarla. |
| `/catalogo` a 375 px | Emulación de un teléfono. | Sin desbordamiento horizontal: la página mide 375 px igual que la ventana. Las catorce tarjetas conservan la misma altura de imagen, 214 px, de modo que la cuadrícula queda uniforme. |
| `/inventario` como `ADMIN` | Acceso desde `/acceso?siguiente=%2Finventario` y recorrido de las tres pestañas. | El acceso redirigió a `/inventario`. El resumen mostró 6 categorías, 14 equipos, 32 unidades activas y 2 retiradas. La pestaña de categorías listó seis filas con su recuento de equipos, la de equipos catorce filas con marca y modelo, tarifa, unidades activas y estado de publicación, y la de unidades físicas las 34 etiquetas con su identificador, su equipo y su estado. |

## Evidencia de Docker Compose del 15 de noviembre de 2026

Comprobaciones ejecutadas por Claude Code con Docker Compose en Windows, sobre un volumen de prueba vacío. Node.js 24.22.3 en el contenedor de aplicación y PostgreSQL 17.11 en el de base de datos.

| Criterio | Ejecución observada | Resultado |
| --- | --- | --- |
| AC-08 | `docker compose config --quiet` y `docker compose up --build --wait`. Después `docker compose run --rm migrate` sobre el mismo volumen. | Configuración válida. `db` y `app` sanos y `migrate` finalizado con código 0. La primera ejecución aplicó `001-baseline.sql`, `002-inventory.sql` y `003-accounts.sql` y creó la cuenta administrativa. La segunda informó que no había migraciones pendientes y que la cuenta ya estaba al día, sin duplicar versiones ni cerrar sesiones abiertas. |
| AC-09 | `npm run test:smoke` con la base disponible y la variante `--database-down` tras `docker compose stop db`. | Inicio, catálogo, acceso y tres recursos estáticos correctos. Salud HTTP 200 con PostgreSQL disponible y HTTP 503 al detenerlo. Con la base caída, `GET /inventario` sigue respondiendo 302 hacia el acceso y `POST /api/sessions` devuelve HTTP 500 con el cuerpo genérico `internal_error`; la traza queda en el registro del servidor. |
| AC-01 | Sección de cuentas de la prueba de humo y consultas a la base. | La cuenta `admin` existe una sola vez con rol `ADMIN` y contraseña almacenada como `$argon2id$v=19$m=19456,t=2,p=1$…`. Ninguna fila contiene la contraseña en texto plano. Una contraseña incorrecta devolvió 401. El registro público creó una cuenta con rol `USER`. Cerrar sesión dejó la tabla de sesiones sin filas del administrador. Las sesiones guardan un SHA-256 de 64 caracteres hexadecimales y caducan a las 12 horas. |
| AC-02, AC-03 | Sección de inventario de la prueba de humo y navegación en el navegador contra `http://localhost:8080`. | Dos unidades registradas con códigos distintos. El código repetido devolvió HTTP 409 contra el índice único `units_inventory_code_unique`, también escribiendo `nav-777` y después `NAV-777` desde el formulario. Sin sesión, HTTP 401; con una cuenta `USER`, HTTP 403 en la API y la página «Sin permisos» en `/inventario`. La consulta final no encontró códigos duplicados. |
| AC-03, RT-02 | Inicio de sesión en el navegador con la cuenta administrativa y creación de una categoría. | El acceso llevó a `/inventario`, la cabecera mostró el usuario con rol `ADMIN` y `document.cookie` devolvió vacío, de modo que la cookie de sesión no es legible por scripts. La categoría se creó contra PostgreSQL y apareció en la lista con su identificador. |

Pendientes: la ejecución remota en GitHub Actions y la comprobación desde un clon limpio por otra persona del equipo.

## Evidencia local del 15 de noviembre de 2026

Comprobaciones realizadas por Codex durante la preparación de infraestructura, con Node.js 24.16 y PostgreSQL 17.11 en Windows.

| Criterio | Ejecución observada | Resultado |
| --- | --- | --- |
| AC-08 | Se ejecutó `npm run migrate` dos veces con PostgreSQL nativo en un entorno de prueba aislado. Se consultó luego `public.schema_migrations` y la existencia del esquema. | La primera ejecución aplicó `001-baseline.sql`. La segunda informó que no había migraciones pendientes. Se encontró una entrada y el esquema `audiovisual` estaba presente. |
| AC-09 | Se ejecutaron `npm test`, `npm run test:smoke` y la variante `--database-down`. Se abrió la página en Edge. | Tres pruebas HTTP automatizadas correctas. Inicio y dos recursos estáticos correctos. Salud 200 con PostgreSQL disponible y 503 al detenerlo. Edge mostró la página de inicio y el estado conectado. |
| AC-08, AC-10 | Se ejecutó `docker compose config --quiet` y se intentó el arranque de la composición. | Configuración válida. La sesión de Windows no obtuvo acceso al motor Docker y el arranque completo por Compose sigue pendiente. |
| AC-10 | El flujo `.github/workflows/ci.yml` está preparado para ejecutarse en GitHub. | La ejecución remota y la prueba de instalación por otra persona del equipo están pendientes. |

En un clon local independiente del paquete Git del historial, se comprobó el commit de infraestructura `602948e`. Pasaron `npm ci`, las tres pruebas de `npm test` y `docker compose config --quiet` después de copiar `.env.example`. Quedan pendientes el clon desde GitHub y el arranque completo por un integrante del equipo.
