-- Hay gastos que no son de un galpón sino de toda la finca: el alimento que entra
-- (lo comen varios galpones), los servicios, la mano de obra general. El costo
-- puede quedar sin galpón y se muestra como "Toda la finca". La seguridad no
-- cambia: va por la finca, no por el galpón.
ALTER TABLE costos_lote_aves ALTER COLUMN lote_id DROP NOT NULL;
