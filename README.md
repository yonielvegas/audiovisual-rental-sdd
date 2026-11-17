# Sistema de Reservas de Equipos Audiovisuales

Proyecto #2 de Tópicos Especiales II del profesor Regis Rivera. La aplicación web académica simula el alquiler de equipos audiovisuales por unidades físicas e intervalos de tiempo.

## Estado y alcance

La base incluye el frontend, el backend, PostgreSQL, las migraciones y la comprobación de salud. Están implementados el registro y el inicio de sesión con roles `ADMIN` y `USER` (RF-01), el catálogo público (RF-02), el inventario por unidad física (RF-03), la disponibilidad por fechas (RF-04), la reserva con prevención de solapamientos concurrentes (RF-05) y las reservas propias y su cancelación (RF-06). Los pagos quedan fuera de esta entrega.

Consulta [ODD](specs/outcomes.md), [requisitos](specs/requirements.md), [arquitectura](specs/architecture.md), [criterios de aceptación](specs/acceptance-criteria.md), [plan de implementación](specs/implementation-plan.md) y [el contrato de inventario que consume Reservas](docs/inventory-contract.md).

Para desarrollar nuevas pantallas y preparar la evidencia de las Issues, consulta la [guía de UI/UX](docs/ui-ux.md) y la [guía de trabajo y entrega académica](docs/project-workflow.md).

[Guion e índice de la entrega académica](docs/delivery.md)

## Instalación y ejecución

