-- ============================================================
-- MÓDULO: Horarios de recolección de huevos
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS horarios_recoleccion_aves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  hora time NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE horarios_recoleccion_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD horarios_recoleccion_aves" ON horarios_recoleccion_aves;
CREATE POLICY "Miembros CRUD horarios_recoleccion_aves" ON horarios_recoleccion_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_horarios_recoleccion_lote ON horarios_recoleccion_aves(lote_id, hora);
