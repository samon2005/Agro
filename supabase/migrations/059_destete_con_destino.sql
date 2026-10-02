-- El destete en un solo paso: la camada sale de la cerda clasificada por talla
-- y se va a un corral de precebo o se vende. Toca la cerda, los lechones, el lote
-- de destino, la venta y los movimientos: se hace todo o nada.

-- Los movimientos que deja un destete se van con él si se anula
ALTER TABLE movimientos_cerdos
  ADD COLUMN IF NOT EXISTS destete_id uuid REFERENCES destetes_cerdos(id) ON DELETE CASCADE;

-- p_lechones: [{"id": uuid, "sale": bool, "peso": numeric|null, "talla": text|null}]
CREATE OR REPLACE FUNCTION registrar_destete(
  p_parto uuid,
  p_fecha date,
  p_lechones jsonb,
  p_destino text,            -- 'corral' | 'venta'
  p_corral uuid,             -- corral de precebo si el destino es un corral
  p_destetados integer,      -- solo cuando la camada no tiene lechones identificados
  p_peso_promedio numeric,   -- idem
  p_precio_lechon numeric,   -- si se vende
  p_cliente text,
  p_observaciones text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  pa record; cerda record; lote_cria record; corral record; lote_destino uuid;
  n integer; peso_prom numeric; destete uuid; venta uuid; l jsonb;
  nombre_corral text;  -- el registro corral solo existe cuando el destino es un corral
BEGIN
  SELECT * INTO pa FROM partos_cerdos WHERE id = p_parto;
  IF NOT FOUND THEN RAISE EXCEPTION 'El parto no existe' USING HINT = 'destete'; END IF;
  IF EXISTS (SELECT 1 FROM destetes_cerdos WHERE parto_id = p_parto) THEN
    RAISE EXCEPTION 'Esta camada ya se destetó' USING HINT = 'destete';
  END IF;
  IF p_fecha < pa.fecha_parto THEN
    RAISE EXCEPTION 'El destete no puede ser antes del parto' USING HINT = 'destete';
  END IF;
  IF p_destino NOT IN ('corral', 'venta') THEN
    RAISE EXCEPTION 'Elige si la camada va a un corral o se vende' USING HINT = 'destete';
  END IF;

  SELECT * INTO cerda FROM reproductoras_cerdos WHERE id = pa.reproductora_id;
  SELECT * INTO lote_cria FROM lotes_cerdos WHERE id = pa.lote_id;

  -- Cuántos salen y con qué peso
  IF jsonb_array_length(COALESCE(p_lechones, '[]'::jsonb)) > 0 THEN
    SELECT count(*) FILTER (WHERE (e->>'sale')::boolean),
           avg(NULLIF(e->>'peso', '')::numeric) FILTER (WHERE (e->>'sale')::boolean)
      INTO n, peso_prom
      FROM jsonb_array_elements(p_lechones) e;
  ELSE
    n := COALESCE(p_destetados, 0);
    peso_prom := p_peso_promedio;
  END IF;
  IF n <= 0 THEN RAISE EXCEPTION 'No sale ningún lechón de la camada' USING HINT = 'destete'; END IF;
  IF n > pa.nacidos_vivos THEN
    RAISE EXCEPTION 'No se pueden destetar más lechones de los que nacieron vivos (%)', pa.nacidos_vivos USING HINT = 'destete';
  END IF;

  INSERT INTO destetes_cerdos (parto_id, reproductora_id, lote_id, finca_id, fecha_destete, lechones_destetados,
                               peso_promedio_kg, observaciones, destino)
  VALUES (p_parto, pa.reproductora_id, pa.lote_id, pa.finca_id, p_fecha, n, round(peso_prom, 2), p_observaciones, p_destino)
  RETURNING id INTO destete;

  IF p_destino = 'corral' THEN
    SELECT * INTO corral FROM instalaciones WHERE id = p_corral AND finca_id = pa.finca_id;
    IF NOT FOUND OR corral.uso IS DISTINCT FROM 'precebo' THEN
      RAISE EXCEPTION 'Elige un corral de precebo' USING HINT = 'destete';
    END IF;
    nombre_corral := corral.nombre;
    -- Al lote que ya está en el corral, o a uno nuevo si el corral está vacío
    SELECT id INTO lote_destino FROM lotes_cerdos WHERE instalacion_id = p_corral AND estado = 'activo';
    IF lote_destino IS NULL THEN
      INSERT INTO lotes_cerdos (finca_id, instalacion_id, corral, area_corral_m2, nombre, sistema, etapa_actual,
                                linea_genetica, fecha_ingreso, fecha_nacimiento, numero_animales, animales_actuales,
                                peso_promedio_inicial, origen_animales)
      VALUES (pa.finca_id, p_corral, corral.nombre, corral.area_m2,
              corral.nombre || ' · ' || to_char(p_fecha, 'DD/MM/YYYY'), 'ceba', 'precebo',
              lote_cria.linea_genetica, p_fecha, pa.fecha_parto, n, n, round(peso_prom, 2),
              'Destetes de ' || lote_cria.nombre)
      RETURNING id INTO lote_destino;
    ELSE
      UPDATE lotes_cerdos SET numero_animales = numero_animales + n, animales_actuales = animales_actuales + n
       WHERE id = lote_destino;
    END IF;
    UPDATE destetes_cerdos SET destino_lote_id = lote_destino WHERE id = destete;

    INSERT INTO movimientos_cerdos (lote_id, finca_id, fecha, tipo, cantidad, peso_promedio, destino_origen, observaciones, destete_id)
    VALUES (pa.lote_id, pa.finca_id, p_fecha, 'traslado', n, round(peso_prom, 2), corral.nombre,
            'Destete de la camada de ' || cerda.codigo, destete),
           (lote_destino, pa.finca_id, p_fecha, 'ingreso', n, round(peso_prom, 2), lote_cria.nombre,
            'Destete de la camada de ' || cerda.codigo, destete);
  ELSE
    IF p_precio_lechon IS NULL OR p_precio_lechon <= 0 THEN
      RAISE EXCEPTION 'Indica el precio por lechón' USING HINT = 'destete';
    END IF;
    INSERT INTO ventas_cerdos (lote_id, finca_id, fecha, cantidad, peso_promedio_kg, modo_precio, precio_animal,
                               tipo_venta, cliente, observaciones)
    VALUES (pa.lote_id, pa.finca_id, p_fecha, n, round(peso_prom, 2), 'animal', p_precio_lechon, 'pie',
            NULLIF(trim(p_cliente), ''), 'Camada de ' || cerda.codigo || ' vendida al destete')
    RETURNING id INTO venta;
    UPDATE destetes_cerdos SET venta_id = venta WHERE id = destete;
  END IF;

  -- Cada lechón: sale con su peso y su talla, o queda como muerto en lactancia
  FOR l IN SELECT * FROM jsonb_array_elements(COALESCE(p_lechones, '[]'::jsonb)) LOOP
    IF (l->>'sale')::boolean THEN
      UPDATE lechones_cerdos SET
        estado = CASE WHEN p_destino = 'corral' THEN 'precebo' ELSE 'vendido' END,
        peso_destete_kg = NULLIF(l->>'peso', '')::numeric,
        talla_destete = NULLIF(l->>'talla', ''),
        lote_id = CASE WHEN p_destino = 'corral' THEN lote_destino ELSE lote_id END,
        fecha_salida = p_fecha,
        causa_salida = CASE WHEN p_destino = 'corral' THEN 'Destete a ' || nombre_corral ELSE 'Vendido al destete' END
      WHERE id = (l->>'id')::uuid AND parto_id = p_parto;
    ELSE
      -- El que ya había muerto conserva su fecha y su causa
      UPDATE lechones_cerdos SET estado = 'muerto', fecha_salida = p_fecha,
             causa_salida = COALESCE(causa_salida, 'Murió en lactancia')
       WHERE id = (l->>'id')::uuid AND parto_id = p_parto AND estado <> 'muerto';
    END IF;
  END LOOP;

  -- Destetada la camada, la cerda queda vacía y lista para volver a servicio
  UPDATE reproductoras_cerdos SET estado = 'vacia' WHERE id = pa.reproductora_id AND estado <> 'descartada';

  RETURN destete;
END;
$$;

-- Deshace un destete mal registrado: los lechones vuelven a la cerda.
CREATE OR REPLACE FUNCTION anular_destete(p_destete uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE d record; dest record;
BEGIN
  SELECT * INTO d FROM destetes_cerdos WHERE id = p_destete;
  IF NOT FOUND THEN RAISE EXCEPTION 'El destete no existe' USING HINT = 'destete'; END IF;

  IF d.destino = 'corral' AND d.destino_lote_id IS NOT NULL THEN
    SELECT * INTO dest FROM lotes_cerdos WHERE id = d.destino_lote_id FOR UPDATE;
    IF FOUND THEN
      IF dest.estado <> 'activo' OR dest.animales_actuales < d.lechones_destetados THEN
        RAISE EXCEPTION 'Los lechones de este destete ya salieron de %: no se puede anular', dest.nombre USING HINT = 'destete';
      END IF;
      -- Si el lote quedó vacío (solo tenía esta camada) se cierra y el corral queda libre
      UPDATE lotes_cerdos SET numero_animales = GREATEST(0, numero_animales - d.lechones_destetados),
                              animales_actuales = animales_actuales - d.lechones_destetados,
                              estado = CASE WHEN animales_actuales - d.lechones_destetados = 0 THEN 'finalizado' ELSE estado END
       WHERE id = dest.id;
    END IF;
  END IF;
  IF d.venta_id IS NOT NULL THEN
    DELETE FROM ventas_cerdos WHERE id = d.venta_id;
  END IF;

  UPDATE lechones_cerdos SET estado = 'lactante', peso_destete_kg = NULL, talla_destete = NULL,
         lote_id = d.lote_id, fecha_salida = NULL, causa_salida = NULL
   -- 'destetado' es como quedaban los lechones de los destetes de antes
   WHERE parto_id = d.parto_id AND (estado IN ('precebo', 'vendido', 'destetado')
         OR (estado = 'muerto' AND fecha_salida = d.fecha_destete AND causa_salida = 'Murió en lactancia'));

  UPDATE reproductoras_cerdos SET estado = 'lactante' WHERE id = d.reproductora_id AND estado = 'vacia';
  DELETE FROM destetes_cerdos WHERE id = p_destete;
END;
$$;
