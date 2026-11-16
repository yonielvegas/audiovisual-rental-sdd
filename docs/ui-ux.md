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

- **Eric, catálogo e inventario.** Implementa el catálogo en `/catalogo` con su [página temporal](../src/frontend/catalog.html) como punto de entrada. Reutiliza los componentes para tarjetas, estados vacíos y acciones de administración. [Issue #4](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/4)
- **Yini, reservas y disponibilidad.** Usa el mismo layout y estilos para formularios de horarios, lista de reservas y mensajes de confirmación, error o conflicto. [Issue #5](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/5)
- **Todas las pantallas.** Comprueba navegación por teclado, foco visible, ausencia de desbordamiento móvil, textos de estado explícitos y lectura sobre fondos translúcidos. Los nombres de acciones y los mensajes de error deben indicar qué puede hacer la persona.

La landing y el catálogo provisional son referencias de implementación. El [flujo de trabajo académico](project-workflow.md) describe cómo vincular cambios, criterios, pruebas y evidencia.
