-- =============================================
-- AgroGestión - Módulo: Aves Ponedoras
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- =============================================

-- Lotes de aves ponedoras (entidad central)
CREATE TABLE IF NOT EXISTS lotes_aves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre              text NOT NULL,
  linea_genetica      text,
  fecha_inicio        date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin           date,
  aves_iniciales      integer NOT NULL DEFAULT 0,
  aves_actuales       integer NOT NULL DEFAULT 0,
  origen_aves         text,
  estado              text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'vendido')),
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lotes_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD lotes_aves" ON lotes_aves;
CREATE POLICY "Miembros CRUD lotes_aves" ON lotes_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_lotes_aves_finca ON lotes_aves(finca_id);
CREATE INDEX IF NOT EXISTS idx_lotes_aves_estado ON lotes_aves(finca_id, estado);

-- Producción diaria
CREATE TABLE IF NOT EXISTS produccion_diaria_aves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  huevos_totales      integer NOT NULL DEFAULT 0,
  huevos_rotos        integer NOT NULL DEFAULT 0,
  huevos_sucios       integer NOT NULL DEFAULT 0,
  huevos_deformes     integer NOT NULL DEFAULT 0,
  aves_en_dia         integer,
  alimento_kg         numeric(10,3) NOT NULL DEFAULT 0,
  muertes             integer NOT NULL DEFAULT 0,
  causa_muerte        text,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, fecha)
);
ALTER TABLE produccion_diaria_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD produccion_diaria_aves" ON produccion_diaria_aves;
CREATE POLICY "Miembros CRUD produccion_diaria_aves" ON produccion_diaria_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_produccion_diaria_lote_fecha ON produccion_diaria_aves(lote_id, fecha DESC);

-- Parámetros ambientales (IoT-ready)
CREATE TABLE IF NOT EXISTS parametros_ambientales_aves (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id               uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id              uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha                 date NOT NULL DEFAULT CURRENT_DATE,
  hora                  time,
  temperatura_interior  numeric(5,2),
  temperatura_exterior  numeric(5,2),
  humedad_interior      numeric(5,2),
  humedad_exterior      numeric(5,2),
  nh3_ppm               numeric(8,2),
  co2_ppm               numeric(8,2),
  lux_intensidad        numeric(10,2),
  fuente                text NOT NULL DEFAULT 'manual' CHECK (fuente IN ('manual', 'sensor')),
  sensor_id             text,
  observaciones         text,
  registrado_por        uuid REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE parametros_ambientales_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD parametros_ambientales_aves" ON parametros_ambientales_aves;
CREATE POLICY "Miembros CRUD parametros_ambientales_aves" ON parametros_ambientales_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_parametros_amb_lote_fecha ON parametros_ambientales_aves(lote_id, fecha DESC);

-- Vacunaciones
CREATE TABLE IF NOT EXISTS vacunaciones_aves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_aplicacion    date NOT NULL DEFAULT CURRENT_DATE,
  vacuna              text NOT NULL,
  lote_vacuna         text,
  via_administracion  text,
  dosis               text,
  laboratorio         text,
  numero_aves         integer,
  costo               numeric(12,2),
  proxima_dosis       date,
  veterinario         text,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vacunaciones_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD vacunaciones_aves" ON vacunaciones_aves;
CREATE POLICY "Miembros CRUD vacunaciones_aves" ON vacunaciones_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_vacunaciones_lote ON vacunaciones_aves(lote_id, fecha_aplicacion DESC);

-- Medicaciones
CREATE TABLE IF NOT EXISTS medicaciones_aves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_inicio        date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin           date,
  medicamento         text NOT NULL,
  principio_activo    text,
  via_administracion  text,
  dosis               text,
  periodo_retiro_dias integer,
  motivo              text,
  costo               numeric(12,2),
  veterinario         text,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE medicaciones_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD medicaciones_aves" ON medicaciones_aves;
CREATE POLICY "Miembros CRUD medicaciones_aves" ON medicaciones_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_medicaciones_lote ON medicaciones_aves(lote_id, fecha_inicio DESC);

-- Eventos clínicos
CREATE TABLE IF NOT EXISTS eventos_clinicos_aves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  tipo_evento         text NOT NULL CHECK (tipo_evento IN ('respiratorio','locomotor','digestivo','reproductivo','nervioso','piel','otro')),
  descripcion         text NOT NULL,
  aves_afectadas      integer,
  aves_muertas        integer DEFAULT 0,
  accion_tomada       text,
  veterinario         text,
  resuelto            boolean NOT NULL DEFAULT false,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE eventos_clinicos_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD eventos_clinicos_aves" ON eventos_clinicos_aves;
CREATE POLICY "Miembros CRUD eventos_clinicos_aves" ON eventos_clinicos_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_eventos_clinicos_lote ON eventos_clinicos_aves(lote_id, fecha DESC);

-- Costos operativos del lote
CREATE TABLE IF NOT EXISTS costos_lote_aves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  categoria           text NOT NULL CHECK (categoria IN ('pollitas','alimento','agua','energia','mano_obra','mantenimiento','sanitario','otro')),
  descripcion         text NOT NULL,
  monto               numeric(14,2) NOT NULL,
  proveedor           text,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE costos_lote_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD costos_lote_aves" ON costos_lote_aves;
CREATE POLICY "Miembros CRUD costos_lote_aves" ON costos_lote_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_costos_lote ON costos_lote_aves(lote_id, fecha DESC);

-- Equipos del galpón (IoT-ready)
CREATE TABLE IF NOT EXISTS equipos_aves (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id               uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id              uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  tipo                  text NOT NULL CHECK (tipo IN ('ventilador','banda_recoleccion','comedero','bebedero','lampara','calefactor','otro')),
  estado                text NOT NULL DEFAULT 'operativo' CHECK (estado IN ('operativo','falla','mantenimiento','inactivo')),
  horas_operacion       numeric(10,2) DEFAULT 0,
  ultima_revision       date,
  proximo_mantenimiento date,
  ubicacion             text,
  sensor_id             text,
  observaciones         text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE equipos_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD equipos_aves" ON equipos_aves;
CREATE POLICY "Miembros CRUD equipos_aves" ON equipos_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_equipos_lote ON equipos_aves(lote_id);

-- Logs de equipos (IoT-ready)
CREATE TABLE IF NOT EXISTS equipos_aves_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id           uuid NOT NULL REFERENCES equipos_aves(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  estado_registrado   text NOT NULL,
  horas_dia           numeric(6,2),
  lectura_sensor      jsonb,
  alerta              boolean DEFAULT false,
  descripcion_alerta  text,
  fuente              text DEFAULT 'manual' CHECK (fuente IN ('manual','sensor')),
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE equipos_aves_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD equipos_aves_logs" ON equipos_aves_logs;
CREATE POLICY "Miembros CRUD equipos_aves_logs" ON equipos_aves_logs FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_equipos_logs_equipo ON equipos_aves_logs(equipo_id, fecha DESC);
