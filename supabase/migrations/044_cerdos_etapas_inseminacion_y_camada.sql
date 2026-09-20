-- ============================================================
-- MÓDULO: Cerdos — etapas que maneja la finca, inseminación y camada
-- ============================================================

-- ---- Qué etapas maneja la finca ----
-- No todas las granjas hacen el ciclo completo: unas solo crían y venden el
-- lechón al destete, otras solo levantan o solo ceban. La finca marca las
-- suyas y el módulo de cerdos solo muestra esas.
ALTER TABLE fincas
  ADD COLUMN IF NOT EXISTS etapas_cerdos text[];

-- Las fincas que ya tienen cerdos arrancan con el ciclo completo
UPDATE fincas SET etapas_cerdos = ARRAY['cria','lactancia','precebo','levante','ceba']
WHERE etapas_cerdos IS NULL AND 'cerdos' = ANY(tipo_produccion);

-- ---- Aplicaciones de cada servicio ----
-- La inseminación no es una sola: se repite 1, 2 o 3 veces a distintas horas,
-- con un semen que tiene su propio código.
CREATE TABLE IF NOT EXISTS inseminaciones_cerdos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id     uuid NOT NULL REFERENCES servicios_cerdos(id) ON DELETE CASCADE,
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  hora            time,
  codigo_semen    text,
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inseminaciones_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD inseminaciones_cerdos" ON inseminaciones_cerdos;
CREATE POLICY "Miembros CRUD inseminaciones_cerdos" ON inseminaciones_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_inseminaciones_cerdos_servicio ON inseminaciones_cerdos(servicio_id, fecha);

-- El código del semen también queda en el servicio, para verlo sin abrir el detalle
ALTER TABLE servicios_cerdos
  ADD COLUMN IF NOT EXISTS codigo_semen text;

-- ---- La camada ----
-- Se registra por camada, con la madre: cuántos nacieron vivos, cuántas momias
-- (nacidos muertos), cuántos se murieron en el posparto y el peso de cada lechón.
ALTER TABLE partos_cerdos
  ADD COLUMN IF NOT EXISTS muertos_postparto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pesos_nacimiento_kg numeric(5,2)[];

COMMENT ON COLUMN partos_cerdos.momificados IS 'Momias: lechones que nacen muertos y momificados';
COMMENT ON COLUMN partos_cerdos.pesos_nacimiento_kg IS 'Peso de cada lechón al nacer, en el orden en que se pesaron';
