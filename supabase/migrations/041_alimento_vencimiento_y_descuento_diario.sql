-- ============================================================
-- MÓDULO: Alimento de aves — vencimiento de entradas y descuento diario
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

-- ---- Fecha de vencimiento del lote de alimento que entra (opcional) ----
ALTER TABLE entradas_alimento_aves
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

-- ---- Hasta qué día ya se descontó el consumo del inventario ----
-- El inventario de alimento baja solo, día a día, según el consumo activo del
-- galpón. Esta fecha evita descontar dos veces el mismo día.
ALTER TABLE lotes_aves
  ADD COLUMN IF NOT EXISTS consumo_descontado_hasta date;

-- Los galpones que ya tienen consumo arrancan a contar desde hoy: no se
-- descuenta hacia atrás lo que ya se comió antes de existir esta función.
UPDATE lotes_aves
   SET consumo_descontado_hasta = (now() AT TIME ZONE 'America/Bogota')::date
 WHERE consumo_descontado_hasta IS NULL
   AND consumo_activo_kg IS NOT NULL;

-- ---- Descuenta del inventario los días de consumo pendientes de una finca ----
-- Se llama al abrir la app. Por cada galpón con alimento y consumo activos:
--   días pendientes × kg/día ÷ kg por bulto  → bultos que salen del inventario.
-- La fila del galpón se bloquea mientras se descuenta, así dos pestañas abiertas
-- a la vez no descuentan el mismo día dos veces.
CREATE OR REPLACE FUNCTION aplicar_consumo_alimento_aves(p_finca uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  hoy date := (now() AT TIME ZONE 'America/Bogota')::date;
  r record;
  dias integer;
  bultos numeric;
  aplicados integer := 0;
BEGIN
  FOR r IN
    SELECT l.id, l.consumo_activo_kg, l.consumo_descontado_hasta,
           t.nombre AS alimento, COALESCE(NULLIF(t.peso_bulto_kg, 0), 40) AS peso_bulto
      FROM lotes_aves l
      JOIN tipos_alimento_aves t ON t.id = l.alimento_activo_id
     WHERE l.finca_id = p_finca
       AND l.estado IN ('activo', 'preparacion')
       AND l.consumo_activo_kg > 0
     FOR UPDATE OF l
  LOOP
    IF r.consumo_descontado_hasta IS NULL THEN
      UPDATE lotes_aves SET consumo_descontado_hasta = hoy WHERE id = r.id;
      CONTINUE;
    END IF;

    dias := hoy - r.consumo_descontado_hasta;
    IF dias <= 0 THEN
      CONTINUE;
    END IF;

    bultos := round((dias * r.consumo_activo_kg / r.peso_bulto)::numeric, 2);

    UPDATE inventario
       SET cantidad_actual = GREATEST(0, cantidad_actual - bultos)
     WHERE finca_id = p_finca
       AND nombre = r.alimento;

    UPDATE lotes_aves SET consumo_descontado_hasta = hoy WHERE id = r.id;
    aplicados := aplicados + 1;
  END LOOP;

  RETURN aplicados;
END;
$$;

GRANT EXECUTE ON FUNCTION aplicar_consumo_alimento_aves(uuid) TO authenticated;
