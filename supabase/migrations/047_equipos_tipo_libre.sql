-- El tipo de equipo estaba amarrado a una lista fija, así que "Otro" no podía
-- guardar cuál era. Ahora el tipo es texto libre: la app sigue ofreciendo los
-- de siempre y, al elegir "Otro", guarda lo que el operario escriba.
ALTER TABLE equipos_aves   DROP CONSTRAINT IF EXISTS equipos_aves_tipo_check;
ALTER TABLE equipos_cerdos DROP CONSTRAINT IF EXISTS equipos_cerdos_tipo_check;
ALTER TABLE equipos_pollo  DROP CONSTRAINT IF EXISTS equipos_pollo_tipo_check;
