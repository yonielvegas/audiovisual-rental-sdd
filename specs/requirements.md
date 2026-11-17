# Requisitos

El alcance funcional procede de la solicitud del proyecto. Los contratos y las reglas quedan documentados junto a la implementación integrada del MVP. Los resultados y metas de validación se documentan en [ODD](outcomes.md).

## Requisitos funcionales

| ID | Alcance confirmado | Resultado |
| --- | --- | --- |
| RF-01 | Las personas pueden registrarse e iniciar sesión. | O-01, O-04 |
| RF-02 | Una persona puede consultar el catálogo público de equipos y sus categorías. | O-01 |
| RF-03 | El personal autorizado puede administrar equipos y su inventario. Cada unidad tiene una identidad individual, incluso cuando comparte equipo o modelo. | O-03 |
| RF-04 | Una persona puede consultar la disponibilidad de un equipo para un intervalo. | O-01 |
| RF-05 | Una persona autenticada puede crear una reserva por intervalo. Una unidad física queda protegida contra reservas activas superpuestas, incluso con solicitudes simultáneas. | O-01, O-02 |
| RF-06 | Una persona autenticada puede consultar sus propias reservas y cancelar las que correspondan según la política acordada. | O-04 |

## Requisitos técnicos y de calidad

| ID | Requisito | Evidencia |
| --- | --- | --- |
| RT-01 | La aplicación base levanta frontend, backend y PostgreSQL mediante Docker Compose. Incluye configuración por entorno, migraciones iniciales, una página de inicio, comprobación de salud, instrucciones de ejecución, pruebas técnicas y CI. | Ejecución reproducible y comprobaciones de infraestructura. |
| RT-02 | El backend verifica identidad, rol y titularidad para cada operación protegida. | Casos de acceso sin sesión, sin rol y entre dos titulares. |
| RT-03 | PostgreSQL preserva la integridad de las reservas simultáneas. | Prueba concurrente que consulta el estado final de la base de datos. |

RF-01 se implementó con catálogo e inventario en el PR #12. La política de fechas y cancelación de RF-04 a RF-06 está documentada en [reglas de negocio](business-rules.md). El límite del formulario web se detalla en [el cambio de requisito](../docs/requirement-change.md).

## Límites del MVP

Quedan fuera la gestión detallada de devoluciones, daños y mantenimiento avanzado, multas, logística, facturación y reportes avanzados. La incorporación de pagos requiere aprobación. La entrega de infraestructura cubre RT-01. Los PRs #12 y #13 entregaron las funcionalidades de negocio según la especificación integrada.
