-- El huevo en bodega de cada galpón = huevos puestos (clasificados por tamaño)
-- menos huevos vendidos. Antes cada pantalla sumaba o restaba a mano en el
-- inventario y la cuenta se descuadraba (galpones sin ítem, ítems que no
-- cuadraban con lo registrado). Ahora la base lo recalcula con cada cambio.
--
-- El saldo es del galpón (la instalación), no del lote: si un lote sale y entra
-- otro, el huevo que quedó en bodega sigue siendo del galpón.

ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS instalacion_id uuid REFERENCES instalaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventario_instalacion ON inventario(instalacion_id) WHERE instalacion_id IS NOT NULL;

-- p_instalacion: el galpón. Sin galpón (lotes viejos sueltos) se agrupa por el nombre del lote.
CREATE OR REPLACE FUNCTION sincronizar_huevos_galpon(p_finca uuid, p_instalacion uuid, p_nombre text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_nombre   text;
  v_puestos  bigint;
  v_vendidos bigint;
  v_hay      boolean;
  v_cat      uuid;
  v_item     uuid;
BEGIN
  IF p_instalacion IS NOT NULL THEN
    SELECT nombre INTO v_nombre FROM instalaciones WHERE id = p_instalacion;
    IF v_nombre IS NULL THEN RETURN; END IF;
  ELSE
    v_nombre := p_nombre;
    IF v_nombre IS NULL THEN RETURN; END IF;
  END IF;

  WITH ls AS (
    SELECT id FROM lotes_aves
     WHERE finca_id = p_finca
       AND (CASE WHEN p_instalacion IS NOT NULL THEN instalacion_id = p_instalacion
                 ELSE instalacion_id IS NULL AND nombre = p_nombre END)
  )
  SELECT
    (SELECT COALESCE(SUM(huevos_b + huevos_a + huevos_aa + huevos_aaa + huevos_jumbo), 0)
       FROM produccion_diaria_aves WHERE lote_id IN (SELECT id FROM ls)),
    (SELECT COALESCE(SUM(cantidad_b + cantidad_a + cantidad_aa + cantidad_aaa + cantidad_jumbo), 0)
       FROM ventas_huevos_aves WHERE lote_id IN (SELECT id FROM ls)),
    EXISTS (SELECT 1 FROM ls)
  INTO v_puestos, v_vendidos, v_hay;

  -- El ítem del galpón: primero por su id, luego por el nombre (ítems de antes)
  IF p_instalacion IS NOT NULL THEN
    SELECT id INTO v_item FROM inventario
     WHERE finca_id = p_finca AND instalacion_id = p_instalacion LIMIT 1;
  END IF;
  IF v_item IS NULL THEN
    SELECT id INTO v_item FROM inventario
     WHERE finca_id = p_finca AND nombre = 'Huevos — ' || v_nombre
       AND (instalacion_id IS NULL OR instalacion_id IS NOT DISTINCT FROM p_instalacion)
     LIMIT 1;
  END IF;

  -- Sin lotes, o sin huevo nunca puesto ni vendido: no hay nada que llevar
  IF NOT v_hay OR (v_puestos = 0 AND v_vendidos = 0) THEN
    IF v_item IS NOT NULL THEN DELETE FROM inventario WHERE id = v_item; END IF;
    RETURN;
  END IF;

  IF v_item IS NULL THEN
    SELECT id INTO v_cat FROM inventario_categorias
     WHERE finca_id = p_finca AND nombre ILIKE 'huevos' LIMIT 1;
    IF v_cat IS NULL THEN
      INSERT INTO inventario_categorias (finca_id, nombre, color)
      VALUES (p_finca, 'Huevos', '#FBBF24') RETURNING id INTO v_cat;
    END IF;
    INSERT INTO inventario (finca_id, categoria_id, instalacion_id, nombre, unidad_medida, cantidad_actual, cantidad_minima)
    VALUES (p_finca, v_cat, p_instalacion, 'Huevos — ' || v_nombre, 'huevos', v_puestos - v_vendidos, 0);
  ELSE
    UPDATE inventario
       SET cantidad_actual = v_puestos - v_vendidos,
           nombre          = 'Huevos — ' || v_nombre,
           instalacion_id  = p_instalacion,
           unidad_medida   = 'huevos'
     WHERE id = v_item;
  END IF;
END;
$$;

-- Atajo: sincroniza el galpón al que pertenece un lote
CREATE OR REPLACE FUNCTION sincronizar_huevos_de_lote(p_lote uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE l record;
BEGIN
  SELECT finca_id, instalacion_id, nombre INTO l FROM lotes_aves WHERE id = p_lote;
  IF FOUND THEN
    PERFORM sincronizar_huevos_galpon(l.finca_id, l.instalacion_id, l.nombre);
  END IF;
END;
$$;

-- Producción: solo cuando cambian los huevos (o el día cambia de lote)
CREATE OR REPLACE FUNCTION trg_huevos_produccion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sincronizar_huevos_de_lote(OLD.lote_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM sincronizar_huevos_de_lote(NEW.lote_id);
  ELSIF NEW.lote_id IS DISTINCT FROM OLD.lote_id
     OR (NEW.huevos_b, NEW.huevos_a, NEW.huevos_aa, NEW.huevos_aaa, NEW.huevos_jumbo)
        IS DISTINCT FROM (OLD.huevos_b, OLD.huevos_a, OLD.huevos_aa, OLD.huevos_aaa, OLD.huevos_jumbo) THEN
    PERFORM sincronizar_huevos_de_lote(NEW.lote_id);
    IF NEW.lote_id IS DISTINCT FROM OLD.lote_id THEN PERFORM sincronizar_huevos_de_lote(OLD.lote_id); END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS huevos_produccion ON produccion_diaria_aves;
CREATE TRIGGER huevos_produccion
  AFTER INSERT OR UPDATE OR DELETE ON produccion_diaria_aves
  FOR EACH ROW EXECUTE FUNCTION trg_huevos_produccion();

-- Ventas
CREATE OR REPLACE FUNCTION trg_huevos_ventas()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN PERFORM sincronizar_huevos_de_lote(OLD.lote_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.lote_id IS DISTINCT FROM OLD.lote_id
      OR (NEW.cantidad_b, NEW.cantidad_a, NEW.cantidad_aa, NEW.cantidad_aaa, NEW.cantidad_jumbo)
         IS DISTINCT FROM (OLD.cantidad_b, OLD.cantidad_a, OLD.cantidad_aa, OLD.cantidad_aaa, OLD.cantidad_jumbo)) THEN
    PERFORM sincronizar_huevos_de_lote(NEW.lote_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS huevos_ventas ON ventas_huevos_aves;
CREATE TRIGGER huevos_ventas
  AFTER INSERT OR UPDATE OR DELETE ON ventas_huevos_aves
  FOR EACH ROW EXECUTE FUNCTION trg_huevos_ventas();

-- El galpón cambia de nombre: su ítem también
CREATE OR REPLACE FUNCTION trg_huevos_instalacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
    PERFORM sincronizar_huevos_galpon(NEW.finca_id, NEW.id, NULL);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS huevos_instalacion ON instalaciones;
CREATE TRIGGER huevos_instalacion
  AFTER UPDATE OF nombre ON instalaciones
  FOR EACH ROW EXECUTE FUNCTION trg_huevos_instalacion();

-- Un lote cambia de galpón (o un lote suelto de nombre): se rehacen ambos lados.
-- Si el lote se borra, sus días y ventas se van en cascada antes de este trigger
-- (los de llave foránea corren primero), así que el galpón queda con lo que le queda.
CREATE OR REPLACE FUNCTION trg_huevos_lote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sincronizar_huevos_galpon(OLD.finca_id, OLD.instalacion_id, OLD.nombre);
  ELSIF NEW.instalacion_id IS DISTINCT FROM OLD.instalacion_id
     OR (NEW.instalacion_id IS NULL AND NEW.nombre IS DISTINCT FROM OLD.nombre) THEN
    PERFORM sincronizar_huevos_galpon(OLD.finca_id, OLD.instalacion_id, OLD.nombre);
    PERFORM sincronizar_huevos_galpon(NEW.finca_id, NEW.instalacion_id, NEW.nombre);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS huevos_lote ON lotes_aves;
CREATE TRIGGER huevos_lote
  AFTER UPDATE OF instalacion_id, nombre OR DELETE ON lotes_aves
  FOR EACH ROW EXECUTE FUNCTION trg_huevos_lote();

-- Se rehace todo lo que ya existía. Los ítems de huevo que no corresponden a
-- ningún galpón con lotes se quitan al final.
DO $$
DECLARE g record;
BEGIN
  FOR g IN
    SELECT DISTINCT finca_id, instalacion_id, CASE WHEN instalacion_id IS NULL THEN nombre END AS nombre
      FROM lotes_aves
  LOOP
    PERFORM sincronizar_huevos_galpon(g.finca_id, g.instalacion_id, g.nombre);
  END LOOP;
END $$;

DELETE FROM inventario i
 USING inventario_categorias c
 WHERE c.id = i.categoria_id AND c.nombre ILIKE 'huevos'
   AND i.nombre LIKE 'Huevos — %'
   AND NOT EXISTS (
     SELECT 1 FROM lotes_aves l
      LEFT JOIN instalaciones ins ON ins.id = l.instalacion_id
      WHERE l.finca_id = i.finca_id
        AND (i.instalacion_id = l.instalacion_id
             OR (l.instalacion_id IS NULL AND i.nombre = 'Huevos — ' || l.nombre)));
