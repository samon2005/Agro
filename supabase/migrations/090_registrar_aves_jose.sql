-- Registrar aves en un galpón, con las respuestas de José (19 nov 2026).
--   · Cómo llegan: pollitas de un día, levantadas listas para poner o ya en postura.
--   · Aves muertas o débiles en el transporte y aves facturadas frente a contadas.
--   · Datos de origen: peso y uniformidad al llegar, vacunas que traen, factura o remisión, % de machos.
--   · Metas del lote según el propósito (jsonb).
--   · Al marcar el inicio de postura: % con que se considera iniciada, semana del pico,
--     peso del huevo y peso de las aves.
--   · Historial de cambios de propósito y traslados entre galpones (el lote sigue siendo el mismo).
--   · Registro del vacío sanitario del galpón (no bloquea la entrada).
--   · Venta de aves con peso promedio y la lista de chequeo hecha.

ALTER TABLE public.lotes_aves
  ADD COLUMN IF NOT EXISTS llegada text CHECK (llegada IS NULL OR llegada IN ('pollitas_dia', 'levantadas', 'en_postura')),
  ADD COLUMN IF NOT EXISTS aves_muertas_llegada integer CHECK (aves_muertas_llegada IS NULL OR aves_muertas_llegada >= 0),
  ADD COLUMN IF NOT EXISTS aves_facturadas integer CHECK (aves_facturadas IS NULL OR aves_facturadas >= 0),
  ADD COLUMN IF NOT EXISTS peso_llegada_g numeric,
  ADD COLUMN IF NOT EXISTS uniformidad_llegada_pct numeric,
  ADD COLUMN IF NOT EXISTS vacunas_llegada text,
  ADD COLUMN IF NOT EXISTS factura_remision text,
  ADD COLUMN IF NOT EXISTS machos_pct numeric,
  ADD COLUMN IF NOT EXISTS metas_lote jsonb,
  ADD COLUMN IF NOT EXISTS pct_inicio_postura numeric,
  ADD COLUMN IF NOT EXISTS semana_pico_esperada integer,
  ADD COLUMN IF NOT EXISTS peso_huevo_esperado_g numeric,
  ADD COLUMN IF NOT EXISTS peso_aves_inicio_postura_g numeric;

-- Los lotes de antes: los que llegaron poniendo quedan "en postura", los demás según su edad
UPDATE public.lotes_aves SET llegada = CASE
  WHEN estado = 'activo' AND fecha_inicio_postura IS NOT NULL AND fecha_inicio_postura <= fecha_inicio THEN 'en_postura'
  WHEN fecha_nacimiento IS NOT NULL AND fecha_inicio - fecha_nacimiento >= 98 THEN 'levantadas'
  ELSE 'pollitas_dia' END
WHERE llegada IS NULL;

CREATE TABLE IF NOT EXISTS public.cambios_proposito_lote (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id       uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  lote_id        uuid NOT NULL REFERENCES public.lotes_aves(id) ON DELETE CASCADE,
  fecha          date NOT NULL DEFAULT CURRENT_DATE,
  anterior       text,
  nuevo          text NOT NULL,
  motivo         text,
  registrado_por uuid DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.traslados_lote_aves (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id       uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  lote_id        uuid NOT NULL REFERENCES public.lotes_aves(id) ON DELETE CASCADE,
  fecha          date NOT NULL DEFAULT CURRENT_DATE,
  desde_instalacion_id uuid REFERENCES public.instalaciones(id) ON DELETE SET NULL,
  hacia_instalacion_id uuid REFERENCES public.instalaciones(id) ON DELETE SET NULL,
  aves           integer,
  motivo         text,
  registrado_por uuid DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vacios_sanitarios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id         uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  instalacion_id   uuid NOT NULL REFERENCES public.instalaciones(id) ON DELETE CASCADE,
  lote_id          uuid,
  fecha_inicio     date NOT NULL,
  fecha_fin        date,
  producto         text,
  dosis            text,
  aplicaciones     integer,
  control_roedores boolean NOT NULL DEFAULT false,
  control_insectos boolean NOT NULL DEFAULT false,
  cambio_cama      boolean NOT NULL DEFAULT false,
  responsable      text,
  observaciones    text,
  registrado_por   uuid DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ventas_aves_lote
  ADD COLUMN IF NOT EXISTS peso_promedio_g numeric,
  ADD COLUMN IF NOT EXISTS checklist jsonb;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cambios_proposito_lote', 'traslados_lote_aves', 'vacios_sanitarios'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Miembros de la finca" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Miembros de la finca" ON public.%I FOR ALL TO authenticated USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id))', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (finca_id)', t || '_finca_idx', t);
  END LOOP;
END $$;
