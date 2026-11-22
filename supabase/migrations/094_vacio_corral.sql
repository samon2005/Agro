-- Vacío sanitario de los corrales de cerdos (José: 7 días entre un grupo y el
-- siguiente). La base anota desde cuándo quedó vacío un lugar: cuando el grupo
-- sale (vendido, cerrado) o se traslada a otro corral. Al entrar otro grupo se borra.
-- La app muestra "vacío sanitario hasta" con los días de Parámetros.
ALTER TABLE public.instalaciones ADD COLUMN IF NOT EXISTS vacio_desde date;

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
  -- El grupo deja el lugar: se vendió, se cerró o pasó a otro corral
  IF OLD.instalacion_id IS NOT NULL AND OLD.estado = 'activo'
     AND (NEW.estado <> 'activo' OR NEW.instalacion_id IS DISTINCT FROM OLD.instalacion_id) THEN
    UPDATE instalaciones SET vacio_desde = CURRENT_DATE WHERE id = OLD.instalacion_id
      AND NOT EXISTS (SELECT 1 FROM lotes_cerdos l WHERE l.instalacion_id = OLD.instalacion_id AND l.estado = 'activo' AND l.id <> OLD.id);
  END IF;
  -- Llega a un lugar nuevo
  IF NEW.instalacion_id IS NOT NULL AND NEW.estado = 'activo'
     AND (NEW.instalacion_id IS DISTINCT FROM OLD.instalacion_id OR OLD.estado <> 'activo') THEN
    UPDATE instalaciones SET vacio_desde = NULL WHERE id = NEW.instalacion_id;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.trg_vacio_corral() FROM anon, PUBLIC;
DROP TRIGGER IF EXISTS trg_vacio_corral ON public.lotes_cerdos;
CREATE TRIGGER trg_vacio_corral AFTER INSERT OR UPDATE OF estado, instalacion_id ON public.lotes_cerdos
  FOR EACH ROW EXECUTE FUNCTION public.trg_vacio_corral();
