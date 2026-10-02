-- ============================================================
-- Galpones como lugares de la finca
-- ============================================================
-- El galpón es un lugar físico que se registra con la finca, con su nombre y su
-- medida. Los animales entran a un galpón ya registrado: el lote es lo que vive
-- en él durante un ciclo, y cuando sale, el galpón queda vacío para el siguiente.
--
-- La tabla es genérica a propósito: la misma servirá para los corrales de cerdos.

CREATE TABLE IF NOT EXISTS instalaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  especie         text NOT NULL CHECK (especie IN ('aves_ponedoras', 'cerdos', 'pollo_engorde')),
  -- galpon | corral
  tipo            text NOT NULL DEFAULT 'galpon',
  nombre          text NOT NULL,
  area_m2         numeric(10,2),
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, nombre)
);
ALTER TABLE instalaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD instalaciones" ON instalaciones;
CREATE POLICY "Miembros CRUD instalaciones" ON instalaciones FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_instalaciones_finca ON instalaciones(finca_id, especie);

-- Cada lote de aves vive en un galpón
ALTER TABLE lotes_aves
  ADD COLUMN IF NOT EXISTS instalacion_id uuid REFERENCES instalaciones(id) ON DELETE SET NULL,
  -- Cuándo se piensa sacar el lote: pollas de levante que se venden, o fin del ciclo
  ADD COLUMN IF NOT EXISTS fecha_salida_programada date;

-- Los galpones que ya existen salen de los lotes que ya están registrados:
-- uno por cada nombre de lote en cada finca, con la medida que tenía.
INSERT INTO instalaciones (finca_id, especie, tipo, nombre, area_m2)
SELECT l.finca_id, 'aves_ponedoras', 'galpon', l.nombre, max(l.area_galpon_m2)
  FROM lotes_aves l
 GROUP BY l.finca_id, l.nombre
ON CONFLICT (finca_id, nombre) DO NOTHING;

UPDATE lotes_aves l
   SET instalacion_id = i.id
  FROM instalaciones i
 WHERE l.instalacion_id IS NULL
   AND i.finca_id = l.finca_id
   AND i.nombre = l.nombre;

-- Un galpón no puede tener dos lotes vivos a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_aves_un_lote_por_galpon
  ON lotes_aves(instalacion_id)
  WHERE instalacion_id IS NOT NULL AND estado IN ('activo', 'preparacion');
