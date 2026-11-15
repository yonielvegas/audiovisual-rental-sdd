# Criterios de aceptación

Los criterios AC-01 a AC-07 proponen cómo comprobar el MVP descrito en [requisitos](requirements.md). Sus detalles de negocio requieren revisión del equipo antes de implementar. AC-08 a AC-10 comprueban la entrega de infraestructura de la Issue 3. Las pruebas y evidencias esperadas se detallan en la [estrategia de pruebas](../docs/testing.md).

## Funcionalidad del MVP

| ID | Trazabilidad | Dado | Cuando | Entonces |
| --- | --- | --- | --- | --- |
| AC-01 | RF-01, O-01, O-04 | Una persona con un correo aún sin registrar. | Se registra con datos válidos y después inicia sesión con las credenciales creadas. También se prueban una entrada inválida y una contraseña incorrecta. | Puede acceder con la contraseña correcta. El registro inválido deja intacto el número de cuentas y el acceso con contraseña incorrecta se rechaza. |
| AC-02 | RF-02, O-01 | Un catálogo con equipos ficticios de al menos dos categorías. | Una persona sin sesión consulta el catálogo y elige una categoría. | Puede ver los equipos publicados y sus categorías. El resultado filtrado contiene solo equipos de la categoría seleccionada. |
| AC-03 | RF-03, O-03 | Un equipo y una cuenta con permisos de administración. | Se registran dos unidades físicas del mismo equipo con códigos distintos y se intenta repetir uno de esos códigos. Una cuenta sin permiso intenta modificar el inventario. | Se guardan y distinguen ambas unidades. El intento duplicado y la modificación sin permiso se rechazan y el inventario se conserva. |
| AC-04 | RF-04, O-01, O-02 | Dos unidades activas de un equipo y una reserva confirmada de 10:00 a 11:00 para la primera unidad. | Se consulta disponibilidad para 10:30 a 11:30, luego para 11:00 a 12:00, usando la misma fecha y desplazamiento horario. También se consulta un intervalo de duración cero. | Para el primer intervalo solo aparece la segunda unidad. Para el intervalo contiguo aparecen ambas. El intervalo de duración cero se rechaza. |
| AC-05 | RF-05, O-01, O-02 | Una persona autenticada y una unidad física libre. | Reserva un intervalo válido. Luego otra persona solicita la misma unidad en un intervalo solapado. | La primera recibe confirmación con la unidad y su intervalo. La segunda recibe HTTP 409 y PostgreSQL conserva una sola reserva confirmada en el intervalo en disputa. Dos reservas en unidades distintas pueden compartir horario. |
| AC-06 | RF-05, O-02 | Dos personas autenticadas y una unidad física libre. | Envían simultáneamente solicitudes por la misma unidad con intervalos superpuestos. | Exactamente una solicitud confirma y la otra devuelve HTTP 409. La comprobación en PostgreSQL después de ambas respuestas encuentra una sola reserva confirmada en el intervalo en disputa. |
| AC-07 | RF-06, O-04 | Dos cuentas autenticadas. La primera tiene una reserva confirmada que se encuentra dentro de las condiciones de cancelación acordadas. | Ambas consultan sus reservas. La segunda intenta cancelar la reserva ajena y luego la titular cancela la propia. Se vuelve a consultar la disponibilidad del intervalo. | Solo la titular ve su reserva. La cancelación ajena se rechaza y la propia queda registrada como cancelada. La unidad vuelve a aparecer disponible si satisface las demás reglas. |

Los ejemplos horarios aplican la propuesta de intervalo semiabierto `[inicio, fin)`. Envían instantes RFC 3339 con desplazamiento explícito y esperan resultados equivalentes cuando dos entradas representan el mismo instante.

## Infraestructura inicial

| ID | Trazabilidad | Dado | Cuando | Entonces |
| --- | --- | --- | --- | --- |
| AC-08 | RT-01 | Un clon limpio, Docker Compose y variables configuradas según el README. | Se construye y arranca la composición con un volumen de prueba vacío, y después se ejecutan nuevamente las migraciones sobre ese volumen. | PostgreSQL queda disponible, las migraciones iniciales finalizan correctamente, cada versión queda registrada una sola vez y el backend inicia tras su ejecución. |
| AC-09 | RT-01 | La aplicación iniciada con la base lista. | Se abre `/` en un navegador y se solicita `GET /api/health`. Se repite la petición con la base inaccesible en el entorno de prueba. | El navegador muestra la página inicial. El endpoint devuelve HTTP 200 y `{"status":"ok","database":"up"}` si PostgreSQL responde, y HTTP 503 y `{"status":"unavailable","database":"down"}` si no responde. |
| AC-10 | RT-01 | Un commit candidato a integrar con el flujo de GitHub Actions habilitado. | Se ejecuta la comprobación automatizada del commit y se siguen desde un clon limpio los pasos del README. | Las pruebas técnicas terminan correctamente en CI y el proceso documentado permite llegar a la página inicial y al endpoint de salud. La evidencia registra quién ejecutó cada comprobación y sobre qué commit. |
