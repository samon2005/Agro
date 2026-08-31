CREATE TABLE IF NOT EXISTS ventas_huevos_aves (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id           uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id          uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha             date NOT NULL DEFAULT CURRENT_DATE,
  cantidad_b        integer NOT NULL DEFAULT 0,
  cantidad_a        integer NOT NULL DEFAULT 0,
  cantidad_aa       integer NOT NULL DEFAULT 0,
  cantidad_aaa      integer NOT NULL DEFAULT 0,
  cantidad_jumbo    integer NOT NULL DEFAULT 0,
  precio_b          numeric(10,2),
  precio_a          numeric(10,2),
  precio_aa         numeric(10,2),
  precio_aaa        numeric(10,2),
  precio_jumbo      numeric(10,2),
  cliente           text,
  observaciones     text,
  registrado_por    uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ventas_huevos_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD ventas_huevos_aves" ON ventas_huevos_aves;
CREATE POLICY "Miembros CRUD ventas_huevos_aves" ON ventas_huevos_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_ventas_huevos_lote_fecha ON ventas_huevos_aves(lote_id, fecha DESC);
