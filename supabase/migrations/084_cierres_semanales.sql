-- Cierre semanal guardado (reunión con Juliana, nov 2026): al "cerrar la semana"
-- se guarda una foto de sus números con las notas del administrador, para que no
-- cambie aunque después se corrija un día. Una por finca, especie y semana.
CREATE TABLE IF NOT EXISTS public.cierres_semanales (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id    uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  especie     text NOT NULL CHECK (especie IN ('aves_ponedoras', 'cerdos', 'pollo_engorde')),
  lunes       date NOT NULL,
  datos       jsonb NOT NULL,
  notas       text,
  cerrado_por uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, especie, lunes)
);
ALTER TABLE public.cierres_semanales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros ven y cierran semanas" ON public.cierres_semanales;
CREATE POLICY "Miembros ven y cierran semanas" ON public.cierres_semanales
  FOR ALL TO authenticated USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));
