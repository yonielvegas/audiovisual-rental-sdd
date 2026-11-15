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
| AC-02, AC-03 | O-01, O-03 | Catálogo público, categorías, códigos únicos y permisos. | Reporte de pruebas de catálogo e inventario y demostración con dos unidades. | Pendiente |
| AC-04 | O-01, O-02 | Disponibilidad con intervalos solapados, contiguos e inválidos. | Reporte de pruebas de disponibilidad. | Pendiente |
| AC-05, AC-06 | O-01, O-02 | Conflicto secuencial y concurrencia sobre una unidad en PostgreSQL. | Reporte de integración con respuestas HTTP y recuento final de reservas. | Pendiente |
| AC-07 | O-04 | Aislamiento por titular, cancelación propia y disponibilidad posterior. | Reporte de integración y evidencia del guion con dos cuentas. | Pendiente |
| AC-08 | Infraestructura | PostgreSQL disponible, migración inicial y segunda ejecución. | Registros de Compose y listado de versiones aplicadas. | Pendiente |
| AC-09 | Infraestructura | Inicio en navegador y salud con PostgreSQL disponible y caído. | Evidencia del navegador y reporte HTTP de 200 y 503. | Pendiente |
| AC-10 | Infraestructura | CI del commit candidato y arranque desde un clon limpio. | Enlace al run de GitHub Actions y registro de instalación. | Pendiente |

Para cada ejecución registra fecha, ejecutor, commit, entorno, comando o pasos, resultado esperado, resultado observado y enlace a la evidencia. Para el cambio inesperado, conserva el criterio actualizado y la prueba correspondiente junto con el resultado anterior y posterior al cambio.

## Evidencia local del 15 de noviembre de 2026

Comprobaciones realizadas por Codex durante la preparación de infraestructura, con Node.js 24.16 y PostgreSQL 17.11 en Windows.

| Criterio | Ejecución observada | Resultado |
| --- | --- | --- |
| AC-08 | Se ejecutó `npm run migrate` dos veces con PostgreSQL nativo en un entorno de prueba aislado. Se consultó luego `public.schema_migrations` y la existencia del esquema. | La primera ejecución aplicó `001-baseline.sql`. La segunda informó que no había migraciones pendientes. Se encontró una entrada y el esquema `audiovisual` estaba presente. |
| AC-09 | Se ejecutaron `npm test`, `npm run test:smoke` y la variante `--database-down`. Se abrió la página en Edge. | Tres pruebas HTTP automatizadas correctas. Inicio y dos recursos estáticos correctos. Salud 200 con PostgreSQL disponible y 503 al detenerlo. Edge mostró la página de inicio y el estado conectado. |
| AC-08, AC-10 | Se ejecutó `docker compose config --quiet` y se intentó el arranque de la composición. | Configuración válida. La sesión de Windows no obtuvo acceso al motor Docker y el arranque completo por Compose sigue pendiente. |
| AC-10 | El flujo `.github/workflows/ci.yml` está preparado para ejecutarse en GitHub. | La ejecución remota y la prueba de instalación por otra persona del equipo están pendientes. |
