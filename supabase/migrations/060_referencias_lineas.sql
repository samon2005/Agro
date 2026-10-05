-- Referencias por línea genética: lo esperado por semana de vida (postura,
-- mortalidad, peso del ave, consumo y peso del huevo), tomado de las guías
-- oficiales. Es la base para comparar lo real con lo esperado, para el programa
-- de alimentación, la predicción y las sugerencias.
--
-- Las referencias generales (finca_id NULL) son de solo lectura; cada finca
-- puede hacer su propia copia y ajustarla (clima, altura, manejo).

CREATE TABLE IF NOT EXISTS lineas_referencia (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id    uuid REFERENCES fincas(id) ON DELETE CASCADE,
  codigo      text NOT NULL,
  nombre      text NOT NULL,
  especie     text NOT NULL DEFAULT 'aves_ponedoras' CHECK (especie IN ('aves_ponedoras', 'cerdos', 'pollo_engorde')),
  fuente      text,
  url         text,
  notas       text,
  basada_en   uuid REFERENCES lineas_referencia(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lineas_referencia_codigo
  ON lineas_referencia (COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo);

CREATE TABLE IF NOT EXISTS referencia_semanal (
  linea_id             uuid NOT NULL REFERENCES lineas_referencia(id) ON DELETE CASCADE,
  semana               integer NOT NULL CHECK (semana BETWEEN 1 AND 120),
  postura_min          numeric(5,2),
  postura_max          numeric(5,2),
  mortalidad_acum_pct  numeric(5,2),
  peso_ave_min_g       numeric(7,1),
  peso_ave_max_g       numeric(7,1),
  consumo_min_g        numeric(6,1),
  consumo_max_g        numeric(6,1),
  peso_huevo_min_g     numeric(5,1),
  peso_huevo_max_g     numeric(5,1),
  PRIMARY KEY (linea_id, semana)
);

ALTER TABLE lineas_referencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencia_semanal ENABLE ROW LEVEL SECURITY;

-- Las generales las ve cualquiera con sesión; las de una finca, sus miembros
DROP POLICY IF EXISTS ver_lineas_referencia ON lineas_referencia;
CREATE POLICY ver_lineas_referencia ON lineas_referencia FOR SELECT TO authenticated
  USING (finca_id IS NULL OR es_miembro_finca(finca_id));
DROP POLICY IF EXISTS editar_lineas_referencia ON lineas_referencia;
CREATE POLICY editar_lineas_referencia ON lineas_referencia FOR ALL TO authenticated
  USING (finca_id IS NOT NULL AND es_miembro_finca(finca_id))
  WITH CHECK (finca_id IS NOT NULL AND es_miembro_finca(finca_id));

DROP POLICY IF EXISTS ver_referencia_semanal ON referencia_semanal;
CREATE POLICY ver_referencia_semanal ON referencia_semanal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM lineas_referencia l WHERE l.id = linea_id
                  AND (l.finca_id IS NULL OR es_miembro_finca(l.finca_id))));
DROP POLICY IF EXISTS editar_referencia_semanal ON referencia_semanal;
CREATE POLICY editar_referencia_semanal ON referencia_semanal FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM lineas_referencia l WHERE l.id = linea_id
                  AND l.finca_id IS NOT NULL AND es_miembro_finca(l.finca_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM lineas_referencia l WHERE l.id = linea_id
                  AND l.finca_id IS NOT NULL AND es_miembro_finca(l.finca_id)));

-- El lote: la edad de sus aves (como fecha de nacimiento, así no se congela) y
-- la referencia con que se compara
ALTER TABLE lotes_aves
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
  ADD COLUMN IF NOT EXISTS referencia_id uuid REFERENCES lineas_referencia(id) ON DELETE SET NULL;

