-- Fincas que llegan con producción antigua (plan de la reunión con Juliana, fase 8):
-- el huevo que ya había en bodega el día que empezaron a usar la app, por tamaño.
-- Se suma al saldo de la bodega (sincronizar_huevos_finca y lib/huevosFinca).
CREATE TABLE IF NOT EXISTS public.saldos_iniciales_huevos (
  finca_id       uuid PRIMARY KEY REFERENCES public.fincas(id) ON DELETE CASCADE,
  fecha          date NOT NULL DEFAULT CURRENT_DATE,
  huevos_c       integer NOT NULL DEFAULT 0 CHECK (huevos_c >= 0),
  huevos_b       integer NOT NULL DEFAULT 0 CHECK (huevos_b >= 0),
  huevos_a       integer NOT NULL DEFAULT 0 CHECK (huevos_a >= 0),
  huevos_aa      integer NOT NULL DEFAULT 0 CHECK (huevos_aa >= 0),
  huevos_aaa     integer NOT NULL DEFAULT 0 CHECK (huevos_aaa >= 0),
  huevos_jumbo   integer NOT NULL DEFAULT 0 CHECK (huevos_jumbo >= 0),
  registrado_por uuid DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saldos_iniciales_huevos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros de la finca" ON public.saldos_iniciales_huevos;
CREATE POLICY "Miembros de la finca" ON public.saldos_iniciales_huevos
  FOR ALL TO authenticated USING (es_miembro_finca(finca_id)) WITH CHECK (es_administrador_finca(finca_id));

CREATE OR REPLACE FUNCTION public.sincronizar_huevos_finca(p_finca uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_puestos  bigint;
  v_vendidos bigint;
  v_cat      uuid;
  v_item     uuid;
BEGIN
  IF p_finca IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(huevos_c + huevos_b + huevos_a + huevos_aa + huevos_aaa + huevos_jumbo), 0) INTO v_puestos
    FROM produccion_diaria_aves WHERE finca_id = p_finca AND NOT importado;
  -- Lo que había en bodega al empezar a usar la app
  v_puestos := v_puestos + COALESCE((SELECT huevos_c + huevos_b + huevos_a + huevos_aa + huevos_aaa + huevos_jumbo
    FROM saldos_iniciales_huevos WHERE finca_id = p_finca), 0);
  SELECT COALESCE(SUM(cantidad_c + cantidad_b + cantidad_a + cantidad_aa + cantidad_aaa + cantidad_jumbo), 0) INTO v_vendidos
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
$function$;

-- Al cambiar el saldo inicial se recalcula la bodega
CREATE OR REPLACE FUNCTION public.trg_saldo_inicial_huevos()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM sincronizar_huevos_finca(COALESCE(NEW.finca_id, OLD.finca_id));
  RETURN NULL;
END;
$function$;
DROP TRIGGER IF EXISTS trg_saldo_inicial_huevos ON public.saldos_iniciales_huevos;
CREATE TRIGGER trg_saldo_inicial_huevos AFTER INSERT OR UPDATE OR DELETE ON public.saldos_iniciales_huevos
  FOR EACH ROW EXECUTE FUNCTION public.trg_saldo_inicial_huevos();
REVOKE EXECUTE ON FUNCTION public.trg_saldo_inicial_huevos() FROM anon, PUBLIC;
