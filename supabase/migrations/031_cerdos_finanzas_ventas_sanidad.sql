-- ============================================================
-- MÓDULO: Cerdos — finanzas, ventas y sanidad clínica
-- Lleva el módulo de cerdos a la paridad con aves ponedoras.
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Eventos clínicos (mismo patrón que eventos_clinicos_aves) ----
CREATE TABLE IF NOT EXISTS eventos_clinicos_cerdos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id               uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id              uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha                 date NOT NULL DEFAULT CURRENT_DATE,
  tipo_evento           text NOT NULL,
  descripcion           text NOT NULL,
  animales_afectados    integer,
  animales_muertos      integer DEFAULT 0,
  accion_tomada         text,
  veterinario           text,
  resuelto              boolean NOT NULL DEFAULT false,
  requiere_medicamento  boolean NOT NULL DEFAULT true,
  observaciones         text,
  registrado_por        uuid REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE eventos_clinicos_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD eventos_clinicos_cerdos" ON eventos_clinicos_cerdos;
CREATE POLICY "Miembros CRUD eventos_clinicos_cerdos" ON eventos_clinicos_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_eventos_clinicos_cerdos_lote_fecha ON eventos_clinicos_cerdos(lote_id, fecha DESC);

-- ---- Tratamientos con período de retiro (crítico en carne) ----
CREATE TABLE IF NOT EXISTS medicaciones_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_inicio        date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin           date,
  medicamento         text NOT NULL,
  principio_activo    text,
  via_administracion  text,
  dosis               text,
  periodo_retiro_dias integer,
  numero_animales     integer,
  motivo              text,
  costo               numeric(12,2),
  veterinario         text,
  proveedor           text,
  observaciones       text,
  evento_clinico_id   uuid REFERENCES eventos_clinicos_cerdos(id) ON DELETE SET NULL,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE medicaciones_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD medicaciones_cerdos" ON medicaciones_cerdos;
CREATE POLICY "Miembros CRUD medicaciones_cerdos" ON medicaciones_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_medicaciones_cerdos_lote_fecha ON medicaciones_cerdos(lote_id, fecha_inicio DESC);

-- ---- Recordatorios de aplicación ----
CREATE TABLE IF NOT EXISTS recordatorios_medicacion_cerdos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicacion_id  uuid NOT NULL REFERENCES medicaciones_cerdos(id) ON DELETE CASCADE,
  lote_id        uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id       uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha          date NOT NULL,
  hora           time,
  completado     boolean NOT NULL DEFAULT false,
  canal          text NOT NULL DEFAULT 'app' CHECK (canal IN ('app', 'whatsapp')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recordatorios_medicacion_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD recordatorios_medicacion_cerdos" ON recordatorios_medicacion_cerdos;
CREATE POLICY "Miembros CRUD recordatorios_medicacion_cerdos" ON recordatorios_medicacion_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_recordatorios_medicacion_cerdos_lote_fecha ON recordatorios_medicacion_cerdos(lote_id, fecha);

-- ---- Costos del lote (espejo de costos_lote_aves, con FK en cascada) ----
CREATE TABLE IF NOT EXISTS costos_lote_cerdos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id          uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id         uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  categoria        text NOT NULL,
  descripcion      text NOT NULL,
  monto            numeric(14,2) NOT NULL,
  proveedor        text,
  observaciones    text,
  equipo_id        uuid REFERENCES equipos_cerdos(id) ON DELETE CASCADE,
  medicacion_id    uuid REFERENCES medicaciones_cerdos(id) ON DELETE CASCADE,
  vacunacion_id    uuid REFERENCES vacunaciones_cerdos(id) ON DELETE CASCADE,
  desinfeccion_id  uuid REFERENCES desinfecciones_cerdos(id) ON DELETE CASCADE,
  registrado_por   uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costos_lote_cerdos_categoria_check
    CHECK (categoria IN ('lechones', 'alimento', 'servicios_publicos', 'mano_obra', 'mantenimiento', 'sanitario', 'equipos', 'otro'))
);
ALTER TABLE costos_lote_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD costos_lote_cerdos" ON costos_lote_cerdos;
CREATE POLICY "Miembros CRUD costos_lote_cerdos" ON costos_lote_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_costos_lote_cerdos_lote_fecha ON costos_lote_cerdos(lote_id, fecha DESC);

CREATE TABLE IF NOT EXISTS costos_predefinidos_cerdos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id          uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  categoria         text NOT NULL,
  monto_referencia  numeric(14,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, categoria)
);
ALTER TABLE costos_predefinidos_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD costos_predefinidos_cerdos" ON costos_predefinidos_cerdos;
CREATE POLICY "Miembros CRUD costos_predefinidos_cerdos" ON costos_predefinidos_cerdos FOR ALL USING (es_miembro_finca(finca_id));

-- ---- Ventas (modelo flexible: por kg o por animal, en pie o en canal) ----
CREATE TABLE IF NOT EXISTS ventas_cerdos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id                uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id               uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha                  date NOT NULL DEFAULT CURRENT_DATE,
  cantidad               integer NOT NULL DEFAULT 0,
  peso_promedio_kg       numeric(10,2),
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
ALTER TABLE ventas_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD ventas_cerdos" ON ventas_cerdos;
CREATE POLICY "Miembros CRUD ventas_cerdos" ON ventas_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_ventas_cerdos_lote_fecha ON ventas_cerdos(lote_id, fecha DESC);

-- ---- Configuración del lote y del equipo ----
ALTER TABLE lotes_cerdos
  ADD COLUMN IF NOT EXISTS area_corral_m2 numeric(10,2),
  ADD COLUMN IF NOT EXISTS peso_objetivo_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS fecha_salida_estimada date,
  ADD COLUMN IF NOT EXISTS precio_kg_objetivo numeric(12,2);

ALTER TABLE equipos_cerdos
  ADD COLUMN IF NOT EXISTS costo_compra numeric(14,2),
  ADD COLUMN IF NOT EXISTS fecha_compra date;
