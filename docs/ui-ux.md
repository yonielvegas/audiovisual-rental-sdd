# Guía de UI/UX

**Decisión aprobada en la [Issue #10](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/10).** La identidad visual de todo el sistema es glassmorphism oscuro con inspiración en un estudio audiovisual. Se aplica a la landing, el catálogo, la administración, la autenticación y las reservas.

## Identidad y componentes

| Elemento | Uso |
| --- | --- |
| Azul noche y grafito | Fondo general y superficies densas como tablas, formularios y paneles administrativos. |
| Vidrio azulado con borde tenue | Cabecera, tarjetas y paneles. `.glass` conserva una superficie opaca cuando el navegador carece de desenfoque. |
| Turquesa | Acción principal, enlaces y foco. Mantén una acción principal por contexto y utiliza `.button-secondary` para acciones secundarias. |
| Violeta y luz teal | Acentos ambientales y fotografía. Sobre imágenes, usa un fondo oscurecido para mantener legibles el texto y los controles. |
| Tipografía sans-serif | Escala fluida. Títulos claros y etiquetas de acción breves en español. |

Los colores, radios y espaciados compartidos están en [styles.css](../src/frontend/styles.css). El [layout](../src/frontend/layout.html) centraliza cabecera, navegación, enlace para saltar al contenido, pie e indicador de salud. Usa `.shell` para alinear contenido y `.glass` para superficies.

## Integración

- **Catálogo e inventario, entregados.** `/catalogo` presenta las categorías como filtros (`.chip`) y los equipos como tarjetas (`.card-grid`, `.equipment-card`). `/inventario` reúne los formularios y listas de administración (`.form-panel`, `.field-row`, `.record-list`). Ambos reutilizan `.shell`, `.glass` y los botones compartidos, y añaden a la hoja de estilos los componentes de filtro, tarjeta, formulario y registro para las siguientes pantallas. [Issue #4](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/4)
- **Reservas y disponibilidad, implementadas.** `/disponibilidad` reutiliza `.form-panel`, `.field-row` y el horario local del navegador; la ficha del catálogo preselecciona el equipo. `/reservas` muestra el historial propio con `.record-list`. Ambas comparten layout, `.glass`, `.feedback`, confirmaciones con `<dialog>`, foco y estados de carga y conflicto. La entrada sin sesión conserva equipo e intervalo al dirigir al acceso. [Issue #5](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/5)
- **Todas las pantallas.** Comprueba navegación por teclado, foco visible, ausencia de desbordamiento móvil, textos de estado explícitos y lectura sobre fondos translúcidos. Los nombres de acciones y los mensajes de error deben indicar qué puede hacer la persona.

La landing, el catálogo y la administración del inventario son las referencias de implementación vigentes. El [flujo de trabajo académico](project-workflow.md) describe cómo vincular cambios, criterios, pruebas y evidencia.

El selector de reservas usa un calendario propio con el estilo oscuro y turquesa, días pasados deshabilitados y navegación por flechas, Inicio/Fin y PageUp/PageDown. Las tarjetas separan recogida y devolución, con hora y minutos en formato de 12 horas y selector AM/PM y duración visible. Para hoy, el mínimo es el siguiente minuto; la devolución debe ser posterior a la recogida. Los límites se actualizan al cambiar de minuto y al volver a la pantalla. Un enlace con fechas vencidas se abre con un intervalo futuro válido. Esta restricción guía el formulario de reserva; la consulta histórica de la API conserva su contrato.
