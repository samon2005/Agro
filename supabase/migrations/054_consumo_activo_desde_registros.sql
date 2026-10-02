-- El consumo activo de un galpón de aves es el de su último registro con alimento.
-- Hasta ahora lo copiaba cada pantalla a mano, y si un registro se borraba por otro
-- camino el galpón seguía "comiendo" algo que el inventario ya no descontaba.
-- Un trigger lo mantiene siempre igual a los registros.

CREATE OR REPLACE FUNCTION sincronizar_consumo_activo_aves(p_lote uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  ult record;
BEGIN
  SELECT alimento_kg, tipo_alimento_id INTO ult
    FROM produccion_diaria_aves
   WHERE lote_id = p_lote AND alimento_kg > 0
   ORDER BY fecha DESC
   LIMIT 1;

  UPDATE lotes_aves
     SET consumo_activo_kg  = ult.alimento_kg,
         -- Registros viejos sin tipo: se conserva el alimento que ya tenía
         alimento_activo_id = COALESCE(ult.tipo_alimento_id, alimento_activo_id)
   WHERE id = p_lote
     AND (consumo_activo_kg IS DISTINCT FROM ult.alimento_kg
          OR (ult.tipo_alimento_id IS NOT NULL AND alimento_activo_id IS DISTINCT FROM ult.tipo_alimento_id));
END;
$$;

CREATE OR REPLACE FUNCTION trg_sincronizar_consumo_activo_aves()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM sincronizar_consumo_activo_aves(OLD.lote_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.lote_id IS DISTINCT FROM OLD.lote_id
      OR NEW.alimento_kg IS DISTINCT FROM OLD.alimento_kg OR NEW.tipo_alimento_id IS DISTINCT FROM OLD.tipo_alimento_id
      OR NEW.fecha IS DISTINCT FROM OLD.fecha) THEN
    PERFORM sincronizar_consumo_activo_aves(NEW.lote_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sincronizar_consumo_activo_aves ON produccion_diaria_aves;
CREATE TRIGGER sincronizar_consumo_activo_aves
  AFTER INSERT OR UPDATE OR DELETE ON produccion_diaria_aves
  FOR EACH ROW EXECUTE FUNCTION trg_sincronizar_consumo_activo_aves();

-- Los galpones que ya estaban descuadrados
SELECT sincronizar_consumo_activo_aves(id) FROM lotes_aves;
