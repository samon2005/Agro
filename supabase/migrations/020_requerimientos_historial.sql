-- Historial de requerimientos nutricionales: cada edición crea una nueva versión en vez de sobreescribir

ALTER TABLE requerimientos_nutricionales_aves DROP CONSTRAINT IF EXISTS requerimientos_nutricionales_aves_lote_id_key;

ALTER TABLE requerimientos_nutricionales_aves
  ADD COLUMN IF NOT EXISTS vigente_desde date NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_requerimientos_lote_vigencia ON requerimientos_nutricionales_aves(lote_id, vigente_desde DESC);
