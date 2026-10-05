-- El huevo se vende por la finca, no por galpón: la venta y el encargo ya no
-- dicen de qué galpón sale (las de antes lo conservan) y el inventario lleva un
-- solo saldo de huevo para toda la finca. En "Huevos de la finca" se sigue
-- viendo cuánto pone cada galpón.
--
-- Más los clientes: con su propio precio (o contrato) y su historial.

ALTER TABLE ventas_huevos_aves ALTER COLUMN lote_id DROP NOT NULL;
ALTER TABLE encargos_huevos_aves ALTER COLUMN lote_id DROP NOT NULL;

-- ── Clientes ──
CREATE TABLE IF NOT EXISTS clientes_huevos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id         uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre           text NOT NULL CHECK (length(trim(nombre)) > 0),
  telefono         text,
  -- Precio propio por tamaño; vacío = el de la finca
  precio_b         numeric(12,2) CHECK (precio_b IS NULL OR precio_b >= 0),
  precio_a         numeric(12,2) CHECK (precio_a IS NULL OR precio_a >= 0),
  precio_aa        numeric(12,2) CHECK (precio_aa IS NULL OR precio_aa >= 0),
  precio_aaa       numeric(12,2) CHECK (precio_aaa IS NULL OR precio_aaa >= 0),
  precio_jumbo     numeric(12,2) CHECK (precio_jumbo IS NULL OR precio_jumbo >= 0),
  -- Contrato: precio pactado por un tiempo y lo que se compromete a llevar
  contrato         boolean NOT NULL DEFAULT false,
  contrato_desde   date,
  contrato_hasta   date,
  huevos_semana    integer CHECK (huevos_semana IS NULL OR huevos_semana > 0),
  notas            text,
  activo           boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  CHECK (contrato_desde IS NULL OR contrato_hasta IS NULL OR contrato_desde <= contrato_hasta)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_huevos_nombre ON clientes_huevos (finca_id, lower(trim(nombre)));

ALTER TABLE clientes_huevos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clientes_huevos_miembros ON clientes_huevos;
CREATE POLICY clientes_huevos_miembros ON clientes_huevos FOR ALL TO authenticated
  USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));

ALTER TABLE ventas_huevos_aves ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes_huevos(id) ON DELETE SET NULL;
ALTER TABLE encargos_huevos_aves ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes_huevos(id) ON DELETE SET NULL;

-- Los clientes que ya aparecen en ventas o encargos pasan al directorio
INSERT INTO clientes_huevos (finca_id, nombre)
SELECT DISTINCT ON (finca_id, lower(trim(cliente))) finca_id, trim(cliente)
  FROM (SELECT finca_id, cliente FROM ventas_huevos_aves UNION ALL SELECT finca_id, cliente FROM encargos_huevos_aves) x
 WHERE cliente IS NOT NULL AND length(trim(cliente)) > 0
ON CONFLICT DO NOTHING;

UPDATE ventas_huevos_aves v SET cliente_id = c.id
  FROM clientes_huevos c
 WHERE v.cliente_id IS NULL AND c.finca_id = v.finca_id AND lower(trim(c.nombre)) = lower(trim(v.cliente));
UPDATE encargos_huevos_aves e SET cliente_id = c.id
  FROM clientes_huevos c
 WHERE e.cliente_id IS NULL AND c.finca_id = e.finca_id AND lower(trim(c.nombre)) = lower(trim(e.cliente));

-- ── Un solo saldo de huevo por finca ──
CREATE OR REPLACE FUNCTION sincronizar_huevos_finca(p_finca uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_puestos  bigint;
  v_vendidos bigint;
  v_cat      uuid;
  v_item     uuid;
BEGIN
  IF p_finca IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(huevos_b + huevos_a + huevos_aa + huevos_aaa + huevos_jumbo), 0) INTO v_puestos
    FROM produccion_diaria_aves WHERE finca_id = p_finca;
  SELECT COALESCE(SUM(cantidad_b + cantidad_a + cantidad_aa + cantidad_aaa + cantidad_jumbo), 0) INTO v_vendidos
    FROM ventas_huevos_aves WHERE finca_id = p_finca;

  SELECT id INTO v_item FROM inventario
   WHERE finca_id = p_finca AND nombre = 'Huevos de la finca' LIMIT 1;

  IF v_puestos = 0 AND v_vendidos = 0 THEN
    IF v_item IS NOT NULL THEN DELETE FROM inventario WHERE id = v_item; END IF;
    RETURN;
  END IF;

  IF v_item IS NULL THEN
    SELECT id INTO v_cat FROM inventario_categorias
     WHERE finca_id = p_finca AND nombre ILIKE 'huevos' LIMIT 1;
    IF v_cat IS NULL THEN
      INSERT INTO inventario_categorias (finca_id, nombre, color)
      VALUES (p_finca, 'Huevos', '#FBBF24') RETURNING id INTO v_cat;
    END IF;
    INSERT INTO inventario (finca_id, categoria_id, nombre, unidad_medida, cantidad_actual, cantidad_minima)
    VALUES (p_finca, v_cat, 'Huevos de la finca', 'huevos', v_puestos - v_vendidos, 0);
  ELSE
    UPDATE inventario SET cantidad_actual = v_puestos - v_vendidos, unidad_medida = 'huevos' WHERE id = v_item;
  END IF;
END;
$$;

-- Las funciones de antes (por galpón) quedan como atajos a la de la finca: así
-- los triggers de producción, galpones y lotes siguen igual
CREATE OR REPLACE FUNCTION sincronizar_huevos_galpon(p_finca uuid, p_instalacion uuid, p_nombre text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM sincronizar_huevos_finca(p_finca);
END;
$$;

CREATE OR REPLACE FUNCTION sincronizar_huevos_de_lote(p_lote uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE f uuid;
BEGIN
  SELECT finca_id INTO f FROM lotes_aves WHERE id = p_lote;
  IF FOUND THEN PERFORM sincronizar_huevos_finca(f); END IF;
END;
$$;

-- Producción: por la finca del día (no hace falta buscar el lote)
CREATE OR REPLACE FUNCTION trg_huevos_produccion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sincronizar_huevos_finca(OLD.finca_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM sincronizar_huevos_finca(NEW.finca_id);
  ELSIF (NEW.huevos_b, NEW.huevos_a, NEW.huevos_aa, NEW.huevos_aaa, NEW.huevos_jumbo, NEW.finca_id)
        IS DISTINCT FROM (OLD.huevos_b, OLD.huevos_a, OLD.huevos_aa, OLD.huevos_aaa, OLD.huevos_jumbo, OLD.finca_id) THEN
    PERFORM sincronizar_huevos_finca(NEW.finca_id);
    IF NEW.finca_id IS DISTINCT FROM OLD.finca_id THEN PERFORM sincronizar_huevos_finca(OLD.finca_id); END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- Ventas: también las que no tienen galpón
CREATE OR REPLACE FUNCTION trg_huevos_ventas()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN PERFORM sincronizar_huevos_finca(OLD.finca_id); END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.finca_id IS DISTINCT FROM OLD.finca_id) THEN
    PERFORM sincronizar_huevos_finca(NEW.finca_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Los ítems de antes, uno por galpón, se reemplazan por el de la finca
DELETE FROM inventario i
 USING inventario_categorias c
 WHERE c.id = i.categoria_id AND c.nombre ILIKE 'huevos' AND i.nombre LIKE 'Huevos — %';

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT DISTINCT finca_id FROM lotes_aves LOOP
    PERFORM sincronizar_huevos_finca(f.finca_id);
  END LOOP;
END $$;
