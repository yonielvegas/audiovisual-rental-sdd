# Contratos API

El navegador y la API comparten origen y usan la ruta base `/api`. La entrega de infraestructura publica la comprobación de salud. Catálogo e inventario (RF-02 y RF-03) están implementados y su contrato detallado, incluidas las garantías para Reservas, está en [el contrato de inventario](../docs/inventory-contract.md). Los contratos de cuentas y reservas siguen siendo propuestas para revisión.

## Infraestructura

| Método y ruta | Condición | Respuesta JSON |
| --- | --- | --- |
| `GET /api/health` | El backend puede ejecutar una consulta de comprobación contra PostgreSQL. | `200 {"status":"ok","database":"up"}` |
| `GET /api/health` | El backend no puede ejecutar la consulta de comprobación. | `503 {"status":"unavailable","database":"down"}` |

La respuesta expone el estado del servicio y la base de datos. Los detalles de conexión, credenciales y errores internos se reservan para el servidor.

## Catálogo e inventario implementados

| Requisito | Método y ruta | Operación | Acceso y respuesta |
| --- | --- | --- | --- |
| RF-02 | `GET /api/categories` | Listar categorías del catálogo con su número de equipos. | Público. `200 {"categories":[{"id","name","equipmentCount"}]}` |
| RF-02 | `GET /api/equipment` | Listar equipos, con filtro opcional `categoryId`. | Público. `200 {"equipment":[…]}`. `400` si el filtro no es un identificador y `404` si la categoría no existe. |
| RF-02 | `GET /api/equipment/{id}` | Consultar un equipo del catálogo. | Público. `200 {"equipment":{…}}` o `404`. |
| RF-03 | `POST /api/categories`, `PATCH /api/categories/{id}` | Crear o renombrar categorías. | Administrativo. `201` o `200` con la categoría. `409 category_name_taken` si el nombre se repite. |
| RF-03 | `POST /api/equipment`, `PATCH /api/equipment/{id}` | Crear o modificar equipos y su categoría. | Administrativo. `201` o `200` con el equipo. `409 equipment_name_taken` si el nombre se repite en la categoría. |
| RF-03 | `GET /api/units?equipmentId={id}`, `GET /api/units/{id}` | Listar unidades e identificar sus códigos. | Administrativo. `200` con las unidades. |
| RF-03 | `POST /api/units`, `PATCH /api/units/{id}` | Registrar una unidad o actualizar su código y su estado activo. | Administrativo. `201` o `200` con la unidad. `409 inventory_code_taken` si el código ya identifica a otra unidad. |

Un equipo se representa como `{"id","name","description","category":{"id","name"},"activeUnits"}` y una unidad como
`{"id","inventoryCode","active","equipment":{"id","name","category":{"id","name"}}}`. `activeUnits` cuenta unidades activas
del inventario y no considera reservas ni intervalos. El inventario no ofrece borrado: una unidad fuera de servicio pasa a
`active: false` y conserva su identificador.

Las operaciones administrativas se identifican con `Authorization: Bearer <credencial>`. Es una frontera provisional hasta
que RF-01 defina la sesión; su firma y su sustitución están descritas en [el contrato de inventario](../docs/inventory-contract.md).

## Contratos propuestos del MVP

| Requisito | Método y ruta | Operación | Acceso y respuesta esperada |
| --- | --- | --- | --- |
| RF-01 | `POST /api/users` | Registrar con `email` y `password`. | Público. `201` con el identificador y el correo de la cuenta. |
| RF-01 | `POST /api/sessions` | Iniciar sesión con `email` y `password`. | Público. `200` si las credenciales son válidas, `401` si son inválidas. El mecanismo de sesión está pendiente. |
| RF-04 | `GET /api/availability?equipmentId={id}&start={instant}&end={instant}` | Consultar unidades disponibles del equipo para un intervalo. | Público. `200` con unidades disponibles o una lista vacía. |
| RF-05 | `POST /api/reservations` | Crear una reserva enviando `unitId`, `start` y `end`. | Sesión requerida. `201` con la reserva confirmada o `409` por indisponibilidad. |
| RF-06 | `GET /api/reservations` | Consultar las reservas del titular autenticado. | Sesión requerida. `200` con las reservas propias. |
| RF-06 | `PATCH /api/reservations/{id}` | Solicitar cancelación con `status: "cancelled"`. | Titular. `200` con la reserva cancelada o `409` si su estado o la política impiden cancelar. |

Los parámetros temporales usan RFC 3339 con desplazamiento explícito y las respuestas temporales se expresan en UTC.

Todos los errores, incluidos los de las rutas ya implementadas, usan un objeto JSON con `error.code` y `error.message`. Se
emplea `400` para entradas inválidas, `401` cuando falta una credencial válida, `403` para un rol insuficiente, `404` para
recursos inexistentes o reservas ajenas, `405` con cabecera `Allow` para un método no admitido, `409` para conflictos de
unicidad o de disponibilidad y `413` para un cuerpo que excede el límite. Las respuestas de reserva omiten información
interna del conflicto. El catálogo e inventario ya aplican estos códigos; el listado completo está en
[el contrato de inventario](../docs/inventory-contract.md).
