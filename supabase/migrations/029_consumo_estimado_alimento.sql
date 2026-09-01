-- ============================================================
-- MÓDULO: Límite de kg programados vs. consumo estimado diario
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

ALTER TABLE lotes_aves ADD COLUMN IF NOT EXISTS consumo_estimado_kg_dia numeric(10,2);
