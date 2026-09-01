-- ============================================================
-- MÓDULO: Distinguir eventos clínicos que requieren fármaco de
-- los que solo requieren una acción a tomar (ej: estrés calórico)
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

ALTER TABLE eventos_clinicos_aves ADD COLUMN IF NOT EXISTS requiere_medicamento boolean NOT NULL DEFAULT true;
