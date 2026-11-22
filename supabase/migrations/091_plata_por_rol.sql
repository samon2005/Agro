-- La plata de la finca la ven solo los roles que tienen que verla (pendiente
-- desde las migraciones 085 y 087): propietario, administrador, asesor y
-- contabilidad. Antes la app lo escondía, pero la base dejaba leer a cualquier
-- miembro.
--
-- Cómo queda cada tabla de plata:
--   · Ver, cambiar y borrar: solo quien ve la plata (puede_ver_dinero).
--   · Anotar: cualquier miembro, porque el operario registra cosas que traen un
--     costo (una vacuna, una compra de alimento) aunque no lo vea después.
-- Las cantidades vendidas (no la plata) siguen a la vista de todos los miembros
-- en dos vistas, porque las necesitan el saldo de huevos en bodega y el resumen
-- semanal del galpón.

CREATE OR REPLACE FUNCTION public.puede_ver_dinero(finca uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(rol_en_finca(finca) IN ('propietario', 'administrador', 'asesor', 'contador'), false);
$function$;
REVOKE EXECUTE ON FUNCTION public.puede_ver_dinero(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.puede_ver_dinero(uuid) TO authenticated;

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ventas_huevos_aves', 'pagos_ventas_huevos', 'clientes_huevos', 'ventas_aves_lote',
    'costos_lote_aves', 'costos_lote_cerdos', 'costos_lote_pollo', 'costos_predefinidos_cerdos',
    'ventas_cerdos', 'pagos_ventas_cerdos', 'ventas_pollo', 'precios_mercado_cerdos'
  ] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Ven la plata quienes pueden" ON public.%I FOR SELECT TO authenticated USING (puede_ver_dinero(finca_id))', t);
    EXECUTE format('CREATE POLICY "Anota cualquier miembro" ON public.%I FOR INSERT TO authenticated WITH CHECK (es_miembro_finca(finca_id))', t);
    EXECUTE format('CREATE POLICY "Cambian quienes ven la plata" ON public.%I FOR UPDATE TO authenticated USING (puede_ver_dinero(finca_id)) WITH CHECK (puede_ver_dinero(finca_id))', t);
    EXECUTE format('CREATE POLICY "Borran quienes ven la plata" ON public.%I FOR DELETE TO authenticated USING (puede_ver_dinero(finca_id))', t);
  END LOOP;
END $$;

-- Solo las cantidades vendidas, sin precios ni clientes
CREATE OR REPLACE VIEW public.ventas_huevos_cantidades AS
  SELECT finca_id, lote_id, fecha, cantidad_c, cantidad_b, cantidad_a, cantidad_aa, cantidad_aaa, cantidad_jumbo
  FROM public.ventas_huevos_aves
  WHERE es_miembro_finca(finca_id);

CREATE OR REPLACE VIEW public.ventas_aves_cantidades AS
  SELECT finca_id, lote_id, fecha, cantidad, tipo
  FROM public.ventas_aves_lote
  WHERE es_miembro_finca(finca_id);

REVOKE ALL ON public.ventas_huevos_cantidades, public.ventas_aves_cantidades FROM anon, PUBLIC;
GRANT SELECT ON public.ventas_huevos_cantidades, public.ventas_aves_cantidades TO authenticated;
