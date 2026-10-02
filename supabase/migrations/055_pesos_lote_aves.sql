-- Pesajes de las aves de un galpón. No se pesa todo el lote: se toma una muestra
-- y se anota cuántas aves se pesaron y su peso promedio (en gramos, como lo
-- traen las tablas de las líneas genéticas). Sirve sobre todo en levante, para
-- saber si las pollas llegan con el peso a la postura, y alimenta la columna
-- "Peso aves" del resumen semanal.

CREATE TABLE IF NOT EXISTS pesos_lote_aves (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id          uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id         uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  aves_pesadas     integer NOT NULL CHECK (aves_pesadas > 0),
  peso_promedio_g  numeric(8,1) NOT NULL CHECK (peso_promedio_g > 0),
  peso_minimo_g    numeric(8,1) CHECK (peso_minimo_g > 0),
  peso_maximo_g    numeric(8,1) CHECK (peso_maximo_g > 0),
  -- % de la muestra dentro de ±10 % del promedio
  uniformidad_pct  numeric(5,1) CHECK (uniformidad_pct BETWEEN 0 AND 100),
  observaciones    text,
  registrado_por   uuid DEFAULT auth.uid(),
  created_at       timestamptz DEFAULT now(),
  UNIQUE (lote_id, fecha),
  CHECK (peso_minimo_g IS NULL OR peso_maximo_g IS NULL OR peso_minimo_g <= peso_maximo_g)
);

CREATE INDEX IF NOT EXISTS idx_pesos_lote_aves_lote ON pesos_lote_aves(lote_id, fecha);

ALTER TABLE pesos_lote_aves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS miembro_finca_pesos_aves ON pesos_lote_aves;
CREATE POLICY miembro_finca_pesos_aves ON pesos_lote_aves
  FOR ALL USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));
