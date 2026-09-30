-- ============================================================
-- MÓDULO: Alimento de aves — el stock se calcula, no se va restando
-- ============================================================
-- Antes el inventario se descontaba día a día con el consumo estimado y una
-- marca de "hasta dónde ya descontamos". Eso se desajusta apenas se edita o se
-- borra un día, y descuenta de más cuando el galpón comió menos.
--
-- Ahora el stock de cada alimento es una cuenta que se rehace sola:
--     bultos que entraron  −  kg consumidos ÷ kg por bulto
-- El consumo sale del registro diario: cada día rige el último consumo
-- registrado hasta que se registre otro. Así, borrar o corregir un día corrige
-- el stock solo, y nunca se descuenta dos veces.

-- El ítem de inventario queda amarrado al tipo de alimento por su id: antes se
-- casaban por nombre y al renombrar el alimento se perdía el stock.
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS tipo_alimento_aves_id uuid REFERENCES tipos_alimento_aves(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventario_tipo_alimento_aves ON inventario(tipo_alimento_aves_id);

-- Se amarran los ítems que ya existen con el alimento que lleva su mismo nombre
UPDATE inventario i
   SET tipo_alimento_aves_id = t.id
  FROM tipos_alimento_aves t
 WHERE i.tipo_alimento_aves_id IS NULL
   AND t.finca_id = i.finca_id
   AND t.nombre = i.nombre;

-- Ya no hace falta la marca de hasta dónde se descontó
ALTER TABLE lotes_aves DROP COLUMN IF EXISTS consumo_descontado_hasta;

DROP FUNCTION IF EXISTS aplicar_consumo_alimento_aves(uuid);

-- ---- Rehace el stock de todos los alimentos de la finca ----
CREATE OR REPLACE FUNCTION recalcular_stock_alimento_aves(p_finca uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  hoy date := (now() AT TIME ZONE 'America/Bogota')::date;
  cat_id uuid;
  r record;
  tocados integer := 0;
BEGIN
  -- Los alimentos viven en la categoría Alimento del inventario de la finca
  SELECT id INTO cat_id FROM inventario_categorias
   WHERE finca_id = p_finca AND nombre ILIKE 'alimento' LIMIT 1;

  FOR r IN
    WITH tramos AS (
      -- Cada registro con alimento abre un tramo que rige hasta el siguiente
      SELECT p.tipo_alimento_id,
             p.alimento_kg,
             p.fecha,
             LEAD(p.fecha) OVER (PARTITION BY p.lote_id ORDER BY p.fecha) AS siguiente,
             l.estado
        FROM produccion_diaria_aves p
        JOIN lotes_aves l ON l.id = p.lote_id
       WHERE l.finca_id = p_finca
         AND p.alimento_kg > 0
         AND p.tipo_alimento_id IS NOT NULL
    ),
    consumo AS (
      SELECT tipo_alimento_id,
             SUM(alimento_kg * GREATEST(0,
               COALESCE(siguiente,
                        CASE WHEN estado IN ('activo', 'preparacion') THEN hoy + 1 ELSE fecha + 1 END
               ) - fecha)) AS kg
        FROM tramos
       GROUP BY tipo_alimento_id
    ),
    entradas AS (
      SELECT e.tipo_alimento_id, SUM(e.cantidad_bultos) AS bultos
        FROM entradas_alimento_aves e
        JOIN tipos_alimento_aves t ON t.id = e.tipo_alimento_id
       WHERE t.finca_id = p_finca
       GROUP BY e.tipo_alimento_id
    )
    SELECT t.id,
           t.nombre,
           COALESCE(NULLIF(t.peso_bulto_kg, 0), 40) AS peso_bulto,
           COALESCE(en.bultos, 0) AS bultos_entrados,
           COALESCE(co.kg, 0) AS kg_consumidos
      FROM tipos_alimento_aves t
      LEFT JOIN entradas en ON en.tipo_alimento_id = t.id
      LEFT JOIN consumo  co ON co.tipo_alimento_id = t.id
     WHERE t.finca_id = p_finca
  LOOP
    DECLARE
      stock numeric := round(r.bultos_entrados - (r.kg_consumidos / r.peso_bulto), 2);
      item_id uuid;
    BEGIN
      SELECT id INTO item_id FROM inventario
       WHERE finca_id = p_finca
         AND (tipo_alimento_aves_id = r.id OR (tipo_alimento_aves_id IS NULL AND nombre = r.nombre))
       LIMIT 1;

      IF item_id IS NULL THEN
        -- Sin entradas nunca hubo stock: no se crea un ítem vacío
        IF r.bultos_entrados = 0 THEN
          CONTINUE;
        END IF;
        INSERT INTO inventario (finca_id, categoria_id, tipo_alimento_aves_id, nombre, unidad_medida, cantidad_actual, cantidad_minima)
        VALUES (p_finca, cat_id, r.id, r.nombre, 'bultos', GREATEST(0, stock), 0);
      ELSE
        UPDATE inventario
           SET cantidad_actual = GREATEST(0, stock),
               tipo_alimento_aves_id = r.id,
               nombre = r.nombre,
               unidad_medida = 'bultos'
         WHERE id = item_id;
      END IF;

      tocados := tocados + 1;
    END;
  END LOOP;

  RETURN tocados;
END;
$$;

GRANT EXECUTE ON FUNCTION recalcular_stock_alimento_aves(uuid) TO authenticated;

-- ---- Lo que cada alimento tiene y consume hoy ----
-- Sirve para mostrar el stock por galpón y en el inventario sin rehacer la
-- cuenta en cada pantalla.
CREATE OR REPLACE VIEW stock_alimento_aves AS
WITH tramos AS (
  SELECT l.finca_id,
         p.tipo_alimento_id,
         p.alimento_kg,
         p.fecha,
         LEAD(p.fecha) OVER (PARTITION BY p.lote_id ORDER BY p.fecha) AS siguiente,
         l.estado
    FROM produccion_diaria_aves p
    JOIN lotes_aves l ON l.id = p.lote_id
   WHERE p.alimento_kg > 0
     AND p.tipo_alimento_id IS NOT NULL
),
consumo AS (
  SELECT tipo_alimento_id,
         SUM(alimento_kg * GREATEST(0,
           COALESCE(siguiente,
                    CASE WHEN estado IN ('activo', 'preparacion')
                         THEN ((now() AT TIME ZONE 'America/Bogota')::date) + 1
                         ELSE fecha + 1 END
           ) - fecha)) AS kg
    FROM tramos
   GROUP BY tipo_alimento_id
),
entradas AS (
  SELECT tipo_alimento_id, SUM(cantidad_bultos) AS bultos, MAX(fecha) AS ultima_entrada
    FROM entradas_alimento_aves
   GROUP BY tipo_alimento_id
)
SELECT t.id                                             AS tipo_alimento_id,
       t.finca_id,
       t.nombre,
       COALESCE(NULLIF(t.peso_bulto_kg, 0), 40)         AS peso_bulto_kg,
       COALESCE(en.bultos, 0)                           AS bultos_entrados,
       COALESCE(co.kg, 0)                               AS kg_consumidos,
       round(COALESCE(co.kg, 0) / COALESCE(NULLIF(t.peso_bulto_kg, 0), 40), 2) AS bultos_consumidos,
       round(COALESCE(en.bultos, 0) - COALESCE(co.kg, 0) / COALESCE(NULLIF(t.peso_bulto_kg, 0), 40), 2) AS bultos_disponibles,
       en.ultima_entrada,
       EXISTS (SELECT 1 FROM lotes_aves l
                WHERE l.alimento_activo_id = t.id
                  AND l.estado IN ('activo', 'preparacion'))  AS activo_en_algun_lote
  FROM tipos_alimento_aves t
  LEFT JOIN entradas en ON en.tipo_alimento_id = t.id
  LEFT JOIN consumo  co ON co.tipo_alimento_id = t.id;

-- La vista consulta con los permisos de quien la usa, no con los del dueño:
-- así cada finca solo ve lo suyo, igual que en las tablas.
ALTER VIEW stock_alimento_aves SET (security_invoker = on);

GRANT SELECT ON stock_alimento_aves TO authenticated;
