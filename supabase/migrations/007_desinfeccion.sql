-- ============================================================
-- MÓDULO: Registro de desinfección (aves, cerdos, pollo)
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS desinfecciones_aves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  producto text NOT NULL,
  previene text,
  dosis text,
  responsable text,
  costo numeric(12,2),
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE desinfecciones_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD desinfecciones_aves" ON desinfecciones_aves;
CREATE POLICY "Miembros CRUD desinfecciones_aves" ON desinfecciones_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_desinfecciones_aves_lote ON desinfecciones_aves(lote_id, fecha DESC);

CREATE TABLE IF NOT EXISTS desinfecciones_cerdos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  producto text NOT NULL,
  previene text,
  dosis text,
  responsable text,
  costo numeric(12,2),
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE desinfecciones_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD desinfecciones_cerdos" ON desinfecciones_cerdos;
CREATE POLICY "Miembros CRUD desinfecciones_cerdos" ON desinfecciones_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_desinfecciones_cerdos_lote ON desinfecciones_cerdos(lote_id, fecha DESC);

CREATE TABLE IF NOT EXISTS desinfecciones_pollo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  producto text NOT NULL,
  previene text,
  dosis text,
  responsable text,
  costo numeric(12,2),
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE desinfecciones_pollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD desinfecciones_pollo" ON desinfecciones_pollo;
CREATE POLICY "Miembros CRUD desinfecciones_pollo" ON desinfecciones_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_desinfecciones_pollo_lote ON desinfecciones_pollo(lote_id, fecha DESC);
