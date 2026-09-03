-- ============================================================
-- MÓDULO: Causas clínicas personalizadas por finca
-- Permite añadir causas propias al registrar un evento clínico y
-- reusarlas después, sin tocar la lista base del sistema.
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS causas_clinicas_aves (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id    uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, nombre)
);
ALTER TABLE causas_clinicas_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD causas_clinicas_aves" ON causas_clinicas_aves;
CREATE POLICY "Miembros CRUD causas_clinicas_aves" ON causas_clinicas_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_causas_clinicas_aves_finca ON causas_clinicas_aves(finca_id);

-- Guardar la causa concreta en el evento, además del tipo de signo
ALTER TABLE eventos_clinicos_aves ADD COLUMN IF NOT EXISTS causa text;
