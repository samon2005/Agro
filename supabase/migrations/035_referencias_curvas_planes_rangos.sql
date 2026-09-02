-- ============================================================
-- MÓDULO: Datos de referencia por especie
--   * curvas_referencia    — peso/consumo/conversión objetivo por edad
--   * planes_sanitarios    — calendarios de vacunación sugeridos
--   * rangos_ambientales   — temperatura, humedad, gases y densidad objetivo
--
-- Las filas con finca_id NULL son PLANTILLAS del sistema: cualquiera las lee,
-- nadie las edita. Una finca puede crear sus propias filas (finca_id = su id)
-- para sobrescribir la plantilla con los datos de su genética o proveedor.
--
-- Los valores sembrados son de referencia publicada y aproximada: cada finca
-- debe ajustarlos a la ficha técnica real de su línea y su proveedor.
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Curvas de referencia (peso objetivo por día de vida) ----
CREATE TABLE IF NOT EXISTS curvas_referencia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid REFERENCES fincas(id) ON DELETE CASCADE,
  especie         text NOT NULL CHECK (especie IN ('aves_ponedoras', 'cerdos', 'pollo_engorde')),
  linea_genetica  text NOT NULL,
  dia             integer NOT NULL,
  peso_g          numeric(12,2),
  consumo_acum_g  numeric(12,2),
  conversion      numeric(6,3),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (finca_id, especie, linea_genetica, dia)
);
ALTER TABLE curvas_referencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura curvas_referencia" ON curvas_referencia;
CREATE POLICY "Lectura curvas_referencia" ON curvas_referencia FOR SELECT
  USING (finca_id IS NULL OR es_miembro_finca(finca_id));
DROP POLICY IF EXISTS "Miembros escriben curvas_referencia" ON curvas_referencia;
CREATE POLICY "Miembros escriben curvas_referencia" ON curvas_referencia FOR ALL
  USING (finca_id IS NOT NULL AND es_miembro_finca(finca_id))
  WITH CHECK (finca_id IS NOT NULL AND es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_curvas_referencia_lookup ON curvas_referencia(especie, linea_genetica, dia);

-- ---- Planes sanitarios (calendario de vacunación sugerido) ----
CREATE TABLE IF NOT EXISTS planes_sanitarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id    uuid REFERENCES fincas(id) ON DELETE CASCADE,
  especie     text NOT NULL CHECK (especie IN ('aves_ponedoras', 'cerdos', 'pollo_engorde')),
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (finca_id, especie, nombre)
);
ALTER TABLE planes_sanitarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura planes_sanitarios" ON planes_sanitarios;
CREATE POLICY "Lectura planes_sanitarios" ON planes_sanitarios FOR SELECT
  USING (finca_id IS NULL OR es_miembro_finca(finca_id));
DROP POLICY IF EXISTS "Miembros escriben planes_sanitarios" ON planes_sanitarios;
CREATE POLICY "Miembros escriben planes_sanitarios" ON planes_sanitarios FOR ALL
  USING (finca_id IS NOT NULL AND es_miembro_finca(finca_id))
  WITH CHECK (finca_id IS NOT NULL AND es_miembro_finca(finca_id));

CREATE TABLE IF NOT EXISTS planes_sanitarios_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             uuid NOT NULL REFERENCES planes_sanitarios(id) ON DELETE CASCADE,
  edad_dias           integer NOT NULL,
  tipo                text NOT NULL DEFAULT 'vacuna' CHECK (tipo IN ('vacuna', 'desparasitacion', 'tratamiento')),
  producto            text NOT NULL,
  previene            text,
  via_administracion  text,
  dosis               text,
  obligatoria         boolean NOT NULL DEFAULT false,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE planes_sanitarios_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura planes_sanitarios_items" ON planes_sanitarios_items;
