-- Marca "Hecho" por horario de alimentación y por día, para poder sumar (y deshacer) su aporte
-- al consumo de alimento del día sin duplicar si se presiona más de una vez.

CREATE TABLE IF NOT EXISTS horarios_alimentacion_completados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id   uuid NOT NULL REFERENCES horarios_alimentacion_aves(id) ON DELETE CASCADE,
  lote_id      uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id     uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha        date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (horario_id, fecha)
);
ALTER TABLE horarios_alimentacion_completados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD horarios_alimentacion_completados" ON horarios_alimentacion_completados;
CREATE POLICY "Miembros CRUD horarios_alimentacion_completados" ON horarios_alimentacion_completados FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_horarios_completados_lote_fecha ON horarios_alimentacion_completados(lote_id, fecha DESC);
