-- Con la plata bloqueada por rol (091), cuatro funciones que leen o escriben
-- tablas de plata corrían con los permisos de quien las usa y se dañaban si las
-- usaba un operario o un zootecnista:
--   · sincronizar_huevos_finca: el saldo de huevos no restaba las ventas.
--   · cerrar_lote_aves: no veía las ventas anteriores del lote.
--   · registrar_destete y anular_destete: la venta de la camada fallaba.
-- Ahora corren con los permisos de la base (SECURITY DEFINER) y revisan antes
-- que quien las usa sea miembro de la finca.

ALTER FUNCTION public.sincronizar_huevos_finca(uuid) SECURITY DEFINER;
ALTER FUNCTION public.sincronizar_huevos_finca(uuid) SET search_path TO 'public';
-- cerrar_lote_aves ya revisa es_miembro_finca
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'cerrar_lote_aves' LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', f);
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', f);
  END LOOP;
END $$;

-- Los del destete: se les agrega la revisión de la finca y corren como la base
DO $$
DECLARE def text; o oid;
BEGIN
  SELECT p.oid INTO o FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'registrar_destete';
  def := pg_get_functiondef(o);
  IF def !~ 'Sin permiso en esta finca' THEN
    def := regexp_replace(def, '(RAISE EXCEPTION ''El parto no existe''[^;]*;\s*END IF;)',
      E'\\1\n  IF NOT es_miembro_finca(pa.finca_id) THEN RAISE EXCEPTION ''Sin permiso en esta finca''; END IF;');
  END IF;
  EXECUTE def;
  EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', o::regprocedure);
  EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', o::regprocedure);

  SELECT p.oid INTO o FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'anular_destete';
  def := pg_get_functiondef(o);
  IF def !~ 'Sin permiso en esta finca' THEN
    def := regexp_replace(def, '(RAISE EXCEPTION ''El destete no existe''[^;]*;\s*END IF;)',
      E'\\1\n  IF NOT es_miembro_finca(d.finca_id) THEN RAISE EXCEPTION ''Sin permiso en esta finca''; END IF;');
  END IF;
  EXECUTE def;
  EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', o::regprocedure);
  EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', o::regprocedure);
END $$;
