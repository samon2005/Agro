-- Tareas del equipo: de qué galpón son, qué tan urgentes, si se repiten y quién
-- y cuándo las completó. Al completar una tarea que se repite, la base crea la
-- siguiente (mañana o en una semana), así nadie tiene que volver a escribirla.

ALTER TABLE tareas_operarios
  ADD COLUMN IF NOT EXISTS instalacion_id uuid REFERENCES instalaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prioridad text NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('normal', 'alta')),
  ADD COLUMN IF NOT EXISTS repetir text NOT NULL DEFAULT 'no' CHECK (repetir IN ('no', 'diaria', 'semanal')),
  ADD COLUMN IF NOT EXISTS notas text,
  ADD COLUMN IF NOT EXISTS completada_en timestamptz,
  ADD COLUMN IF NOT EXISTS completada_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- La tarea de la que salió esta (si es una repetición), para no duplicarla
  ADD COLUMN IF NOT EXISTS viene_de uuid REFERENCES tareas_operarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tareas_operarios_fecha ON tareas_operarios (finca_id, fecha);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tareas_operarios_viene_de ON tareas_operarios (viene_de) WHERE viene_de IS NOT NULL;

CREATE OR REPLACE FUNCTION trg_tarea_completada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'completada' AND OLD.estado IS DISTINCT FROM 'completada' THEN
    NEW.completada_en := now();
    NEW.completada_por := auth.uid();
    IF NEW.repetir <> 'no' THEN
      INSERT INTO tareas_operarios (finca_id, operario_id, descripcion, fecha, hora_inicio, hora_fin, instalacion_id, prioridad, repetir, notas, viene_de)
      VALUES (NEW.finca_id, NEW.operario_id, NEW.descripcion,
              NEW.fecha + CASE NEW.repetir WHEN 'diaria' THEN 1 ELSE 7 END,
              NEW.hora_inicio, NEW.hora_fin, NEW.instalacion_id, NEW.prioridad, NEW.repetir, NEW.notas, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF NEW.estado <> 'completada' AND OLD.estado = 'completada' THEN
    NEW.completada_en := NULL;
    NEW.completada_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tarea_completada ON tareas_operarios;
CREATE TRIGGER tarea_completada
  BEFORE UPDATE OF estado ON tareas_operarios
  FOR EACH ROW EXECUTE FUNCTION trg_tarea_completada();
