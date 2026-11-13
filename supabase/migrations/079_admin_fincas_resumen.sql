-- Resumen del administrador (13 nov 2026): la lista de sus fincas trae también
-- cómo va cada una (aves, lotes, huevos y postura), para mostrarla en su
-- Resumen sin entrar finca por finca. Cambia lo que devuelve: se borra y se crea.

DROP FUNCTION IF EXISTS public.admin_fincas();

CREATE FUNCTION public.admin_fincas()
 RETURNS TABLE(
   id uuid, nombre text, municipio text, departamento text, tipo_produccion text[],
   created_at timestamptz, sin_registro_ventas boolean,
   propietario_nombre text, propietario_correo text, miembros bigint,
   lotes_activos bigint, lotes_total bigint, aves_actuales bigint,
   primer_registro date, ultimo_registro date, dias_registrados bigint,
   huevos_total bigint, huevos_7d bigint, postura_7d numeric
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT es_admin() THEN
    RAISE EXCEPTION 'Solo el administrador ve todas las fincas' USING HINT = 'sin_permiso';
  END IF;
  RETURN QUERY
  SELECT f.id, f.nombre, f.municipio, f.departamento, f.tipo_produccion,
         f.created_at, f.sin_registro_ventas,
         p.full_name, u.email::text,
         (SELECT count(*) FROM finca_miembros m WHERE m.finca_id = f.id),
         (SELECT count(*) FROM lotes_aves l WHERE l.finca_id = f.id AND l.estado IN ('activo', 'preparacion'))
           + (SELECT count(*) FROM lotes_pollo l WHERE l.finca_id = f.id AND l.estado = 'activo')
           + (SELECT count(*) FROM lotes_cerdos l WHERE l.finca_id = f.id AND l.estado = 'activo'),
         (SELECT count(*) FROM lotes_aves l WHERE l.finca_id = f.id)
           + (SELECT count(*) FROM lotes_pollo l WHERE l.finca_id = f.id)
           + (SELECT count(*) FROM lotes_cerdos l WHERE l.finca_id = f.id),
         (SELECT COALESCE(sum(l.aves_actuales), 0)::bigint FROM lotes_aves l WHERE l.finca_id = f.id AND l.estado IN ('activo', 'preparacion')),
         d.primero, d.ultimo, d.dias, d.huevos, s.huevos,
         CASE WHEN s.aves > 0 THEN round(s.huevos_con_aves * 100.0 / s.aves, 1) END
    FROM fincas f
    LEFT JOIN profiles p ON p.id = f.propietario_id
    LEFT JOIN auth.users u ON u.id = f.propietario_id
    LEFT JOIN LATERAL (
      SELECT min(x.fecha) primero, max(x.fecha) ultimo, count(*) dias, COALESCE(sum(x.huevos_totales), 0)::bigint huevos
        FROM produccion_diaria_aves x WHERE x.finca_id = f.id
    ) d ON true
    -- Los últimos 7 días hasta hoy
    LEFT JOIN LATERAL (
      SELECT COALESCE(sum(x.huevos_totales), 0)::bigint huevos,
             COALESCE(sum(x.huevos_totales) FILTER (WHERE x.aves_en_dia > 0), 0) huevos_con_aves,
             COALESCE(sum(x.aves_en_dia) FILTER (WHERE x.aves_en_dia > 0), 0) aves
        FROM produccion_diaria_aves x WHERE x.finca_id = f.id AND x.fecha > current_date - 7
    ) s ON true
   WHERE f.soporte_admin
   ORDER BY f.sin_registro_ventas, f.created_at;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_fincas() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_fincas() TO authenticated;
