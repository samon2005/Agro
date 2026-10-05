-- Directorio de veterinarios de la finca. Su historial son los eventos,
-- tratamientos y vacunas donde aparecen como encargado (por nombre: así también
-- cuentan los casos registrados antes de tener el directorio).

CREATE TABLE IF NOT EXISTS veterinarios (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id             uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre               text NOT NULL CHECK (length(trim(nombre)) > 0),
  telefono             text,
  correo               text,
  tarjeta_profesional  text,
  especialidad         text,
  notas                text,
  activo               boolean NOT NULL DEFAULT true,
  created_at           timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_veterinarios_nombre ON veterinarios (finca_id, lower(trim(nombre)));

ALTER TABLE veterinarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS veterinarios_miembros ON veterinarios;
CREATE POLICY veterinarios_miembros ON veterinarios FOR ALL TO authenticated
  USING (es_miembro_finca(finca_id)) WITH CHECK (es_miembro_finca(finca_id));
