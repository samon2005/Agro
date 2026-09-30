-- ============================================================
-- Alimento de cerdos y pollo: entradas e inventario, como en ponedoras
-- ============================================================
-- Hasta ahora solo las ponedoras registraban las entradas de alimento y tenían
-- stock. Cerdos y pollo llevaban el consumo pero no lo que entraba, así que
-- nunca se sabía cuánto quedaba en bodega.

CREATE TABLE IF NOT EXISTS entradas_alimento_lote (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id           uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  especie            text NOT NULL CHECK (especie IN ('cerdos', 'pollo_engorde')),
  -- Apunta a tipos_alimento_cerdos o tipos_alimento_pollo según la especie
  tipo_alimento_id   uuid NOT NULL,
  lote_id            uuid,
  fecha              date NOT NULL DEFAULT CURRENT_DATE,
  cantidad_bultos    numeric(10,2) NOT NULL CHECK (cantidad_bultos > 0),
  precio_bulto       numeric(12,2),
  proveedor          text,
  fecha_vencimiento  date,
  observaciones      text,
  registrado_por     uuid REFERENCES profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE entradas_alimento_lote ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD entradas_alimento_lote" ON entradas_alimento_lote;
CREATE POLICY "Miembros CRUD entradas_alimento_lote" ON entradas_alimento_lote FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_entradas_alimento_lote_tipo ON entradas_alimento_lote(tipo_alimento_id, fecha DESC);

-- El ítem de inventario se amarra al alimento por su id, igual que en aves
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS tipo_alimento_cerdos_id uuid REFERENCES tipos_alimento_cerdos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_alimento_pollo_id uuid REFERENCES tipos_alimento_pollo(id) ON DELETE SET NULL;

-- ---- Stock de cerdos: entradas menos lo consumido día a día ----
CREATE OR REPLACE FUNCTION recalcular_stock_alimento_cerdos(p_finca uuid)
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
  SELECT id INTO cat_id FROM inventario_categorias
   WHERE finca_id = p_finca AND nombre ILIKE 'alimento' LIMIT 1;

  FOR r IN
    WITH tramos AS (
      SELECT n.tipo_alimento_id, n.alimento_kg, n.fecha,
             LEAD(n.fecha) OVER (PARTITION BY n.lote_id ORDER BY n.fecha) AS siguiente,
             l.estado
        FROM nutricion_diaria_cerdos n
        JOIN lotes_cerdos l ON l.id = n.lote_id
       WHERE l.finca_id = p_finca AND n.alimento_kg > 0 AND n.tipo_alimento_id IS NOT NULL
    ),
    consumo AS (
      SELECT tipo_alimento_id,
             SUM(alimento_kg * GREATEST(0,
               COALESCE(siguiente, CASE WHEN estado = 'activo' THEN hoy + 1 ELSE fecha + 1 END) - fecha)) AS kg
        FROM tramos GROUP BY tipo_alimento_id
    ),
    entradas AS (
      SELECT tipo_alimento_id, SUM(cantidad_bultos) AS bultos
        FROM entradas_alimento_lote
       WHERE finca_id = p_finca AND especie = 'cerdos'
       GROUP BY tipo_alimento_id
    )
    SELECT t.id, t.nombre,
           COALESCE(NULLIF(t.peso_bulto_kg, 0), 40) AS peso_bulto,
           COALESCE(en.bultos, 0) AS bultos_entrados,
           COALESCE(co.kg, 0) AS kg_consumidos
      FROM tipos_alimento_cerdos t
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
         AND (tipo_alimento_cerdos_id = r.id OR (tipo_alimento_cerdos_id IS NULL AND tipo_alimento_aves_id IS NULL AND nombre = r.nombre))
       LIMIT 1;

      IF item_id IS NULL THEN
        IF r.bultos_entrados = 0 THEN CONTINUE; END IF;
        INSERT INTO inventario (finca_id, categoria_id, tipo_alimento_cerdos_id, nombre, unidad_medida, cantidad_actual, cantidad_minima)
        VALUES (p_finca, cat_id, r.id, r.nombre, 'bultos', GREATEST(0, stock), 0);
      ELSE
        UPDATE inventario
           SET cantidad_actual = GREATEST(0, stock),
               tipo_alimento_cerdos_id = r.id,
               unidad_medida = 'bultos'
         WHERE id = item_id;
      END IF;
      tocados := tocados + 1;
    END;
  END LOOP;

  RETURN tocados;
END;
$$;

GRANT EXECUTE ON FUNCTION recalcular_stock_alimento_cerdos(uuid) TO authenticated;

-- ---- Stock de pollo ----
CREATE OR REPLACE FUNCTION recalcular_stock_alimento_pollo(p_finca uuid)
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
  SELECT id INTO cat_id FROM inventario_categorias
   WHERE finca_id = p_finca AND nombre ILIKE 'alimento' LIMIT 1;

  FOR r IN
    WITH tramos AS (
      SELECT pr.tipo_alimento_id, pr.alimento_kg, pr.fecha,
             LEAD(pr.fecha) OVER (PARTITION BY pr.lote_id ORDER BY pr.fecha) AS siguiente,
             l.estado
        FROM produccion_diaria_pollo pr
        JOIN lotes_pollo l ON l.id = pr.lote_id
       WHERE l.finca_id = p_finca AND pr.alimento_kg > 0 AND pr.tipo_alimento_id IS NOT NULL
    ),
    consumo AS (
      SELECT tipo_alimento_id,
             SUM(alimento_kg * GREATEST(0,
               COALESCE(siguiente, CASE WHEN estado = 'activo' THEN hoy + 1 ELSE fecha + 1 END) - fecha)) AS kg
        FROM tramos GROUP BY tipo_alimento_id
    ),
    entradas AS (
      SELECT tipo_alimento_id, SUM(cantidad_bultos) AS bultos
        FROM entradas_alimento_lote
       WHERE finca_id = p_finca AND especie = 'pollo_engorde'
       GROUP BY tipo_alimento_id
    )
    SELECT t.id, t.nombre,
           COALESCE(NULLIF(t.peso_bulto_kg, 0), 40) AS peso_bulto,
           COALESCE(en.bultos, 0) AS bultos_entrados,
           COALESCE(co.kg, 0) AS kg_consumidos
      FROM tipos_alimento_pollo t
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
         AND (tipo_alimento_pollo_id = r.id OR (tipo_alimento_pollo_id IS NULL AND tipo_alimento_aves_id IS NULL AND tipo_alimento_cerdos_id IS NULL AND nombre = r.nombre))
       LIMIT 1;

      IF item_id IS NULL THEN
        IF r.bultos_entrados = 0 THEN CONTINUE; END IF;
        INSERT INTO inventario (finca_id, categoria_id, tipo_alimento_pollo_id, nombre, unidad_medida, cantidad_actual, cantidad_minima)
        VALUES (p_finca, cat_id, r.id, r.nombre, 'bultos', GREATEST(0, stock), 0);
      ELSE
        UPDATE inventario
           SET cantidad_actual = GREATEST(0, stock),
               tipo_alimento_pollo_id = r.id,
               unidad_medida = 'bultos'
         WHERE id = item_id;
      END IF;
      tocados := tocados + 1;
    END;
  END LOOP;

  RETURN tocados;
END;
$$;

GRANT EXECUTE ON FUNCTION recalcular_stock_alimento_pollo(uuid) TO authenticated;

-- ---- Lo que hay de cada alimento de cerdos y pollo ----
CREATE OR REPLACE VIEW stock_alimento_lote AS
WITH tramos_cerdos AS (
  SELECT 'cerdos'::text AS especie, l.finca_id, n.tipo_alimento_id, n.alimento_kg, n.fecha,
         LEAD(n.fecha) OVER (PARTITION BY n.lote_id ORDER BY n.fecha) AS siguiente, l.estado
    FROM nutricion_diaria_cerdos n
    JOIN lotes_cerdos l ON l.id = n.lote_id
   WHERE n.alimento_kg > 0 AND n.tipo_alimento_id IS NOT NULL
),
tramos_pollo AS (
  SELECT 'pollo_engorde'::text AS especie, l.finca_id, pr.tipo_alimento_id, pr.alimento_kg, pr.fecha,
         LEAD(pr.fecha) OVER (PARTITION BY pr.lote_id ORDER BY pr.fecha) AS siguiente, l.estado
    FROM produccion_diaria_pollo pr
    JOIN lotes_pollo l ON l.id = pr.lote_id
   WHERE pr.alimento_kg > 0 AND pr.tipo_alimento_id IS NOT NULL
),
tramos AS (
  SELECT * FROM tramos_cerdos UNION ALL SELECT * FROM tramos_pollo
),
consumo AS (
  SELECT especie, tipo_alimento_id,
         SUM(alimento_kg * GREATEST(0,
           COALESCE(siguiente, CASE WHEN estado = 'activo'
                                    THEN ((now() AT TIME ZONE 'America/Bogota')::date) + 1
                                    ELSE fecha + 1 END) - fecha)) AS kg
    FROM tramos GROUP BY especie, tipo_alimento_id
),
entradas AS (
  SELECT especie, tipo_alimento_id, SUM(cantidad_bultos) AS bultos, MAX(fecha) AS ultima_entrada
    FROM entradas_alimento_lote GROUP BY especie, tipo_alimento_id
),
tipos AS (
  SELECT 'cerdos'::text AS especie, id, finca_id, nombre, peso_bulto_kg FROM tipos_alimento_cerdos
  UNION ALL
  SELECT 'pollo_engorde'::text, id, finca_id, nombre, peso_bulto_kg FROM tipos_alimento_pollo
)
SELECT t.id AS tipo_alimento_id,
       t.especie,
       t.finca_id,
       t.nombre,
       COALESCE(NULLIF(t.peso_bulto_kg, 0), 40) AS peso_bulto_kg,
       COALESCE(en.bultos, 0) AS bultos_entrados,
       COALESCE(co.kg, 0) AS kg_consumidos,
       round(COALESCE(co.kg, 0) / COALESCE(NULLIF(t.peso_bulto_kg, 0), 40), 2) AS bultos_consumidos,
       round(COALESCE(en.bultos, 0) - COALESCE(co.kg, 0) / COALESCE(NULLIF(t.peso_bulto_kg, 0), 40), 2) AS bultos_disponibles,
       en.ultima_entrada
  FROM tipos t
  LEFT JOIN entradas en ON en.tipo_alimento_id = t.id AND en.especie = t.especie
  LEFT JOIN consumo  co ON co.tipo_alimento_id = t.id AND co.especie = t.especie;

ALTER VIEW stock_alimento_lote SET (security_invoker = on);
GRANT SELECT ON stock_alimento_lote TO authenticated;
