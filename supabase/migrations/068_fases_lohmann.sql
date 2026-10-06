-- Fases de alimentación de Lohmann Brown-Classic (Management Guide, Cage Housing):
-- en levante Grower semanas 1–8 (Starter solo si no se alcanza el peso),
-- Developer 9–17 y Pre-Layer hacia la semana 18 (unos 10 días, máximo 1 kg por
-- ave); en postura la guía define las fases por edad y masa de huevo: fase 1
-- semana 19 a ~50, fase 2 ~50 a 70, fase 3 después de la 70.
--
-- Por eso una fase de postura también puede ir por semanas (además de por % de
-- postura o puntos bajo el pico, como las de Hy-Line).

ALTER TABLE fases_alimento DROP CONSTRAINT IF EXISTS fases_alimento_check2;
ALTER TABLE fases_alimento DROP CONSTRAINT IF EXISTS fases_alimento_postura_criterio;
ALTER TABLE fases_alimento ADD CONSTRAINT fases_alimento_postura_criterio
  CHECK (categoria <> 'postura' OR postura_min IS NOT NULL OR bajo_pico IS NOT NULL OR desde_semana IS NOT NULL);

INSERT INTO fases_alimento (linea_id, orden, nombre, categoria, desde_semana, hasta_semana, peso_cambio_g, postura_min, bajo_pico, notas)
SELECT l.id, f.* FROM lineas_referencia l, (VALUES
  (1, 'Crecimiento (Grower)', 'crecimiento', 1, 8, 657.0, NULL::numeric, NULL::numeric,
   'Starter solo si con Grower no se alcanza el peso. Se pasa a Developer al llegar al peso de la semana 8 (657–697 g): la guía cambia por peso, no por edad.'),
  (2, 'Desarrollo (Developer)', 'desarrollo', 9, 17, NULL, NULL, NULL,
   'Menor densidad de nutrientes y más fibra (5–6 %) para desarrollar la capacidad de consumo.'),
  (3, 'Pre-postura (Pre-Layer)', 'prepostura', 18, 18, NULL, NULL, NULL,
   'Unos 10 días antes de la postura, máximo 1 kg por ave; no empezarlo antes de tiempo ni alargarlo. Doble calcio que el Developer.'),
  (4, 'Postura fase 1', 'postura', 19, 50, NULL, NULL, NULL,
   'Desde el inicio de postura hasta cerca de la semana 50, con masa de huevo sobre 59 g/ave/día. Las primeras 5–6 semanas, un alimento de inicio más concentrado (11,6 MJ/kg).'),
  (5, 'Postura fase 2', 'postura', 51, 70, NULL, NULL, NULL,
   'Cerca de las semanas 50 a 70, con masa de huevo sobre 55 g/ave/día. El cambio va más por producción y calcio que por edad.'),
  (6, 'Postura fase 3', 'postura', 71, 120, NULL, NULL, NULL,
   'Después de la semana 70: más calcio para la cáscara.')
) AS f(orden, nombre, categoria, desde_semana, hasta_semana, peso_cambio_g, postura_min, bajo_pico, notas)
WHERE l.codigo = 'lohmann-brown-classic' AND l.finca_id IS NULL
ON CONFLICT (linea_id, orden) DO NOTHING;
