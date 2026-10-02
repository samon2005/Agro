-- ============================================================
-- Una sola especie por finca
-- ============================================================
-- Una finca produce una sola especie: aves ponedoras, cerdos o pollo de engorde.
-- Antes el formulario dejaba marcar varias y algunas fincas quedaron así. Cada
-- una se queda con la especie de la que tiene animales (sin contar los lotes de
-- prueba). La que no tiene animales queda sin especie y su dueño la elige al
-- entrar. No se borra nada: lo de otras especies solo deja de mostrarse.

WITH conteo AS (
  SELECT f.id, f.tipo_produccion,
    (SELECT count(*) FROM lotes_aves   l WHERE l.finca_id = f.id AND l.nombre NOT ILIKE '%prueba%') AS aves_r,
    (SELECT count(*) FROM lotes_cerdos l WHERE l.finca_id = f.id AND l.nombre NOT ILIKE '%prueba%') AS cerdos_r,
    (SELECT count(*) FROM lotes_pollo  l WHERE l.finca_id = f.id AND l.nombre NOT ILIKE '%prueba%') AS pollo_r,
    (SELECT count(*) FROM lotes_aves   l WHERE l.finca_id = f.id) AS aves_t,
    (SELECT count(*) FROM lotes_cerdos l WHERE l.finca_id = f.id) AS cerdos_t,
    (SELECT count(*) FROM lotes_pollo  l WHERE l.finca_id = f.id) AS pollo_t
  FROM fincas f
),
decision AS (
  SELECT id,
    CASE
      WHEN coalesce(array_length(tipo_produccion, 1), 0) = 1 THEN tipo_produccion[1]
      WHEN aves_r + cerdos_r + pollo_r > 0 THEN
        (ARRAY['aves_ponedoras', 'cerdos', 'pollo_engorde'])[
          (SELECT i FROM (VALUES (1, aves_r), (2, cerdos_r), (3, pollo_r)) v(i, n) ORDER BY n DESC, i LIMIT 1)]
      WHEN aves_t + cerdos_t + pollo_t > 0 THEN
        (ARRAY['aves_ponedoras', 'cerdos', 'pollo_engorde'])[
          (SELECT i FROM (VALUES (1, aves_t), (2, cerdos_t), (3, pollo_t)) v(i, n) ORDER BY n DESC, i LIMIT 1)]
      ELSE NULL
    END AS especie
  FROM conteo
)
UPDATE fincas f
   SET tipo_produccion = CASE WHEN d.especie IS NULL THEN NULL ELSE ARRAY[d.especie] END
  FROM decision d
 WHERE d.id = f.id;

-- De aquí en adelante la base no acepta una finca con dos especies
ALTER TABLE fincas DROP CONSTRAINT IF EXISTS fincas_una_especie;
ALTER TABLE fincas ADD CONSTRAINT fincas_una_especie CHECK (
  tipo_produccion IS NULL
  OR (array_length(tipo_produccion, 1) = 1
      AND tipo_produccion[1] IN ('aves_ponedoras', 'cerdos', 'pollo_engorde'))
);
