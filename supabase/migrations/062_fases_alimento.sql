-- Programa de alimentación por edad: las fases de cada referencia (qué alimento
-- le corresponde al lote). En levante la fase va por semana de vida y por peso;
-- en producción, por el % de postura del propio lote, como lo indica la guía.

CREATE TABLE IF NOT EXISTS fases_alimento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id       uuid NOT NULL REFERENCES lineas_referencia(id) ON DELETE CASCADE,
  orden          integer NOT NULL,
  nombre         text NOT NULL,
  categoria      text NOT NULL CHECK (categoria IN ('iniciacion', 'crecimiento', 'desarrollo', 'prepostura', 'postura')),
  -- Fases de levante: semanas de vida y peso con que se pasa a la siguiente
  desde_semana   integer CHECK (desde_semana IS NULL OR desde_semana BETWEEN 1 AND 120),
  hasta_semana   integer CHECK (hasta_semana IS NULL OR hasta_semana BETWEEN 1 AND 120),
  peso_cambio_g  numeric(7,1) CHECK (peso_cambio_g IS NULL OR peso_cambio_g > 0),
  -- Fases de producción: mientras la postura no baje de postura_min (%), o
  -- mientras no caiga más de bajo_pico puntos desde el pico del lote
  postura_min    numeric(5,2) CHECK (postura_min IS NULL OR postura_min BETWEEN 0 AND 100),
  bajo_pico      numeric(4,1) CHECK (bajo_pico IS NULL OR bajo_pico >= 0),
  notas          text,
  CHECK (desde_semana IS NULL OR hasta_semana IS NULL OR desde_semana <= hasta_semana),
  CHECK (categoria = 'postura' OR desde_semana IS NOT NULL),
  CHECK (categoria <> 'postura' OR postura_min IS NOT NULL OR bajo_pico IS NOT NULL),
  UNIQUE (linea_id, orden)
);

ALTER TABLE fases_alimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ver_fases_alimento ON fases_alimento;
CREATE POLICY ver_fases_alimento ON fases_alimento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM lineas_referencia l WHERE l.id = linea_id
                  AND (l.finca_id IS NULL OR es_miembro_finca(l.finca_id))));
DROP POLICY IF EXISTS editar_fases_alimento ON fases_alimento;
CREATE POLICY editar_fases_alimento ON fases_alimento FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM lineas_referencia l WHERE l.id = linea_id
                  AND l.finca_id IS NOT NULL AND es_miembro_finca(l.finca_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM lineas_referencia l WHERE l.id = linea_id
                  AND l.finca_id IS NOT NULL AND es_miembro_finca(l.finca_id)));

-- Hy-Line Brown (International Standards, dic. 2025): "Rearing Period Nutritional
-- Recommendations" cambia la dieta por peso corporal; las semanas son las de la
-- tabla de pesos de la misma guía. "Production Period ... for Egg Numbers" define
-- las fases de producción por el % de postura.
INSERT INTO fases_alimento (linea_id, orden, nombre, categoria, desde_semana, hasta_semana, peso_cambio_g, postura_min, bajo_pico, notas)
SELECT l.id, f.* FROM lineas_referencia l, (VALUES
  (1,  'Iniciación 1 (Starter 1)', 'iniciacion',  1,  3,  186.0, NULL::numeric, NULL::numeric, 'Se cambia al llegar a 186–197 g.'),
  (2,  'Iniciación 2 (Starter 2)', 'iniciacion',  4,  6,  456.0, NULL, NULL, 'Se cambia al llegar a 456–482 g.'),
  (3,  'Crecimiento (Grower)',     'crecimiento', 7,  12, 1046.0, NULL, NULL, 'Se cambia al llegar a 1046–1105 g.'),
  (4,  'Desarrollo (Developer)',   'desarrollo',  13, 15, 1246.0, NULL, NULL, 'Se cambia al llegar a 1246–1317 g.'),
  (5,  'Pre-postura (Pre-Lay)',    'prepostura',  16, 17, 1357.0, NULL, NULL, 'No antes de la semana 15 ni después del primer huevo: tiene poco calcio para la postura. Sin pre-postura, subir el calcio del desarrollo a 1,4 %.'),
  (6,  'Pico (Peaking)',           'postura',     NULL, NULL, NULL, NULL, 2.0, 'Desde el primer huevo hasta que la postura cae 2 puntos bajo el pico.'),
  (7,  'Postura 2 (Layer 2)',      'postura',     NULL, NULL, NULL, 92.0, NULL, 'De 2 puntos bajo el pico hasta 92 %.'),
  (8,  'Postura 3 (Layer 3)',      'postura',     NULL, NULL, NULL, 89.0, NULL, 'Postura entre 91 y 89 %.'),
  (9,  'Postura 4 (Layer 4)',      'postura',     NULL, NULL, NULL, 85.0, NULL, 'Postura entre 88 y 85 %.'),
  (10, 'Postura 5 (Layer 5)',      'postura',     NULL, NULL, NULL, 0.0,  NULL, 'Postura por debajo de 85 %.')
) AS f(orden, nombre, categoria, desde_semana, hasta_semana, peso_cambio_g, postura_min, bajo_pico, notas)
WHERE l.codigo = 'hy-line-brown' AND l.finca_id IS NULL
ON CONFLICT (linea_id, orden) DO NOTHING;

