-- ============================================================
-- MÓDULO: Roles reales (operarios), especies que trabaja la finca
-- y coordenadas geográficas (para clima en fase posterior)
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Perfil: cargo/función del operario + estado activo ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- ---- Coordenadas de la finca (para integración de clima Open-Meteo) ----
ALTER TABLE fincas ADD COLUMN IF NOT EXISTS latitud numeric(9,6);
ALTER TABLE fincas ADD COLUMN IF NOT EXISTS longitud numeric(9,6);

-- ---- tipo_produccion ya existe (text[]); documentamos los valores válidos ----
-- Valores esperados desde la app: 'aves_ponedoras' | 'cerdos' | 'pollo_engorde'
COMMENT ON COLUMN fincas.tipo_produccion IS
  'Especies que trabaja la finca. Valores usados por la app: aves_ponedoras, cerdos, pollo_engorde';
