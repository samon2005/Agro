-- Nómina de los operarios (reunión con Juliana, nov 2026): se puede pagar por
-- hora (con las horas de los turnos) y se anota el tipo de contrato. La app solo
-- estima lo que toca pagar por lo trabajado; las prestaciones y aportes de ley
-- los liquida el contador.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pago_periodo_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pago_periodo_check
  CHECK (pago_periodo IS NULL OR pago_periodo IN ('mensual', 'quincenal', 'semanal', 'diario', 'por_hora', 'por_tarea'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tipo_contrato text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tipo_contrato_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tipo_contrato_check
  CHECK (tipo_contrato IS NULL OR tipo_contrato IN ('indefinido', 'fijo', 'obra_labor', 'prestacion_servicios', 'jornal'));
