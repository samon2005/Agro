-- Historial de la salida programada (reunión con Juliana, nov 2026): la salida
-- de un lote se puede cambiar cuando pasan cosas (se adelanta la venta, se
-- alarga el ciclo). Cada cambio queda guardado con la fecha anterior, la nueva,
-- quién y cuándo, y el motivo si se escribe. Lo guarda la base sola, así que
-- queda aunque se cambie desde Configurar galpón.

CREATE TABLE IF NOT EXISTS public.cambios_salida_lote (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id        uuid NOT NULL REFERENCES public.lotes_aves(id) ON DELETE CASCADE,
  finca_id       uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  fecha_anterior date,
  fecha_nueva    date,
  motivo         text,
  registrado_por uuid DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cambios_salida_lote_lote_idx ON public.cambios_salida_lote (lote_id, created_at DESC);

ALTER TABLE public.cambios_salida_lote ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros ven y anotan cambios de salida" ON public.cambios_salida_lote;
CREATE POLICY "Miembros ven y anotan cambios de salida" ON public.cambios_salida_lote
  FOR ALL TO authenticated USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));

CREATE OR REPLACE FUNCTION public.trg_cambio_salida_lote()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fecha_salida_programada IS DISTINCT FROM OLD.fecha_salida_programada THEN
    INSERT INTO cambios_salida_lote (lote_id, finca_id, fecha_anterior, fecha_nueva)
    VALUES (NEW.id, NEW.finca_id, OLD.fecha_salida_programada, NEW.fecha_salida_programada);
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.trg_cambio_salida_lote() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS cambio_salida_lote ON public.lotes_aves;
CREATE TRIGGER cambio_salida_lote AFTER UPDATE OF fecha_salida_programada ON public.lotes_aves
  FOR EACH ROW EXECUTE FUNCTION public.trg_cambio_salida_lote();
