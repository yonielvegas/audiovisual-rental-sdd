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

## Identidad visual

- Yoel aprobó el prototipo de landing para la Issue #10 y adoptó el glassmorphism oscuro para las pantallas públicas y las de administración. Los componentes compartidos y criterios de aplicación están en [la guía de UI/UX](ui-ux.md).
