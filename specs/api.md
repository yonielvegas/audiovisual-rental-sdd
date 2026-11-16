# Contratos API

El navegador y la API comparten origen y usan la ruta base `/api`. La entrega de infraestructura publica la comprobación de salud. Los contratos de negocio son propuestas para revisión.

## Infraestructura

| Método y ruta | Condición | Respuesta JSON |
| --- | --- | --- |
| `GET /api/health` | El backend puede ejecutar una consulta de comprobación contra PostgreSQL. | `200 {"status":"ok","database":"up"}` |
| `GET /api/health` | El backend no puede ejecutar la consulta de comprobación. | `503 {"status":"unavailable","database":"down"}` |

La respuesta expone el estado del servicio y la base de datos. Los detalles de conexión, credenciales y errores internos se reservan para el servidor.

## Contratos propuestos del MVP

| Requisito | Método y ruta | Operación | Acceso y respuesta esperada |
| --- | --- | --- | --- |
| RF-01 | `POST /api/users` | Registrar con `email` y `password`. | Público. `201` con el identificador y el correo de la cuenta. |
| RF-01 | `POST /api/sessions` | Iniciar sesión con `email` y `password`. | Público. `200` si las credenciales son válidas, `401` si son inválidas. El mecanismo de sesión está pendiente. |
| RF-02 | `GET /api/categories` | Listar categorías del catálogo. | Público. `200` con las categorías. |
| RF-02 | `GET /api/equipment` | Listar equipos, con filtro opcional `categoryId`. | Público. `200` con los equipos. |
| RF-03 | `POST /api/categories`, `PATCH /api/categories/{id}` | Crear o modificar categorías. | Administrativo. `201` o `200` con la categoría. |
| RF-03 | `POST /api/equipment`, `PATCH /api/equipment/{id}` | Crear o modificar equipos. | Administrativo. `201` o `200` con el equipo. |
| RF-03 | `GET /api/units?equipmentId={id}` | Listar unidades e identificar sus códigos. | Administrativo. `200` con las unidades. |
| RF-03 | `POST /api/units`, `PATCH /api/units/{id}` | Registrar una unidad o actualizar sus datos y estado activo. | Administrativo. `201` o `200` con la unidad. |
| RF-04 | `GET /api/availability?equipmentId={id}&start={instant}&end={instant}` | Consultar unidades disponibles del equipo para un intervalo. | Público. `200` con unidades disponibles o una lista vacía. |
| RF-05 | `POST /api/reservations` | Crear una reserva enviando `unitId`, `start` y `end`. | Sesión requerida. `201` con la reserva confirmada o `409` por indisponibilidad. |
| RF-06 | `GET /api/reservations` | Consultar las reservas del titular autenticado. | Sesión requerida. `200` con las reservas propias. |
| RF-06 | `PATCH /api/reservations/{id}` | Solicitar cancelación con `status: "cancelled"`. | Titular. `200` con la reserva cancelada o `409` si su estado o la política impiden cancelar. |

Los parámetros temporales usan RFC 3339 con desplazamiento explícito y las respuestas temporales se expresan en UTC. Los errores de negocio usan un objeto JSON con `error.code` y `error.message`. Se propone `400` para entradas inválidas, `401` cuando se requiere sesión, `403` para un rol insuficiente y `404` para recursos inexistentes o reservas ajenas. Las respuestas de reserva omiten información interna del conflicto.
