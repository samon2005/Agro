-- Huevos podridos (pedido de José, 14 nov 2026): un defecto más en la calidad del
-- huevo del día, junto a rotos, sucios y deformes. Como ellos, son parte de los
-- huevos del día (no se suman aparte). Solo agrega una columna con 0 por defecto:
-- la versión publicada anterior sigue guardando igual.
ALTER TABLE public.produccion_diaria_aves
  ADD COLUMN IF NOT EXISTS huevos_podridos integer NOT NULL DEFAULT 0 CHECK (huevos_podridos >= 0);