CREATE POLICY "Lectura planes_sanitarios_items" ON planes_sanitarios_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Miembros escriben planes_sanitarios_items" ON planes_sanitarios_items;
CREATE POLICY "Miembros escriben planes_sanitarios_items" ON planes_sanitarios_items FOR ALL
  USING (EXISTS (SELECT 1 FROM planes_sanitarios p WHERE p.id = plan_id AND p.finca_id IS NOT NULL AND es_miembro_finca(p.finca_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM planes_sanitarios p WHERE p.id = plan_id AND p.finca_id IS NOT NULL AND es_miembro_finca(p.finca_id)));
CREATE INDEX IF NOT EXISTS idx_planes_sanitarios_items_plan ON planes_sanitarios_items(plan_id, edad_dias);

-- ---- Rangos ambientales objetivo ----
CREATE TABLE IF NOT EXISTS rangos_ambientales (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id                 uuid REFERENCES fincas(id) ON DELETE CASCADE,
  especie                  text NOT NULL CHECK (especie IN ('aves_ponedoras', 'cerdos', 'pollo_engorde')),
  etapa                    text NOT NULL,
  semana                   integer,
  temp_min                 numeric(5,2),
  temp_max                 numeric(5,2),
  humedad_min              numeric(5,2),
  humedad_max              numeric(5,2),
  nh3_max_ppm              numeric(8,2),
  co2_max_ppm              numeric(8,2),
  densidad_max_animales_m2 numeric(8,2),
  area_min_m2_animal       numeric(8,3),
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (finca_id, especie, etapa)
);
ALTER TABLE rangos_ambientales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura rangos_ambientales" ON rangos_ambientales;
CREATE POLICY "Lectura rangos_ambientales" ON rangos_ambientales FOR SELECT
  USING (finca_id IS NULL OR es_miembro_finca(finca_id));
DROP POLICY IF EXISTS "Miembros escriben rangos_ambientales" ON rangos_ambientales;
CREATE POLICY "Miembros escriben rangos_ambientales" ON rangos_ambientales FOR ALL
  USING (finca_id IS NOT NULL AND es_miembro_finca(finca_id))
  WITH CHECK (finca_id IS NOT NULL AND es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_rangos_ambientales_lookup ON rangos_ambientales(especie, semana);

-- ============================================================
-- SIEMBRA DE PLANTILLAS (finca_id NULL)
-- ============================================================

-- ---- Curva pollo de engorde: Ross 308 (mixto, valores de referencia) ----
INSERT INTO curvas_referencia (finca_id, especie, linea_genetica, dia, peso_g, consumo_acum_g, conversion) VALUES
  (NULL, 'pollo_engorde', 'Ross 308',  0,   42,     0, NULL),
  (NULL, 'pollo_engorde', 'Ross 308',  7,  196,   165, 0.84),
  (NULL, 'pollo_engorde', 'Ross 308', 14,  500,   545, 1.09),
  (NULL, 'pollo_engorde', 'Ross 308', 21,  970,  1160, 1.20),
  (NULL, 'pollo_engorde', 'Ross 308', 28, 1560,  2020, 1.30),
  (NULL, 'pollo_engorde', 'Ross 308', 35, 2270,  3060, 1.35),
  (NULL, 'pollo_engorde', 'Ross 308', 42, 2990,  4250, 1.42)
ON CONFLICT DO NOTHING;

-- ---- Curva pollo de engorde: Cobb 500 (mixto, valores de referencia) ----
INSERT INTO curvas_referencia (finca_id, especie, linea_genetica, dia, peso_g, consumo_acum_g, conversion) VALUES
  (NULL, 'pollo_engorde', 'Cobb 500',  0,   42,     0, NULL),
  (NULL, 'pollo_engorde', 'Cobb 500',  7,  190,   160, 0.84),
  (NULL, 'pollo_engorde', 'Cobb 500', 14,  490,   535, 1.09),
  (NULL, 'pollo_engorde', 'Cobb 500', 21,  950,  1140, 1.20),
  (NULL, 'pollo_engorde', 'Cobb 500', 28, 1530,  1990, 1.30),
  (NULL, 'pollo_engorde', 'Cobb 500', 35, 2230,  3010, 1.35),
  (NULL, 'pollo_engorde', 'Cobb 500', 42, 2930,  4180, 1.43)
ON CONFLICT DO NOTHING;

-- ---- Curva porcina de referencia por día de vida (destete a mercado) ----
INSERT INTO curvas_referencia (finca_id, especie, linea_genetica, dia, peso_g, consumo_acum_g, conversion) VALUES
  (NULL, 'cerdos', 'Estándar comercial',  21,   6500,      0, NULL),
  (NULL, 'cerdos', 'Estándar comercial',  42,  15000,  14000, 1.30),
  (NULL, 'cerdos', 'Estándar comercial',  63,  27000,  40000, 1.80),
  (NULL, 'cerdos', 'Estándar comercial',  84,  45000,  86000, 2.20),
  (NULL, 'cerdos', 'Estándar comercial', 105,  62000, 145000, 2.55),
  (NULL, 'cerdos', 'Estándar comercial', 112,  70000, 168000, 2.65),
  (NULL, 'cerdos', 'Estándar comercial', 133,  85000, 232000, 2.85),
  (NULL, 'cerdos', 'Estándar comercial', 154, 105000, 310000, 3.10)
ON CONFLICT DO NOTHING;

-- ---- Plan sanitario sugerido: pollo de engorde ----
INSERT INTO planes_sanitarios (finca_id, especie, nombre, descripcion)
VALUES (NULL, 'pollo_engorde', 'Plan básico pollo de engorde',
        'Esquema de referencia. Confirma siempre con la incubadora: los pollitos llegan con anticuerpos maternos y el plan varía por zona.')
ON CONFLICT DO NOTHING;

INSERT INTO planes_sanitarios_items (plan_id, edad_dias, tipo, producto, previene, via_administracion, dosis, obligatoria, notas)
SELECT p.id, v.edad, 'vacuna', v.producto, v.previene, v.via, NULL, false, v.notas
FROM planes_sanitarios p
CROSS JOIN (VALUES
  (1,  'Marek',                 'Enfermedad de Marek',        'Subcutánea',    'Se aplica en incubadora'),
  (1,  'Gumboro',               'Bursitis infecciosa',        'Subcutánea',    'Se aplica en incubadora'),
  (3,  'Newcastle + Bronquitis','Newcastle y bronquitis',     'Ocular / spray', NULL),
  (6,  'Gumboro',               'Bursitis infecciosa',        'Agua de bebida', NULL),
  (14, 'Gumboro (refuerzo)',    'Bursitis infecciosa',        'Agua de bebida', NULL),
  (16, 'Newcastle + Bronquitis','Newcastle y bronquitis',     'Ocular / spray', 'Refuerzo')
) AS v(edad, producto, previene, via, notas)
WHERE p.finca_id IS NULL AND p.especie = 'pollo_engorde'
ON CONFLICT DO NOTHING;

-- ---- Plan sanitario sugerido: cerdos ----
INSERT INTO planes_sanitarios (finca_id, especie, nombre, descripcion)
VALUES (NULL, 'cerdos', 'Plan básico porcino',
        'Esquema de referencia para Colombia. La vacunación contra Peste Porcina Clásica es obligatoria en la Zona de Control definida por el ICA.')
ON CONFLICT DO NOTHING;

INSERT INTO planes_sanitarios_items (plan_id, edad_dias, tipo, producto, previene, via_administracion, dosis, obligatoria, notas)
SELECT p.id, v.edad, v.tipo, v.producto, v.previene, v.via, NULL, v.obligatoria, v.notas
FROM planes_sanitarios p
CROSS JOIN (VALUES
  (7,  'vacuna',          'Mycoplasma hyopneumoniae',  'Neumonía enzoótica',      'Intramuscular', false, 'Primera dosis'),
  (21, 'vacuna',          'Circovirus porcino (PCV2)', 'Desmedro post-destete',   'Intramuscular', false, NULL),
  (21, 'vacuna',          'Mycoplasma hyopneumoniae',  'Neumonía enzoótica',      'Intramuscular', false, 'Refuerzo'),
  (50, 'vacuna',          'Peste Porcina Clásica',     'Peste Porcina Clásica',   'Intramuscular', true,  'Entre los 45 y 60 días. Obligatoria en la Zona de Control del ICA'),
  (60, 'desparasitacion', 'Desparasitante de amplio espectro', 'Parásitos internos y externos', 'Oral / inyectable', false, 'Repetir según el producto')
) AS v(edad, tipo, producto, previene, via, obligatoria, notas)
WHERE p.finca_id IS NULL AND p.especie = 'cerdos'
ON CONFLICT DO NOTHING;

-- ---- Rangos ambientales: pollo de engorde (baja ~3 °C por semana) ----
INSERT INTO rangos_ambientales (finca_id, especie, etapa, semana, temp_min, temp_max, humedad_min, humedad_max, nh3_max_ppm, co2_max_ppm, densidad_max_animales_m2) VALUES
  (NULL, 'pollo_engorde', 'Semana 1', 1, 32, 35, 50, 70, 20, 3000, 12),
  (NULL, 'pollo_engorde', 'Semana 2', 2, 29, 32, 50, 70, 20, 3000, 12),
  (NULL, 'pollo_engorde', 'Semana 3', 3, 26, 29, 50, 70, 20, 3000, 12),
  (NULL, 'pollo_engorde', 'Semana 4', 4, 23, 26, 50, 70, 20, 3000, 10),
  (NULL, 'pollo_engorde', 'Semana 5', 5, 21, 24, 50, 70, 20, 3000, 10),
  (NULL, 'pollo_engorde', 'Semana 6', 6, 19, 22, 50, 70, 20, 3000, 10)
ON CONFLICT DO NOTHING;

-- ---- Rangos ambientales: cerdos por etapa ----
INSERT INTO rangos_ambientales (finca_id, especie, etapa, semana, temp_min, temp_max, humedad_min, humedad_max, nh3_max_ppm, co2_max_ppm, area_min_m2_animal) VALUES
  (NULL, 'cerdos', 'precebo',      NULL, 26, 30, 50, 70, 20, 3000, 0.30),
  (NULL, 'cerdos', 'levante',      NULL, 22, 26, 50, 75, 20, 3000, 0.50),
  (NULL, 'cerdos', 'ceba',         NULL, 18, 24, 50, 80, 20, 3000, 0.75),
  (NULL, 'cerdos', 'finalizacion', NULL, 16, 22, 50, 80, 20, 3000, 1.00)
ON CONFLICT DO NOTHING;
