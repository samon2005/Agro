-- ============================================================
-- MÓDULO: Eventos clínicos — tipo libre y separación de mortalidad
-- El CHECK sobre tipo_evento rechazaba cualquier tipo fuera de la lista
-- fija, así que los eventos con tipo escrito a mano fallaban al insertarse.
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

ALTER TABLE eventos_clinicos_aves DROP CONSTRAINT IF EXISTS eventos_clinicos_aves_tipo_evento_check;

-- Separa la mortalidad (que va en su propia pestaña) de los eventos clínicos.
ALTER TABLE eventos_clinicos_aves
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'clinico'
  CHECK (origen IN ('clinico', 'mortalidad'));

UPDATE eventos_clinicos_aves
  SET origen = 'mortalidad'
  WHERE descripcion LIKE 'Mortalidad reportada:%';
