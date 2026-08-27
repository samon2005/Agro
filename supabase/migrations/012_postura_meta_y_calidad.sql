-- ============================================================
-- MÓDULO: Aves Ponedoras — estado "en preparación", meta de huevos
-- diaria y revisión semanal de clasificación de huevo por peso
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Estado del lote: agregar "preparación" (levante, aún sin postura) ----
ALTER TABLE lotes_aves DROP CONSTRAINT IF EXISTS lotes_aves_estado_check;
ALTER TABLE lotes_aves ADD CONSTRAINT lotes_aves_estado_check
  CHECK (estado IN ('preparacion', 'activo', 'finalizado', 'vendido'));

-- ---- Meta de huevos diaria (número absoluto, además del % de postura) ----
ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS meta_huevos_diaria integer;

-- ---- Revisión semanal de calidad/clasificación de huevo por peso ----
CREATE TABLE IF NOT EXISTS revisiones_calidad_huevo_aves (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id         uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  cantidad_b      integer NOT NULL DEFAULT 0,
  cantidad_a      integer NOT NULL DEFAULT 0,
  cantidad_aa     integer NOT NULL DEFAULT 0,
  cantidad_aaa    integer NOT NULL DEFAULT 0,
  cantidad_jumbo  integer NOT NULL DEFAULT 0,
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, fecha)
);
ALTER TABLE revisiones_calidad_huevo_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD revisiones_calidad_huevo_aves" ON revisiones_calidad_huevo_aves;
CREATE POLICY "Miembros CRUD revisiones_calidad_huevo_aves" ON revisiones_calidad_huevo_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_revisiones_calidad_lote ON revisiones_calidad_huevo_aves(lote_id, fecha DESC);
