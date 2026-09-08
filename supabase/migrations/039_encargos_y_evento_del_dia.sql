-- ============================================================
-- MÓDULO: Encargos futuros de huevo + evento clínico atado al día
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- El evento clínico registrado desde "Registrar día" queda atado a ese día ----
-- Así, al borrar el día se borra también su evento, y al editarlo se reemplaza
-- en vez de crear uno nuevo cada vez que se guarda.
ALTER TABLE eventos_clinicos_aves
  ADD COLUMN IF NOT EXISTS produccion_id uuid REFERENCES produccion_diaria_aves(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_eventos_clinicos_aves_produccion
  ON eventos_clinicos_aves(produccion_id);

-- ---- Encargos futuros: huevo comprometido que todavía no se ha entregado ----
CREATE TABLE IF NOT EXISTS encargos_huevos_aves (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id         uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_pedido    date NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega   date NOT NULL,
  cliente         text,
  cantidad_b      integer NOT NULL DEFAULT 0,
  cantidad_a      integer NOT NULL DEFAULT 0,
  cantidad_aa     integer NOT NULL DEFAULT 0,
  cantidad_aaa    integer NOT NULL DEFAULT 0,
  cantidad_jumbo  integer NOT NULL DEFAULT 0,
  estado          text NOT NULL DEFAULT 'pendiente',
  venta_id        uuid REFERENCES ventas_huevos_aves(id) ON DELETE SET NULL,
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE encargos_huevos_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD encargos_huevos_aves" ON encargos_huevos_aves;
CREATE POLICY "Miembros CRUD encargos_huevos_aves" ON encargos_huevos_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_encargos_huevos_aves_lote_entrega
  ON encargos_huevos_aves(lote_id, fecha_entrega);
