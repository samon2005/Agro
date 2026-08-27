-- ============================================================
-- MÓDULO: Alimento — marca, tipo de alimento y datos de entrada
-- (cantidad y fecha) para conectar la compra con Costos
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

ALTER TABLE tipos_alimento_aves ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE tipos_alimento_aves ADD COLUMN IF NOT EXISTS tipo_alimento_categoria text
  CHECK (tipo_alimento_categoria IS NULL OR tipo_alimento_categoria IN ('levante', 'pollitas_ponedoras', 'otros'));
ALTER TABLE tipos_alimento_aves ADD COLUMN IF NOT EXISTS cantidad_entrada numeric(10,2);
ALTER TABLE tipos_alimento_aves ADD COLUMN IF NOT EXISTS fecha_entrada date;
