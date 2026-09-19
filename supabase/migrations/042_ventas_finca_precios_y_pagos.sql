-- ============================================================
-- MÓDULO: Ventas de huevo a nivel de finca — precios únicos y pagos
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Un solo precio por tamaño para toda la finca ----
-- Rige para todos los galpones hasta que se cambie. Antes vivía en cada galpón.
ALTER TABLE fincas
  ADD COLUMN IF NOT EXISTS precio_huevo_b numeric(12,2),
  ADD COLUMN IF NOT EXISTS precio_huevo_a numeric(12,2),
  ADD COLUMN IF NOT EXISTS precio_huevo_aa numeric(12,2),
  ADD COLUMN IF NOT EXISTS precio_huevo_aaa numeric(12,2),
  ADD COLUMN IF NOT EXISTS precio_huevo_jumbo numeric(12,2);

-- Las fincas arrancan con los precios que ya tenía alguno de sus galpones
UPDATE fincas f SET
  precio_huevo_b     = COALESCE(f.precio_huevo_b,     p.b),
  precio_huevo_a     = COALESCE(f.precio_huevo_a,     p.a),
  precio_huevo_aa    = COALESCE(f.precio_huevo_aa,    p.aa),
  precio_huevo_aaa   = COALESCE(f.precio_huevo_aaa,   p.aaa),
  precio_huevo_jumbo = COALESCE(f.precio_huevo_jumbo, p.jumbo)
FROM (
  SELECT finca_id,
         max(precio_huevo_b) AS b, max(precio_huevo_a) AS a, max(precio_huevo_aa) AS aa,
         max(precio_huevo_aaa) AS aaa, max(precio_huevo_jumbo) AS jumbo
    FROM lotes_aves
   GROUP BY finca_id
) p
WHERE p.finca_id = f.id;

-- ---- Pagos de las ventas ----
-- La venta se registra el día que el huevo sale de bodega; el dinero entra
-- después, en uno o varios pagos. Solo lo pagado cuenta como ingreso.
CREATE TABLE IF NOT EXISTS pagos_ventas_huevos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        uuid NOT NULL REFERENCES ventas_huevos_aves(id) ON DELETE CASCADE,
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  titular         text,
  monto           numeric(14,2) NOT NULL CHECK (monto > 0),
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pagos_ventas_huevos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD pagos_ventas_huevos" ON pagos_ventas_huevos;
CREATE POLICY "Miembros CRUD pagos_ventas_huevos" ON pagos_ventas_huevos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_pagos_ventas_huevos_venta ON pagos_ventas_huevos(venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_ventas_huevos_finca_fecha ON pagos_ventas_huevos(finca_id, fecha DESC);
