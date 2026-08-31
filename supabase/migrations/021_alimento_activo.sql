-- "Alimento activo": el último alimento/consumo registrado queda vigente para las tarjetas
-- de Producción y Alimento hasta que se registre un nuevo consumo (no depende de que exista
-- un registro de producción específicamente para "hoy").

ALTER TABLE lotes_aves
  ADD COLUMN IF NOT EXISTS alimento_activo_id uuid REFERENCES tipos_alimento_aves(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consumo_activo_kg numeric(10,3);
