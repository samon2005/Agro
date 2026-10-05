-- El lote de aves: para qué entra (propósito), cómo sale (cierre sin borrar) y
-- el vacío sanitario del galpón antes de recibir aves nuevas. Más las plantillas
-- de configuración para no llenar todo cada vez que entran aves.

ALTER TABLE lotes_aves
  ADD COLUMN IF NOT EXISTS proposito text NOT NULL DEFAULT 'ciclo_completo'
    CHECK (proposito IN ('ciclo_completo', 'venta_postura', 'venta_levante')),
  ADD COLUMN IF NOT EXISTS motivo_cierre text
    CHECK (motivo_cierre IS NULL OR motivo_cierre IN ('fin_ciclo', 'venta_pollas', 'venta_postura', 'otro')),
  ADD COLUMN IF NOT EXISTS vacio_sanitario_hasta date;

-- Días de limpieza y desinfección del galpón entre un lote y el siguiente
ALTER TABLE fincas
  ADD COLUMN IF NOT EXISTS dias_vacio_sanitario integer NOT NULL DEFAULT 21
    CHECK (dias_vacio_sanitario BETWEEN 0 AND 180);

-- ── Plantillas de configuración del lote ──
CREATE TABLE IF NOT EXISTS plantillas_lote_aves (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id              uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  linea_genetica        text,
  referencia_id         uuid REFERENCES lineas_referencia(id) ON DELETE SET NULL,
  proposito             text NOT NULL DEFAULT 'ciclo_completo'
    CHECK (proposito IN ('ciclo_completo', 'venta_postura', 'venta_levante')),
  estado_llegada        text NOT NULL DEFAULT 'preparacion' CHECK (estado_llegada IN ('preparacion', 'activo')),
  edad_llegada_semanas  numeric(5,1) CHECK (edad_llegada_semanas IS NULL OR edad_llegada_semanas BETWEEN 0 AND 120),
  semana_salida         integer CHECK (semana_salida IS NULL OR semana_salida BETWEEN 1 AND 120),
  semanas_ciclo_postura integer CHECK (semanas_ciclo_postura IS NULL OR semanas_ciclo_postura > 0),
  meta_postura_pct      numeric(5,2) CHECK (meta_postura_pct IS NULL OR meta_postura_pct BETWEEN 0 AND 100),
  created_at            timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plantillas_lote_aves_nombre ON plantillas_lote_aves (finca_id, lower(nombre));

ALTER TABLE plantillas_lote_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plantillas_lote_aves_miembros ON plantillas_lote_aves;
CREATE POLICY plantillas_lote_aves_miembros ON plantillas_lote_aves FOR ALL TO authenticated
  USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));

-- ── Cerrar un lote ──
-- Las aves que quedan salen como venta (descarte o pollas; precio 0 si se
-- regalan), así el saldo de aves y las finanzas cuadran con los registros. El
-- lote queda con todo su historial, el galpón libre y en vacío sanitario.
CREATE OR REPLACE FUNCTION cerrar_lote_aves(
  p_lote uuid,
  p_fecha date,
  p_motivo text,
  p_tipo_venta text DEFAULT 'descarte',
  p_precio numeric DEFAULT 0,
  p_cliente text DEFAULT NULL,
  p_dias_vacio integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  l lotes_aves%ROWTYPE;
  dias integer;
BEGIN
  SELECT * INTO l FROM lotes_aves WHERE id = p_lote FOR UPDATE;
  IF NOT FOUND OR NOT es_miembro_finca(l.finca_id) THEN
    RAISE EXCEPTION 'El lote no existe' USING HINT = 'sin_lote';
  END IF;
  IF l.estado NOT IN ('activo', 'preparacion') THEN
    RAISE EXCEPTION 'El lote de % ya está cerrado', l.nombre USING HINT = 'lote_cerrado';
  END IF;
  IF p_fecha IS NULL OR p_fecha < l.fecha_inicio THEN
    RAISE EXCEPTION 'La salida no puede ser antes de la entrada (%)', l.fecha_inicio USING HINT = 'fecha';
  END IF;
  IF p_fecha > current_date THEN
    RAISE EXCEPTION 'La salida no puede ser una fecha futura' USING HINT = 'fecha';
  END IF;
  IF p_motivo NOT IN ('fin_ciclo', 'venta_pollas', 'venta_postura', 'otro') THEN
    RAISE EXCEPTION 'Motivo de salida no válido' USING HINT = 'motivo';
  END IF;
  IF p_tipo_venta NOT IN ('descarte', 'pollas') THEN
    RAISE EXCEPTION 'Tipo de venta no válido' USING HINT = 'motivo';
  END IF;
  IF p_precio IS NULL OR p_precio < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo' USING HINT = 'precio';
  END IF;

  IF l.aves_actuales > 0 THEN
    -- El trigger de ventas deja las aves del lote en 0
    INSERT INTO ventas_aves_lote (finca_id, lote_id, fecha, tipo, descripcion, cantidad, unidad, precio_unitario, cliente)
    VALUES (l.finca_id, l.id, p_fecha, p_tipo_venta, 'Salida del lote ' || l.nombre, l.aves_actuales, 'aves',
            p_precio, NULLIF(trim(p_cliente), ''));
  END IF;

  SELECT COALESCE(p_dias_vacio, f.dias_vacio_sanitario, 21) INTO dias FROM fincas f WHERE f.id = l.finca_id;

  UPDATE lotes_aves
     SET estado = CASE WHEN l.aves_actuales > 0 OR EXISTS (
                         SELECT 1 FROM ventas_aves_lote v WHERE v.lote_id = l.id AND v.tipo IN ('descarte', 'pollas'))
                       THEN 'vendido' ELSE 'finalizado' END,
         fecha_fin = p_fecha,
         motivo_cierre = p_motivo,
         vacio_sanitario_hasta = p_fecha + GREATEST(dias, 0),
         -- En levante la fecha de postura era solo lo esperado: sin ella el
         -- historial no cuenta semanas de postura que nunca hubo
         fecha_inicio_postura = CASE WHEN l.estado = 'preparacion' THEN NULL ELSE l.fecha_inicio_postura END
   WHERE id = l.id;
END;
$$;