-- La copia de una referencia lleva también sus fases
CREATE OR REPLACE FUNCTION copiar_referencia(p_linea uuid, p_finca uuid, p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  origen lineas_referencia%ROWTYPE;
  nueva uuid;
BEGIN
  IF NOT es_miembro_finca(p_finca) THEN
    RAISE EXCEPTION 'No perteneces a esta finca' USING HINT = 'sin_permiso';
  END IF;
  SELECT * INTO origen FROM lineas_referencia WHERE id = p_linea;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La referencia no existe' USING HINT = 'sin_referencia';
  END IF;

  INSERT INTO lineas_referencia (finca_id, codigo, nombre, especie, fuente, url, notas, basada_en)
  VALUES (p_finca, origen.codigo || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6),
          COALESCE(NULLIF(trim(p_nombre), ''), origen.nombre || ' (finca)'),
          origen.especie, origen.fuente, origen.url, origen.notas, origen.id)
  RETURNING id INTO nueva;

  INSERT INTO referencia_semanal (linea_id, semana, postura_min, postura_max, mortalidad_acum_pct, peso_ave_min_g, peso_ave_max_g,
                                  consumo_min_g, consumo_max_g, peso_huevo_min_g, peso_huevo_max_g)
  SELECT nueva, semana, postura_min, postura_max, mortalidad_acum_pct, peso_ave_min_g, peso_ave_max_g,
         consumo_min_g, consumo_max_g, peso_huevo_min_g, peso_huevo_max_g
    FROM referencia_semanal WHERE linea_id = p_linea;

  INSERT INTO fases_alimento (linea_id, orden, nombre, categoria, desde_semana, hasta_semana, peso_cambio_g, postura_min, bajo_pico, notas)
  SELECT nueva, orden, nombre, categoria, desde_semana, hasta_semana, peso_cambio_g, postura_min, bajo_pico, notas
    FROM fases_alimento WHERE linea_id = p_linea;
  RETURN nueva;
END;
$$;

-- Los alimentos del catálogo se clasifican con las mismas fases del programa
ALTER TABLE tipos_alimento_aves DROP CONSTRAINT IF EXISTS tipos_alimento_aves_tipo_alimento_categoria_check;
ALTER TABLE tipos_alimento_aves ADD CONSTRAINT tipos_alimento_aves_tipo_alimento_categoria_check
  CHECK (tipo_alimento_categoria IS NULL OR tipo_alimento_categoria IN
    ('iniciacion', 'crecimiento', 'desarrollo', 'prepostura', 'postura', 'levante', 'pollitas_ponedoras', 'otros'));

-- Guardar todas las fases de una copia de la finca de una vez: si algo falla,
-- no queda a medias (borrar e insertar van en la misma transacción)
CREATE OR REPLACE FUNCTION guardar_fases_alimento(p_linea uuid, p_fases jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lineas_referencia l WHERE l.id = p_linea AND l.finca_id IS NOT NULL AND es_miembro_finca(l.finca_id)) THEN
    RAISE EXCEPTION 'Solo se pueden ajustar las copias de la finca' USING HINT = 'sin_permiso';
  END IF;
  DELETE FROM fases_alimento WHERE linea_id = p_linea;
  INSERT INTO fases_alimento (linea_id, orden, nombre, categoria, desde_semana, hasta_semana, peso_cambio_g, postura_min, bajo_pico, notas)
  SELECT p_linea, (f->>'orden')::integer, f->>'nombre', f->>'categoria',
         (f->>'desde_semana')::integer, (f->>'hasta_semana')::integer, (f->>'peso_cambio_g')::numeric,
         (f->>'postura_min')::numeric, (f->>'bajo_pico')::numeric, NULLIF(f->>'notas', '')
    FROM jsonb_array_elements(COALESCE(p_fases, '[]'::jsonb)) AS f;
END;
$$;
