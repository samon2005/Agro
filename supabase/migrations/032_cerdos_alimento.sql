-- ============================================================
-- MÓDULO: Cerdos — catálogo de alimento, requerimientos por etapa
-- y horarios de alimentación (espejo del módulo de aves)
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS tipos_alimento_cerdos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id                 uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre                   text NOT NULL,
  marca                    text,
  tipo_alimento_categoria  text,
  proteina_bruta_pct       numeric(5,2),
  grasa_pct                numeric(5,2),
  calcio_pct               numeric(5,2),
  fosforo_pct              numeric(5,2),
  lisina_pct               numeric(5,2),
  energia_kcal_kg          numeric(8,2),
  precio_bulto             numeric(12,2),
  peso_bulto_kg            numeric(6,2) NOT NULL DEFAULT 40,
  cantidad_entrada         numeric(10,2),
  fecha_entrada            date,
  activo                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tipos_alimento_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD tipos_alimento_cerdos" ON tipos_alimento_cerdos;
CREATE POLICY "Miembros CRUD tipos_alimento_cerdos" ON tipos_alimento_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_tipos_alimento_cerdos_finca ON tipos_alimento_cerdos(finca_id);

-- El consumo diario pasa de "tipo_alimento" en texto libre al catálogo con FK
ALTER TABLE nutricion_diaria_cerdos
  ADD COLUMN IF NOT EXISTS tipo_alimento_id uuid REFERENCES tipos_alimento_cerdos(id) ON DELETE SET NULL;

ALTER TABLE costos_lote_cerdos
  ADD COLUMN IF NOT EXISTS tipo_alimento_id uuid REFERENCES tipos_alimento_cerdos(id) ON DELETE CASCADE;

-- El alimento activo del lote (igual que en aves) alimenta el balance del día
ALTER TABLE lotes_cerdos
  ADD COLUMN IF NOT EXISTS alimento_activo_id uuid REFERENCES tipos_alimento_cerdos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consumo_activo_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS consumo_estimado_kg_dia numeric(10,2);

-- ---- Requerimientos nutricionales por etapa, versionados ----
-- Valores por defecto de referencia para cerdo en crecimiento/ceba.
CREATE TABLE IF NOT EXISTS requerimientos_nutricionales_cerdos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id            uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id           uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  etapa              text NOT NULL DEFAULT 'ceba',
  consumo_kg_dia     numeric(6,3) NOT NULL DEFAULT 0,
  proteina_pct       numeric(6,2) NOT NULL DEFAULT 0,
  lisina_pct         numeric(6,2) NOT NULL DEFAULT 0,
  calcio_pct         numeric(6,2) NOT NULL DEFAULT 0,
  fosforo_pct        numeric(6,2) NOT NULL DEFAULT 0,
  energia_kcal_kg    numeric(8,2) NOT NULL DEFAULT 0,
  vigente_desde      date NOT NULL DEFAULT CURRENT_DATE,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE requerimientos_nutricionales_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD requerimientos_nutricionales_cerdos" ON requerimientos_nutricionales_cerdos;
CREATE POLICY "Miembros CRUD requerimientos_nutricionales_cerdos" ON requerimientos_nutricionales_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_requerimientos_cerdos_lote ON requerimientos_nutricionales_cerdos(lote_id, vigente_desde DESC);

-- ---- Horarios de alimentación ----
CREATE TABLE IF NOT EXISTS horarios_alimentacion_cerdos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id      uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id     uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  hora         time NOT NULL,
  descripcion  text,
  cantidad_kg  numeric(10,3),
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE horarios_alimentacion_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD horarios_alimentacion_cerdos" ON horarios_alimentacion_cerdos;
CREATE POLICY "Miembros CRUD horarios_alimentacion_cerdos" ON horarios_alimentacion_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_horarios_alim_cerdos_lote ON horarios_alimentacion_cerdos(lote_id, hora);

CREATE TABLE IF NOT EXISTS horarios_alimentacion_cerdos_completados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id   uuid NOT NULL REFERENCES horarios_alimentacion_cerdos(id) ON DELETE CASCADE,
  lote_id      uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id     uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha        date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (horario_id, fecha)
);
ALTER TABLE horarios_alimentacion_cerdos_completados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD horarios_alimentacion_cerdos_completados" ON horarios_alimentacion_cerdos_completados;
CREATE POLICY "Miembros CRUD horarios_alimentacion_cerdos_completados" ON horarios_alimentacion_cerdos_completados FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_horarios_alim_cerdos_completados ON horarios_alimentacion_cerdos_completados(lote_id, fecha DESC);
