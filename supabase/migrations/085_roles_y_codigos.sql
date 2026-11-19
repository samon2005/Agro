-- Roles por finca y código para entrar (reunión con Juliana, nov 2026).
--
-- Cada persona tiene un rol en cada finca (finca_miembros.rol), que solo cambia
-- el administrador de la finca: el usuario no lo puede tocar (profiles.rol sí lo
-- podría, por eso no se usa para permisos).
--   propietario   · quien creó la finca (administrador de la finca)
--   administrador · otro administrador de la finca
--   zootecnista   · ve todo menos la plata; ajusta metas y sanidad
--   operario      · registra el día, el alimento y sus tareas
--   recolector    · registra los huevos y ve sus tareas
--   trabajador    · el de antes: se trata como operario
--
-- El administrador de la finca crea un código por rol, que vence y tiene un número
-- de usos. Quien se registra lo escribe y entra a esa finca con ese rol. Todo lo
-- valida la base (usar_codigo_finca), así nadie se pone un rol que no le dieron.

ALTER TABLE public.finca_miembros DROP CONSTRAINT IF EXISTS finca_miembros_rol_check;
ALTER TABLE public.finca_miembros ADD CONSTRAINT finca_miembros_rol_check
  CHECK (rol IN ('propietario', 'administrador', 'zootecnista', 'operario', 'recolector', 'trabajador'));

-- El rol de quien consulta en una finca (el administrador general la ve como propietario)
CREATE OR REPLACE FUNCTION public.rol_en_finca(finca uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT rol FROM finca_miembros WHERE finca_id = finca AND perfil_id = auth.uid()),
    CASE WHEN es_miembro_finca(finca) THEN 'propietario' END
  );
$function$;
REVOKE EXECUTE ON FUNCTION public.rol_en_finca(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rol_en_finca(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.es_administrador_finca(finca uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(rol_en_finca(finca) IN ('propietario', 'administrador'), false);
$function$;
REVOKE EXECUTE ON FUNCTION public.es_administrador_finca(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_administrador_finca(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.invitaciones_finca (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     text NOT NULL UNIQUE,
  finca_id   uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  rol        text NOT NULL CHECK (rol IN ('administrador', 'zootecnista', 'operario', 'recolector')),
  vence      timestamptz,
  usos_max   integer CHECK (usos_max IS NULL OR usos_max > 0),
  usos       integer NOT NULL DEFAULT 0,
  activa     boolean NOT NULL DEFAULT true,
  creado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invitaciones_finca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Administradores ven y manejan los códigos" ON public.invitaciones_finca;
CREATE POLICY "Administradores ven y manejan los códigos" ON public.invitaciones_finca
  FOR ALL TO authenticated USING (es_administrador_finca(finca_id)) WITH CHECK (es_administrador_finca(finca_id));

-- Crear un código fácil de dictar: tres letras de la finca y cuatro caracteres sin confusiones (sin 0/O ni 1/I)
CREATE OR REPLACE FUNCTION public.crear_codigo_finca(p_finca uuid, p_rol text, p_dias integer DEFAULT 7, p_usos integer DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_prefijo text;
  v_codigo text;
  i int;
BEGIN
  IF NOT es_administrador_finca(p_finca) THEN
    RAISE EXCEPTION 'Solo el administrador de la finca crea códigos' USING HINT = 'sin_permiso';
  END IF;
  SELECT upper(substr(regexp_replace(translate(nombre, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^A-Za-z]', '', 'g') || 'FIN', 1, 3))
    INTO v_prefijo FROM fincas WHERE id = p_finca;
  LOOP
    v_codigo := v_prefijo || '-';
    FOR i IN 1..4 LOOP
      v_codigo := v_codigo || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM invitaciones_finca WHERE codigo = v_codigo);
  END LOOP;
  INSERT INTO invitaciones_finca (codigo, finca_id, rol, vence, usos_max)
  VALUES (v_codigo, p_finca, p_rol, CASE WHEN p_dias IS NULL THEN NULL ELSE now() + make_interval(days => p_dias) END, p_usos);
  RETURN v_codigo;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.crear_codigo_finca(uuid, text, integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_codigo_finca(uuid, text, integer, integer) TO authenticated;

-- Entrar a una finca con un código: valida que sirva, agrega a quien lo usa con ese rol y cuenta el uso
CREATE OR REPLACE FUNCTION public.usar_codigo_finca(p_codigo text)
 RETURNS TABLE(finca_id uuid, finca_nombre text, rol text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v invitaciones_finca%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para usar el código'; END IF;
  SELECT * INTO v FROM invitaciones_finca WHERE codigo = upper(trim(p_codigo)) FOR UPDATE;
  IF v.id IS NULL OR NOT v.activa OR (v.vence IS NOT NULL AND v.vence < now()) OR (v.usos_max IS NOT NULL AND v.usos >= v.usos_max) THEN
    RAISE EXCEPTION 'Ese código no existe, venció o ya se usó todas las veces. Pídele uno nuevo al administrador de la finca.' USING HINT = 'codigo_invalido';
  END IF;
  IF EXISTS (SELECT 1 FROM finca_miembros m WHERE m.finca_id = v.finca_id AND m.perfil_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ya eres parte de esa finca' USING HINT = 'ya_miembro';
  END IF;
  INSERT INTO finca_miembros (finca_id, perfil_id, rol) VALUES (v.finca_id, auth.uid(), v.rol);
  UPDATE invitaciones_finca SET usos = usos + 1 WHERE id = v.id;
  RETURN QUERY SELECT f.id, f.nombre, v.rol FROM fincas f WHERE f.id = v.finca_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.usar_codigo_finca(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.usar_codigo_finca(text) TO authenticated;

-- El administrador de la finca cambia el rol de alguien de su equipo (no el del propietario)
CREATE OR REPLACE FUNCTION public.cambiar_rol_miembro(p_finca uuid, p_perfil uuid, p_rol text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT es_administrador_finca(p_finca) THEN
    RAISE EXCEPTION 'Solo el administrador de la finca cambia los roles' USING HINT = 'sin_permiso';
  END IF;
  IF p_rol NOT IN ('administrador', 'zootecnista', 'operario', 'recolector') THEN
    RAISE EXCEPTION 'Rol no válido';
  END IF;
  UPDATE finca_miembros SET rol = p_rol
   WHERE finca_id = p_finca AND perfil_id = p_perfil AND rol <> 'propietario';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.cambiar_rol_miembro(uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cambiar_rol_miembro(uuid, uuid, text) TO authenticated;
