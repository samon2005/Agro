-- =============================================
-- AgroGestión - Módulo: Cerdos
-- Aplicar en: Supabase SQL Editor
-- =============================================

-- Lotes de cerdos (entidad central)
CREATE TABLE IF NOT EXISTS lotes_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre              text NOT NULL,
  linea_genetica      text,
  fecha_ingreso       date NOT NULL DEFAULT CURRENT_DATE,
  etapa_actual        text NOT NULL DEFAULT 'precebo' CHECK (etapa_actual IN ('precebo','levante','ceba','finalizacion','vendido')),
  numero_animales     integer NOT NULL DEFAULT 0,
  animales_actuales   integer NOT NULL DEFAULT 0,
  peso_promedio_inicial numeric(8,2),
  origen_animales     text,
  corral              text,
  estado              text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'vendido')),
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lotes_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD lotes_cerdos" ON lotes_cerdos;
CREATE POLICY "Miembros CRUD lotes_cerdos" ON lotes_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_lotes_cerdos_finca ON lotes_cerdos(finca_id);
CREATE INDEX IF NOT EXISTS idx_lotes_cerdos_estado ON lotes_cerdos(finca_id, estado);

-- Cambios de etapa productiva
CREATE TABLE IF NOT EXISTS etapas_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  etapa_anterior      text,
  etapa_nueva         text NOT NULL,
  peso_promedio       numeric(8,2),
  numero_animales     integer,
  corral_destino      text,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE etapas_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD etapas_cerdos" ON etapas_cerdos;
CREATE POLICY "Miembros CRUD etapas_cerdos" ON etapas_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_etapas_cerdos_lote ON etapas_cerdos(lote_id, fecha DESC);

-- Pesos del lote (curva de crecimiento)
CREATE TABLE IF NOT EXISTS pesos_lote_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  peso_promedio       numeric(8,2) NOT NULL,
  peso_minimo         numeric(8,2),
  peso_maximo         numeric(8,2),
  numero_pesados      integer,
  metodo              text DEFAULT 'manual' CHECK (metodo IN ('manual','bascula_dinamica')),
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pesos_lote_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD pesos_lote_cerdos" ON pesos_lote_cerdos;
CREATE POLICY "Miembros CRUD pesos_lote_cerdos" ON pesos_lote_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_pesos_lote_cerdos ON pesos_lote_cerdos(lote_id, fecha DESC);

-- Mortalidad
CREATE TABLE IF NOT EXISTS mortalidad_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  cantidad            integer NOT NULL DEFAULT 1,
  causa               text,
  descripcion         text,
  peso_estimado       numeric(8,2),
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mortalidad_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD mortalidad_cerdos" ON mortalidad_cerdos;
CREATE POLICY "Miembros CRUD mortalidad_cerdos" ON mortalidad_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_mortalidad_cerdos_lote ON mortalidad_cerdos(lote_id, fecha DESC);

-- Movimientos (traslados y ventas)
CREATE TABLE IF NOT EXISTS movimientos_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  tipo                text NOT NULL CHECK (tipo IN ('traslado','venta','ingreso','descarte')),
  cantidad            integer NOT NULL,
  peso_promedio       numeric(8,2),
  destino_origen      text,
  precio_unitario     numeric(12,2),
  valor_total         numeric(14,2),
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE movimientos_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD movimientos_cerdos" ON movimientos_cerdos;
CREATE POLICY "Miembros CRUD movimientos_cerdos" ON movimientos_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_movimientos_cerdos_lote ON movimientos_cerdos(lote_id, fecha DESC);

-- Vacunaciones
CREATE TABLE IF NOT EXISTS vacunaciones_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_aplicacion    date NOT NULL DEFAULT CURRENT_DATE,
  vacuna              text NOT NULL,
  lote_vacuna         text,
  via_administracion  text,
  dosis               text,
  laboratorio         text,
  numero_animales     integer,
  costo               numeric(12,2),
  proxima_dosis       date,
  veterinario         text,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vacunaciones_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD vacunaciones_cerdos" ON vacunaciones_cerdos;
