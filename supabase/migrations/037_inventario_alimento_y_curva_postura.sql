-- ============================================================
-- MÓDULO: Entradas de alimento (inventario) + curva de postura
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Entradas de alimento: cada compra que entra al galpón ----
CREATE TABLE IF NOT EXISTS entradas_alimento_aves (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id          uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  lote_id           uuid REFERENCES lotes_aves(id) ON DELETE SET NULL,
  tipo_alimento_id  uuid NOT NULL REFERENCES tipos_alimento_aves(id) ON DELETE CASCADE,
  fecha             date NOT NULL DEFAULT CURRENT_DATE,
  cantidad_bultos   numeric(10,2) NOT NULL,
  precio_bulto      numeric(12,2),
  proveedor         text,
  observaciones     text,
  registrado_por    uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE entradas_alimento_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD entradas_alimento_aves" ON entradas_alimento_aves;
CREATE POLICY "Miembros CRUD entradas_alimento_aves" ON entradas_alimento_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_entradas_alimento_aves_finca_fecha ON entradas_alimento_aves(finca_id, fecha DESC);

-- El costo de la entrada se borra en cascada si se borra la entrada
ALTER TABLE costos_lote_aves
  ADD COLUMN IF NOT EXISTS entrada_alimento_id uuid REFERENCES entradas_alimento_aves(id) ON DELETE CASCADE;

-- ---- Curva de postura de referencia (% producido por semana de vida) ----
ALTER TABLE curvas_referencia ADD COLUMN IF NOT EXISTS postura_pct numeric(5,2);
ALTER TABLE curvas_referencia ADD COLUMN IF NOT EXISTS semana integer;

-- Curva estándar de ponedora: arranca en la semana 20, pico ~92 % entre la 30 y la 32
-- y desciende hasta ~45 % en la semana 90. Valores de referencia editables por finca.
INSERT INTO curvas_referencia (finca_id, especie, linea_genetica, dia, semana, postura_pct) VALUES
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 133, 19,  0),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 140, 20,  5),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 147, 21, 35),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 154, 22, 62),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 161, 23, 74),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 175, 25, 82),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 196, 28, 89),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 210, 30, 92),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 224, 32, 92),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 245, 35, 91),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 280, 40, 89),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 315, 45, 87),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 350, 50, 84),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 385, 55, 81),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 420, 60, 78),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 455, 65, 74),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 490, 70, 70),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 525, 75, 65),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 560, 80, 60),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 595, 85, 53),
  (NULL, 'aves_ponedoras', 'Curva estándar de postura', 630, 90, 45)
ON CONFLICT DO NOTHING;
