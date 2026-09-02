-- ============================================================
-- MÓDULO: Pollo de engorde — ventas, logs de equipos, recordatorios
-- y costos al nivel de aves ponedoras
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Ventas (mismo modelo flexible que cerdos: por kg o por animal) ----
CREATE TABLE IF NOT EXISTS ventas_pollo (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id                uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id               uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha                  date NOT NULL DEFAULT CURRENT_DATE,
  cantidad               integer NOT NULL DEFAULT 0,
  peso_promedio_kg       numeric(10,3),
  modo_precio            text NOT NULL DEFAULT 'kg' CHECK (modo_precio IN ('kg', 'animal')),
  precio_kg              numeric(12,2),
  precio_animal          numeric(12,2),
  tipo_venta             text NOT NULL DEFAULT 'pie' CHECK (tipo_venta IN ('pie', 'canal')),
  rendimiento_canal_pct  numeric(5,2),
  cliente                text,
  destino                text,
  observaciones          text,
  registrado_por         uuid REFERENCES profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ventas_pollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD ventas_pollo" ON ventas_pollo;
CREATE POLICY "Miembros CRUD ventas_pollo" ON ventas_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_ventas_pollo_lote_fecha ON ventas_pollo(lote_id, fecha DESC);

-- ---- Bitácora de equipos (espejo de equipos_aves_logs) ----
CREATE TABLE IF NOT EXISTS equipos_pollo_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id           uuid NOT NULL REFERENCES equipos_pollo(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  estado_registrado   text NOT NULL,
  horas_dia           numeric(8,2),
  lectura_sensor      jsonb,
  alerta              boolean DEFAULT false,
  descripcion_alerta  text,
  fuente              text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE equipos_pollo_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD equipos_pollo_logs" ON equipos_pollo_logs;
CREATE POLICY "Miembros CRUD equipos_pollo_logs" ON equipos_pollo_logs FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_equipos_pollo_logs_equipo_fecha ON equipos_pollo_logs(equipo_id, fecha DESC);

-- ---- Recordatorios de aplicación de tratamientos ----
CREATE TABLE IF NOT EXISTS recordatorios_medicacion_pollo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicacion_id  uuid NOT NULL REFERENCES medicaciones_pollo(id) ON DELETE CASCADE,
  lote_id        uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id       uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha          date NOT NULL,
  hora           time,
  completado     boolean NOT NULL DEFAULT false,
  canal          text NOT NULL DEFAULT 'app' CHECK (canal IN ('app', 'whatsapp')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recordatorios_medicacion_pollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD recordatorios_medicacion_pollo" ON recordatorios_medicacion_pollo;
CREATE POLICY "Miembros CRUD recordatorios_medicacion_pollo" ON recordatorios_medicacion_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_recordatorios_medicacion_pollo_lote_fecha ON recordatorios_medicacion_pollo(lote_id, fecha);

-- ---- Costos: vínculos en cascada con el registro que los originó ----
ALTER TABLE costos_lote_pollo
  ADD COLUMN IF NOT EXISTS equipo_id uuid REFERENCES equipos_pollo(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS medicacion_id uuid REFERENCES medicaciones_pollo(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vacunacion_id uuid REFERENCES vacunaciones_pollo(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS desinfeccion_id uuid REFERENCES desinfecciones_pollo(id) ON DELETE CASCADE;

ALTER TABLE costos_lote_pollo DROP CONSTRAINT IF EXISTS costos_lote_pollo_categoria_check;
ALTER TABLE costos_lote_pollo ADD CONSTRAINT costos_lote_pollo_categoria_check
  CHECK (categoria IN ('pollitos', 'alimento', 'servicios_publicos', 'mano_obra', 'mantenimiento', 'sanitario', 'equipos', 'otro'));

CREATE TABLE IF NOT EXISTS costos_predefinidos_pollo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id          uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  categoria         text NOT NULL,
  monto_referencia  numeric(14,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, categoria)
);
ALTER TABLE costos_predefinidos_pollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD costos_predefinidos_pollo" ON costos_predefinidos_pollo;
CREATE POLICY "Miembros CRUD costos_predefinidos_pollo" ON costos_predefinidos_pollo FOR ALL USING (es_miembro_finca(finca_id));

-- ---- Configuración del lote y del equipo ----
ALTER TABLE lotes_pollo
  ADD COLUMN IF NOT EXISTS area_galpon_m2 numeric(10,2),
  ADD COLUMN IF NOT EXISTS peso_objetivo_kg numeric(10,3),
  ADD COLUMN IF NOT EXISTS dias_ciclo integer DEFAULT 42,
  ADD COLUMN IF NOT EXISTS precio_kg_objetivo numeric(12,2);

ALTER TABLE equipos_pollo
  ADD COLUMN IF NOT EXISTS costo_compra numeric(14,2),
  ADD COLUMN IF NOT EXISTS fecha_compra date;

-- ---- Evento clínico: distinguir causas que no requieren fármaco ----
ALTER TABLE eventos_clinicos_pollo
  ADD COLUMN IF NOT EXISTS requiere_medicamento boolean NOT NULL DEFAULT true;
