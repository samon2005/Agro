-- Cerdos como lo pide el direccionamiento: la finca registra sus corrales (lugares
-- fijos, con su medida y el tipo de producción que va en cada uno), los lotes
-- entran a esos corrales, las cerdas de cría se agrupan en naves, y el destete
-- clasifica a los lechones por talla y los manda a un corral de precebo o a venta.

-- ── Corrales: el tipo de producción de cada uno (se ve bajo su nombre) ──
ALTER TABLE instalaciones
  ADD COLUMN IF NOT EXISTS uso text CHECK (uso IS NULL OR uso IN ('cria', 'precebo', 'levante', 'ceba'));

-- ── El lote vive en un corral; un corral tiene un solo lote activo ──
ALTER TABLE lotes_cerdos
  ADD COLUMN IF NOT EXISTS instalacion_id uuid REFERENCES instalaciones(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_cerdos_un_lote_por_corral
  ON lotes_cerdos(instalacion_id) WHERE instalacion_id IS NOT NULL AND estado = 'activo';

-- ── Naves: grupos de cerdas dentro de un corral de cría ──
CREATE TABLE IF NOT EXISTS naves_cerdos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id    uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  lote_id     uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  nombre      text NOT NULL CHECK (length(trim(nombre)) > 0),
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (lote_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_naves_cerdos_lote ON naves_cerdos(lote_id, orden);

ALTER TABLE naves_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS miembro_finca_naves_cerdos ON naves_cerdos;
CREATE POLICY miembro_finca_naves_cerdos ON naves_cerdos
  FOR ALL USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));

ALTER TABLE reproductoras_cerdos
  ADD COLUMN IF NOT EXISTS nave_id uuid REFERENCES naves_cerdos(id) ON DELETE SET NULL;

-- ── Tallas de destete: cada granja pone sus rangos de peso ──
-- [{"nombre":"S","desde":0},{"nombre":"M","desde":7},{"nombre":"L","desde":8}]
-- Cada talla va desde su peso hasta el de la siguiente; la última no tiene tope.
ALTER TABLE fincas ADD COLUMN IF NOT EXISTS tallas_destete jsonb;

ALTER TABLE lechones_cerdos ADD COLUMN IF NOT EXISTS talla_destete text;

-- ── Destino del destete: un corral de precebo o la venta de la camada ──
ALTER TABLE destetes_cerdos
  ADD COLUMN IF NOT EXISTS destino text CHECK (destino IS NULL OR destino IN ('corral', 'venta')),
  ADD COLUMN IF NOT EXISTS destino_lote_id uuid REFERENCES lotes_cerdos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venta_id uuid REFERENCES ventas_cerdos(id) ON DELETE SET NULL;

-- ── El consumo activo de un lote de cerdos sale de su último registro con alimento ──
-- (igual que en aves, 054: nadie lo escribe a mano y no se descuadra del inventario)
CREATE OR REPLACE FUNCTION sincronizar_consumo_activo_cerdos(p_lote uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE ult record;
BEGIN
  SELECT alimento_kg, tipo_alimento_id INTO ult
    FROM nutricion_diaria_cerdos
   WHERE lote_id = p_lote AND alimento_kg > 0
   ORDER BY fecha DESC
   LIMIT 1;

  UPDATE lotes_cerdos
     SET consumo_activo_kg  = ult.alimento_kg,
         alimento_activo_id = COALESCE(ult.tipo_alimento_id, alimento_activo_id)
   WHERE id = p_lote
     AND (consumo_activo_kg IS DISTINCT FROM ult.alimento_kg
          OR (ult.tipo_alimento_id IS NOT NULL AND alimento_activo_id IS DISTINCT FROM ult.tipo_alimento_id));
END;
$$;

CREATE OR REPLACE FUNCTION trg_sincronizar_consumo_activo_cerdos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM sincronizar_consumo_activo_cerdos(OLD.lote_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.lote_id IS DISTINCT FROM OLD.lote_id
      OR NEW.alimento_kg IS DISTINCT FROM OLD.alimento_kg OR NEW.tipo_alimento_id IS DISTINCT FROM OLD.tipo_alimento_id
      OR NEW.fecha IS DISTINCT FROM OLD.fecha) THEN
    PERFORM sincronizar_consumo_activo_cerdos(NEW.lote_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sincronizar_consumo_activo_cerdos ON nutricion_diaria_cerdos;
CREATE TRIGGER sincronizar_consumo_activo_cerdos
  AFTER INSERT OR UPDATE OR DELETE ON nutricion_diaria_cerdos
  FOR EACH ROW EXECUTE FUNCTION trg_sincronizar_consumo_activo_cerdos();

-- ── Lo que ya existía ──
-- Cada lote de una finca de cerdos pasa a su corral: el que tenía escrito, o uno
-- con el nombre del lote. El tipo del corral sale del sistema y la etapa del lote.
DO $$
DECLARE l record; inst uuid;
BEGIN
  FOR l IN
    SELECT lc.* FROM lotes_cerdos lc JOIN fincas f ON f.id = lc.finca_id
     WHERE 'cerdos' = ANY (f.tipo_produccion) AND lc.instalacion_id IS NULL
     ORDER BY lc.created_at
  LOOP
    SELECT id INTO inst FROM instalaciones
     WHERE finca_id = l.finca_id AND nombre = COALESCE(NULLIF(trim(l.corral), ''), l.nombre);
    IF inst IS NULL THEN
      INSERT INTO instalaciones (finca_id, especie, tipo, nombre, area_m2, uso)
      VALUES (l.finca_id, 'cerdos', 'corral', COALESCE(NULLIF(trim(l.corral), ''), l.nombre), l.area_corral_m2,
              CASE WHEN l.sistema = 'cria' THEN 'cria'
                   WHEN l.etapa_actual IN ('precebo', 'levante', 'ceba') THEN l.etapa_actual
                   ELSE 'ceba' END)
      RETURNING id INTO inst;
    END IF;
    -- Si el corral ya tiene un lote activo, este queda sin corral en vez de chocar
    IF l.estado <> 'activo' OR NOT EXISTS (
      SELECT 1 FROM lotes_cerdos x WHERE x.instalacion_id = inst AND x.estado = 'activo'
    ) THEN
      UPDATE lotes_cerdos SET instalacion_id = inst WHERE id = l.id;
    END IF;
  END LOOP;
END $$;

-- Las cerdas que ya estaban quedan en una primera nave de su lote
DO $$
DECLARE l record; nave uuid;
BEGIN
  FOR l IN
    SELECT DISTINCT r.lote_id, r.finca_id FROM reproductoras_cerdos r WHERE r.nave_id IS NULL
  LOOP
    INSERT INTO naves_cerdos (finca_id, lote_id, nombre, orden)
    VALUES (l.finca_id, l.lote_id, 'Nave 1', 1)
    ON CONFLICT (lote_id, nombre) DO UPDATE SET nombre = EXCLUDED.nombre
    RETURNING id INTO nave;
    UPDATE reproductoras_cerdos SET nave_id = nave WHERE lote_id = l.lote_id AND nave_id IS NULL;
  END LOOP;
END $$;

SELECT sincronizar_consumo_activo_cerdos(id) FROM lotes_cerdos;
