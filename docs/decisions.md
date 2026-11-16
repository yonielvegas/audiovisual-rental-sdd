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
| El inventario no ofrece borrado. Una unidad fuera de servicio pasa a `active = false`. | Conserva el historial de reservas y hace que AC-03 pueda comprobar que el inventario se preserva. |
| Los nombres de categoría son únicos y los de equipo son únicos dentro de su categoría, comparando en minúsculas. | Un catálogo público con dos entradas que solo difieren en mayúsculas confunde a quien consulta. Va más allá del mínimo del modelo de datos y necesita confirmación del equipo. |
| El catálogo publica todos los equipos y muestra su número de unidades activas, sin ocultar los que tienen cero. | No se inventa una regla de publicación que la especificación no fija. Queda pendiente decidir si un equipo sin unidades activas debe ocultarse. |
| Una desactivación de unidad y una confirmación de reserva se serializan con bloqueos de fila (`FOR UPDATE` frente a `FOR SHARE`). | Responde la pregunta abierta sobre desactivar unidades con reservas vigentes, sin bloquear el inventario completo. |
| Hasta que RF-01 aporte la sesión, el rol administrativo se identifica con credenciales portadoras configuradas por entorno. | RF-03 y AC-03 exigen comprobar permisos antes de que exista RF-01. La frontera está aislada en `src/backend/access.js` y solo se sustituye esa función cuando llegue la sesión acordada. |
| La administración se expone en la página `/inventario`, que pide la credencial y la guarda solo en la pestaña actual. | Permite demostrar AC-03 y O-03 en el navegador sin adelantar el diseño de la pantalla de inicio de sesión. |

Pendiente de acuerdo del equipo: qué ocurre con las reservas ya confirmadas de una unidad que se desactiva, si un equipo sin unidades activas debe salir del catálogo público y cómo se da de alta una cuenta administrativa cuando exista RF-01.

## Identidad visual

- Yoel aprobó el prototipo de landing para la Issue #10 y adoptó el glassmorphism oscuro para las pantallas públicas y las de administración. Los componentes compartidos y criterios de aplicación están en [la guía de UI/UX](ui-ux.md).
