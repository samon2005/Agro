-- Por ahora una finca puede producir más de una especie (decisión del 11 nov
-- 2026, para la prueba de José en Jericó: por si la finca tiene cerdos y aves).
-- Revisar si se queda. Para volver a una sola especie, restaurar la regla de
-- 051_una_especie_por_finca.sql (array_length = 1) después de revisar que
-- ninguna finca quedó con dos.
--
-- La regla nueva: de 1 a 3 especies, todas válidas. (Que no se repitan lo
-- garantiza la app: una regla CHECK no puede usar subconsultas.)
ALTER TABLE fincas DROP CONSTRAINT IF EXISTS fincas_una_especie;
ALTER TABLE fincas ADD CONSTRAINT fincas_una_especie CHECK (
  tipo_produccion IS NULL
  OR (array_length(tipo_produccion, 1) BETWEEN 1 AND 3
      AND tipo_produccion <@ ARRAY['aves_ponedoras', 'cerdos', 'pollo_engorde']::text[])
);
