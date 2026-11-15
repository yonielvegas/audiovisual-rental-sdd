# ODD · Resultados esperados

Estado: exploración inicial documentada. Las hipótesis y los umbrales se proponen para validación del equipo. Fuente académica: enunciado del Proyecto #2 de Regis Rivera, fase 1.

## Resultado que buscamos

Una persona que necesita equipo audiovisual debe poder comprobar qué unidades físicas están libres para el intervalo que necesita, reservar una y saber si quedó confirmada. El personal debe poder mantener un inventario que distinga cada unidad física y verificar que la misma unidad queda comprometida a una sola persona para un mismo horario.

## Contexto y usuarios

El proyecto simula la operación de una empresa de alquiler de equipos audiovisuales. El MVP acordado incluye registro e inicio de sesión, catálogo y categorías, inventario por unidad física, disponibilidad, reservas propias, cancelación y administración básica. La inclusión de pagos está pendiente de aprobación.

| Usuario | Necesidad | Supuesto que requiere validación |
| --- | --- | --- |
| Persona que alquila | Encontrar el equipo adecuado y confirmar un horario sin depender del personal. | Si la disponibilidad se coordina manualmente, verificarla puede exigir varios intercambios. |
| Personal encargado del inventario | Distinguir unidades del mismo modelo y mantener el inventario al día. | Un registro por modelo o por cantidades puede ocultar qué unidad se comprometió. |
| Personal que coordina reservas | Entregar una confirmación coherente cuando coinciden solicitudes. | Si dos personas pueden guardar por separado, existe riesgo de reservar la misma unidad dos veces. |

Estos escenarios representan hipótesis de trabajo para una empresa simulada. Las preguntas y mediciones son propuestas. El equipo registrará evidencia cuando ejecute la validación.

## Preguntas de exploración

1. En una solicitud típica, ¿qué pasos sigue hoy la persona para saber si un equipo se encuentra libre y dónde suele detenerse?
2. ¿El cliente necesita conocer el modelo exacto o puede utilizar cualquier unidad del mismo equipo? ¿Qué información le permite elegir?
3. ¿Cómo identifica el personal dos unidades del mismo modelo y qué información necesita ver para corregir el inventario?
4. Cuando coinciden solicitudes, ¿cómo se comunica a la persona que el horario se ocupó? ¿Qué alternativa le permite continuar?
5. ¿Cuándo espera el usuario poder cancelar y con qué confirmación? ¿Cuándo debe quedar libre el intervalo?
6. ¿Qué precisión temporal y zona horaria corresponden al escenario de alquiler? ¿Qué debe ocurrir con reservas contiguas?

## Resultados, medición y prioridad

| ID | Prioridad | Resultado | Indicador y objetivo propuesto | Cómo obtener evidencia |
| --- | --- | --- | --- | --- |
| O-01 | P0 | Consultar disponibilidad y completar una reserva sin ayuda. | Al menos 4 de 5 ejecuciones correctas en un guion de solicitud con un equipo y horario conocidos. | Cronometrar y anotar éxito y ayudas en cinco ejecuciones. Tomar como línea base la primera ejecución del guion en una coordinación manual simulada y declarar el tamaño de muestra. |
| O-02 | P0 | Una unidad queda reservada una sola vez durante un intervalo ocupado. | Cero reservas activas superpuestas de la misma unidad en los escenarios automatizados. Para dos solicitudes concurrentes que compiten por una unidad, exactamente una confirmación y un conflicto. | Ejecutar pruebas contra PostgreSQL y comprobar el número final de reservas activas. Incluir coincidencia total, parcial y simultánea. |
| O-03 | P1 | El personal distingue físicamente unidades del mismo modelo. | Identificar correctamente ambas unidades y sus códigos en el escenario de demostración. | Mostrar dos unidades ficticias de un mismo equipo con códigos distintos y registrar la identificación lograda. |
| O-04 | P1 | La persona consulta sus reservas y libera su horario al cancelar. | En el escenario de aceptación, la reserva aparece solo para su titular y el intervalo vuelve a estar disponible después de una cancelación permitida. | Ejecutar un guion con dos cuentas ficticias y guardar la prueba de acceso, la cancelación y la consulta posterior de disponibilidad. |

Los resultados P0 se usan para priorizar el flujo y la regla de integridad. Las cifras son metas de aceptación propuestas para una demostración académica. En ambiente de prueba se usarán datos ficticios.

## Criterios de revisión de esta fase

- [x] Contexto de la empresa simulada y usuarios descritos.
- [x] Problemas formulados como hipótesis, con preguntas para explorarlos.
- [x] Resultados priorizados con indicadores, metas y método de validación.
- [ ] Revisar con el equipo las preguntas, las metas y la evidencia del guion.

Validación pendiente: acordar con Product / Spec Lead el conjunto de escenarios, las metas y el registro de resultados antes de la demostración.
