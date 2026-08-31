-- Vincula cada costo con el registro que lo originó (tratamiento, vacuna, desinfección,
-- alimento) para que al eliminar el origen se elimine automáticamente su costo asociado.
-- equipo_id pasa de SET NULL a CASCADE para que el comportamiento sea consistente.

ALTER TABLE costos_lote_aves
  ADD COLUMN IF NOT EXISTS medicacion_id uuid REFERENCES medicaciones_aves(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vacunacion_id uuid REFERENCES vacunaciones_aves(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS desinfeccion_id uuid REFERENCES desinfecciones_aves(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo_alimento_id uuid REFERENCES tipos_alimento_aves(id) ON DELETE CASCADE;

ALTER TABLE costos_lote_aves DROP CONSTRAINT IF EXISTS costos_lote_aves_equipo_id_fkey;
ALTER TABLE costos_lote_aves
  ADD CONSTRAINT costos_lote_aves_equipo_id_fkey
  FOREIGN KEY (equipo_id) REFERENCES equipos_aves(id) ON DELETE CASCADE;
