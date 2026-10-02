-- Lo que la finca vende además del huevo: gallinas de descarte, pollas de levante
-- (se pueden vender hacia las 14–15 semanas), gallinaza y otros. Las ventas de
-- aves bajan las aves del galpón; la base no deja vender más de las que hay.

-- Los costos de la finca (sin galpón) también en cerdos y pollo, como en aves (053)
ALTER TABLE costos_lote_cerdos ALTER COLUMN lote_id DROP NOT NULL;
ALTER TABLE costos_lote_pollo  ALTER COLUMN lote_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS ventas_aves_lote (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id         uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  -- Sin galpón: lo que es de toda la finca (gallinaza, otros)
  lote_id          uuid REFERENCES lotes_aves(id) ON DELETE CASCADE,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  tipo             text NOT NULL CHECK (tipo IN ('descarte', 'pollas', 'gallinaza', 'otro')),
  descripcion      text,
  cantidad         numeric(12,2) NOT NULL CHECK (cantidad > 0),
  unidad           text NOT NULL DEFAULT 'aves',
  precio_unitario  numeric(14,2) NOT NULL CHECK (precio_unitario >= 0),
  total            numeric(16,2) GENERATED ALWAYS AS (round(cantidad * precio_unitario, 2)) STORED,
  cliente          text,
  observaciones    text,
  registrado_por   uuid DEFAULT auth.uid(),
  created_at       timestamptz DEFAULT now(),
  -- Las aves se venden de un galpón y enteras
  CHECK (tipo NOT IN ('descarte', 'pollas') OR (lote_id IS NOT NULL AND cantidad = trunc(cantidad)))
);

CREATE INDEX IF NOT EXISTS idx_ventas_aves_lote_finca ON ventas_aves_lote(finca_id, fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_aves_lote_lote ON ventas_aves_lote(lote_id);

ALTER TABLE ventas_aves_lote ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS miembro_finca_ventas_aves_lote ON ventas_aves_lote;
CREATE POLICY miembro_finca_ventas_aves_lote ON ventas_aves_lote
  FOR ALL USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));

-- Mueve aves de un lote: negativo las saca (venta), positivo las devuelve (venta borrada)
CREATE OR REPLACE FUNCTION mover_aves_por_venta(p_lote uuid, p_delta integer)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE l record;
BEGIN
  IF p_lote IS NULL OR p_delta = 0 THEN RETURN; END IF;
  SELECT nombre, estado, aves_actuales INTO l FROM lotes_aves WHERE id = p_lote FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;  -- el lote se está borrando: sus ventas se van con él
  IF l.estado NOT IN ('activo', 'preparacion') THEN
    RAISE EXCEPTION 'El lote de % ya se cerró: sus ventas de aves no se pueden cambiar', l.nombre
      USING ERRCODE = 'P0001', HINT = 'lote_cerrado';
  END IF;
  IF l.aves_actuales + p_delta < 0 THEN
    RAISE EXCEPTION 'En % hay % aves: no se pueden vender %', l.nombre, l.aves_actuales, -p_delta
      USING ERRCODE = 'P0001', HINT = 'sin_aves';
  END IF;
  UPDATE lotes_aves SET aves_actuales = aves_actuales + p_delta WHERE id = p_lote;
END;
$$;

CREATE OR REPLACE FUNCTION trg_ventas_aves_lote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Primero se devuelve lo de antes y luego se saca lo nuevo: editar una venta
  -- solo mueve la diferencia, y si cambia de galpón cada uno queda bien.
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.tipo IN ('descarte', 'pollas') THEN
    IF TG_OP = 'DELETE' OR NEW.lote_id IS DISTINCT FROM OLD.lote_id OR NEW.cantidad <> OLD.cantidad
       OR NEW.tipo NOT IN ('descarte', 'pollas') THEN
      PERFORM mover_aves_por_venta(OLD.lote_id, OLD.cantidad::integer);
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.tipo IN ('descarte', 'pollas') THEN
    IF TG_OP = 'INSERT' OR NEW.lote_id IS DISTINCT FROM OLD.lote_id OR NEW.cantidad <> OLD.cantidad
       OR OLD.tipo NOT IN ('descarte', 'pollas') THEN
      PERFORM mover_aves_por_venta(NEW.lote_id, -NEW.cantidad::integer);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ventas_aves_lote_mueve_aves ON ventas_aves_lote;
CREATE TRIGGER ventas_aves_lote_mueve_aves
  AFTER INSERT OR UPDATE OR DELETE ON ventas_aves_lote
  FOR EACH ROW EXECUTE FUNCTION trg_ventas_aves_lote();
