# Sistema de Reservas de Equipos Audiovisuales

Proyecto #2 de Tópicos Especiales II del profesor Regis Rivera. La aplicación web académica simula el alquiler de equipos audiovisuales por unidades físicas e intervalos de tiempo.

## Estado y alcance

Esta entrega prepara el frontend, el backend, PostgreSQL, las migraciones y la comprobación de salud. El MVP acordado contempla registro e inicio de sesión, catálogo y categorías, inventario por unidad física, disponibilidad, reservas propias, cancelaciones, prevención de doble reserva y administración básica. La inclusión de pagos queda pendiente de aprobación.

Consulta [ODD](specs/outcomes.md), [requisitos](specs/requirements.md), [arquitectura](specs/architecture.md), [criterios de aceptación](specs/acceptance-criteria.md) y [plan de implementación](specs/implementation-plan.md).

## Instalación y ejecución

1. Clona el [repositorio privado](https://github.com/yonielvegas/audiovisual-rental-sdd) con una cuenta que tenga acceso y entra a la carpeta `audiovisual-rental-sdd`.
2. Inicia Docker Desktop o un motor Docker equivalente y verifica que Docker Compose esté disponible.
3. Copia `.env.example` a `.env`. En PowerShell usa `Copy-Item .env.example .env`. En Bash usa `cp .env.example .env`. Los datos de ejemplo son para desarrollo local. Si el puerto 8080 está ocupado, ajusta `APP_PORT`.
4. Ejecuta:

   ```sh
   docker compose up --build --wait
   docker compose ps --all
   ```

5. Abre [la página de inicio](http://localhost:8080/) y comprueba que indique que el servidor y la base están disponibles. [El endpoint de salud](http://localhost:8080/api/health) debe responder HTTP 200 con `{"status":"ok","database":"up"}`. Cuando PostgreSQL esté inaccesible devuelve HTTP 503 con `{"status":"unavailable","database":"down"}`.

Compose arranca PostgreSQL, ejecuta la migración inicial y luego inicia el servidor que sirve el frontend y la API. El estado esperado es `db` y `app` saludables y `migrate` finalizado con código 0. Para ver los registros usa `docker compose logs db migrate app`. Para repetir las migraciones en la misma base usa `docker compose run --rm migrate`. Para detener y conservar el volumen usa `docker compose down`.

## Pruebas

Con Node.js 24 instalado, ejecuta:

```sh
npm ci
npm test
```

Con Compose iniciado, ejecuta `npm run test:smoke` para verificar el inicio, los recursos estáticos y la respuesta de salud. Si cambiaste el puerto, ajusta `SMOKE_BASE_URL` antes de ejecutar la prueba. En PowerShell usa `$env:SMOKE_BASE_URL = 'http://localhost:8081'`.

GitHub Actions ejecuta la suite y comprueba el arranque y las migraciones con una base de datos de prueba. Consulta la [estrategia y evidencia de pruebas](docs/testing.md).

## Trabajo del equipo

Yoel Samaniego inició el repositorio y preparó la documentación inicial con apoyo de IA.

| Integrante | Rol inicial | Trabajo |
| --- | --- | --- |
| Eric Ruiz | Product / Spec Lead | [#4 · Catálogo e inventario](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/4) (previsto) |
| Yoel Samaniego | Architecture / Development Lead | [#1 · ODD](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/1), [#2 · SDD](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/2) y [#3 · Infraestructura](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/3) |
| Yini Pan | QA / DevOps Lead | [#5 · Reservas y disponibilidad](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/5) (previsto) |

Una vez integrada la infraestructura, Eric y Yini deben clonar el repositorio con sus cuentas, comprobar el arranque y trabajar en una rama por Issue desde `main`. La entrega de Yini debe acordar con Eric el contrato de unidades e incluir la prueba concurrente de doble reserva. Antes de implementar rutas protegidas, el equipo debe acordar el responsable y el contrato de sesión. El PR de cada entrega debe enlazar la Issue, los criterios y las pruebas ejecutadas.

El [registro de roles y ciclos](docs/roles-and-cycles.md), las [decisiones](docs/decisions.md) y el [registro de IA](docs/ai-log.md) documentan la preparación y la revisión del equipo.
