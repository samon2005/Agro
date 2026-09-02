-- ============================================================
-- MÓDULO: Pollo de engorde — catálogo de alimento, requerimientos
-- por fase y horarios de alimentación (espejo del módulo de aves)
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS tipos_alimento_pollo (
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
ALTER TABLE tipos_alimento_pollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD tipos_alimento_pollo" ON tipos_alimento_pollo;
CREATE POLICY "Miembros CRUD tipos_alimento_pollo" ON tipos_alimento_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_tipos_alimento_pollo_finca ON tipos_alimento_pollo(finca_id);

ALTER TABLE produccion_diaria_pollo
  ADD COLUMN IF NOT EXISTS tipo_alimento_id uuid REFERENCES tipos_alimento_pollo(id) ON DELETE SET NULL;

ALTER TABLE costos_lote_pollo
  ADD COLUMN IF NOT EXISTS tipo_alimento_id uuid REFERENCES tipos_alimento_pollo(id) ON DELETE CASCADE;

ALTER TABLE lotes_pollo
  ADD COLUMN IF NOT EXISTS alimento_activo_id uuid REFERENCES tipos_alimento_pollo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consumo_activo_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS consumo_estimado_kg_dia numeric(10,2);

-- ---- Requerimientos nutricionales por fase, versionados ----
-- Fases del engorde: preiniciador, iniciador, engorde, finalizador.
CREATE TABLE IF NOT EXISTS requerimientos_nutricionales_pollo (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id          uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id         uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fase             text NOT NULL DEFAULT 'iniciador',
  dia_desde        integer NOT NULL DEFAULT 0,
  dia_hasta        integer,
  consumo_g_dia    numeric(8,2) NOT NULL DEFAULT 0,
  proteina_pct     numeric(6,2) NOT NULL DEFAULT 0,
  lisina_pct       numeric(6,2) NOT NULL DEFAULT 0,
  calcio_pct       numeric(6,2) NOT NULL DEFAULT 0,
  fosforo_pct      numeric(6,2) NOT NULL DEFAULT 0,
  energia_kcal_kg  numeric(8,2) NOT NULL DEFAULT 0,
  vigente_desde    date NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE requerimientos_nutricionales_pollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD requerimientos_nutricionales_pollo" ON requerimientos_nutricionales_pollo;
CREATE POLICY "Miembros CRUD requerimientos_nutricionales_pollo" ON requerimientos_nutricionales_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_requerimientos_pollo_lote ON requerimientos_nutricionales_pollo(lote_id, vigente_desde DESC);

-- ---- Horarios de alimentación ----
CREATE TABLE IF NOT EXISTS horarios_alimentacion_pollo (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id      uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id     uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  hora         time NOT NULL,
  descripcion  text,
  cantidad_kg  numeric(10,3),
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE horarios_alimentacion_pollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD horarios_alimentacion_pollo" ON horarios_alimentacion_pollo;
CREATE POLICY "Miembros CRUD horarios_alimentacion_pollo" ON horarios_alimentacion_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_horarios_alim_pollo_lote ON horarios_alimentacion_pollo(lote_id, hora);

CREATE TABLE IF NOT EXISTS horarios_alimentacion_pollo_completados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id   uuid NOT NULL REFERENCES horarios_alimentacion_pollo(id) ON DELETE CASCADE,
  lote_id      uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id     uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha        date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (horario_id, fecha)
);
ALTER TABLE horarios_alimentacion_pollo_completados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD horarios_alimentacion_pollo_completados" ON horarios_alimentacion_pollo_completados;
CREATE POLICY "Miembros CRUD horarios_alimentacion_pollo_completados" ON horarios_alimentacion_pollo_completados FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_horarios_alim_pollo_completados ON horarios_alimentacion_pollo_completados(lote_id, fecha DESC);
