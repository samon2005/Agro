-- Parámetros de aves de cada finca (reunión con Juliana, nov 2026), como
-- config_cerdos: solo se guarda lo que la finca cambia frente a lo de siempre
-- (lib/configAves.ts). Primero: desde qué % de huevos rotos avisar.
ALTER TABLE public.fincas ADD COLUMN IF NOT EXISTS config_aves jsonb;
