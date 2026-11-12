-- Meta de postura semana a semana, en % (pedido de José en Jericó, 12 nov 2026).
--
-- Cada lote puede tener su propia meta para cada semana de vida de las aves:
-- {"20": 85, "21": 90.5, ...}. La meta en huevos ya no se escribe: la app la
-- calcula como aves del día × % de la semana (src/lib/metasPostura.ts). Si una
-- semana no tiene meta propia, se usa la guía de la línea y, si no hay guía,
-- la meta de pico (meta_postura_pct). Solo agrega.
ALTER TABLE lotes_aves
  ADD COLUMN IF NOT EXISTS metas_postura_semanal jsonb;

COMMENT ON COLUMN lotes_aves.metas_postura_semanal IS
  'Meta de postura (%) por semana de vida: {"20": 85, "21": 90}. La meta en huevos se calcula con las aves del día.';
COMMENT ON COLUMN lotes_aves.meta_huevos_diaria IS
  'Ya no se usa en la app (desde la migración 074 la meta en huevos se calcula del % semanal). Se deja por la versión publicada anterior.';
