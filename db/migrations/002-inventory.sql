-- Catálogo e inventario de RF-02 y RF-03. Una categoría agrupa equipos y un
-- equipo agrupa las unidades físicas que las reservas comprometen de una en una.

CREATE TABLE audiovisual.categories (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL
    CONSTRAINT categories_name_present CHECK (name = btrim(name) AND name <> '' AND char_length(name) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- El catálogo público no debe mostrar dos categorías que solo difieren en
-- mayúsculas, así que la unicidad compara el nombre normalizado.
CREATE UNIQUE INDEX categories_name_unique ON audiovisual.categories (lower(name));

CREATE TABLE audiovisual.equipment (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id integer NOT NULL
    REFERENCES audiovisual.categories (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  name text NOT NULL
    CONSTRAINT equipment_name_present CHECK (name = btrim(name) AND name <> '' AND char_length(name) <= 120),
  description text NOT NULL DEFAULT ''
    CONSTRAINT equipment_description_length CHECK (char_length(description) <= 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX equipment_category_idx ON audiovisual.equipment (category_id);
CREATE UNIQUE INDEX equipment_name_unique ON audiovisual.equipment (category_id, lower(name));

CREATE TABLE audiovisual.units (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  equipment_id integer NOT NULL
    REFERENCES audiovisual.equipment (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  inventory_code text NOT NULL
    CONSTRAINT units_inventory_code_format CHECK (inventory_code ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RN-01. El código distingue cada unidad física en todo el inventario, incluso
-- entre unidades del mismo equipo o modelo.
CREATE UNIQUE INDEX units_inventory_code_unique ON audiovisual.units (inventory_code);
CREATE INDEX units_equipment_idx ON audiovisual.units (equipment_id);

COMMENT ON COLUMN audiovisual.units.id IS
  'Identificador estable de la unidad física. Las reservas lo referencian y nunca se reutiliza ni se borra.';
COMMENT ON COLUMN audiovisual.units.inventory_code IS
  'Código único y legible de la etiqueta física. Normalizado en mayúsculas por la aplicación.';
COMMENT ON COLUMN audiovisual.units.active IS
  'Una unidad inactiva se conserva en el inventario y queda fuera del catálogo y de la disponibilidad.';
