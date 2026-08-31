-- Precio de venta por tamaño de huevo (B/A/AA/AAA/JUMBO) y desglose diario de huevos por tamaño

ALTER TABLE lotes_aves
  ADD COLUMN IF NOT EXISTS precio_huevo_b numeric(10,2),
  ADD COLUMN IF NOT EXISTS precio_huevo_a numeric(10,2),
  ADD COLUMN IF NOT EXISTS precio_huevo_aa numeric(10,2),
  ADD COLUMN IF NOT EXISTS precio_huevo_aaa numeric(10,2),
  ADD COLUMN IF NOT EXISTS precio_huevo_jumbo numeric(10,2);

ALTER TABLE produccion_diaria_aves
  ADD COLUMN IF NOT EXISTS huevos_b integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS huevos_a integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS huevos_aa integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS huevos_aaa integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS huevos_jumbo integer NOT NULL DEFAULT 0;
