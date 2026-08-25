-- ============================================================
-- MÓDULO: Alimento — tipos de alimento y requerimientos
-- nutricionales para Aves Ponedoras
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS tipos_alimento_aves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  proteina_bruta_pct numeric(5,2),
  grasa_pct numeric(5,2),
  calcio_pct numeric(5,2),
  fosforo_pct numeric(5,2),
  precio_bulto numeric(12,2),
  peso_bulto_kg numeric(6,2) NOT NULL DEFAULT 40,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tipos_alimento_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD tipos_alimento_aves" ON tipos_alimento_aves;
CREATE POLICY "Miembros CRUD tipos_alimento_aves" ON tipos_alimento_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_tipos_alimento_aves_finca ON tipos_alimento_aves(finca_id);

ALTER TABLE produccion_diaria_aves ADD COLUMN IF NOT EXISTS tipo_alimento_id uuid REFERENCES tipos_alimento_aves(id);

CREATE TABLE IF NOT EXISTS requerimientos_nutricionales_aves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE UNIQUE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  mant_proteina_g numeric(6,2) NOT NULL DEFAULT 9,
  mant_calcio_g numeric(6,2) NOT NULL DEFAULT 0.3,
  mant_fosforo_g numeric(6,2) NOT NULL DEFAULT 0.25,
  mant_grasa_g numeric(6,2) NOT NULL DEFAULT 1.5,
  prod_proteina_g numeric(6,2) NOT NULL DEFAULT 4.2,
  prod_calcio_g numeric(6,2) NOT NULL DEFAULT 3.8,
  prod_fosforo_g numeric(6,2) NOT NULL DEFAULT 0.45,
  prod_grasa_g numeric(6,2) NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE requerimientos_nutricionales_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD requerimientos_nutricionales_aves" ON requerimientos_nutricionales_aves;
CREATE POLICY "Miembros CRUD requerimientos_nutricionales_aves" ON requerimientos_nutricionales_aves FOR ALL USING (es_miembro_finca(finca_id));
