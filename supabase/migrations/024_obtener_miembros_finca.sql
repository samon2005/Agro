-- Devuelve id + nombre de los miembros de una finca (sin exponer teléfono/pago) para
-- usarlos como opciones de "Encargado" en los formularios. RLS de profiles solo deja
-- ver el propio perfil, así que se necesita una función SECURITY DEFINER acotada.

CREATE OR REPLACE FUNCTION public.obtener_miembros_finca(p_finca_id uuid)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id, p.full_name
  FROM profiles p
  JOIN finca_miembros fm ON fm.perfil_id = p.id
  WHERE fm.finca_id = p_finca_id
    AND es_miembro_finca(p_finca_id)
  ORDER BY p.full_name;
$function$;
