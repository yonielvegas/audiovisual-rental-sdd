# Plan de implementación

Estado: plan inicial de SDD. Referencia metodológica: fases 1 y 2 del Proyecto #2 y Laboratorio 13 del profesor Regis Rivera.

## Secuencia

| Trabajo | Responsable | Depende de | Entregable y prueba |
| --- | --- | --- | --- |
| Aplicar ODD | Yoel | Primer commit | Resultados O-01 a O-04, supuestos y preguntas en [outcomes.md](outcomes.md). |
| Aplicar SDD | Yoel | ODD | Requisitos, reglas, datos, contratos, criterios AC-01 a AC-10 y este plan. Revisión de trazabilidad y decisiones abiertas. |
| Inicializar sistema ejecutable | Yoel | SDD | RT-01 e infraestructura. AC-08 a AC-10, pruebas locales, CI y arranque verificable desde un clon. |
| Cuentas y sesiones | Equipo | Infraestructura | RF-01 y AC-01, RT-02. Registro, inicio y cierre de sesión, roles `ADMIN` y `USER`, hash Argon2id y alta del administrador desde el entorno. Entregado con pruebas de autenticación, roles y caducidad de sesión. |
| Catálogo e inventario | Eric | Infraestructura | RF-02 y RF-03, AC-02 y AC-03. Categorías, equipos, unidades físicas, catálogo público y administración básica. Entregado con pruebas de consultas, permisos y unicidad, y con [el contrato de inventario](../docs/inventory-contract.md) para Reservas. |
| Reservas y disponibilidad | Yini, prevista | Catálogo e inventario, ya disponible | RF-04 a RF-06, AC-04 a AC-07. Disponibilidad, reservas, cancelación y prueba obligatoria de doble reserva. Parte de [el contrato de inventario](../docs/inventory-contract.md). |

RF-01 y AC-01 están implementados: registro público, inicio de sesión único para todas las cuentas, cierre de sesión y autorización por rol `ADMIN` y `USER`. El contrato de sesión está descrito en [los contratos de API](api.md) y la frontera que consume Reservas, en [el contrato de inventario](../docs/inventory-contract.md). Las cuentas de prueba para los demás flujos serán ficticias. Los accesos de colaboración en GitHub se asignarán a cuentas verificadas.

## Tareas de infraestructura

1. Crear el proyecto Node con dependencias bloqueadas y estructura separada para frontend y backend. Preparar pruebas del contrato de salud y de la página inicial.
2. Preparar Compose, la base de datos y la migración inicial del esquema. Registrar versiones en la base de datos y comprobar que volver a ejecutar el migrador no aplica dos veces la misma migración.
3. Servir la página estática y la ruta de salud. Comprobar estados de base de datos disponible y no disponible.
4. Ejecutar la suite local, iniciar la composición, inspeccionar las migraciones y el estado de servicios, cargar la página en el navegador y comprobar el arranque desde un clon limpio. Ejecutar los mismos controles automáticos en GitHub Actions cuando el remoto esté disponible.

## Puntos de revisión

- Antes de lógica funcional, acordar las decisiones abiertas de [reglas](business-rules.md), [datos](data-model.md) y [API](api.md). Registrar fecha, versión y participantes reales en [decisiones](../docs/decisions.md).
- Cada cambio funcional debe enlazar el resultado de ODD, el requisito, su criterio, la prueba y la evidencia, además de la Issue y el PR correspondientes. Las propuestas se convierten en criterios pactados con el equipo antes de implementar.
- Cuando se reciba un cambio inesperado, registrar la solicitud, revisar especificación y criterios, ajustar tareas, cambiar pruebas y código, y mostrar el resultado. La plantilla de solicitud está preparada para ese momento.