1. Clona el [repositorio privado](https://github.com/yonielvegas/audiovisual-rental-sdd) con una cuenta que tenga acceso y entra a la carpeta `audiovisual-rental-sdd`.
2. Inicia Docker Desktop o un motor Docker equivalente y verifica que Docker Compose esté disponible.
3. Copia `.env.example` a `.env`. En PowerShell usa `Copy-Item .env.example .env`. En Bash usa `cp .env.example .env`. Los datos de ejemplo son para desarrollo local. Si el puerto 8080 está ocupado, ajusta `APP_PORT`.
4. Abre `.env` y escribe la contraseña de la cuenta administrativa en `ADMIN_PASSWORD`. `.env` está en `.gitignore`, de modo que la contraseña nunca llega al repositorio. `ADMIN_USERNAME` vale `admin` si no se indica otra cosa, y `SESSION_COOKIE_SECURE` debe pasar a `true` cuando el despliegue sirva HTTPS.
5. Ejecuta:

   ```sh
   docker compose up --build --wait
   docker compose ps --all
   ```

6. Abre [la página de inicio](http://localhost:8080/) y comprueba que indique que el servidor y la base están disponibles. [El endpoint de salud](http://localhost:8080/api/health) debe responder HTTP 200 con `{"status":"ok","database":"up"}`. Cuando PostgreSQL esté inaccesible devuelve HTTP 503 con `{"status":"unavailable","database":"down"}`.

## Cuentas, acceso y roles

[La página de acceso](http://localhost:8080/acceso) es la misma para todas las cuentas y reconoce el rol al iniciar sesión.

- **Administración.** La cuenta con rol `ADMIN` la crea el paso `migrate` al arrancar la composición, con el usuario de `ADMIN_USERNAME` y la contraseña de `ADMIN_PASSWORD`. Al iniciar sesión llega a `/inventario`.
- **Personas usuarias.** Cualquiera puede registrarse desde la misma página. El registro público siempre crea cuentas con rol `USER`, que llegan a `/catalogo` y no pueden administrar el inventario.

Las contraseñas se guardan solo como hash Argon2id. La sesión vive en PostgreSQL y el navegador recibe una cookie `HttpOnly` con una credencial opaca; cerrar sesión borra la sesión en el servidor. `/inventario` no se sirve sin rol `ADMIN`: quien no ha iniciado sesión va a la página de acceso y una cuenta sin permisos recibe HTTP 403.

Para rehacer la cuenta administrativa sin volver a migrar, ejecuta `npm run bootstrap:admin` con las variables de entorno configuradas. El proceso es idempotente y solo vuelve a guardar el hash si la contraseña configurada cambió.

## Catálogo e inventario

- [El catálogo público](http://localhost:8080/catalogo) presenta los equipos publicados en tarjetas con imagen, marca, modelo, descripción, tarifa de alquiler por día y unidades en servicio. Incluye buscador por nombre, marca o modelo, filtro por categoría, ordenamiento y una ficha con el detalle completo. No requiere cuenta. El recuento de unidades refleja el inventario; la ficha enlaza a la disponibilidad por fechas de RF-04.
- [La administración del inventario](http://localhost:8080/inventario) registra categorías, equipos y unidades físicas. Requiere una sesión con rol `ADMIN`.

Las operaciones administrativas de la API usan la cookie de sesión que devuelve el inicio de sesión:

```sh
curl -c sesion.txt -X POST http://localhost:8080/api/sessions   -H "Content-Type: application/json"   -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}"
```

```sh
curl -b sesion.txt -X POST http://localhost:8080/api/units   -H "Content-Type: application/json"   -d '{"equipmentId":1,"inventoryCode":"CAM-001"}'
```

La migración `005-catalog-seed.sql` deja el catálogo cargado con catorce equipos audiovisuales reales, sus tarifas, sus ilustraciones y 34 unidades físicas etiquetadas, de modo que `/catalogo` y `/inventario` tienen datos desde el primer arranque. Cada unidad física tiene un identificador estable y un código único en todo el inventario. Las rutas, las respuestas y las garantías que la entrega de reservas puede dar por ciertas están en [el contrato de inventario](docs/inventory-contract.md) y en [los contratos de API](specs/api.md).

## Reservas y disponibilidad · Issue #5

Desde la ficha del catálogo, abre «Consultar disponibilidad» o entra a `/disponibilidad`. Elige equipo, inicio y fin; las horas se muestran en la zona horaria del navegador. La consulta es pública. Para confirmar una unidad libre necesitas una sesión de cualquier rol. `/reservas` muestra únicamente las reservas de tu cuenta, incluidas las canceladas.

Una reserva debe empezar en el futuro y terminar después del inicio. Su titular puede cancelarla hasta antes del inicio, sin exigir 24 horas de anticipación. Se conserva el registro cancelado y se libera el intervalo al confirmar la transacción. Los horarios son semiabiertos: una unidad puede empezar otro alquiler exactamente cuando termina el anterior.

La consulta es orientativa: al confirmar se comprueba de nuevo la unidad activa dentro de la transacción. La migración `006-reservations.sql` añade `btree_gist` y una exclusión parcial de PostgreSQL para impedir dos reservas confirmadas superpuestas de una misma unidad, incluso entre instancias del servidor. Un conflicto devuelve HTTP 409 y permite consultar otro horario. Retirar una unidad conserva sus reservas y excluye la unidad de nuevas consultas; no cancela ni reasigna automáticamente reservas anteriores.

Pruebas reales de integración y concurrencia (sobre una composición **de pruebas** ya iniciada):

```sh
docker compose run --rm --no-deps -v "$PWD/tests:/app/tests:ro" -e RESERVATION_TEST_DATABASE=1 app npm run test:integration
```

En PowerShell, el argumento del volumen es `-v "$($PWD.Path)/tests:/app/tests:ro"`. La suite crea y limpia sus propias cuentas, categorías, equipos, unidades y reservas; requiere una base de pruebas migrada. Comprueba solicitudes simultáneas desde dos servidores HTTP, el conflicto SQL directo, el estado final persistido, cancelaciones y coordinación con Inventario. CI ejecuta esta suite además de `npm test` y la prueba de humo.

## Funcionamiento de la composición

Compose arranca PostgreSQL, aplica las migraciones, carga el catálogo de demostración, deja lista la cuenta administrativa y luego inicia el servidor que sirve el frontend y la API. El estado esperado es `db` y `app` saludables y `migrate` finalizado con código 0. Para ver los registros usa `docker compose logs db migrate app`. Para repetir las migraciones en la misma base usa `docker compose run --rm migrate`. Para detener y conservar el volumen usa `docker compose down`.

## Pruebas

Con Node.js 24 instalado, ejecuta:

```sh
npm ci
npm test
```

Con Compose iniciado, ejecuta `npm run test:smoke` para verificar el inicio, los recursos estáticos, la respuesta de salud, el acceso por roles y el inventario contra PostgreSQL. Las comprobaciones de cuentas necesitan `ADMIN_USERNAME` y `ADMIN_PASSWORD` en el entorno de la prueba, los mismos valores que recibió la aplicación; sin ellos esa sección se omite. Si cambiaste el puerto, ajusta `SMOKE_BASE_URL` antes de ejecutar la prueba. En PowerShell usa `$env:SMOKE_BASE_URL = 'http://localhost:8081'`.

GitHub Actions ejecuta la suite y comprueba el arranque y las migraciones con una base de datos de prueba. Consulta la [estrategia y evidencia de pruebas](docs/testing.md).

## Trabajo del equipo

Yoel Samaniego inició el repositorio y preparó la documentación inicial con apoyo de IA.

| Integrante | Rol inicial | Trabajo entregado |
| --- | --- | --- |
| Eric Ruiz | Product / Spec Lead | [#5 · Reservas y disponibilidad](https://github.com/yonielvegas/audiovisual-rental-sdd/pull/13) |
| Yoel Samaniego | Architecture / Development Lead | [#1 · ODD](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/1), [#2 · SDD](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/2), [#3 · Infraestructura](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/3) y [#10 · Landing](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/10) |
| Yini Pan | QA / DevOps Lead | [#4 · Catálogo, inventario y autenticación](https://github.com/yonielvegas/audiovisual-rental-sdd/pull/12) |

Los aportes integrados están registrados en los PRs del equipo. Reservas consume el [contrato de inventario](docs/inventory-contract.md), y la doble reserva concurrente se verifica en tests/reservations.postgres.test.js. El contrato de sesión y la autorización por rol están descritos en [la API](specs/api.md).

El [registro de roles y ciclos](docs/roles-and-cycles.md), las [decisiones](docs/decisions.md) y el [registro de IA](docs/ai-log.md) documentan la preparación y la revisión del equipo.
