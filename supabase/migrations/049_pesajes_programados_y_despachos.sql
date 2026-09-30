-- ============================================================
-- Pesajes programados, despachos de venta y datos de llegada del pollo
-- ============================================================

-- ---- Cada cuánto se pesa el lote y cuándo toca el próximo ----
-- Los pesajes son programados: de ahí sale la ganancia diaria de peso, que es
-- lo que dice si el lote va bien o se está quedando.
ALTER TABLE lotes_cerdos
  ADD COLUMN IF NOT EXISTS frecuencia_pesaje_dias integer,
  ADD COLUMN IF NOT EXISTS proximo_pesaje date;

ALTER TABLE lotes_pollo
  ADD COLUMN IF NOT EXISTS frecuencia_pesaje_dias integer,
  ADD COLUMN IF NOT EXISTS proximo_pesaje date;

-- ---- Ventas programadas para despacho ----
-- La venta se cierra el día que salen los animales, pero se programa antes:
-- así la granja sabe qué le sale esta semana y con cuánto peso.
CREATE TABLE IF NOT EXISTS despachos_programados (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id           uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  -- 'cerdos' o 'pollo_engorde': el lote vive en la tabla de su especie
  especie            text NOT NULL CHECK (especie IN ('cerdos', 'pollo_engorde')),
  lote_id            uuid NOT NULL,
  fecha_programada   date NOT NULL,
  cantidad           integer NOT NULL CHECK (cantidad > 0),
  peso_estimado_kg   numeric(7,2),
  precio_kg          numeric(12,2),
  cliente            text,
  destino            text,
  -- programado | despachado | cancelado
  estado             text NOT NULL DEFAULT 'programado',
  venta_id           uuid,
  observaciones      text,
  registrado_por     uuid REFERENCES profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE despachos_programados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD despachos_programados" ON despachos_programados;
CREATE POLICY "Miembros CRUD despachos_programados" ON despachos_programados FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_despachos_programados_lote ON despachos_programados(lote_id, fecha_programada);

-- ---- Llegada del pollito ----
-- El pollo de un día es crítico: se anota de dónde vino, a qué hora llegó,
-- cuánto costó y con qué peso entró, porque de ahí sale todo el ciclo.
ALTER TABLE lotes_pollo
  ADD COLUMN IF NOT EXISTS codigo_lote text,
  ADD COLUMN IF NOT EXISTS proveedor text,
  ADD COLUMN IF NOT EXISTS hora_llegada time,
  ADD COLUMN IF NOT EXISTS costo_pollito numeric(12,2),
  -- machos | hembras | mixto: al sexar se separan porque el ciclo es distinto
  ADD COLUMN IF NOT EXISTS sexo text;

-- ---- Plan de vacunación de la granja ----
-- Las vacunas de la granja se hacen cada cierto tiempo y son obligatorias: el
-- plan dice a qué día de vida va cada una, y el lote las va marcando.
CREATE TABLE IF NOT EXISTS plan_vacunacion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  especie         text NOT NULL CHECK (especie IN ('aves_ponedoras', 'cerdos', 'pollo_engorde')),
  vacuna          text NOT NULL,
  dia_vida        integer NOT NULL CHECK (dia_vida >= 0),
  via             text,
  dosis           text,
  obligatoria     boolean NOT NULL DEFAULT true,
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE plan_vacunacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD plan_vacunacion" ON plan_vacunacion;
CREATE POLICY "Miembros CRUD plan_vacunacion" ON plan_vacunacion FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_plan_vacunacion_finca ON plan_vacunacion(finca_id, especie, dia_vida);

-- Cada vacunación puede decir de qué renglón del plan salió
ALTER TABLE vacunaciones_pollo
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plan_vacunacion(id) ON DELETE SET NULL;
ALTER TABLE vacunaciones_cerdos
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plan_vacunacion(id) ON DELETE SET NULL;
