-- ============================================================
-- MÓDULO: Cerdos — sistema de cría (reproducción) y edad del lote
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- El lote declara con qué sistema trabaja ----
-- 'ceba'  → engorde: se compra el lechón, se levanta y se vende por kilo.
-- 'cria'  → reproducción: hembras propias, servicios, partos y destetes.
ALTER TABLE lotes_cerdos
  ADD COLUMN IF NOT EXISTS sistema text NOT NULL DEFAULT 'ceba';

-- Edad del lote: se guarda la fecha de nacimiento y la edad se calcula sola,
-- así no queda desactualizada como quedaría un número de días fijo.
ALTER TABLE lotes_cerdos
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date;

-- ---- Hembras reproductoras del lote de cría ----
CREATE TABLE IF NOT EXISTS reproductoras_cerdos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id           uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id          uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  codigo            text NOT NULL,
  nombre            text,
  linea_genetica    text,
  fecha_nacimiento  date,
  fecha_ingreso     date NOT NULL DEFAULT CURRENT_DATE,
  numero_partos     integer NOT NULL DEFAULT 0,
  -- vacia | servida | gestante | lactante | descartada
  estado            text NOT NULL DEFAULT 'vacia',
  peso_kg           numeric(6,2),
  observaciones     text,
  registrado_por    uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, codigo)
);
ALTER TABLE reproductoras_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD reproductoras_cerdos" ON reproductoras_cerdos;
CREATE POLICY "Miembros CRUD reproductoras_cerdos" ON reproductoras_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_reproductoras_cerdos_lote ON reproductoras_cerdos(lote_id);

-- ---- Servicios: monta natural o inseminación artificial ----
-- La gestación de la cerda es de 114 días (3 meses, 3 semanas y 3 días).
CREATE TABLE IF NOT EXISTS servicios_cerdos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reproductora_id       uuid NOT NULL REFERENCES reproductoras_cerdos(id) ON DELETE CASCADE,
  lote_id               uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id              uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_servicio        date NOT NULL DEFAULT CURRENT_DATE,
  -- monta_natural | inseminacion
  tipo                  text NOT NULL DEFAULT 'inseminacion',
  verraco               text,
  numero_dosis          integer,
  fecha_probable_parto  date,
  prenez_confirmada     boolean NOT NULL DEFAULT false,
  fecha_confirmacion    date,
  -- pendiente | confirmado | repetido | fallido | parido
  estado                text NOT NULL DEFAULT 'pendiente',
  observaciones         text,
  registrado_por        uuid REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE servicios_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD servicios_cerdos" ON servicios_cerdos;
CREATE POLICY "Miembros CRUD servicios_cerdos" ON servicios_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_servicios_cerdos_lote_fecha ON servicios_cerdos(lote_id, fecha_servicio DESC);

-- ---- Partos ----
CREATE TABLE IF NOT EXISTS partos_cerdos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id         uuid REFERENCES servicios_cerdos(id) ON DELETE SET NULL,
  reproductora_id     uuid NOT NULL REFERENCES reproductoras_cerdos(id) ON DELETE CASCADE,
  lote_id             uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id            uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_parto         date NOT NULL DEFAULT CURRENT_DATE,
  nacidos_vivos       integer NOT NULL DEFAULT 0,
  nacidos_muertos     integer NOT NULL DEFAULT 0,
  momificados         integer NOT NULL DEFAULT 0,
  peso_camada_kg      numeric(7,2),
  observaciones       text,
  registrado_por      uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE partos_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD partos_cerdos" ON partos_cerdos;
CREATE POLICY "Miembros CRUD partos_cerdos" ON partos_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_partos_cerdos_lote_fecha ON partos_cerdos(lote_id, fecha_parto DESC);

-- ---- Destetes ----
-- El lechón se desteta entre los 21 y los 28 días; la cerda vuelve a celo
-- entre 5 y 7 días después del destete.
CREATE TABLE IF NOT EXISTS destetes_cerdos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parto_id             uuid REFERENCES partos_cerdos(id) ON DELETE SET NULL,
  reproductora_id      uuid NOT NULL REFERENCES reproductoras_cerdos(id) ON DELETE CASCADE,
  lote_id              uuid NOT NULL REFERENCES lotes_cerdos(id) ON DELETE CASCADE,
  finca_id             uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha_destete        date NOT NULL DEFAULT CURRENT_DATE,
  lechones_destetados  integer NOT NULL DEFAULT 0,
  peso_promedio_kg     numeric(6,2),
  observaciones        text,
  registrado_por       uuid REFERENCES profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE destetes_cerdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD destetes_cerdos" ON destetes_cerdos;
CREATE POLICY "Miembros CRUD destetes_cerdos" ON destetes_cerdos FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_destetes_cerdos_lote_fecha ON destetes_cerdos(lote_id, fecha_destete DESC);
