# Reglas de negocio

La identidad individual de las unidades, la reserva por intervalos, la prevención de superposiciones y el acceso a reservas propias provienen del alcance confirmado. Las reglas operativas siguientes detallan una propuesta para revisión.

| ID | Requisito | Regla propuesta |
| --- | --- | --- |
| RN-01 | RF-03 | Cada unidad física pertenece a un equipo y tiene un código de inventario único en todo el inventario. Su identificador interno es estable y la unidad nunca se borra: sale de servicio pasando a inactiva. El personal autorizado administra categorías, equipos y unidades. **Implementada.** |
| RN-02 | RF-04, RF-05 | Cada reserva corresponde a una sola unidad física. Se acepta un intervalo con inicio estrictamente anterior al fin. Los instantes reciben formato RFC 3339 con desplazamiento explícito y se normalizan a UTC. |
| RN-03 | RF-04, RF-05 | El intervalo incluye el inicio y excluye el fin, `[inicio, fin)`. Dos reservas contiguas pueden utilizar la misma unidad si una termina cuando empieza la otra. |
| RN-04 | RF-04, RF-05 | Una unidad activa está disponible cuando carece de reservas confirmadas superpuestas para el intervalo consultado. La disponibilidad se vuelve a comprobar al registrar la reserva. |
| RN-05 | RF-05 | PostgreSQL rechaza confirmaciones simultáneas superpuestas de la misma unidad. La solicitud que pierde la disputa recibe un conflicto y puede volver a consultar disponibilidad. |
| RN-06 | RF-06 | Una reserva nace confirmada. Su titular puede pasarla de confirmada a cancelada cuando la política aplicable lo permite. La cancelación conserva el registro y libera el intervalo al confirmarse la transacción. |
| RN-07 | RF-01, RF-03, RF-06 | El backend identifica al titular mediante la sesión, guardada en el servidor y referida por una cookie `HttpOnly`. Solo el titular consulta o cancela su reserva y solo una cuenta con rol `ADMIN` administra el inventario. El registro público crea cuentas con rol `USER`. **Implementada para cuentas e inventario.** |
| RN-08 | RF-01 | Las contraseñas se guardan solo como hash Argon2id. La respuesta a unas credenciales incorrectas es idéntica a la de una cuenta inexistente, y los intentos repetidos contra una misma cuenta y origen se frenan. **Implementada.** |

El equipo debe confirmar si admite reservas con inicio pasado, la precisión y duración de los intervalos, y el plazo de cancelación. La desactivación de una unidad y la confirmación de una reserva ya se serializan con bloqueos de fila, según [el contrato de inventario](../docs/inventory-contract.md); queda por acordar qué ocurre con las reservas ya confirmadas de esa unidad. El rol administrativo se concede en el arranque desde el entorno; queda por acordar si el equipo necesita además promover cuentas desde la propia aplicación.
