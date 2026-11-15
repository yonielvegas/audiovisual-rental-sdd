# Reglas de negocio

La identidad individual de las unidades, la reserva por intervalos, la prevención de superposiciones y el acceso a reservas propias provienen del alcance confirmado. Las reglas operativas siguientes detallan una propuesta para revisión.

| ID | Requisito | Regla propuesta |
| --- | --- | --- |
| RN-01 | RF-03 | Cada unidad física pertenece a un equipo y tiene un código de inventario único. El personal autorizado administra equipos y unidades. |
| RN-02 | RF-04, RF-05 | Cada reserva corresponde a una sola unidad física. Se acepta un intervalo con inicio estrictamente anterior al fin. Los instantes reciben formato RFC 3339 con desplazamiento explícito y se normalizan a UTC. |
| RN-03 | RF-04, RF-05 | El intervalo incluye el inicio y excluye el fin, `[inicio, fin)`. Dos reservas contiguas pueden utilizar la misma unidad si una termina cuando empieza la otra. |
| RN-04 | RF-04, RF-05 | Una unidad activa está disponible cuando carece de reservas confirmadas superpuestas para el intervalo consultado. La disponibilidad se vuelve a comprobar al registrar la reserva. |
| RN-05 | RF-05 | PostgreSQL rechaza confirmaciones simultáneas superpuestas de la misma unidad. La solicitud que pierde la disputa recibe un conflicto y puede volver a consultar disponibilidad. |
| RN-06 | RF-06 | Una reserva nace confirmada. Su titular puede pasarla de confirmada a cancelada cuando la política aplicable lo permite. La cancelación conserva el registro y libera el intervalo al confirmarse la transacción. |
| RN-07 | RF-01, RF-03, RF-06 | El backend identifica al titular mediante la sesión. Solo el titular consulta o cancela su reserva y solo una cuenta autorizada administra el inventario. |

El equipo debe confirmar si admite reservas con inicio pasado, la precisión y duración de los intervalos, y el plazo de cancelación. También debe acordar cómo gestionar la desactivación de unidades con reservas vigentes y cómo se habilita el rol administrativo.
