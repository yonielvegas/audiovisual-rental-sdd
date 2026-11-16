# Sistema de Reservas de Equipos Audiovisuales

Proyecto #2 de Tópicos Especiales II del profesor Regis Rivera. La aplicación web académica simula el alquiler de equipos audiovisuales por unidades físicas e intervalos de tiempo.

## Estado y alcance

La base incluye el frontend, el backend, PostgreSQL, las migraciones y la comprobación de salud. Están implementados el registro y el inicio de sesión con roles `ADMIN` y `USER` (RF-01), el catálogo público de equipos y categorías (RF-02) y la administración de inventario por unidad física (RF-03). Quedan pendientes la disponibilidad, las reservas propias, las cancelaciones y la prevención de doble reserva. La inclusión de pagos queda pendiente de aprobación.

Consulta [ODD](specs/outcomes.md), [requisitos](specs/requirements.md), [arquitectura](specs/architecture.md), [criterios de aceptación](specs/acceptance-criteria.md), [plan de implementación](specs/implementation-plan.md) y [el contrato de inventario que consume Reservas](docs/inventory-contract.md).

Para desarrollar nuevas pantallas y preparar la evidencia de las Issues, consulta la [guía de UI/UX](docs/ui-ux.md) y la [guía de trabajo y entrega académica](docs/project-workflow.md).

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

- [El catálogo público](http://localhost:8080/catalogo) presenta los equipos publicados en tarjetas con imagen, marca, modelo, descripción, tarifa de alquiler por día y unidades en servicio. Incluye buscador por nombre, marca o modelo, filtro por categoría, ordenamiento y una ficha con el detalle completo. No requiere cuenta. El recuento de unidades refleja el inventario y todavía no descuenta reservas por fechas, que corresponden a RF-04.
- [La administración del inventario](http://localhost:8080/inventario) registra categorías, equipos y unidades físicas. Requiere una sesión con rol `ADMIN`.

Las operaciones administrativas de la API usan la cookie de sesión que devuelve el inicio de sesión:

```sh
curl -c sesion.txt -X POST http://localhost:8080/api/sessions   -H "Content-Type: application/json"   -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}"
```

```sh
curl -b sesion.txt -X POST http://localhost:8080/api/units   -H "Content-Type: application/json"   -d '{"equipmentId":1,"inventoryCode":"CAM-001"}'
```

La migración `005-catalog-seed.sql` deja el catálogo cargado con catorce equipos audiovisuales reales, sus tarifas, sus ilustraciones y 34 unidades físicas etiquetadas, de modo que `/catalogo` y `/inventario` tienen datos desde el primer arranque. Cada unidad física tiene un identificador estable y un código único en todo el inventario. Las rutas, las respuestas y las garantías que la entrega de reservas puede dar por ciertas están en [el contrato de inventario](docs/inventory-contract.md) y en [los contratos de API](specs/api.md).

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

| Integrante | Rol inicial | Trabajo |
| --- | --- | --- |
| Eric Ruiz | Product / Spec Lead | [#4 · Catálogo e inventario](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/4) |
| Yoel Samaniego | Architecture / Development Lead | [#1 · ODD](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/1), [#2 · SDD](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/2) y [#3 · Infraestructura](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/3) |
| Yini Pan | QA / DevOps Lead | [#5 · Reservas y disponibilidad](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/5) (previsto) |

Una vez integrada la infraestructura, Eric y Yini deben clonar el repositorio con sus cuentas, comprobar el arranque y trabajar en una rama por Issue desde `main`. La entrega de Yini parte de [el contrato de inventario](docs/inventory-contract.md) y debe incluir la prueba concurrente de doble reserva. El contrato de sesión y la autorización por rol ya están implementados y documentados en [los contratos de API](specs/api.md). El PR de cada entrega debe enlazar la Issue, los criterios y las pruebas ejecutadas.

El [registro de roles y ciclos](docs/roles-and-cycles.md), las [decisiones](docs/decisions.md) y el [registro de IA](docs/ai-log.md) documentan la preparación y la revisión del equipo.
