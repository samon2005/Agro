-- ============================================================
-- MÓDULO: Trabajadores — cuánto se les paga y con qué periodicidad
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pago_monto numeric(14,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pago_periodo text
  CHECK (pago_periodo IS NULL OR pago_periodo IN ('mensual', 'quincenal', 'semanal', 'diario', 'por_tarea'));
