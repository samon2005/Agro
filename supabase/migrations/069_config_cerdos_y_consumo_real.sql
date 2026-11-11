-- Fase 0 del plan de cerdos (docs/plan-cerdos-jose-2026-11.md)
--
-- 1. Parámetros de cerdos por finca. Lo que antes estaba fijo en el código
--    (114 días de gestación, lactancia 21–28, etapas y sus pesos, umbrales de
--    alerta, metas) pasa a ser una configuración de cada granja. La app trae
--    valores por defecto de literatura y solo guarda lo que la granja cambie.
ALTER TABLE fincas
  ADD COLUMN IF NOT EXISTS config_cerdos jsonb;

COMMENT ON COLUMN fincas.config_cerdos IS
  'Parámetros de cerdos que la granja cambió frente a los valores por defecto (src/lib/configCerdos.ts).';

-- 2. Consumo real de alimento. El operario anota lo que sirvió y, si lo mide,
--    lo que quedó en el comedero. El consumo real se calcula aquí, en un solo
--    lugar, para que la conversión, los costos, los reportes y las alertas
--    usen el mismo número. La bodega sigue descontando lo servido.
ALTER TABLE nutricion_diaria_cerdos
  ADD COLUMN IF NOT EXISTS sobrante_kg numeric(10,2) CHECK (sobrante_kg IS NULL OR sobrante_kg >= 0);

ALTER TABLE nutricion_diaria_cerdos
  ADD COLUMN IF NOT EXISTS consumo_real_kg numeric(10,2)
  GENERATED ALWAYS AS (GREATEST(COALESCE(alimento_kg, 0) - COALESCE(sobrante_kg, 0), 0)) STORED;

COMMENT ON COLUMN nutricion_diaria_cerdos.sobrante_kg IS 'Alimento que quedó en el comedero (opcional).';
COMMENT ON COLUMN nutricion_diaria_cerdos.consumo_real_kg IS 'Servido menos sobrante: lo que de verdad comieron.';
