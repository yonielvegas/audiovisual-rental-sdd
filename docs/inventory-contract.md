# Contrato de inventario que consume Reservas

Este documento fija lo que la entrega de catálogo e inventario (RF-02 y RF-03,
[Issue #4](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/4))
garantiza a la entrega de disponibilidad y reservas (RF-04 a RF-06,
[Issue #5](https://github.com/yonielvegas/audiovisual-rental-sdd/issues/5)).
Reservas puede apoyarse en lo que aquí se promete. Cualquier cambio en estas
garantías requiere acordarlo en [decisiones](decisions.md) antes de aplicarlo.

## 1. La unidad física es la cosa que se reserva

Una reserva compromete exactamente una fila de `audiovisual.units` (RN-02).
Las categorías y los equipos agrupan, pero no se reservan.

| Entidad | Tabla | Papel para Reservas |
| --- | --- | --- |
| Categoría | `audiovisual.categories` | Solo navegación del catálogo. |
| Equipo | `audiovisual.equipment` | Agrupa las unidades intercambiables que la persona puede pedir. |
| Unidad física | `audiovisual.units` | Objeto reservable. La reserva referencia su `id`. |

## 2. Identificador estable

```sql
CREATE TABLE audiovisual.units (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  equipment_id integer NOT NULL REFERENCES audiovisual.equipment (id),
  inventory_code text NOT NULL,   -- único en todo el inventario
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX units_inventory_code_unique ON audiovisual.units (inventory_code);
```

Garantías:

1. **`units.id` es estable.** No cambia durante la vida de la unidad y no se
   reutiliza. Es el valor que Reservas debe almacenar en su clave foránea.
2. **El inventario no borra unidades.** No existe ninguna operación de borrado
   de unidades, ni en la API ni en la interfaz de administración. Una unidad que
   sale de servicio pasa a `active = false` y conserva su fila, de modo que las
   reservas históricas nunca pierden su referencia. Las categorías y los equipos
   sí admiten `DELETE`, pero solo cuando están vacíos: la clave foránea
   `ON DELETE RESTRICT` impide borrar un equipo con unidades, así que esa vía
   tampoco puede dejar una reserva colgando.
3. **`inventory_code` es único en todo el inventario**, no solo dentro de un
   equipo. Identifica la etiqueta física y es el valor que se muestra al
   personal. La administración puede corregirlo, así que **no debe usarse como
   clave foránea**; sirve para presentar la unidad en pantalla.
4. **`equipment_id` puede considerarse fijo.** El inventario no ofrece mover una
   unidad de equipo.

La clave foránea recomendada para la tabla de reservas:

```sql
unit_id integer NOT NULL REFERENCES audiovisual.units (id)
```

## 3. Qué significa `active`

`active = true` quiere decir que la unidad está en servicio y es candidata a
reservarse. `active = false` la retira del catálogo público y de la
disponibilidad, sin borrar su historial. El inventario **no** interpreta
intervalos ni conoce reservas: la disponibilidad temporal de RN-04 la calcula
Reservas sobre el conjunto de unidades activas.

## 4. Superficie en proceso

`createInventory({ store })` (`src/backend/inventory.js`) expone a Reservas:

| Función | Devuelve | Uso previsto |
| --- | --- | --- |
| `listActiveUnits({ equipmentId })` | Unidades activas del equipo, ordenadas por código. Lanza 404 si el equipo no existe. | Conjunto candidato antes de descontar las reservas superpuestas. |
| `findActiveUnit(id)` | La unidad si existe y está activa, `null` en otro caso. | Comprobación de lectura previa al formulario de reserva. |
| `lockActiveUnit(client, id)` | Igual que `findActiveUnit`, pero ejecutado sobre el `client` de quien llama y con bloqueo compartido. | Comprobación **dentro** de la transacción que confirma la reserva. |

Forma de la unidad en todas ellas y en la API HTTP:

```json
{
  "id": 7,
  "inventoryCode": "CAM-001",
  "active": true,
  "equipment": { "id": 1, "name": "Cámara de cine compacta", "category": { "id": 1, "name": "Cámaras" } }
}
```

## 5. Coordinación con la desactivación de unidades

Esta es la respuesta a la pregunta abierta de
[reglas de negocio](../specs/business-rules.md) sobre desactivar una unidad con
reservas vigentes.

- `lockActiveUnit` ejecuta `SELECT ... FOR SHARE OF u` sobre la fila de la unidad.
- La administración de unidades (`PATCH /api/units/{id}`) ejecuta
  `SELECT ... FOR UPDATE` sobre esa misma fila dentro de su propia transacción.

Consecuencia: mientras una transacción de reserva mantiene el bloqueo
compartido, una desactivación concurrente espera a que la reserva termine, y una
reserva que empieza después de una desactivación confirmada ya no encuentra la
unidad activa. No hay ventana en la que una unidad quede desactivada y reservada
por la misma operación.

Reservas debe, por tanto, llamar a `lockActiveUnit(client, unitId)` con su propio
cliente transaccional **antes** de insertar la reserva, y tratar un `null` como
unidad no disponible.

```js
// Dentro de la transacción de la reserva
const unit = await inventory.lockActiveUnit(client, unitId);
if (!unit) throw notFound('La unidad indicada no existe o no está activa.');
// … insertar la reserva; la restricción de exclusión decide el solapamiento
```

La política de qué hacer con las reservas ya confirmadas de una unidad que se
desactiva (conservarlas o avisar al titular) sigue pendiente de acuerdo del
equipo. El inventario no las modifica.

## 6. Rutas HTTP disponibles

Las consultas públicas de RF-02 no requieren sesión. Las de RF-03 exigen una
cuenta administrativa.

| Método y ruta | Acceso | Respuesta |
| --- | --- | --- |
| `GET /api/categories` | Público | `200 { "categories": [{ "id", "name", "equipmentCount" }] }` |
| `GET /api/equipment?categoryId={id}` | Público | `200 { "equipment": [...] }`, `404` si la categoría del filtro no existe |
| `GET /api/equipment/{id}` | Público | `200 { "equipment": { "id", "name", "description", "category", "activeUnits" } }` |
| `POST /api/categories` · `PATCH /api/categories/{id}` | Administrativo | `201` o `200 { "category" }` |
| `POST /api/equipment` · `PATCH /api/equipment/{id}` | Administrativo | `201` o `200 { "equipment" }` |
| `GET /api/units?equipmentId={id}` | Administrativo | `200 { "units": [...] }` |
| `GET /api/units/{id}` | Administrativo | `200 { "unit" }` |
| `POST /api/units` · `PATCH /api/units/{id}` | Administrativo | `201` o `200 { "unit" }` |

`activeUnits` cuenta las unidades activas del equipo. Es inventario, no
disponibilidad: no considera reservas ni intervalos. Reservas es quien debe
descontarlas al calcular la disponibilidad de RF-04.

El equipo lleva además `brand`, `model`, `dailyRate` (`{ cents, currency }` o
`null` cuando la tarifa no está fijada), `imageUrl` y `published`. La tarifa es
el dato que Reservas necesitará para presentar el importe de una reserva; los
céntimos son enteros, así que un cálculo por días se hace en enteros y solo se
da formato al mostrarlo. `published` controla la visibilidad pública del
catálogo y **no** limita lo que Reservas puede reservar: una unidad activa de un
equipo despublicado sigue siendo reservable para quien ya tiene su enlace, de
modo que despublicar no rompe una reserva en curso.

## 7. Errores

Todos los errores usan `{ "error": { "code", "message" } }`.

| Estado | Código | Cuándo |
| --- | --- | --- |
| 400 | `invalid_request` | Entrada ausente, de tipo incorrecto o fuera de límite. |
| 400 | `invalid_inventory_code` | El código no cumple `^[A-Z0-9][A-Z0-9-]{2,23}$`. |
| 400 | `invalid_content_type` | Falta `Content-Type: application/json`. |
| 401 | `unauthenticated` | Operación protegida sin sesión, o con una sesión caducada o desconocida. |
| 403 | `forbidden` | Cuenta autenticada sin rol de administración. |
| 404 | `not_found` | Categoría, equipo o unidad inexistente. |
| 405 | `method_not_allowed` | Método no admitido. La respuesta incluye `Allow`. |
| 409 | `inventory_code_taken` | El código ya identifica a otra unidad. |
| 409 | `category_name_taken` · `equipment_name_taken` | Nombre repetido. |
| 409 | `category_in_use` · `equipment_in_use` | Se intentó borrar algo de lo que todavía dependen otros registros. |

Reservas puede reutilizar este formato para sus propios errores, incluido el
`409` de solapamiento de RN-05.

## 8. Identidad y autorización

RF-01 está implementado: registro, inicio de sesión único, cierre de sesión y
roles `ADMIN` y `USER`. Reservas se apoya en la misma frontera.

`resolveActor(request)` (`src/backend/access.js`) devuelve `{ id, username, role }`
o `null`, resolviendo la cookie de sesión contra la tabla `audiovisual.sessions`.
Cada ruta declara el rol que exige y el backend lo comprueba antes de invocar el
manejador y antes de leer el cuerpo:

```js
['/api/reservations', {
  POST: { actor: true, handler: … },   // recibe `actor` resuelto, o null
  GET:  { actor: true, handler: … },
}]
```

Para RF-05 y RF-06, Reservas necesita al titular, no un rol concreto: declara
`actor: true` y usa `actor.id` como `user_id` de la reserva. Ojo con `role`:
`requireRole` compara el rol de forma exacta, de modo que `role: roles.user`
**excluiría al administrador**. Para «hace falta una sesión, de cualquier rol»,
usa `actor: true` y rechaza el caso nulo en el manejador:

```js
if (!actor) throw unauthenticated('Esta operación requiere haber iniciado sesión.');
```

Si más adelante hiciera falta esa comprobación en varias rutas, el sitio donde
añadir un `requireSession` es `src/backend/access.js`, junto a `requireRole`.

La clave foránea recomendada para el titular:

```sql
user_id integer NOT NULL REFERENCES audiovisual.users (id)
```

`users.id` es estable por las mismas razones que `units.id`: se genera con
`GENERATED ALWAYS AS IDENTITY` y no se reutiliza. Borrar una cuenta elimina en
cascada sus sesiones, no sus reservas, así que Reservas debe decidir con el
equipo qué hacer con las reservas de una cuenta eliminada antes de permitir
ese borrado.
