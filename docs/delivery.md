# Entrega del Proyecto #2

Sistema de reservas de equipos audiovisuales. Tópicos Especiales II, profesor Regis Rivera. El código del MVP revisado corresponde a `f9c1951` en `main`.

## Evidencias para entregar

| Indicaciones del profesor | Evidencia |
| --- | --- |
| ODD → SDD → código → pruebas → valor para el usuario | [Resultados](../specs/outcomes.md), [plan SDD](../specs/implementation-plan.md), [criterios](../specs/acceptance-criteria.md) y [matriz verificada](testing.md). |
| Repositorio, Issues, ramas, commits e historial de revisión | [Repositorio](https://github.com/yonielvegas/audiovisual-rental-sdd), [Issues](https://github.com/yonielvegas/audiovisual-rental-sdd/issues?q=is%3Aissue) y [contribuciones comprobadas](roles-and-cycles.md). |
| Agentes de IA y decisiones humanas | [Registro de IA](ai-log.md) y [decisiones](decisions.md). |
| Pruebas unitarias, validaciones de usuarios, aceptación y reglas críticas | 82 pruebas de la suite y 12 comprobaciones con PostgreSQL, incluida la doble reserva concurrente. [Ejecución de GitHub Actions](https://github.com/yonielvegas/audiovisual-rental-sdd/actions/runs/44121109157). |
| Cambio de requisito durante el desarrollo | [Cambio del calendario](requirement-change.md), con situación anterior, solicitud registrada, criterios, código y pruebas. |
| Instalación y tecnología | [README](../README.md), [arquitectura](../specs/architecture.md) y [guía de UI/UX](ui-ux.md). |
| Trabajo grupal y rotación | [Plan de rotación y aportes verificados](roles-and-cycles.md). |

## Guion para exponer

1. Explicar el problema de coordinar unidades y horarios, y mostrar O-01 y O-02 en el documento ODD.
2. Abrir la aplicación siguiendo el README. Desde la landing entrar al catálogo, elegir un equipo y consultar una fecha futura. Señalar que la disponibilidad corresponde a una unidad física durante el intervalo completo.
3. Con una cuenta ficticia, registrarse o entrar, confirmar la reserva y mostrarla en **Mis reservas**. Cancelarla antes del inicio y consultar otra vez el intervalo para comprobar que se liberó. Con una segunda cuenta, comprobar que el historial de la primera queda aislado.
4. Entrar como administrador con la contraseña local de `ADMIN_PASSWORD`. Mostrar dos unidades del mismo equipo con códigos distintos. Explicar el rechazo de códigos duplicados y de escrituras de usuarios comunes.
5. Mostrar la evidencia de concurrencia de AC-06. Ocho pares de solicitudes obtuvieron una confirmación y un conflicto por par; PostgreSQL conservó una sola reserva confirmada para cada disputa.
6. Mostrar el antes y el después del selector de fechas. Probar un enlace con un horario vencido y un alquiler futuro, y explicar el alcance del cambio.
7. Abrir el registro de IA, los PRs y la rotación. Cada integrante debe poder presentar la cadena completa y explicar un posible cambio que pida el profesor.

## Ensayo técnico registrado

El 17 de noviembre de 2026, Codex usó Microsoft Edge con la zona de Panamá y PostgreSQL de prueba aislado para ejecutar cinco veces el flujo de creación de cuenta, consulta de un intervalo futuro, confirmación y cancelación. Los cinco intentos terminaron con la reserva confirmada y luego cancelada. Se usaron cuentas ficticias distintas.

| Intento | Resultado | Tiempo automatizado |
| --- | --- | --- |
| 1 | Confirmada y cancelada | 1,00 s |
| 2 | Confirmada y cancelada | 0,66 s |
| 3 | Confirmada y cancelada | 0,58 s |
| 4 | Confirmada y cancelada | 0,77 s |
| 5 | Confirmada y cancelada | 0,99 s |

Los tiempos corresponden a automatización del navegador. La meta humana de O-01 se mide durante el ensayo del equipo, con cinco ejecuciones, registro de ayudas y comparación con la coordinación manual simulada. Registrar también la identificación de dos unidades por un integrante para O-03. O-02 y el aislamiento y la cancelación de O-04 ya cuentan con [evidencia técnica](testing.md).

Para completar el ensayo humano, anotar por intento: fecha, ejecutor, commit, éxito o falla, ayuda recibida, tiempo, prueba que se mostró y enlace a su evidencia. Los avances de rotación se registran con fecha, roles ejercidos y revisión real.

## Entrega

Compartir el repositorio y el acceso al profesor según el canal que indique la asignatura. Adjuntar el material que el equipo use para exponer. Este guion puede usarse como material principal. Antes de enviar, comprobar el acceso a los enlaces privados y acordar quién realizará la entrega.
