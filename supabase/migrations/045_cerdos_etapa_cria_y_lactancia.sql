-- La etapa del lote solo aceptaba etapas de engorde, así que un lote de cría
-- (que se guarda con etapa 'cria') no se podía crear. Se admiten también las
-- etapas de reproducción y lactancia.
ALTER TABLE lotes_cerdos DROP CONSTRAINT IF EXISTS lotes_cerdos_etapa_actual_check;
ALTER TABLE lotes_cerdos ADD CONSTRAINT lotes_cerdos_etapa_actual_check
  CHECK (etapa_actual = ANY (ARRAY['cria','lactancia','precebo','levante','ceba','finalizacion','vendido']));
