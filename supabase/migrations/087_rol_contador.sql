-- Rol "Contabilidad y nómina" (contador): solo la plata de la finca (ventas,
-- finanzas, reportes de dinero y el pago del equipo). Lo pidió Samuel el 18 nov
-- 2026: cada rol ve solo las secciones de su trabajo (matriz en src/lib/roles.ts).
ALTER TABLE public.finca_miembros DROP CONSTRAINT IF EXISTS finca_miembros_rol_check;
ALTER TABLE public.finca_miembros ADD CONSTRAINT finca_miembros_rol_check
  CHECK (rol IN ('propietario', 'administrador', 'zootecnista', 'operario', 'recolector', 'contador', 'trabajador'));

ALTER TABLE public.invitaciones_finca DROP CONSTRAINT IF EXISTS invitaciones_finca_rol_check;
ALTER TABLE public.invitaciones_finca ADD CONSTRAINT invitaciones_finca_rol_check
  CHECK (rol IN ('administrador', 'zootecnista', 'operario', 'recolector', 'contador'));

CREATE OR REPLACE FUNCTION public.cambiar_rol_miembro(p_finca uuid, p_perfil uuid, p_rol text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT es_administrador_finca(p_finca) THEN
    RAISE EXCEPTION 'Solo el administrador de la finca cambia los roles' USING HINT = 'sin_permiso';
  END IF;
  IF p_rol NOT IN ('administrador', 'zootecnista', 'operario', 'recolector', 'contador') THEN
    RAISE EXCEPTION 'Rol no válido';
  END IF;
  UPDATE finca_miembros SET rol = p_rol
   WHERE finca_id = p_finca AND perfil_id = p_perfil AND rol <> 'propietario';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.cambiar_rol_miembro(uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cambiar_rol_miembro(uuid, uuid, text) TO authenticated;
