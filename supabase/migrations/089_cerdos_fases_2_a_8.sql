-- Cerdos · lo que faltaba del plan de José (fases 1 a 8), 22 nov 2026.
-- Fase 1: celos observados, pesos de la hembra de reemplazo, descarte con motivo y destino, ración por cerda.
-- Fase 2: pesos individuales del pesaje (uniformidad), cambio de etapa programado, desenlace de la clínica.
-- Fase 3: lote del producto y factura de cada compra de alimento.
-- Fase 4: signos, áreas y necropsia de cada evento clínico; visitas de bioseguridad (todas las especies).
-- Fase 5: rol asesor (profesores): ve todo, la plata incluida, pero no maneja el equipo.
-- Fase 6: venta con peso total, transporte, forma de pago, vencimiento y pagos (cuentas por cobrar).
-- Fase 8: precios del cerdo en el mercado, cargados a mano por semana.

CREATE TABLE IF NOT EXISTS public.celos_cerdos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  reproductora_id uuid NOT NULL REFERENCES public.reproductoras_cerdos(id) ON DELETE CASCADE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  metodo          text CHECK (metodo IS NULL OR metodo IN ('lordosis', 'celador', 'ambos')),
  calidad         smallint CHECK (calidad IS NULL OR calidad BETWEEN 1 AND 3),
  observaciones   text,
  registrado_por  uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pesos_reproductora_cerdos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  reproductora_id uuid NOT NULL REFERENCES public.reproductoras_cerdos(id) ON DELETE CASCADE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  peso_kg         numeric NOT NULL CHECK (peso_kg > 0),
  registrado_por  uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reproductoras_cerdos
  ADD COLUMN IF NOT EXISTS origen text CHECK (origen IS NULL OR origen IN ('comprada', 'propia')),
  ADD COLUMN IF NOT EXISTS racion_kg_dia numeric CHECK (racion_kg_dia IS NULL OR racion_kg_dia >= 0),
  ADD COLUMN IF NOT EXISTS fecha_descarte date,
  ADD COLUMN IF NOT EXISTS motivo_descarte text,
  ADD COLUMN IF NOT EXISTS destino_descarte text CHECK (destino_descarte IS NULL OR destino_descarte IN ('venta', 'sacrificio', 'muerte'));

ALTER TABLE public.pesos_lote_cerdos ADD COLUMN IF NOT EXISTS pesos_individuales numeric[];
ALTER TABLE public.lotes_cerdos ADD COLUMN IF NOT EXISTS proximo_cambio_etapa date;

ALTER TABLE public.eventos_clinicos_cerdos
  ADD COLUMN IF NOT EXISTS signos text,
  ADD COLUMN IF NOT EXISTS areas_afectadas text,
  ADD COLUMN IF NOT EXISTS necropsia text,
  ADD COLUMN IF NOT EXISTS desenlace text CHECK (desenlace IS NULL OR desenlace IN ('recuperado', 'vuelve_grupo', 'vendido_aparte', 'sacrificado', 'murio')),
  ADD COLUMN IF NOT EXISTS fecha_desenlace date;

ALTER TABLE public.entradas_alimento_lote
  ADD COLUMN IF NOT EXISTS lote_producto text,
  ADD COLUMN IF NOT EXISTS factura text;

CREATE TABLE IF NOT EXISTS public.visitas_finca (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  hora            time,
  nombre          text NOT NULL,
  empresa         text,
  motivo          text,
  areas           text,
  ducha           boolean NOT NULL DEFAULT false,
  cambio_ropa     boolean NOT NULL DEFAULT false,
  desinfeccion    boolean NOT NULL DEFAULT false,
  ultimo_contacto_animales date,
  observaciones   text,
  registrado_por  uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ventas_cerdos
  ADD COLUMN IF NOT EXISTS peso_total_kg numeric,
  ADD COLUMN IF NOT EXISTS valor_total numeric,
  ADD COLUMN IF NOT EXISTS costo_transporte numeric,
  ADD COLUMN IF NOT EXISTS forma_pago text CHECK (forma_pago IS NULL OR forma_pago IN ('contado', 'credito')),
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date,
  ADD COLUMN IF NOT EXISTS pagado numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pagos_ventas_cerdos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id       uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  venta_id       uuid NOT NULL REFERENCES public.ventas_cerdos(id) ON DELETE CASCADE,
  fecha          date NOT NULL DEFAULT CURRENT_DATE,
  monto          numeric NOT NULL CHECK (monto > 0),
  observaciones  text,
  registrado_por uuid DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Lo pagado de cada venta sale de sus pagos
CREATE OR REPLACE FUNCTION public.sincronizar_pagado_venta_cerdos()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v uuid := COALESCE(NEW.venta_id, OLD.venta_id);
BEGIN
  UPDATE ventas_cerdos SET pagado = COALESCE((SELECT sum(monto) FROM pagos_ventas_cerdos WHERE venta_id = v), 0) WHERE id = v;
  RETURN NULL;
END;
$function$;
DROP TRIGGER IF EXISTS trg_pagado_venta_cerdos ON public.pagos_ventas_cerdos;
CREATE TRIGGER trg_pagado_venta_cerdos AFTER INSERT OR UPDATE OR DELETE ON public.pagos_ventas_cerdos
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_pagado_venta_cerdos();

CREATE TABLE IF NOT EXISTS public.precios_mercado_cerdos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  fecha           date NOT NULL,
  precio_kg_pie   numeric,
  precio_kg_canal numeric,
  fuente          text,
  enlace          text,
  registrado_por  uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, fecha)
);

-- RLS: cada finca ve lo suyo
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['celos_cerdos', 'pesos_reproductora_cerdos', 'visitas_finca', 'pagos_ventas_cerdos', 'precios_mercado_cerdos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Miembros de la finca" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Miembros de la finca" ON public.%I FOR ALL TO authenticated USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id))', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (finca_id)', t || '_finca_idx', t);
  END LOOP;
END $$;

-- Rol asesor (los profesores de José): ve todo y la plata, no maneja el equipo
ALTER TABLE public.finca_miembros DROP CONSTRAINT IF EXISTS finca_miembros_rol_check;
ALTER TABLE public.finca_miembros ADD CONSTRAINT finca_miembros_rol_check
  CHECK (rol IN ('propietario', 'administrador', 'asesor', 'zootecnista', 'operario', 'recolector', 'contador', 'trabajador'));
ALTER TABLE public.invitaciones_finca DROP CONSTRAINT IF EXISTS invitaciones_finca_rol_check;
ALTER TABLE public.invitaciones_finca ADD CONSTRAINT invitaciones_finca_rol_check
  CHECK (rol IN ('administrador', 'asesor', 'zootecnista', 'operario', 'recolector', 'contador'));

CREATE OR REPLACE FUNCTION public.cambiar_rol_miembro(p_finca uuid, p_perfil uuid, p_rol text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT es_administrador_finca(p_finca) THEN
    RAISE EXCEPTION 'Solo el administrador de la finca cambia los roles' USING HINT = 'sin_permiso';
  END IF;
  IF p_rol NOT IN ('administrador', 'asesor', 'zootecnista', 'operario', 'recolector', 'contador') THEN
    RAISE EXCEPTION 'Rol no válido';
  END IF;
  UPDATE finca_miembros SET rol = p_rol
   WHERE finca_id = p_finca AND perfil_id = p_perfil AND rol <> 'propietario';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.cambiar_rol_miembro(uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cambiar_rol_miembro(uuid, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sincronizar_pagado_venta_cerdos() FROM anon, PUBLIC;