-- ── Las dos guías oficiales ──
INSERT INTO lineas_referencia (finca_id, codigo, nombre, fuente, url, notas) VALUES
  (NULL, 'hy-line-brown', 'Hy-Line Brown',
   'Hy-Line Brown Commercial Layers, International Standards — Management Guide (Hy-Line International, diciembre 2025)',
   'https://www.hyline.com/filesimages/Hy-Line-Products/Hy-Line-Product-PDFs/Brown/BRN%20STD%20ENG.pdf',
   'Valores en rango (mínimo–máximo) tal como los publica la guía. La mortalidad acumulada cuenta el levante en las semanas 1–17 y vuelve a contar desde la semana 18 (postura).'),
  (NULL, 'lohmann-brown-classic', 'Lohmann Brown-Classic',
   'Lohmann Brown-Classic Layers, Cage Systems — Management Guide, Performance Data (Lohmann Breeders, 08.21_V01-21)',
   'https://lohmann-breeders.com/files/downloads/MG/e-Guides/Cage/English/LB_eMG_Cage_EN_PerfData_LB-Classic_p8.pdf',
   'Postura por gallina viva (H.D.) y peso del huevo de la semana. La mortalidad acumulada se deriva del cociente postura por gallina alojada ÷ por gallina viva (suavizada con el máximo acumulado, porque la guía publica los porcentajes redondeados). La guía da el consumo solo como rango de la fase de producción (115–125 g/ave/día), no por semana.')
ON CONFLICT DO NOTHING;

