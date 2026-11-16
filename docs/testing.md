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
| AC-01 | O-01, O-04 | Registro y sesión con entradas válidas e inválidas. | Reporte de pruebas de validación e integración. | Pendiente |
| AC-02, AC-03 | O-01, O-03 | Catálogo público, categorías, códigos únicos y permisos. | `tests/inventory.test.js` y la sección de inventario de `tests/smoke.mjs` contra PostgreSQL. Demostración con dos unidades en `/inventario`. | Cubierto por pruebas automatizadas. Demostración con el equipo pendiente. |
| AC-04 | O-01, O-02 | Disponibilidad con intervalos solapados, contiguos e inválidos. | Reporte de pruebas de disponibilidad. | Pendiente |
| AC-05, AC-06 | O-01, O-02 | Conflicto secuencial y concurrencia sobre una unidad en PostgreSQL. | Reporte de integración con respuestas HTTP y recuento final de reservas. | Pendiente |
| AC-07 | O-04 | Aislamiento por titular, cancelación propia y disponibilidad posterior. | Reporte de integración y evidencia del guion con dos cuentas. | Pendiente |
| AC-08 | Infraestructura | PostgreSQL disponible, migración inicial y segunda ejecución. | Registros de Compose y listado de versiones aplicadas. | Pendiente |
| AC-09 | Infraestructura | Inicio en navegador y salud con PostgreSQL disponible y caído. | Evidencia del navegador y reporte HTTP de 200 y 503. | Pendiente |
| AC-10 | Infraestructura | CI del commit candidato y arranque desde un clon limpio. | Enlace al run de GitHub Actions y registro de instalación. | Pendiente |

Para cada ejecución registra fecha, ejecutor, commit, entorno, comando o pasos, resultado esperado, resultado observado y enlace a la evidencia. Para el cambio inesperado, conserva el criterio actualizado y la prueba correspondiente junto con el resultado anterior y posterior al cambio.

## Pruebas de catálogo e inventario de la Issue 4

- **`npm test`.** `tests/inventory.test.js` ejecuta la aplicación con un almacén en memoria que reproduce el contrato y las reglas de unicidad del almacén de PostgreSQL. Cubre las consultas públicas y su filtro por categoría (AC-02), el rechazo sin sesión y con una cuenta sin permisos sobre las siete rutas administrativas (AC-03, RT-02), la distinción de dos unidades del mismo equipo, el duplicado de código en el mismo equipo, en otro equipo y con otras mayúsculas (AC-03, RN-01), el formato del código, la estabilidad del identificador al corregirlo, la desactivación que conserva la unidad y retira su recuento del catálogo, y la superficie en proceso que consume Reservas.
- **`npm run test:smoke` con la composición iniciada.** Registra una categoría, un equipo y dos unidades reales, comprueba que el código repetido devuelve HTTP 409 contra el índice único de PostgreSQL, que una petición sin credencial devuelve 401 y que una cuenta sin permisos devuelve 403, y vuelve a consultar el catálogo público para comprobar el filtro. Los datos llevan la marca de la ejecución para no interferir con ejecuciones anteriores sobre el mismo volumen.
- **CI.** El flujo comprueba además que `002-inventory.sql` se aplica una sola vez, que el índice `units_inventory_code_unique` existe y es único, y que la tabla de unidades no contiene códigos repetidos después de la prueba de humo.

## Evidencia local del 15 de noviembre de 2026

Comprobaciones realizadas por Codex durante la preparación de infraestructura, con Node.js 24.16 y PostgreSQL 17.11 en Windows.

| Criterio | Ejecución observada | Resultado |
| --- | --- | --- |
| AC-08 | Se ejecutó `npm run migrate` dos veces con PostgreSQL nativo en un entorno de prueba aislado. Se consultó luego `public.schema_migrations` y la existencia del esquema. | La primera ejecución aplicó `001-baseline.sql`. La segunda informó que no había migraciones pendientes. Se encontró una entrada y el esquema `audiovisual` estaba presente. |
| AC-09 | Se ejecutaron `npm test`, `npm run test:smoke` y la variante `--database-down`. Se abrió la página en Edge. | Tres pruebas HTTP automatizadas correctas. Inicio y dos recursos estáticos correctos. Salud 200 con PostgreSQL disponible y 503 al detenerlo. Edge mostró la página de inicio y el estado conectado. |
| AC-08, AC-10 | Se ejecutó `docker compose config --quiet` y se intentó el arranque de la composición. | Configuración válida. La sesión de Windows no obtuvo acceso al motor Docker y el arranque completo por Compose sigue pendiente. |
| AC-10 | El flujo `.github/workflows/ci.yml` está preparado para ejecutarse en GitHub. | La ejecución remota y la prueba de instalación por otra persona del equipo están pendientes. |

En un clon local independiente del paquete Git del historial, se comprobó el commit de infraestructura `602948e`. Pasaron `npm ci`, las tres pruebas de `npm test` y `docker compose config --quiet` después de copiar `.env.example`. Quedan pendientes el clon desde GitHub y el arranque completo por un integrante del equipo.
