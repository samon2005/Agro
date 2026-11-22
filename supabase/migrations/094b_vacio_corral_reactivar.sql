-- Corrección de 094: si un grupo vuelve a estar activo en el mismo corral, el
-- corral deja de estar en vacío sanitario. (094 ya quedó con esta versión.)
CREATE OR REPLACE FUNCTION public.trg_vacio_corral()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.instalacion_id IS NOT NULL AND NEW.estado = 'activo' THEN
      UPDATE instalaciones SET vacio_desde = NULL WHERE id = NEW.instalacion_id;
    END IF;
    RETURN NULL;
  END IF;
  IF OLD.instalacion_id IS NOT NULL AND OLD.estado = 'activo'
     AND (NEW.estado <> 'activo' OR NEW.instalacion_id IS DISTINCT FROM OLD.instalacion_id) THEN
    UPDATE instalaciones SET vacio_desde = CURRENT_DATE WHERE id = OLD.instalacion_id
      AND NOT EXISTS (SELECT 1 FROM lotes_cerdos l WHERE l.instalacion_id = OLD.instalacion_id AND l.estado = 'activo' AND l.id <> OLD.id);
  END IF;
  IF NEW.instalacion_id IS NOT NULL AND NEW.estado = 'activo'
     AND (NEW.instalacion_id IS DISTINCT FROM OLD.instalacion_id OR OLD.estado <> 'activo') THEN
    UPDATE instalaciones SET vacio_desde = NULL WHERE id = NEW.instalacion_id;
  END IF;
  RETURN NULL;
END;
$function$;
