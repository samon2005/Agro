-- Vincula un tratamiento (medicacion) con el evento clínico que lo originó

ALTER TABLE medicaciones_aves
  ADD COLUMN IF NOT EXISTS evento_clinico_id uuid REFERENCES eventos_clinicos_aves(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medicaciones_evento_clinico ON medicaciones_aves(evento_clinico_id);
