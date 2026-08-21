-- ============================================================
-- MÓDULO: Información geográfica de finca + parámetros de galpón
-- y meta de postura para Aves Ponedoras
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Información geográfica/ambiental de la finca (manual, sin API externa) ----
ALTER TABLE fincas ADD COLUMN IF NOT EXISTS altitud_msnm numeric(8,2);
ALTER TABLE fincas ADD COLUMN IF NOT EXISTS velocidad_viento_kmh numeric(6,2);
ALTER TABLE fincas ADD COLUMN IF NOT EXISTS clima_predominante text
  CHECK (clima_predominante IS NULL OR clima_predominante IN ('calido', 'templado', 'frio', 'paramo'));
ALTER TABLE fincas ADD COLUMN IF NOT EXISTS temperatura_promedio_ext numeric(5,2);

-- ---- Parámetros del galpón y meta de postura (lotes_aves) ----
ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS area_galpon_m2 numeric(10,2);
ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS fecha_inicio_postura date;
ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS semanas_ciclo_postura integer DEFAULT 60;
ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS meta_postura_pct numeric(5,2) DEFAULT 90;
ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS precio_huevo numeric(10,2);
ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS precio_gramo_alimento numeric(10,4);
ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS peso_bulto_alimento_kg numeric(8,2) DEFAULT 40;

-- ---- Horarios de alimentación (configurables por lote) ----
CREATE TABLE IF NOT EXISTS horarios_alimentacion_aves (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id       uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id      uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  hora          time NOT NULL,
  descripcion   text,
  cantidad_kg   numeric(10,3),
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE horarios_alimentacion_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD horarios_alimentacion_aves" ON horarios_alimentacion_aves;
CREATE POLICY "Miembros CRUD horarios_alimentacion_aves" ON horarios_alimentacion_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_horarios_alim_lote ON horarios_alimentacion_aves(lote_id, hora);
