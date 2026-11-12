-- Huevo tipo C (pedido de José en Jericó, 12 nov 2026): el tamaño más pequeño,
-- debajo del B (NTC 1240: menos de 46 g). El precio es opcional: la finca lo
-- pone solo si lo vende. Solo agrega columnas con 0 o vacío por defecto, así la
-- versión publicada anterior sigue guardando igual.

ALTER TABLE produccion_diaria_aves    ADD COLUMN IF NOT EXISTS huevos_c   integer NOT NULL DEFAULT 0 CHECK (huevos_c >= 0);
ALTER TABLE ventas_huevos_aves        ADD COLUMN IF NOT EXISTS cantidad_c integer NOT NULL DEFAULT 0 CHECK (cantidad_c >= 0);
ALTER TABLE ventas_huevos_aves        ADD COLUMN IF NOT EXISTS precio_c   numeric(12,2) CHECK (precio_c IS NULL OR precio_c >= 0);
ALTER TABLE encargos_huevos_aves      ADD COLUMN IF NOT EXISTS cantidad_c integer NOT NULL DEFAULT 0 CHECK (cantidad_c >= 0);
ALTER TABLE revisiones_calidad_huevo_aves ADD COLUMN IF NOT EXISTS cantidad_c integer NOT NULL DEFAULT 0 CHECK (cantidad_c >= 0);
ALTER TABLE clientes_huevos           ADD COLUMN IF NOT EXISTS precio_c   numeric(12,2) CHECK (precio_c IS NULL OR precio_c >= 0);
ALTER TABLE fincas                    ADD COLUMN IF NOT EXISTS precio_huevo_c numeric(12,2);
ALTER TABLE lotes_aves                ADD COLUMN IF NOT EXISTS precio_huevo_c numeric(12,2);

-- El saldo de huevo de la finca cuenta también la C
CREATE OR REPLACE FUNCTION public.sincronizar_huevos_finca(p_finca uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_puestos  bigint;
  v_vendidos bigint;
  v_cat      uuid;
  v_item     uuid;
BEGIN
  IF p_finca IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(huevos_c + huevos_b + huevos_a + huevos_aa + huevos_aaa + huevos_jumbo), 0) INTO v_puestos
    FROM produccion_diaria_aves WHERE finca_id = p_finca;
  SELECT COALESCE(SUM(cantidad_c + cantidad_b + cantidad_a + cantidad_aa + cantidad_aaa + cantidad_jumbo), 0) INTO v_vendidos
    FROM ventas_huevos_aves WHERE finca_id = p_finca;

  SELECT id INTO v_item FROM inventario
   WHERE finca_id = p_finca AND nombre = 'Huevos de la finca' LIMIT 1;

  IF v_puestos = 0 AND v_vendidos = 0 THEN
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
    INSERT INTO inventario (finca_id, categoria_id, nombre, unidad_medida, cantidad_actual, cantidad_minima)
    VALUES (p_finca, v_cat, 'Huevos de la finca', 'huevos', v_puestos - v_vendidos, 0);
  ELSE
    UPDATE inventario SET cantidad_actual = v_puestos - v_vendidos, unidad_medida = 'huevos' WHERE id = v_item;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_huevos_produccion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sincronizar_huevos_finca(OLD.finca_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM sincronizar_huevos_finca(NEW.finca_id);
  ELSIF (NEW.huevos_c, NEW.huevos_b, NEW.huevos_a, NEW.huevos_aa, NEW.huevos_aaa, NEW.huevos_jumbo, NEW.finca_id)
        IS DISTINCT FROM (OLD.huevos_c, OLD.huevos_b, OLD.huevos_a, OLD.huevos_aa, OLD.huevos_aaa, OLD.huevos_jumbo, OLD.finca_id) THEN
    PERFORM sincronizar_huevos_finca(NEW.finca_id);
    IF NEW.finca_id IS DISTINCT FROM OLD.finca_id THEN PERFORM sincronizar_huevos_finca(OLD.finca_id); END IF;
  END IF;
  RETURN NULL;
END;
$function$;

-- Igual que en 066: las funciones de disparador no se llaman por la API
REVOKE EXECUTE ON FUNCTION public.trg_huevos_produccion() FROM anon, authenticated, PUBLIC;