-- Semilla generada de las guías oficiales (ver encabezado de cada línea)
INSERT INTO referencia_semanal (linea_id, semana, postura_min, postura_max, mortalidad_acum_pct, peso_ave_min_g, peso_ave_max_g, consumo_min_g, consumo_max_g, peso_huevo_min_g, peso_huevo_max_g)
SELECT l.id, d.* FROM lineas_referencia l, (VALUES
  (1, NULL, NULL, 0.4, 69.0, 73.0, 16.0, 17.0, NULL, NULL),
  (2, NULL, NULL, 0.55, 119.0, 126.0, 18.0, 19.0, NULL, NULL),
  (3, NULL, NULL, 0.65, 186.0, 197.0, 21.0, 23.0, NULL, NULL),
  (4, NULL, NULL, 0.75, 266.0, 281.0, 26.0, 28.0, NULL, NULL),
  (5, NULL, NULL, 0.85, 357.0, 377.0, 31.0, 33.0, NULL, NULL),
  (6, NULL, NULL, 0.95, 456.0, 482.0, 37.0, 40.0, NULL, NULL),
  (7, NULL, NULL, 1.05, 561.0, 593.0, 43.0, 46.0, NULL, NULL),
  (8, NULL, NULL, 1.15, 668.0, 706.0, 48.0, 52.0, NULL, NULL),
  (9, NULL, NULL, 1.25, 772.0, 816.0, 53.0, 57.0, NULL, NULL),
  (10, NULL, NULL, 1.35, 871.0, 921.0, 57.0, 61.0, NULL, NULL),
  (11, NULL, NULL, 1.45, 963.0, 1018.0, 61.0, 65.0, NULL, NULL),
  (12, NULL, NULL, 1.55, 1046.0, 1105.0, 63.0, 68.0, NULL, NULL),
  (13, NULL, NULL, 1.63, 1120.0, 1184.0, 66.0, 70.0, NULL, NULL),
  (14, NULL, NULL, 1.7, 1186.0, 1254.0, 68.0, 73.0, NULL, NULL),
  (15, NULL, NULL, 1.78, 1246.0, 1317.0, 70.0, 75.0, NULL, NULL),
  (16, NULL, NULL, 1.85, 1302.0, 1377.0, 73.0, 78.0, NULL, NULL),
  (17, NULL, NULL, 2.0, 1357.0, 1434.0, 77.0, 82.0, NULL, NULL),
  (18, 6.7, 7.0, 0.24, 1411.0, 1492.0, 81.0, 86.0, 42.8, 45.5),
  (19, 24.0, 25.2, 0.28, 1467.0, 1551.0, 86.0, 92.0, 45.2, 48.0),
  (20, 52.5, 55.0, 0.32, 1524.0, 1611.0, 91.0, 98.0, 47.6, 50.5),
  (21, 75.9, 79.6, 0.36, 1582.0, 1672.0, 96.0, 103.0, 49.1, 52.2),
  (22, 87.0, 91.2, 0.4, 1638.0, 1732.0, 101.0, 108.0, 50.6, 53.7),
  (23, 90.9, 95.1, 0.44, 1691.0, 1788.0, 104.0, 112.0, 51.9, 55.1),
  (24, 92.4, 97.0, 0.49, 1739.0, 1838.0, 107.0, 114.0, 53.1, 56.4),
  (25, 93.4, 98.1, 0.53, 1779.0, 1880.0, 108.0, 116.0, 54.2, 57.6),
  (26, 93.6, 98.5, 0.58, 1810.0, 1913.0, 109.0, 117.0, 55.2, 58.6),
  (27, 93.6, 98.4, 0.62, 1832.0, 1937.0, 110.0, 117.0, 56.1, 59.6),
  (28, 93.5, 98.4, 0.67, 1847.0, 1953.0, 110.0, 118.0, 56.8, 60.4),
  (29, 93.4, 98.3, 0.72, 1857.0, 1963.0, 110.0, 118.0, 57.5, 61.0),
  (30, 93.3, 98.2, 0.77, 1864.0, 1971.0, 110.0, 118.0, 58.0, 61.6),
  (31, 93.2, 98.1, 0.82, 1871.0, 1977.0, 110.0, 118.0, 58.5, 62.1),
  (32, 93.1, 98.1, 0.87, 1877.0, 1984.0, 110.0, 118.0, 58.9, 62.6),
  (33, 92.9, 98.0, 0.92, 1883.0, 1991.0, 110.0, 118.0, 59.3, 62.9),
  (34, 92.8, 97.9, 0.97, 1890.0, 1998.0, 110.0, 118.0, 59.5, 63.2),
  (35, 92.7, 97.8, 1.03, 1896.0, 2004.0, 110.0, 118.0, 59.7, 63.4),
  (36, 92.5, 97.7, 1.09, 1903.0, 2012.0, 110.0, 118.0, 59.9, 63.6),
  (37, 92.4, 97.6, 1.14, 1909.0, 2018.0, 110.0, 118.0, 60.0, 63.8),
  (38, 92.3, 97.5, 1.2, 1913.0, 2023.0, 110.0, 118.0, 60.1, 63.9),
  (39, 92.1, 97.3, 1.26, 1917.0, 2027.0, 110.0, 118.0, 60.2, 63.9),
  (40, 91.9, 97.2, 1.32, 1921.0, 2030.0, 110.0, 118.0, 60.2, 63.9),
  (41, 91.8, 97.1, 1.38, 1924.0, 2033.0, 110.0, 118.0, 60.2, 64.0),
  (42, 91.6, 96.9, 1.44, 1926.0, 2036.0, 110.0, 118.0, 60.3, 64.0),
  (43, 91.4, 96.8, 1.51, 1928.0, 2039.0, 110.0, 118.0, 60.3, 64.0),
  (44, 91.2, 96.6, 1.57, 1930.0, 2041.0, 110.0, 118.0, 60.3, 64.1),
  (45, 91.1, 96.5, 1.64, 1932.0, 2043.0, 110.0, 118.0, 60.4, 64.1),
  (46, 90.9, 96.3, 1.71, 1934.0, 2044.0, 110.0, 118.0, 60.4, 64.1),
  (47, 90.7, 96.1, 1.78, 1935.0, 2045.0, 110.0, 118.0, 60.4, 64.2),
  (48, 90.5, 96.0, 1.85, 1936.0, 2047.0, 110.0, 118.0, 60.5, 64.2),
  (49, 90.2, 95.8, 1.92, 1937.0, 2048.0, 110.0, 118.0, 60.5, 64.3),
  (50, 90.0, 95.6, 1.99, 1938.0, 2049.0, 110.0, 118.0, 60.5, 64.3),
  (51, 89.8, 95.4, 2.07, 1939.0, 2050.0, 110.0, 118.0, 60.6, 64.3),
  (52, 89.5, 95.2, 2.15, 1940.0, 2051.0, 110.0, 118.0, 60.6, 64.4),
  (53, 89.3, 94.9, 2.23, 1941.0, 2052.0, 110.0, 118.0, 60.6, 64.4),
  (54, 89.1, 94.7, 2.31, 1942.0, 2053.0, 110.0, 118.0, 60.7, 64.4),
  (55, 88.8, 94.5, 2.39, 1943.0, 2054.0, 110.0, 118.0, 60.7, 64.5),
  (56, 88.5, 94.2, 2.47, 1944.0, 2055.0, 110.0, 118.0, 60.7, 64.5),
  (57, 88.3, 94.0, 2.56, 1944.0, 2056.0, 110.0, 118.0, 60.8, 64.5),
  (58, 88.0, 93.7, 2.65, 1945.0, 2056.0, 110.0, 118.0, 60.8, 64.6),
  (59, 87.7, 93.5, 2.74, 1946.0, 2057.0, 110.0, 118.0, 60.8, 64.6),
  (60, 87.4, 93.2, 2.83, 1947.0, 2058.0, 110.0, 118.0, 60.9, 64.6),
  (61, 87.1, 92.9, 2.92, 1948.0, 2059.0, 110.0, 118.0, 60.9, 64.7),
  (62, 86.4, 92.4, 3.02, 1948.0, 2060.0, 110.0, 118.0, 60.9, 64.7),
  (63, 86.1, 92.1, 3.12, 1949.0, 2061.0, 110.0, 118.0, 61.0, 64.8),
  (64, 85.7, 91.8, 3.22, 1950.0, 2061.0, 110.0, 118.0, 61.0, 64.8),
  (65, 85.4, 91.5, 3.32, 1951.0, 2062.0, 110.0, 118.0, 61.0, 64.8),
  (66, 85.1, 91.2, 3.42, 1952.0, 2063.0, 110.0, 118.0, 61.1, 64.9),
  (67, 84.7, 90.8, 3.52, 1952.0, 2064.0, 110.0, 118.0, 61.1, 64.9),
  (68, 84.4, 90.5, 3.64, 1953.0, 2065.0, 110.0, 118.0, 61.1, 64.9),
  (69, 84.0, 90.2, 3.75, 1954.0, 2065.0, 110.0, 118.0, 61.2, 65.0),
  (70, 83.6, 89.8, 3.86, 1954.0, 2066.0, 110.0, 118.0, 61.2, 65.0),
  (71, 83.3, 89.5, 3.97, 1955.0, 2066.0, 110.0, 118.0, 61.2, 65.0),
  (72, 82.9, 89.1, 4.09, 1955.0, 2067.0, 110.0, 118.0, 61.3, 65.1),
  (73, 82.5, 88.8, 4.21, 1956.0, 2068.0, 110.0, 118.0, 61.3, 65.1),
  (74, 82.1, 88.4, 4.34, 1957.0, 2068.0, 110.0, 118.0, 61.3, 65.1),
  (75, 81.7, 88.1, 4.46, 1957.0, 2069.0, 110.0, 118.0, 61.4, 65.2),
  (76, 81.3, 87.7, 4.58, 1958.0, 2070.0, 110.0, 118.0, 61.4, 65.2),
  (77, 80.9, 87.3, 4.71, 1958.0, 2070.0, 110.0, 118.0, 61.4, 65.2),
  (78, 80.5, 86.9, 4.84, 1959.0, 2071.0, 110.0, 118.0, 61.5, 65.3),
  (79, 80.1, 86.5, 4.99, 1959.0, 2071.0, 110.0, 118.0, 61.5, 65.3),
  (80, 79.7, 86.1, 5.13, 1960.0, 2072.0, 110.0, 118.0, 61.5, 65.4),
  (81, 79.3, 85.7, 5.27, 1960.0, 2072.0, 110.0, 118.0, 61.6, 65.4),
  (82, 78.9, 85.3, 5.41, 1960.0, 2072.0, 110.0, 118.0, 61.6, 65.4),
  (83, 78.5, 84.9, 5.55, 1961.0, 2073.0, 110.0, 118.0, 61.6, 65.5),
  (84, 78.0, 84.5, 5.72, 1961.0, 2073.0, 110.0, 118.0, 61.7, 65.5),
  (85, 77.6, 84.1, 5.87, 1962.0, 2074.0, 110.0, 118.0, 61.7, 65.5),
  (86, 77.2, 83.7, 6.02, 1962.0, 2074.0, 110.0, 118.0, 61.7, 65.6),
  (87, 76.7, 83.3, 6.18, 1962.0, 2075.0, 110.0, 118.0, 61.8, 65.6),
  (88, 76.3, 82.8, 6.34, 1963.0, 2075.0, 110.0, 118.0, 61.8, 65.6),
  (89, 75.9, 82.4, 6.51, 1963.0, 2075.0, 110.0, 118.0, 61.8, 65.7),
  (90, 75.4, 82.0, 6.69, 1963.0, 2076.0, 110.0, 118.0, 61.9, 65.7),
  (91, 75.0, 81.6, 6.86, 1964.0, 2076.0, 110.0, 118.0, 61.9, 65.7),
  (92, 74.5, 81.1, 7.04, 1964.0, 2076.0, 110.0, 118.0, 61.9, 65.8),
  (93, 74.1, 80.7, 7.22, 1964.0, 2076.0, 110.0, 118.0, 62.0, 65.8),
  (94, 73.6, 80.2, 7.4, 1964.0, 2077.0, 110.0, 118.0, 62.0, 65.9),
  (95, 73.1, 79.8, 7.6, 1965.0, 2077.0, 110.0, 118.0, 62.0, 65.9),
  (96, 72.7, 79.4, 7.79, 1965.0, 2077.0, 110.0, 118.0, 62.1, 65.9),
  (97, 72.2, 78.9, 7.99, 1965.0, 2077.0, 110.0, 118.0, 62.1, 66.0),
  (98, 71.8, 78.5, 8.19, 1965.0, 2077.0, 110.0, 118.0, 62.1, 66.0),
  (99, 71.3, 78.0, 8.39, 1965.0, 2077.0, 110.0, 118.0, 62.2, 66.0),
  (100, 70.8, 77.6, 8.6, 1965.0, 2078.0, 110.0, 118.0, 62.2, 66.1)
) AS d(semana, postura_min, postura_max, mortalidad_acum_pct, peso_ave_min_g, peso_ave_max_g, consumo_min_g, consumo_max_g, peso_huevo_min_g, peso_huevo_max_g)
WHERE l.codigo = 'hy-line-brown' AND l.finca_id IS NULL;

