# Contratos API

El navegador y la API comparten origen y usan la ruta base `/api`. La entrega de infraestructura publica la comprobación de salud. Cuentas y sesiones (RF-01) y catálogo e inventario (RF-02 y RF-03) están implementados. El contrato detallado del inventario, incluidas las garantías para Reservas, está en [el contrato de inventario](../docs/inventory-contract.md). Los contratos de disponibilidad y reservas siguen siendo propuestas para revisión.

## Infraestructura

| Método y ruta | Condición | Respuesta JSON |
| --- | --- | --- |
| `GET /api/health` | El backend puede ejecutar una consulta de comprobación contra PostgreSQL. | `200 {"status":"ok","database":"up"}` |
| `GET /api/health` | El backend no puede ejecutar la consulta de comprobación. | `503 {"status":"unavailable","database":"down"}` |

La respuesta expone el estado del servicio y la base de datos. Los detalles de conexión, credenciales y errores internos se reservan para el servidor.

## Cuentas y sesiones implementadas

| Requisito | Método y ruta | Operación | Acceso y respuesta |
| --- | --- | --- | --- |
| RF-01 | `POST /api/users` | Registrar con `username`, `password` y `email` opcional. | Público. `201 {"user":{"id","username","role"},"redirect"}` y cookie de sesión. `409 username_taken` o `409 email_taken` si ya existen. |
| RF-01 | `POST /api/sessions` | Iniciar sesión con `username` y `password`. | Público. `200 {"user","redirect"}` y cookie de sesión. `401` si las credenciales no son válidas. `429 too_many_attempts` tras repetir fallos. |
| RF-01 | `GET /api/sessions/current` | Consultar la sesión activa. | Público. `200 {"user":{…}}` o `200 {"user":null}` sin sesión. |
| RF-01 | `DELETE /api/sessions/current` | Cerrar sesión. | Público. `204` y cookie vaciada. La sesión se borra del servidor, así que la revocación es inmediata. |

El identificador de acceso es `username`, no el correo, porque la cuenta administrativa entra como `admin`. El correo es
opcional y único cuando se indica. El registro público siempre crea cuentas con rol `USER`; el rol `ADMIN` solo lo concede
el proceso de inicialización descrito en el [README](../README.md).

La sesión viaja en la cookie `sesion`, con `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` cuando el despliegue sirve
HTTPS. El servidor guarda el SHA-256 de la credencial, nunca la credencial, y las contraseñas se almacenan como hash
Argon2id. `redirect` indica la pantalla que corresponde al rol: `/inventario` para `ADMIN` y `/catalogo` para `USER`.

Las páginas también respetan el rol. `GET /inventario` responde `302` hacia `/acceso?siguiente=%2Finventario` sin sesión y
`403` con una cuenta cuyo rol no es `ADMIN`.

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

Las operaciones administrativas exigen una sesión con rol `ADMIN`, establecida por `POST /api/sessions`. El backend
comprueba el rol antes de leer el cuerpo de la petición, de modo que una solicitud sin permisos nunca llega a modificar el
inventario.

## Contratos propuestos del MVP

| Requisito | Método y ruta | Operación | Acceso y respuesta esperada |
| --- | --- | --- | --- |
| RF-04 | `GET /api/availability?equipmentId={id}&start={instant}&end={instant}` | Consultar unidades disponibles del equipo para un intervalo. | Público. `200` con unidades disponibles o una lista vacía. |
| RF-05 | `POST /api/reservations` | Crear una reserva enviando `unitId`, `start` y `end`. | Sesión requerida. `201` con la reserva confirmada o `409` por indisponibilidad. |
| RF-06 | `GET /api/reservations` | Consultar las reservas del titular autenticado. | Sesión requerida. `200` con las reservas propias. |
| RF-06 | `PATCH /api/reservations/{id}` | Solicitar cancelación con `status: "cancelled"`. | Titular. `200` con la reserva cancelada o `409` si su estado o la política impiden cancelar. |

Los parámetros temporales usan RFC 3339 con desplazamiento explícito y las respuestas temporales se expresan en UTC.

Todos los errores, incluidos los de las rutas ya implementadas, usan un objeto JSON con `error.code` y `error.message`. Se
emplea `400` para entradas inválidas, `401` cuando falta una sesión válida, `403` para un rol insuficiente, `404` para
recursos inexistentes o reservas ajenas, `405` con cabecera `Allow` para un método no admitido, `409` para conflictos de
unicidad o de disponibilidad, `413` para un cuerpo que excede el límite y `429` con cabecera `Retry-After` cuando se
repiten los intentos de inicio de sesión. Las respuestas de reserva omiten información
interna del conflicto. El catálogo e inventario ya aplican estos códigos; el listado completo está en
[el contrato de inventario](../docs/inventory-contract.md).
