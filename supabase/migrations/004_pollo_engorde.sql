-- ============================================================
-- MÓDULO: Pollo de Engorde (Broilers)
-- Aplicar manualmente en Supabase SQL Editor
-- ============================================================

-- Lotes de Pollo de Engorde
CREATE TABLE IF NOT EXISTS lotes_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  linea_genetica text,
  fecha_ingreso date NOT NULL DEFAULT CURRENT_DATE,
  fecha_salida date,
  pollos_iniciales integer NOT NULL DEFAULT 0,
  pollos_actuales integer NOT NULL DEFAULT 0,
  peso_promedio_inicial numeric(8,3),
  origen_pollos text,
  galpone text,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cerrado', 'vendido')),
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Producción diaria (alimento + agua + muertes) — UNIQUE por lote+fecha
CREATE TABLE IF NOT EXISTS produccion_diaria_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  alimento_kg numeric(10,3) NOT NULL DEFAULT 0,
  agua_litros numeric(10,2),
  muertes integer NOT NULL DEFAULT 0,
  causa_muerte text,
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (lote_id, fecha)
);

-- Pesajes periódicos del lote
CREATE TABLE IF NOT EXISTS pesos_lote_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  peso_promedio numeric(8,3) NOT NULL,
  peso_minimo numeric(8,3),
  peso_maximo numeric(8,3),
  numero_pesados integer,
  dia_vida integer,
  metodo text DEFAULT 'manual' CHECK (metodo IN ('manual', 'bascula_dinamica')),
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Parámetros ambientales (IoT-ready)
CREATE TABLE IF NOT EXISTS parametros_ambientales_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  hora time,
  temperatura_interior numeric(5,2),
  temperatura_exterior numeric(5,2),
  humedad_interior numeric(5,2),
  nh3_ppm numeric(7,2),
  co2_ppm numeric(8,1),
  fuente text NOT NULL DEFAULT 'manual' CHECK (fuente IN ('manual', 'sensor')),
  sensor_id text,
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Vacunaciones
CREATE TABLE IF NOT EXISTS vacunaciones_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_aplicacion date NOT NULL DEFAULT CURRENT_DATE,
  vacuna text NOT NULL,
  lote_vacuna text,
  via_administracion text,
  dosis text,
  laboratorio text,
  numero_aves integer,
  costo numeric(12,2),
  proxima_dosis date,
  veterinario text,
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Medicaciones con período de retiro
CREATE TABLE IF NOT EXISTS medicaciones_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date,
  medicamento text NOT NULL,
  principio_activo text,
  via_administracion text,
  dosis text,
  periodo_retiro_dias integer DEFAULT 0,
  motivo text,
  costo numeric(12,2),
  veterinario text,
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Eventos clínicos
CREATE TABLE IF NOT EXISTS eventos_clinicos_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo_evento text NOT NULL,
  descripcion text NOT NULL,
  aves_afectadas integer,
  aves_muertas integer,
  accion_tomada text,
  veterinario text,
  resuelto boolean NOT NULL DEFAULT false,
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Costos del lote (8 categorías)
CREATE TABLE IF NOT EXISTS costos_lote_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  categoria text NOT NULL CHECK (categoria IN ('pollitos', 'alimento', 'agua', 'energia', 'mano_obra', 'mantenimiento', 'sanitario', 'otro')),
  descripcion text NOT NULL,
  monto numeric(14,2) NOT NULL,
  proveedor text,
  observaciones text,
  registrado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Equipos del galpón (IoT-ready)
CREATE TABLE IF NOT EXISTS equipos_pollo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES lotes_pollo(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL,
  estado text NOT NULL DEFAULT 'operativo' CHECK (estado IN ('operativo', 'falla', 'mantenimiento', 'inactivo')),
  marca text,
  modelo text,
  numero_serie text,
  fecha_instalacion date,
  proximo_mantenimiento date,
  ubicacion text,
  sensor_id text,
  observaciones text,
  created_at timestamptz DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE lotes_pollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE produccion_diaria_pollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesos_lote_pollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_ambientales_pollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacunaciones_pollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicaciones_pollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_clinicos_pollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE costos_lote_pollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos_pollo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "miembro_finca_pollo_lotes" ON lotes_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE POLICY "miembro_finca_produccion_pollo" ON produccion_diaria_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE POLICY "miembro_finca_pesos_pollo" ON pesos_lote_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE POLICY "miembro_finca_ambiental_pollo" ON parametros_ambientales_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE POLICY "miembro_finca_vacunas_pollo" ON vacunaciones_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE POLICY "miembro_finca_medicaciones_pollo" ON medicaciones_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE POLICY "miembro_finca_eventos_pollo" ON eventos_clinicos_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE POLICY "miembro_finca_costos_pollo" ON costos_lote_pollo FOR ALL USING (es_miembro_finca(finca_id));
CREATE POLICY "miembro_finca_equipos_pollo" ON equipos_pollo FOR ALL USING (es_miembro_finca(finca_id));

-- También agregar marca/modelo a equipos_aves y equipos_cerdos si no existen
ALTER TABLE equipos_aves ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE equipos_aves ADD COLUMN IF NOT EXISTS modelo text;
ALTER TABLE equipos_aves ADD COLUMN IF NOT EXISTS numero_serie text;
ALTER TABLE equipos_aves ADD COLUMN IF NOT EXISTS fecha_instalacion date;

ALTER TABLE equipos_cerdos ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE equipos_cerdos ADD COLUMN IF NOT EXISTS modelo text;
ALTER TABLE equipos_cerdos ADD COLUMN IF NOT EXISTS numero_serie text;
ALTER TABLE equipos_cerdos ADD COLUMN IF NOT EXISTS fecha_instalacion date;
