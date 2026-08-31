-- Equipos: costo de compra (para equipos antiguos o futuros/planificados) y estado 'planificado'

ALTER TABLE equipos_aves
  ADD COLUMN IF NOT EXISTS costo_compra numeric(12,2),
  ADD COLUMN IF NOT EXISTS fecha_compra date;

ALTER TABLE equipos_aves DROP CONSTRAINT IF EXISTS equipos_aves_estado_check;
ALTER TABLE equipos_aves ADD CONSTRAINT equipos_aves_estado_check
  CHECK (estado = ANY (ARRAY['operativo', 'falla', 'mantenimiento', 'inactivo', 'planificado']));

-- Costos: vincular un costo con el equipo que lo originó, y nueva categoría 'equipos'
ALTER TABLE costos_lote_aves
  ADD COLUMN IF NOT EXISTS equipo_id uuid REFERENCES equipos_aves(id) ON DELETE SET NULL;

ALTER TABLE costos_lote_aves DROP CONSTRAINT IF EXISTS costos_lote_aves_categoria_check;
ALTER TABLE costos_lote_aves ADD CONSTRAINT costos_lote_aves_categoria_check
  CHECK (categoria = ANY (ARRAY['pollitas', 'alimento', 'agua', 'energia', 'servicios_publicos', 'mano_obra', 'mantenimiento', 'sanitario', 'equipos', 'otro']));
