# Cambio de requisito durante el desarrollo

## Calendario de disponibilidad y horarios vencidos

**Fecha registrada:** 17 de noviembre de 2026. **Entrega:** [Issue #5](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/5) · [PR #13](https://github.com/yonielvegas/audiovisual-rental-sdd/pull/13).

### Antes y solicitud

La primera versión de la pantalla usaba campos nativos `datetime-local`. Validaba que el inicio precediera al fin y permitía consultar un inicio vencido desde la interfaz. La creación de una reserva ya exigía un inicio futuro en el backend. La persona solicitante pidió durante la revisión un selector propio y bloquear días y horarios pasados en la interfaz. La solicitud se conserva en el [registro de IA](ai-log.md).

El estado anterior puede inspeccionarse en el [commit 73515ee](https://github.com/yonielvegas/audiovisual-rental-sdd/commit/73515ee96a54bb7a4b3b27dfa1f6ece18ad53baa), inmediatamente anterior al cambio de interfaz.

### Especificación, plan y aceptación

RF-04 incorpora un límite en el formulario web de disponibilidad. Los días pasados están deshabilitados. Para hoy, el inicio permitido se calcula desde el siguiente minuto, el fin debe ser posterior al inicio y un enlace con fecha vencida propone un horario futuro válido. El selector muestra horas de 12 horas y AM/PM. La consulta histórica de la API conserva su contrato. Ver [criterios](../specs/acceptance-criteria.md), [plan](../specs/implementation-plan.md) y [guía de UI/UX](ui-ux.md).

El trabajo abarcó el calendario y los límites de hora, validación al consultar, tratamiento de enlaces vencidos y conversión AM/PM. Se probaron medianoche, mediodía, cambios de día y año, fin mínimo y enlaces inválidos o vencidos.

### Código, pruebas y resultado

- [Commit 9b6cb3a](https://github.com/yonielvegas/audiovisual-rental-sdd/commit/9b6cb3aafad1b4d8dc9d4f3cd3d143298bc396c1) integra el selector y el bloqueo de horarios pasados.
- [Commit 636bd56](https://github.com/yonielvegas/audiovisual-rental-sdd/commit/636bd56d42669e3026a8cc22de4e4c38b60520ce) incorpora AM/PM y amplía las pruebas.
- [Pruebas del selector](../tests/schedule.test.js) y [ejecución de CI](https://github.com/yonielvegas/audiovisual-rental-sdd/actions/runs/44121109157). En `main` pasaron 82 pruebas de la suite, incluidas siete del selector. El ensayo en navegador confirmó que un horario futuro permite consultar, reservar y cancelar. [Evidencia](testing.md)

El registro de IA y los commits conservan la solicitud y el cambio real. Este documento consolida la trazabilidad al preparar la entrega. La actualización explícita de criterios y plan se registró en esa revisión documental posterior.