CREATE POLICY "Miembros CRUD vacunaciones_cerdos" ON vacunaciones_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_vacunaciones_cerdos_lote ON vacunaciones_cerdos(lote_id, fecha_aplicacion DESC);

-- Desparasitaciones
CREATE TABLE IF NOT EXISTS desparasitaciones_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  producto            text NOT NULL,
  principio_activo    text,
  via_administracion  text,
  dosis               text,
  numero_animales     integer,
  periodo_retiro_dias integer,
  costo               numeric(12,2),
  veterinario         text,
  proxima_aplicacion  date,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE desparasitaciones_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD desparasitaciones_cerdos" ON desparasitaciones_cerdos;
CREATE POLICY "Miembros CRUD desparasitaciones_cerdos" ON desparasitaciones_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_desparasitaciones_cerdos_lote ON desparasitaciones_cerdos(lote_id, fecha DESC);

-- Nutrición diaria (alimento + agua)
CREATE TABLE IF NOT EXISTS nutricion_diaria_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  alimento_kg         numeric(10,3) NOT NULL DEFAULT 0,
  tipo_alimento       text,
  agua_litros         numeric(10,2),
  aditivos            text,
  costo_alimento      numeric(12,2),
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, fecha)
);
ALTER TABLE nutricion_diaria_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD nutricion_diaria_cerdos" ON nutricion_diaria_cerdos;
CREATE POLICY "Miembros CRUD nutricion_diaria_cerdos" ON nutricion_diaria_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_nutricion_diaria_cerdos ON nutricion_diaria_cerdos(lote_id, fecha DESC);

-- Parámetros ambientales (IoT-ready)
CREATE TABLE IF NOT EXISTS parametros_ambientales_cerdos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id               uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id              uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha                 date NOT NULL DEFAULT CURRENT_DATE,
  hora                  time,
  temperatura_interior  numeric(5,2),
  temperatura_exterior  numeric(5,2),
  humedad_interior      numeric(5,2),
  nh3_ppm               numeric(8,2),
  co2_ppm               numeric(8,2),
  fuente                text NOT NULL DEFAULT 'manual' CHECK (fuente IN ('manual','sensor')),
  sensor_id             text,
  observaciones         text,
  registrado_por        uuid REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE parametros_ambientales_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD parametros_ambientales_cerdos" ON parametros_ambientales_cerdos;
CREATE POLICY "Miembros CRUD parametros_ambientales_cerdos" ON parametros_ambientales_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_parametros_amb_cerdos ON parametros_ambientales_cerdos(lote_id, fecha DESC);

-- Equipos de la porqueriza (IoT-ready)
CREATE TABLE IF NOT EXISTS equipos_cerdos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id               uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id              uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  tipo                  text NOT NULL CHECK (tipo IN ('ventilador','extractor','bomba_agua','iluminacion','comedero_automatico','bebedero','calefactor','otro')),
  estado                text NOT NULL DEFAULT 'operativo' CHECK (estado IN ('operativo','falla','mantenimiento','inactivo')),
  horas_operacion       numeric(10,2) DEFAULT 0,
  ultima_revision       date,
  proximo_mantenimiento date,
  ubicacion             text,
  sensor_id             text,
  observaciones         text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE equipos_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD equipos_cerdos" ON equipos_cerdos;
CREATE POLICY "Miembros CRUD equipos_cerdos" ON equipos_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_equipos_cerdos_lote ON equipos_cerdos(lote_id);

-- Logs de equipos cerdos (IoT-ready)
CREATE TABLE IF NOT EXISTS equipos_cerdos_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id           uuid NOT NULL REFERENCES equipos_cerdos(id) ON DELETE CASCADE,
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
ALTER TABLE equipos_cerdos_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD equipos_cerdos_logs" ON equipos_cerdos_logs;
CREATE POLICY "Miembros CRUD equipos_cerdos_logs" ON equipos_cerdos_logs FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_equipos_cerdos_logs ON equipos_cerdos_logs(equipo_id, fecha DESC);
