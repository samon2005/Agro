-- ============================================================
-- MÓDULO: Nivelar equipos_pollo con equipos_aves/equipos_cerdos
-- y agregar tipo 'cuenta_huevos' a equipos_aves
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

ALTER TABLE equipos_pollo ADD COLUMN IF NOT EXISTS horas_operacion numeric(10,1);
ALTER TABLE equipos_pollo ADD COLUMN IF NOT EXISTS ultima_revision date;

ALTER TABLE equipos_aves DROP CONSTRAINT IF EXISTS equipos_aves_tipo_check;
ALTER TABLE equipos_aves ADD CONSTRAINT equipos_aves_tipo_check
  CHECK (tipo IN ('ventilador', 'banda_recoleccion', 'comedero', 'bebedero', 'lampara', 'calefactor', 'cuenta_huevos', 'otro'));
