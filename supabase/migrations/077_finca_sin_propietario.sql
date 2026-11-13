-- Fincas sin usuario (12 nov 2026): las fincas con datos viejos de Marinilla y
-- Jericó no tienen productor; solo las maneja el administrador de fincas.
-- Al crear una finca sin propietario no se agrega miembro (antes fallaba).

CREATE OR REPLACE FUNCTION public.handle_new_finca()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.propietario_id IS NOT NULL THEN
    INSERT INTO public.finca_miembros (finca_id, perfil_id, rol)
    VALUES (NEW.id, NEW.propietario_id, 'propietario');
  END IF;
  RETURN NEW;
END;
$function$;
