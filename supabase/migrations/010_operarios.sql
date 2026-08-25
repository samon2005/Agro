-- ============================================================
-- MÓDULO: Operarios — turnos y tareas
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS turnos_operarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  operario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio time NOT NULL,
  hora_fin time,
  area text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE turnos_operarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD turnos_operarios" ON turnos_operarios;
CREATE POLICY "Miembros CRUD turnos_operarios" ON turnos_operarios FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_turnos_operarios_finca_fecha ON turnos_operarios(finca_id, fecha DESC);

CREATE TABLE IF NOT EXISTS tareas_operarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  operario_id uuid REFERENCES profiles(id),
  descripcion text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio time,
  hora_fin time,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completada')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tareas_operarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD tareas_operarios" ON tareas_operarios;
CREATE POLICY "Miembros CRUD tareas_operarios" ON tareas_operarios FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_tareas_operarios_finca_fecha ON tareas_operarios(finca_id, fecha DESC);
