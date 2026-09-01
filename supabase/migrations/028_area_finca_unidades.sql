-- ============================================================
-- MÓDULO: Área de la finca con unidad de medida seleccionable
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

ALTER TABLE fincas ADD COLUMN IF NOT EXISTS area_valor numeric(12,2);
ALTER TABLE fincas ADD COLUMN IF NOT EXISTS area_unidad text;

-- Migra los datos existentes de "hectareas" al nuevo esquema valor+unidad
UPDATE fincas SET area_valor = hectareas, area_unidad = 'ha'
  WHERE hectareas IS NOT NULL AND area_valor IS NULL;

-- Unidades personalizadas ("otra") que el usuario define, para reusarlas después
-- al crear/editar cualquier finca suya (no atadas a una sola finca).
CREATE TABLE IF NOT EXISTS unidades_area_personalizadas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propietario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (propietario_id, nombre)
);
ALTER TABLE unidades_area_personalizadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dueño CRUD unidades_area_personalizadas" ON unidades_area_personalizadas;
CREATE POLICY "Dueño CRUD unidades_area_personalizadas" ON unidades_area_personalizadas FOR ALL USING (propietario_id = auth.uid());
