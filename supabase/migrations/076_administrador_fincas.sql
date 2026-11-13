-- Administrador de fincas (12 nov 2026): una cuenta de soporte que ve y edita
-- todas las fincas. Quién es administrador vive en una tabla aparte, que nadie
-- toca por la API: profiles.rol no sirve, porque cada usuario edita su perfil.
--
-- Toda la base revisa el acceso con es_miembro_finca(); se le agrega "o es
-- administrador", así el administrador entra a todo y nadie más gana acceso.

CREATE TABLE IF NOT EXISTS public.administradores (
  perfil_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Con RLS y sin políticas: por la API no se lee ni se escribe
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.administradores FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM administradores WHERE perfil_id = auth.uid());
$function$;
REVOKE EXECUTE ON FUNCTION public.es_admin() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.es_miembro_finca(finca uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM finca_miembros
    WHERE finca_id = finca AND perfil_id = auth.uid()
  ) OR EXISTS (SELECT 1 FROM administradores WHERE perfil_id = auth.uid());
$function$;

-- El administrador edita los datos de cualquier finca (no la borra)
DROP POLICY IF EXISTS "Administrador edita finca" ON public.fincas;
CREATE POLICY "Administrador edita finca" ON public.fincas
  FOR UPDATE TO authenticated USING (es_admin()) WITH CHECK (es_admin());

-- Fincas con datos viejos: tienen producción pero no ventas registradas.
-- La app lo avisa en el saldo de huevo y en Finanzas.
ALTER TABLE public.fincas ADD COLUMN IF NOT EXISTS sin_registro_ventas boolean NOT NULL DEFAULT false;

-- Lista de todas las fincas con su dueño, solo para el administrador
CREATE OR REPLACE FUNCTION public.admin_fincas()
 RETURNS TABLE(
   id uuid, nombre text, municipio text, departamento text, tipo_produccion text[],
   created_at timestamptz, sin_registro_ventas boolean,
   propietario_nombre text, propietario_correo text, miembros bigint,
   lotes_activos bigint, ultimo_registro date
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT es_admin() THEN
    RAISE EXCEPTION 'Solo el administrador ve todas las fincas' USING HINT = 'sin_permiso';
  END IF;
  RETURN QUERY
  SELECT f.id, f.nombre, f.municipio, f.departamento, f.tipo_produccion,
         f.created_at, f.sin_registro_ventas,
         p.full_name, u.email::text,
         (SELECT count(*) FROM finca_miembros m WHERE m.finca_id = f.id),
         (SELECT count(*) FROM lotes_aves l WHERE l.finca_id = f.id AND l.estado IN ('activo', 'preparacion'))
           + (SELECT count(*) FROM lotes_pollo l WHERE l.finca_id = f.id AND l.estado = 'activo')
           + (SELECT count(*) FROM lotes_cerdos l WHERE l.finca_id = f.id AND l.estado = 'activo'),
         GREATEST(
           (SELECT max(d.fecha) FROM produccion_diaria_aves d WHERE d.finca_id = f.id),
           (SELECT max(d.fecha) FROM produccion_diaria_pollo d WHERE d.finca_id = f.id)
         )
    FROM fincas f
    LEFT JOIN profiles p ON p.id = f.propietario_id
    LEFT JOIN auth.users u ON u.id = f.propietario_id
   ORDER BY f.created_at;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_fincas() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_fincas() TO authenticated;
