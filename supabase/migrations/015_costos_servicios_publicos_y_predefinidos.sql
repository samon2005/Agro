-- ============================================================
-- MÓDULO: Costos — unifica agua/energía en "servicios públicos"
-- y agrega costos predefinidos editables por categoría
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

ALTER TABLE costos_lote_aves DROP CONSTRAINT IF EXISTS costos_lote_aves_categoria_check;
ALTER TABLE costos_lote_aves ADD CONSTRAINT costos_lote_aves_categoria_check
  CHECK (categoria IN ('pollitas', 'alimento', 'agua', 'energia', 'servicios_publicos', 'mano_obra', 'mantenimiento', 'sanitario', 'otro'));

CREATE TABLE IF NOT EXISTS costos_predefinidos_aves (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id          uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  categoria         text NOT NULL,
  monto_referencia  numeric(14,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, categoria)
);
ALTER TABLE costos_predefinidos_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD costos_predefinidos_aves" ON costos_predefinidos_aves;
CREATE POLICY "Miembros CRUD costos_predefinidos_aves" ON costos_predefinidos_aves FOR ALL USING (es_miembro_finca(finca_id));
