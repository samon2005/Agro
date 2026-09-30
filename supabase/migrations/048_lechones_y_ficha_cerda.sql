-- ============================================================
-- MÓDULO: Cerdos — lechones identificados y ficha de cada cerda
-- ============================================================
-- Cada lechón lleva su propio código (205-01: la madre y su número). Con eso se
-- le sigue el peso, la salud y a dónde fue durante todo el ciclo, y de paso cada
-- cerda tiene su historia completa: qué parió, cuánto destetó y qué le pasó.

CREATE TABLE IF NOT EXISTS lechones_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  -- Lote donde está hoy: al pasar a precebo o levante, el lechón se mueve
  lote_id             uuid REFERENCES lotes_cerdos(id) ON DELETE SET NULL,
  parto_id            uuid REFERENCES partos_cerdos(id) ON DELETE CASCADE,
  madre_id            uuid REFERENCES reproductoras_cerdos(id) ON DELETE SET NULL,
  -- 205-01. El número sigue corrido por madre, así no se repite entre camadas.
  codigo              text NOT NULL,
  numero              integer NOT NULL DEFAULT 1,
  sexo                text CHECK (sexo IN ('macho', 'hembra')),
  peso_nacimiento_kg  numeric(5,2),
  peso_destete_kg     numeric(6,2),
  -- lactante | destetado | precebo | levante | ceba | vendido | muerto
  estado              text NOT NULL DEFAULT 'lactante',
  fecha_nacimiento    date,
  fecha_salida        date,
  causa_salida        text,
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, codigo)
);
ALTER TABLE lechones_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD lechones_cerdos" ON lechones_cerdos;
CREATE POLICY "Miembros CRUD lechones_cerdos" ON lechones_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_lechones_cerdos_parto ON lechones_cerdos(parto_id);
CREATE INDEX IF NOT EXISTS idx_lechones_cerdos_madre ON lechones_cerdos(madre_id);
CREATE INDEX IF NOT EXISTS idx_lechones_cerdos_lote ON lechones_cerdos(lote_id, estado);

-- ---- Pesajes de cada lechón a lo largo del ciclo ----
CREATE TABLE IF NOT EXISTS pesos_lechon_cerdos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lechon_id       uuid NOT NULL REFERENCES lechones_cerdos(id) ON DELETE CASCADE,
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  peso_kg         numeric(6,2) NOT NULL,
  etapa           text,
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pesos_lechon_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD pesos_lechon_cerdos" ON pesos_lechon_cerdos;
CREATE POLICY "Miembros CRUD pesos_lechon_cerdos" ON pesos_lechon_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_pesos_lechon_cerdos_lechon ON pesos_lechon_cerdos(lechon_id, fecha DESC);

-- ---- La sanidad puede señalar a una cerda o a un lechón ----
-- Un animal enfermo no produce, y en cría interesa saber cuál fue: así el
-- evento queda en la ficha de esa cerda o de ese lechón, no solo en el lote.
ALTER TABLE eventos_clinicos_cerdos
  ADD COLUMN IF NOT EXISTS reproductora_id uuid REFERENCES reproductoras_cerdos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lechon_id uuid REFERENCES lechones_cerdos(id) ON DELETE SET NULL;

ALTER TABLE medicaciones_cerdos
  ADD COLUMN IF NOT EXISTS reproductora_id uuid REFERENCES reproductoras_cerdos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lechon_id uuid REFERENCES lechones_cerdos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eventos_clinicos_cerdos_reproductora ON eventos_clinicos_cerdos(reproductora_id);
CREATE INDEX IF NOT EXISTS idx_medicaciones_cerdos_reproductora ON medicaciones_cerdos(reproductora_id);

-- ---- Identificación de la cerda ----
-- Cada granja marca distinto: arete, tatuaje o muesca. Se guarda cuál y su número.
ALTER TABLE reproductoras_cerdos
  ADD COLUMN IF NOT EXISTS tipo_identificacion text,
  ADD COLUMN IF NOT EXISTS identificacion text;
