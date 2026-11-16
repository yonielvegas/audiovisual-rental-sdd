# Registro de decisiones

## Confirmadas en la solicitud inicial

| Decisión | Motivo o fuente |
| --- | --- |
| Desarrollar un sistema académico de alquiler y reserva de equipos audiovisuales. | Alcance solicitado para el Proyecto #2 de Tópicos Especiales II. |
| Aplicar ODD primero y especificar con SDD antes de implementar lógica de negocio. | Indicaciones académicas y secuencia de trabajo solicitada. |
| Identificar unidades físicas individualmente y reservarlas por intervalos. | Alcance funcional del MVP. |
| Mantener trazabilidad con Issues, ramas, commits, Pull Requests, pruebas y registro del uso de IA. | Evidencias exigidas por el proceso académico. |
| Posponer devoluciones detalladas, mantenimiento avanzado, multas, logística, facturación y reportes avanzados. | Alcance acordado para el MVP académico. |

## Pendientes de definición o aprobación

- La inclusión de pagos requerirá aprobación. La infraestructura inicial queda fuera de esa decisión.
- Las hipótesis de problema y los valores objetivo se formularán durante ODD, con su método de validación.
- El diseño técnico, las reglas específicas y los contratos se documentarán durante SDD y registrarán las decisiones que requieran aprobación.
- El cambio inesperado de requisito se registrará cuando se reciba durante el desarrollo.

## Decisión técnica de infraestructura

- Adoptar Node.js 24, HTML/CSS/JS, PostgreSQL 17 y Docker Compose para la base. La solicitud delegó la elección del stack. La justificación y la secuencia de arranque están en [arquitectura](../specs/architecture.md).
- La primera migración creará el esquema de aplicación y se registrará en un historial de versiones. Catálogo, cuentas y reservas tendrán sus propias migraciones cuando se aprueben sus contratos.

## Revisión del SDD funcional

- Pendientes de acuerdo: intervalo semiabierto, precisión y duración, elegibilidad de reservas con inicio pasado, política de cancelación y desactivación de unidades con reservas, responsable y mecanismo de autenticación, y alta de administradores.
- El equipo registrará aquí la versión, fecha y participantes reales cuando se apruebe el contrato funcional. El punto de control se aplica antes de programar lógica de negocio. La Issue 3 utiliza el contrato técnico de inicio y salud y su aceptación se verifica por separado.

## Catálogo e inventario de la Issue #4

Decisiones técnicas adoptadas al implementar RF-02 y RF-03. Quedan abiertas a revisión del equipo y las garantías que afectan a Reservas están reunidas en [el contrato de inventario](inventory-contract.md).

| Decisión | Motivo |
| --- | --- |
| `units.id` es el identificador estable que referencian las reservas y `inventory_code` es el identificador legible de la etiqueta física. | Permite corregir un código mal etiquetado sin romper ninguna reserva. El alcance pide una identidad individual y estable por unidad. |
| El código de inventario es único en todo el inventario, no dentro de cada equipo, y se normaliza a mayúsculas. | El personal lee el código sobre el equipo, donde no hay contexto de a qué equipo pertenece. La normalización evita que `cam-001` y `CAM-001` convivan. |
| La unicidad la decide un índice único de PostgreSQL y la aplicación traduce `23505` a HTTP 409. | Dos solicitudes simultáneas no pueden registrar el mismo código. Una comprobación previa en la aplicación dejaría una ventana de carrera. |
| Las unidades físicas no se borran. Una unidad fuera de servicio pasa a `active = false`. | Conserva el historial de reservas y hace que AC-03 pueda comprobar que el inventario se preserva. Es además una garantía publicada en el contrato que consume Reservas. |
| Las categorías y los equipos sí se eliminan, pero solo cuando no queda nada que dependa de ellos. El rechazo lo decide la clave foránea `ON DELETE RESTRICT` y la aplicación traduce `23503` a HTTP 409. | La administración pidió poder eliminar registros. Limitarlo a lo que está vacío da esa capacidad sin poner en riesgo las unidades ni las reservas, y evita una comprobación previa con ventana de carrera. |
| Los nombres de categoría son únicos y los de equipo son únicos dentro de su categoría, comparando en minúsculas. | Un catálogo público con dos entradas que solo difieren en mayúsculas confunde a quien consulta. Va más allá del mínimo del modelo de datos y necesita confirmación del equipo. |
| El catálogo publica todos los equipos y muestra su número de unidades activas, sin ocultar los que tienen cero. | No se inventa una regla de publicación que la especificación no fija. Queda pendiente decidir si un equipo sin unidades activas debe ocultarse. |
| Una desactivación de unidad y una confirmación de reserva se serializan con bloqueos de fila (`FOR UPDATE` frente a `FOR SHARE`). | Responde la pregunta abierta sobre desactivar unidades con reservas vigentes, sin bloquear el inventario completo. |
| El rol administrativo se comprueba en una única frontera, `src/backend/access.js`, que las rutas consultan declarando el rol que exigen. | Mantiene el control de acceso en un solo lugar. Al implementar RF-01 bastó sustituir la resolución del actor sin tocar ninguna ruta del inventario. |
| La administración se expone en la página `/inventario`, protegida por rol en el servidor. | Permite demostrar AC-03 y O-03 en el navegador. La página no se sirve siquiera a quien no tiene rol `ADMIN`. |

