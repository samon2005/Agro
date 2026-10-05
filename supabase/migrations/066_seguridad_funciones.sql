-- Revisión de seguridad (avisos de Supabase, octubre 2026):
--
-- 1. Toda función con search_path fijo: sin eso, quien cree un objeto con el
--    mismo nombre en otro esquema podría cambiar lo que la función ejecuta.
-- 2. Nada se puede llamar sin iniciar sesión (rol anon): la app no usa ninguna
--    función antes del login.
-- 3. Las funciones de trigger no se llaman por la API: se quitan también a los
--    usuarios (al dispararse un trigger no se revisa ese permiso). Las auxiliares
--    que los triggers llaman (sincronizar_*, mover_aves_por_venta...) sí deben
--    seguir disponibles para el usuario con sesión, porque se ejecutan con sus
--    permisos.

ALTER FUNCTION public.es_miembro_finca(uuid) SET search_path = public;
ALTER FUNCTION public.actualizar_stock() SET search_path = public;
ALTER FUNCTION public.sincronizar_consumo_activo_aves(uuid) SET search_path = public;
ALTER FUNCTION public.trg_sincronizar_consumo_activo_aves() SET search_path = public;
ALTER FUNCTION public.trg_huevos_produccion() SET search_path = public;
ALTER FUNCTION public.trg_huevos_ventas() SET search_path = public;
ALTER FUNCTION public.trg_huevos_instalacion() SET search_path = public;
ALTER FUNCTION public.trg_huevos_lote() SET search_path = public;
ALTER FUNCTION public.trg_ventas_aves_lote() SET search_path = public;
ALTER FUNCTION public.sincronizar_consumo_activo_cerdos(uuid) SET search_path = public;
ALTER FUNCTION public.trg_sincronizar_consumo_activo_cerdos() SET search_path = public;

-- Sin sesión, ninguna función (ni las que se creen después)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;

-- Las funciones de trigger no son para llamarlas por la API
REVOKE EXECUTE ON FUNCTION public.actualizar_stock() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_finca() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_huevos_produccion() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_huevos_ventas() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_huevos_instalacion() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_huevos_lote() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_ventas_aves_lote() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sincronizar_consumo_activo_aves() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sincronizar_consumo_activo_cerdos() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_tarea_completada() FROM authenticated;

-- Lo que la app y las políticas usan con sesión
GRANT EXECUTE ON FUNCTION public.obtener_miembros_finca(uuid) TO authenticated;
-- es_miembro_finca está en políticas que también aplican sin sesión: sin permiso,
-- esas consultas darían error en vez de no devolver nada. Sin sesión responde
-- false (auth.uid() es nulo), así que no revela nada.
GRANT EXECUTE ON FUNCTION public.es_miembro_finca(uuid) TO anon, authenticated;