INSERT INTO referencia_semanal (linea_id, semana, postura_min, postura_max, mortalidad_acum_pct, peso_ave_min_g, peso_ave_max_g, consumo_min_g, consumo_max_g, peso_huevo_min_g, peso_huevo_max_g)
SELECT l.id, d.* FROM lineas_referencia l, (VALUES
  (1, NULL, NULL, NULL, 73.0, 77.0, NULL, NULL, NULL, NULL),
  (2, NULL, NULL, NULL, 126.0, 134.0, NULL, NULL, NULL, NULL),
  (3, NULL, NULL, NULL, 189.0, 201.0, NULL, NULL, NULL, NULL),
  (4, NULL, NULL, NULL, 265.0, 281.0, NULL, NULL, NULL, NULL),
  (5, NULL, NULL, NULL, 355.0, 377.0, NULL, NULL, NULL, NULL),
  (6, NULL, NULL, NULL, 455.0, 483.0, NULL, NULL, NULL, NULL),
  (7, NULL, NULL, NULL, 556.0, 590.0, NULL, NULL, NULL, NULL),
  (8, NULL, NULL, NULL, 657.0, 697.0, NULL, NULL, NULL, NULL),
  (9, NULL, NULL, NULL, 754.0, 800.0, NULL, NULL, NULL, NULL),
  (10, NULL, NULL, NULL, 847.0, 899.0, NULL, NULL, NULL, NULL),
  (11, NULL, NULL, NULL, 934.0, 992.0, NULL, NULL, NULL, NULL),
  (12, NULL, NULL, NULL, 1016.0, 1078.0, NULL, NULL, NULL, NULL),
  (13, NULL, NULL, NULL, 1094.0, 1162.0, NULL, NULL, NULL, NULL),
  (14, NULL, NULL, NULL, 1169.0, 1241.0, NULL, NULL, NULL, NULL),
  (15, NULL, NULL, NULL, 1241.0, 1317.0, NULL, NULL, NULL, NULL),
  (16, NULL, NULL, NULL, 1310.0, 1392.0, NULL, NULL, NULL, NULL),
  (17, NULL, NULL, NULL, 1378.0, 1464.0, NULL, NULL, NULL, NULL),
  (18, NULL, NULL, NULL, 1448.0, 1538.0, NULL, NULL, NULL, NULL),
  (19, 9.0, 9.0, 0.0, 1518.0, 1612.0, 115.0, 125.0, 43.6, 43.6),
  (20, 36.4, 36.4, 0.27, 1586.0, 1684.0, 115.0, 125.0, 46.1, 46.1),
  (21, 54.4, 54.4, 0.27, 1650.0, 1752.0, 115.0, 125.0, 48.7, 48.7),
  (22, 71.9, 71.9, 0.28, 1707.0, 1813.0, 115.0, 125.0, 51.1, 51.1),
  (23, 82.3, 82.3, 0.28, 1754.0, 1862.0, 115.0, 125.0, 53.3, 53.3),
  (24, 87.9, 87.9, 0.34, 1791.0, 1901.0, 115.0, 125.0, 55.3, 55.3),
  (25, 91.1, 91.1, 0.44, 1818.0, 1930.0, 115.0, 125.0, 57.0, 57.0),
  (26, 92.9, 92.9, 0.44, 1836.0, 1950.0, 115.0, 125.0, 58.2, 58.2),
  (27, 94.0, 94.0, 0.53, 1849.0, 1963.0, 115.0, 125.0, 59.3, 59.3),
  (28, 94.6, 94.6, 0.63, 1857.0, 1971.0, 115.0, 125.0, 60.2, 60.2),
  (29, 94.9, 94.9, 0.63, 1860.0, 1976.0, 115.0, 125.0, 61.0, 61.0),
  (30, 95.1, 95.1, 0.63, 1863.0, 1979.0, 115.0, 125.0, 61.6, 61.6),
  (31, 95.3, 95.3, 0.73, 1866.0, 1982.0, 115.0, 125.0, 62.1, 62.1),
  (32, 95.4, 95.4, 0.73, 1868.0, 1984.0, 115.0, 125.0, 62.5, 62.5),
  (33, 95.5, 95.5, 0.84, 1871.0, 1987.0, 115.0, 125.0, 62.9, 62.9),
  (34, 95.5, 95.5, 0.94, 1874.0, 1990.0, 115.0, 125.0, 63.3, 63.3),
  (35, 95.4, 95.4, 0.94, 1876.0, 1992.0, 115.0, 125.0, 63.7, 63.7),
  (36, 95.3, 95.3, 1.05, 1878.0, 1994.0, 115.0, 125.0, 63.9, 63.9),
  (37, 95.1, 95.1, 1.05, 1881.0, 1997.0, 115.0, 125.0, 64.1, 64.1),
  (38, 94.9, 94.9, 1.16, 1883.0, 1999.0, 115.0, 125.0, 64.3, 64.3),
  (39, 94.8, 94.8, 1.27, 1886.0, 2002.0, 115.0, 125.0, 64.4, 64.4),
  (40, 94.6, 94.6, 1.37, 1888.0, 2004.0, 115.0, 125.0, 64.6, 64.6),
  (41, 94.4, 94.4, 1.38, 1891.0, 2007.0, 115.0, 125.0, 64.7, 64.7),
  (42, 94.2, 94.2, 1.49, 1893.0, 2011.0, 115.0, 125.0, 64.9, 64.9),
  (43, 94.0, 94.0, 1.49, 1895.0, 2013.0, 115.0, 125.0, 65.0, 65.0),
  (44, 93.8, 93.8, 1.6, 1897.0, 2015.0, 115.0, 125.0, 65.1, 65.1),
  (45, 93.5, 93.5, 1.71, 1900.0, 2018.0, 115.0, 125.0, 65.2, 65.2),
  (46, 93.2, 93.2, 1.72, 1902.0, 2020.0, 115.0, 125.0, 65.3, 65.3),
  (47, 92.9, 92.9, 1.83, 1905.0, 2023.0, 115.0, 125.0, 65.4, 65.4),
  (48, 92.6, 92.6, 1.94, 1907.0, 2025.0, 115.0, 125.0, 65.5, 65.5),
  (49, 92.3, 92.3, 2.06, 1910.0, 2028.0, 115.0, 125.0, 65.6, 65.6),
  (50, 92.0, 92.0, 2.17, 1913.0, 2031.0, 115.0, 125.0, 65.7, 65.7),
  (51, 91.7, 91.7, 2.29, 1915.0, 2033.0, 115.0, 125.0, 65.8, 65.8),
  (52, 91.3, 91.3, 2.3, 1917.0, 2035.0, 115.0, 125.0, 65.9, 65.9),
  (53, 91.0, 91.0, 2.42, 1920.0, 2038.0, 115.0, 125.0, 66.0, 66.0),
  (54, 90.6, 90.6, 2.54, 1922.0, 2040.0, 115.0, 125.0, 66.1, 66.1),
  (55, 90.3, 90.3, 2.66, 1925.0, 2045.0, 115.0, 125.0, 66.1, 66.1),
  (56, 89.9, 89.9, 2.67, 1926.0, 2046.0, 115.0, 125.0, 66.2, 66.2),
  (57, 89.5, 89.5, 2.79, 1930.0, 2050.0, 115.0, 125.0, 66.2, 66.2),
  (58, 89.2, 89.2, 2.91, 1932.0, 2052.0, 115.0, 125.0, 66.3, 66.3),
  (59, 88.8, 88.8, 3.04, 1934.0, 2054.0, 115.0, 125.0, 66.3, 66.3),
  (60, 88.4, 88.4, 3.17, 1936.0, 2056.0, 115.0, 125.0, 66.4, 66.4),
  (61, 88.1, 88.1, 3.29, 1939.0, 2059.0, 115.0, 125.0, 66.4, 66.4),
  (62, 87.7, 87.7, 3.42, 1941.0, 2061.0, 115.0, 125.0, 66.5, 66.5),
  (63, 87.3, 87.3, 3.55, 1944.0, 2064.0, 115.0, 125.0, 66.6, 66.6),
  (64, 86.9, 86.9, 3.57, 1946.0, 2066.0, 115.0, 125.0, 66.6, 66.6),
  (65, 86.5, 86.5, 3.7, 1949.0, 2069.0, 115.0, 125.0, 66.7, 66.7),
  (66, 86.1, 86.1, 3.83, 1952.0, 2072.0, 115.0, 125.0, 66.8, 66.8),
  (67, 85.7, 85.7, 3.97, 1954.0, 2074.0, 115.0, 125.0, 66.8, 66.8),
  (68, 85.3, 85.3, 4.1, 1956.0, 2076.0, 115.0, 125.0, 66.9, 66.9),
  (69, 84.9, 84.9, 4.24, 1958.0, 2080.0, 115.0, 125.0, 66.9, 66.9),
  (70, 84.4, 84.4, 4.38, 1960.0, 2082.0, 115.0, 125.0, 67.0, 67.0),
  (71, 83.9, 83.9, 4.41, 1963.0, 2085.0, 115.0, 125.0, 67.0, 67.0),
  (72, 83.4, 83.4, 4.56, 1965.0, 2087.0, 115.0, 125.0, 67.1, 67.1),
  (73, 82.9, 82.9, 4.7, 1968.0, 2090.0, 115.0, 125.0, 67.1, 67.1),
  (74, 82.4, 82.4, 4.85, 1971.0, 2093.0, 115.0, 125.0, 67.2, 67.2),
  (75, 81.9, 81.9, 5.13, 1973.0, 2095.0, 115.0, 125.0, 67.2, 67.2),
  (76, 81.3, 81.3, 5.17, 1975.0, 2097.0, 115.0, 125.0, 67.3, 67.3),
  (77, 80.8, 80.8, 5.32, 1978.0, 2100.0, 115.0, 125.0, 67.3, 67.3),
  (78, 80.3, 80.3, 5.48, 1980.0, 2102.0, 115.0, 125.0, 67.4, 67.4),
  (79, 79.7, 79.7, 5.65, 1983.0, 2105.0, 115.0, 125.0, 67.4, 67.4),
  (80, 79.2, 79.2, 5.81, 1985.0, 2107.0, 115.0, 125.0, 67.5, 67.5),
  (81, 78.6, 78.6, 5.98, 1986.0, 2108.0, 115.0, 125.0, 67.5, 67.5),
  (82, 78.0, 78.0, 6.03, 1987.0, 2109.0, 115.0, 125.0, 67.6, 67.6),
  (83, 77.4, 77.4, 6.2, 1988.0, 2110.0, 115.0, 125.0, 67.6, 67.6),
  (84, 76.8, 76.8, 6.38, 1989.0, 2112.0, 115.0, 125.0, 67.6, 67.6),
  (85, 76.3, 76.3, 6.55, 1989.0, 2113.0, 115.0, 125.0, 67.7, 67.7),
  (86, 75.7, 75.7, 6.74, 1990.0, 2114.0, 115.0, 125.0, 67.7, 67.7),
  (87, 75.0, 75.0, 6.8, 1991.0, 2115.0, 115.0, 125.0, 67.8, 67.8),
  (88, 74.4, 74.4, 6.99, 1992.0, 2116.0, 115.0, 125.0, 67.8, 67.8),
  (89, 73.8, 73.8, 7.18, 1992.0, 2116.0, 115.0, 125.0, 67.8, 67.8),
  (90, 73.2, 73.2, 7.38, 1993.0, 2117.0, 115.0, 125.0, 67.9, 67.9),
  (91, 72.5, 72.5, 7.45, 1994.0, 2118.0, 115.0, 125.0, 67.9, 67.9),
  (92, 71.9, 71.9, 7.65, 1994.0, 2118.0, 115.0, 125.0, 67.9, 67.9),
  (93, 71.2, 71.2, 7.72, 1995.0, 2119.0, 115.0, 125.0, 68.0, 68.0),
  (94, 70.6, 70.6, 8.07, 1995.0, 2119.0, 115.0, 125.0, 68.0, 68.0),
  (95, 69.9, 69.9, 8.15, 1996.0, 2120.0, 115.0, 125.0, 68.0, 68.0),
  (96, 69.3, 69.3, 8.37, 1997.0, 2121.0, 115.0, 125.0, 68.1, 68.1),
  (97, 68.6, 68.6, 8.6, 1997.0, 2121.0, 115.0, 125.0, 68.1, 68.1),
  (98, 67.9, 67.9, 8.69, 1998.0, 2122.0, 115.0, 125.0, 68.1, 68.1),
  (99, 67.2, 67.2, 8.93, 1998.0, 2122.0, 115.0, 125.0, 68.1, 68.1),
  (100, 66.5, 66.5, 9.17, 1999.0, 2123.0, 115.0, 125.0, 68.1, 68.1)
) AS d(semana, postura_min, postura_max, mortalidad_acum_pct, peso_ave_min_g, peso_ave_max_g, consumo_min_g, consumo_max_g, peso_huevo_min_g, peso_huevo_max_g)
WHERE l.codigo = 'lohmann-brown-classic' AND l.finca_id IS NULL;

-- Los lotes que ya existen toman la referencia de su línea cuando la hay
UPDATE lotes_aves SET referencia_id = (SELECT id FROM lineas_referencia WHERE codigo = 'hy-line-brown' AND finca_id IS NULL)
 WHERE referencia_id IS NULL AND lower(trim(linea_genetica)) = 'hy-line brown';
UPDATE lotes_aves SET referencia_id = (SELECT id FROM lineas_referencia WHERE codigo = 'lohmann-brown-classic' AND finca_id IS NULL)
 WHERE referencia_id IS NULL AND lower(trim(linea_genetica)) LIKE 'lohmann brown%';

-- Copia de una referencia para la finca: se ajusta sin tocar la guía oficial
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
  RETURN nueva;
END;
$$;