Pendiente de acuerdo del equipo: qué ocurre con las reservas ya confirmadas de una unidad que se desactiva y si un equipo sin unidades activas debe salir del catálogo público.

## Interfaz de administración del inventario

| Decisión | Motivo |
| --- | --- |
| La administración se organiza en tres pestañas (categorías, equipos y unidades) con tabla, buscador y filtros, sobre los mismos contratos de `/api`. | Cada entidad tiene su propio volumen y sus propios criterios de búsqueda. Separarlas evita una pantalla saturada sin añadir rutas ni lógica de negocio. |
| Los formularios viven en ventanas modales nativas `<dialog>`, y los errores del servidor se muestran dentro de la ventana en vez de cerrarla. | El elemento nativo aporta foco atrapado, cierre con Escape y fondo inerte sin dependencias. Conservar lo escrito tras un 409 evita rehacer el formulario. |
| Toda acción destructiva pide confirmación, y la confirmación se resuelve una sola vez con un resolvedor compartido. | Una primera versión con oyentes por invocación podía dejar una promesa pendiente y ejecutar la acción dos veces. El resolvedor único hace imposible ese doble disparo. |
| En las unidades, la acción destructiva es «Retirar», no «Eliminar». | Refleja en la interfaz la regla de que una unidad conserva su identificador. El texto de la confirmación lo explica. |
| En pantallas estrechas cada fila de la tabla se presenta como una ficha con etiquetas. | Mantiene legible el inventario en móvil sin desplazamiento horizontal ni una segunda plantilla. |

## Cuentas, sesión y roles de RF-01

Decisiones técnicas adoptadas al implementar el registro, el inicio de sesión y la autorización por rol. El contrato publicado está en [los contratos de API](../specs/api.md).

| Decisión | Motivo |
| --- | --- |
| Las contraseñas se guardan con Argon2id (19 MiB, dos pasadas, un hilo), mediante `@node-rs/argon2`. | Es la primera opción de la RFC 9106 y resiste ataques por GPU mejor que bcrypt. El paquete trae binarios precompilados para las plataformas del lockfile, así que funciona con el `npm ci --ignore-scripts` del Dockerfile sin añadir cadena de compilación. La codificación PHC guarda sal y parámetros junto al hash, de modo que subir el coste no invalida las contraseñas existentes. |
| El identificador de acceso es `username` y no el correo. El correo queda opcional. | La cuenta administrativa acordada entra como `admin`, que no es un correo. Un único campo de identidad mantiene una sola interfaz de acceso para todas las cuentas. |
| Las sesiones viven en PostgreSQL y la cookie solo lleva una credencial opaca de 32 bytes. La tabla guarda su SHA-256. | Resuelve la decisión abierta sobre el almacenamiento de sesiones. Permite revocar al cerrar sesión, cosa que un testigo autofirmado no permite, y una copia de la base no basta para suplantar una sesión abierta. |
| La cookie es `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` cuando `SESSION_COOKIE_SECURE` está activa. | `HttpOnly` impide que un script lea la credencial. `SameSite=Lax` evita que viaje en escrituras iniciadas desde otro sitio, lo que, junto a exigir `Content-Type: application/json`, cubre el riesgo de falsificación de petición entre sitios sin añadir un testigo aparte. |
| La sesión caduca a las doce horas desde el inicio, sin renovación deslizante. | Es una política simple y predecible para una demostración académica. Cerrar sesión revoca en el acto, así que la caducidad solo cubre el olvido. |
| Unas credenciales incorrectas y una cuenta inexistente devuelven la misma respuesta y consumen el mismo tiempo de verificación. | Evita que la API sirva para averiguar qué nombres de usuario están registrados. |
| Los intentos fallidos se frenan por combinación de usuario y origen, en memoria del proceso. | Detiene una ráfaga de contraseñas contra una cuenta sin que un cliente pueda bloquear a los demás. Un despliegue con varias instancias necesitaría llevar el recuento a un almacén compartido. |
| La cuenta administrativa la crea `bootstrap-admin.js` junto a las migraciones, con la contraseña tomada de `ADMIN_PASSWORD`. | La contraseña no aparece en el código ni en el repositorio: `.env` está en `.gitignore` y `.env.example` solo lleva un marcador. Una instalación limpia queda operativa sin pasos manuales y el proceso es idempotente. |
| El registro público siempre crea cuentas con rol `USER`. No hay forma de pedir `ADMIN` desde la API. | El rol administrativo solo se concede desde el entorno del servidor. |

Pendiente de acuerdo del equipo: si hace falta promover cuentas a `ADMIN` desde la propia aplicación, qué ocurre con las reservas de una cuenta eliminada y si la política de caducidad de sesión debe ser deslizante. La contraseña acordada para la demostración es débil para un sistema real; fuera del entorno académico debe sustituirse por una larga y única.

## Identidad visual

- Yoel aprobó el prototipo de landing para la Issue #10 y adoptó el glassmorphism oscuro para las pantallas públicas y las de administración. Los componentes compartidos y criterios de aplicación están en [la guía de UI/UX](ui-ux.md).
