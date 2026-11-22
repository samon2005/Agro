-- Cerdos · Fase 1 (reproducción), con las respuestas de José (9 nov 2026):
--   machos y celadores con su ficha, servicio ampliado (semen propio, quién
--   inseminó, calidad del celo, grupo sincronizado), parto ampliado (horas,
--   asistido, defectos), adopciones (cambio de madre) y temperatura y humedad
--   en el registro diario del corral.

-- Machos: celadores (calentadores) y reproductores. José los nombra por nombre propio.
CREATE TABLE IF NOT EXISTS public.machos_cerdos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  funcion         text NOT NULL DEFAULT 'celador' CHECK (funcion IN ('celador', 'reproductor', 'celador_reproductor')),
  linea_genetica  text,
  fecha_nacimiento date,
  fecha_ingreso   date,
  activo          boolean NOT NULL DEFAULT true,
  observaciones   text,
  registrado_por  uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.machos_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros manejan los machos" ON public.machos_cerdos;
CREATE POLICY "Miembros manejan los machos" ON public.machos_cerdos
  FOR ALL TO authenticated USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS machos_cerdos_finca_idx ON public.machos_cerdos (finca_id);

-- Servicio ampliado
ALTER TABLE public.servicios_cerdos
  ADD COLUMN IF NOT EXISTS origen_semen text CHECK (origen_semen IS NULL OR origen_semen IN ('comprado', 'propio', 'monta')),
  ADD COLUMN IF NOT EXISTS macho_id uuid REFERENCES public.machos_cerdos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_recoleccion date,
  ADD COLUMN IF NOT EXISTS inseminador text,
  ADD COLUMN IF NOT EXISTS calidad_celo smallint CHECK (calidad_celo IS NULL OR calidad_celo BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS grupo_sincronizado text;

-- Parto ampliado (el sexo de cada lechón va en lechones_cerdos.sexo)
ALTER TABLE public.partos_cerdos
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fin time,
  ADD COLUMN IF NOT EXISTS asistido boolean,
  ADD COLUMN IF NOT EXISTS defectos text;

-- Adopciones: el lechón sigue siendo hijo de su madre (madre_id) y lo cría otra (nodriza_id)
ALTER TABLE public.lechones_cerdos
  ADD COLUMN IF NOT EXISTS nodriza_id uuid REFERENCES public.reproductoras_cerdos(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.adopciones_cerdos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id         uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  lechon_id        uuid NOT NULL REFERENCES public.lechones_cerdos(id) ON DELETE CASCADE,
  madre_origen_id  uuid REFERENCES public.reproductoras_cerdos(id) ON DELETE SET NULL,
  madre_destino_id uuid NOT NULL REFERENCES public.reproductoras_cerdos(id) ON DELETE CASCADE,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  razon            text,
  registrado_por   uuid DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.adopciones_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros manejan las adopciones" ON public.adopciones_cerdos;
CREATE POLICY "Miembros manejan las adopciones" ON public.adopciones_cerdos
  FOR ALL TO authenticated USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS adopciones_cerdos_finca_idx ON public.adopciones_cerdos (finca_id);

-- Temperatura y humedad del termohigrómetro, dentro del registro diario
ALTER TABLE public.nutricion_diaria_cerdos
  ADD COLUMN IF NOT EXISTS temperatura_c numeric,
  ADD COLUMN IF NOT EXISTS humedad_pct numeric CHECK (humedad_pct IS NULL OR humedad_pct BETWEEN 0 AND 100);
