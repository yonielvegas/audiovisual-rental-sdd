# Guía de trabajo y entrega académica

Fuente primaria: **DSaIA-Proyecto2.pdf**, páginas 1–3, profesor Regis Rivera, Tópicos Especiales II. El Laboratorio 13 sirve como referencia para SDD.

## Indicaciones del profesor

1. Mantener un equipo de tres estudiantes con los integrantes del Proyecto #1. Rotar Product / Spec Lead, Architecture / Development Lead y QA / DevOps Lead por ciclo. [Roles y rotación](roles-and-cycles.md)
2. Aplicar **ODD primero**. Identificar el problema, explorar necesidades con preguntas y definir el resultado de valor para el usuario. Luego aplicar **SDD**, convertir el resultado en especificaciones y planificar antes de programar. Demostrar la cadena **ODD → SDD → código → pruebas → valor**. [Resultados](../specs/outcomes.md) · [Plan](../specs/implementation-plan.md)
3. Usar agentes de IA y registrar cada aporte relevante con actividad, IA utilizada, solicitud, resultado y decisión humana. La elección de modelo, herramienta y stack es libre. Documentar el stack en arquitectura. [Registro de IA](ai-log.md) · [Arquitectura](../specs/architecture.md)
4. Mantener un repositorio Git con README, Issues, ramas, commits identificables, PRs o revisión equivalente e historial de cambios. La estructura de carpetas del enunciado es una referencia. [README](../README.md)
5. Incluir pruebas automatizadas unitarias, de reglas críticas, de validaciones de usuario, de conflictos de reserva y de criterios de aceptación. La prevención de doble reserva requiere una prueba automatizada. [Estrategia de pruebas](testing.md)
6. Incorporar un cambio inesperado de requisito a mitad del desarrollo y conservar evidencia desde la solicitud hasta el resultado. Actualizar especificación, aceptación y plan antes del código, luego adaptar las pruebas y demostrar el comportamiento. [Plantilla de cambio](../.github/ISSUE_TEMPLATE/cambio-de-requisito.md)
7. Prepararse como equipo para la presentación. Cualquier integrante puede ser elegido al azar y el profesor puede pedir cambios durante la exposición. Entregar la evidencia anterior y los materiales que se usen para presentar. Las diapositivas son opcionales y una persona puede realizar la entrega por el equipo.

Consulta el [guion de entrega](delivery.md) para localizar la evidencia de cada indicación y preparar la demostración.

## Cómo lo aplicamos en este repositorio

- Desde `main`, abrir una rama por entrega. Enlazar la Issue, el requisito y el criterio en el PR. Publicar cambios pequeños cuando una Issue tenga varios entregables.
- Para reglas de negocio nuevas, aclarar las propuestas pendientes en [decisiones](decisions.md) y actualizar la especificación antes de implementar.
- Ejecutar las pruebas pertinentes y registrar qué se ejecutó, en qué commit y con qué resultado. Adjuntar el enlace de CI cuando aplique. Indicar quién revisó o probó realmente la entrega.
- Usar la [guía de UI/UX](ui-ux.md) en todas las pantallas. Cerrar la Issue al verificar sus criterios de aceptación. Al cierre de cada ciclo, registrar los aportes reales y el siguiente responsable según la rotación.
