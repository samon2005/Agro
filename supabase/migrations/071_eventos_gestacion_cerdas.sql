-- Fase 1A del plan de cerdos (docs/plan-cerdos-jose-2026-11.md, sección 4)
--
-- El estado de la cerda deja de escribirse a mano en cada pantalla: la app lo
-- calcula desde su historia (src/lib/estadoCerda.ts) y lo guarda en
-- reproductoras_cerdos.estado. Para eso hace falta registrar lo que le pasa
-- en la gestación además del servicio, el parto y el destete.
-- Solo agrega: la versión publicada sigue funcionando igual.

-- 1. Lo que le pasa a una cerda servida: repite celo, sale vacía o aborta.
--    Cuentan para el descarte y para los indicadores (% de repetición, % de abortos).
CREATE TABLE IF NOT EXISTS eventos_gestacion_cerdos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id         uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  lote_id          uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  reproductora_id  uuid NOT NULL REFERENCES reproductoras_cerdos(id) ON DELETE CASCADE,
  servicio_id      uuid REFERENCES servicios_cerdos(id) ON DELETE CASCADE,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  tipo             text NOT NULL CHECK (tipo IN ('repeticion', 'vacia', 'aborto')),
  -- Para "vacía": cómo se supo (no repetición, ecografía u otro)
  metodo           text CHECK (metodo IS NULL OR metodo IN ('no_repeticion', 'ecografia', 'otro')),
  observaciones    text,
  registrado_por   uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE eventos_gestacion_cerdos IS
  'Repetición de celo, diagnóstico de vacía y aborto de cada cerda. Con el servicio, el parto y el destete forman la historia de la que sale su estado.';

ALTER TABLE eventos_gestacion_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eventos_gestacion_cerdos_miembros ON eventos_gestacion_cerdos;
CREATE POLICY eventos_gestacion_cerdos_miembros ON eventos_gestacion_cerdos FOR ALL TO authenticated
  USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_eventos_gestacion_cerda ON eventos_gestacion_cerdos(reproductora_id, fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_gestacion_servicio ON eventos_gestacion_cerdos(servicio_id);

-- 2. Cómo se confirmó la preñez (el método y el día los define cada granja)
ALTER TABLE servicios_cerdos
  ADD COLUMN IF NOT EXISTS metodo_confirmacion text
  CHECK (metodo_confirmacion IS NULL OR metodo_confirmacion IN ('no_repeticion', 'ecografia', 'otro'));

-- 3. El servicio también puede terminar en aborto
ALTER TABLE servicios_cerdos DROP CONSTRAINT IF EXISTS servicios_cerdos_estado_check;
ALTER TABLE servicios_cerdos ADD CONSTRAINT servicios_cerdos_estado_check
  CHECK (estado IN ('pendiente', 'confirmado', 'repetido', 'fallido', 'abortado', 'parido'));

-- 4. Cuarentena de las primerizas que llegan a la finca
ALTER TABLE reproductoras_cerdos
  ADD COLUMN IF NOT EXISTS cuarentena_hasta date;
COMMENT ON COLUMN reproductoras_cerdos.cuarentena_hasta IS
  'Último día de cuarentena de una primeriza que llega a la finca (null si no entró a cuarentena).';

-- 5. Los estados posibles de la cerda (José: "según su estado fisiológico")
ALTER TABLE reproductoras_cerdos DROP CONSTRAINT IF EXISTS reproductoras_cerdos_estado_check;
ALTER TABLE reproductoras_cerdos ADD CONSTRAINT reproductoras_cerdos_estado_check
  CHECK (estado IN ('vacia', 'servida', 'gestante', 'lactante', 'descartada',
                    'en_cuarentena', 'en_recuperacion', 'aborto', 'repetidora'));
