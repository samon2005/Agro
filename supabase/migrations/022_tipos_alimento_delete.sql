-- Permitir eliminar un tipo de alimento aunque tenga historial de consumo: el registro
-- diario conserva los kg, pero pierde la referencia al tipo eliminado.

ALTER TABLE produccion_diaria_aves DROP CONSTRAINT IF EXISTS produccion_diaria_aves_tipo_alimento_id_fkey;
ALTER TABLE produccion_diaria_aves
  ADD CONSTRAINT produccion_diaria_aves_tipo_alimento_id_fkey
  FOREIGN KEY (tipo_alimento_id) REFERENCES tipos_alimento_aves(id) ON DELETE SET NULL;
