-- Fase 1A del plan de cerdos: el número de partos de la cerda se calcula
-- (src/lib/estadoCerda.ts) = partos que traía al llegar a la finca + partos
-- registrados en la app. Antes se sumaba y restaba a mano en cada pantalla.
-- Solo agrega.
ALTER TABLE reproductoras_cerdos
  ADD COLUMN IF NOT EXISTS partos_previos integer NOT NULL DEFAULT 0 CHECK (partos_previos >= 0);

COMMENT ON COLUMN reproductoras_cerdos.partos_previos IS
  'Partos que la cerda ya tenía cuando se registró (en otra granja o antes de usar la app).';

-- Lo que hoy dice numero_partos y no está registrado en la app eran partos previos
UPDATE reproductoras_cerdos r
   SET partos_previos = GREATEST(r.numero_partos - (SELECT count(*) FROM partos_cerdos p WHERE p.reproductora_id = r.id), 0);
