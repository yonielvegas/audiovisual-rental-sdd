-- Datos de presentación del catálogo público (RF-02): marca, modelo, precio de
-- alquiler por día, imagen y control de publicación. Son atributos del equipo,
-- no de la unidad física: dos unidades del mismo equipo comparten modelo y
-- tarifa, y se distinguen por su código de inventario (RN-01).

ALTER TABLE audiovisual.equipment
  ADD COLUMN brand text NOT NULL DEFAULT ''
    CONSTRAINT equipment_brand_shape CHECK (brand = btrim(brand) AND char_length(brand) <= 60);

ALTER TABLE audiovisual.equipment
  ADD COLUMN model text NOT NULL DEFAULT ''
    CONSTRAINT equipment_model_shape CHECK (model = btrim(model) AND char_length(model) <= 60);

-- El importe se guarda en céntimos enteros para que no dependa de la aritmética
-- en coma flotante. `NULL` significa que la tarifa todavía no está fijada, que
-- no es lo mismo que una tarifa de cero.
ALTER TABLE audiovisual.equipment
  ADD COLUMN daily_rate_cents integer
    CONSTRAINT equipment_daily_rate_range
      CHECK (daily_rate_cents IS NULL OR (daily_rate_cents >= 0 AND daily_rate_cents <= 100000000));

-- Ruta del mismo origen o URL https. El catálogo dibuja una imagen de reserva
-- cuando está vacía, de modo que las tarjetas conservan la misma proporción.
ALTER TABLE audiovisual.equipment
  ADD COLUMN image_url text
    CONSTRAINT equipment_image_url_shape
      CHECK (image_url IS NULL OR (char_length(image_url) <= 500 AND image_url ~ '^(/[^\s]*|https://[^\s]+)$'));

-- Un equipo despublicado desaparece del catálogo público y sigue visible para
-- la administración. No borra nada ni afecta a las unidades.
ALTER TABLE audiovisual.equipment
  ADD COLUMN published boolean NOT NULL DEFAULT true;

CREATE INDEX equipment_published_idx ON audiovisual.equipment (published);

COMMENT ON COLUMN audiovisual.equipment.daily_rate_cents IS
  'Tarifa de alquiler por día en céntimos de la moneda única del MVP. NULL cuando todavía no está fijada.';
COMMENT ON COLUMN audiovisual.equipment.published IS
  'Solo los equipos publicados aparecen en el catálogo público. La administración los ve todos.';
