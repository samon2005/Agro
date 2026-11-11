-- Fase 0.2 del plan de cerdos (docs/plan-cerdos-jose-2026-11.md)
--
-- La granja se organiza en NAVES (una por etapa: gestación, parideras, precebo,
-- levante, ceba, clínica, berraco, cuarentena). Dentro de cada nave van los
-- CORRALES (engorde) o PUESTOS individuales numerados (jaulas de gestación y
-- parideras). Antes las naves solo existían dentro del lote de cría.
--
-- Las cerdas siguen en un solo grupo, el pie de cría, para no partir su
-- historia (servicio, parto y destete). La nave y el puesto son su ubicación.

-- 1. Naves y corrales en la misma tabla de lugares de la finca
ALTER TABLE instalaciones
  ADD COLUMN IF NOT EXISTS padre_id uuid REFERENCES instalaciones(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS puestos integer CHECK (puestos IS NULL OR puestos > 0);

COMMENT ON COLUMN instalaciones.padre_id IS 'Nave a la que pertenece el corral (null en las naves y en los galpones).';
COMMENT ON COLUMN instalaciones.puestos IS 'Jaulas o parideras individuales numeradas que tiene la nave.';

ALTER TABLE instalaciones DROP CONSTRAINT IF EXISTS instalaciones_uso_check;
ALTER TABLE instalaciones ADD CONSTRAINT instalaciones_uso_check CHECK (
  uso IS NULL OR uso IN ('cria', 'gestacion', 'parideras', 'cuarentena', 'precebo', 'levante', 'ceba', 'clinica', 'berraco')
);

ALTER TABLE instalaciones DROP CONSTRAINT IF EXISTS instalaciones_tipo_check;
ALTER TABLE instalaciones ADD CONSTRAINT instalaciones_tipo_check CHECK (tipo IN ('galpon', 'corral', 'nave'));

-- Dos naves pueden tener cada una su "Corral 1": el nombre se repite solo dentro de la misma nave
ALTER TABLE instalaciones DROP CONSTRAINT IF EXISTS instalaciones_finca_id_nombre_key;
CREATE UNIQUE INDEX IF NOT EXISTS instalaciones_nombre_por_nave
  ON instalaciones (finca_id, COALESCE(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
CREATE INDEX IF NOT EXISTS idx_instalaciones_padre ON instalaciones(padre_id);

-- Un corral solo cuelga de una nave de la misma finca y especie, y una nave no va dentro de otra
CREATE OR REPLACE FUNCTION trg_instalacion_padre_valido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_padre instalaciones%ROWTYPE;
BEGIN
  IF NEW.padre_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.tipo = 'nave' THEN RAISE EXCEPTION 'Una nave no puede ir dentro de otra nave'; END IF;
  SELECT * INTO v_padre FROM instalaciones WHERE id = NEW.padre_id;
  IF v_padre.id IS NULL OR v_padre.tipo <> 'nave' THEN RAISE EXCEPTION 'El corral debe pertenecer a una nave'; END IF;
  IF v_padre.finca_id <> NEW.finca_id OR v_padre.especie <> NEW.especie THEN
    RAISE EXCEPTION 'La nave es de otra finca o de otra especie';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS instalacion_padre_valido ON instalaciones;
CREATE TRIGGER instalacion_padre_valido
  BEFORE INSERT OR UPDATE OF padre_id, tipo ON instalaciones
  FOR EACH ROW EXECUTE FUNCTION trg_instalacion_padre_valido();

-- 2. Ubicación de cada cerda: nave y número de puesto (jaula o paridera)
ALTER TABLE reproductoras_cerdos
  ADD COLUMN IF NOT EXISTS ubicacion_id uuid REFERENCES instalaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS puesto integer CHECK (puesto IS NULL OR puesto > 0);
CREATE INDEX IF NOT EXISTS idx_reproductoras_ubicacion ON reproductoras_cerdos(ubicacion_id);

-- 3. Las naves que existían dentro del lote de cría pasan a ser naves de la finca
--    (se conserva el mismo id para mover las cerdas sin perder nada)
INSERT INTO instalaciones (id, finca_id, especie, tipo, nombre, uso, created_at)
SELECT n.id, n.finca_id, 'cerdos', 'nave',
       CASE WHEN EXISTS (
              SELECT 1 FROM instalaciones i
               WHERE i.finca_id = n.finca_id AND i.padre_id IS NULL AND lower(i.nombre) = lower(n.nombre)
            ) THEN n.nombre || ' (cría)' ELSE n.nombre END,
       'gestacion', n.created_at
  FROM naves_cerdos n
ON CONFLICT (id) DO NOTHING;

UPDATE reproductoras_cerdos SET ubicacion_id = nave_id WHERE nave_id IS NOT NULL AND ubicacion_id IS NULL;

-- 4. Los corrales de cría de antes ahora son naves de gestación
UPDATE instalaciones SET tipo = 'nave', uso = 'gestacion' WHERE especie = 'cerdos' AND uso = 'cria';

-- La tabla vieja (naves_cerdos) y la columna reproductoras_cerdos.nave_id se
-- dejan por ahora: la versión publicada de la app todavía las lee. Se retiran en
-- una migración aparte cuando el código nuevo esté publicado.
