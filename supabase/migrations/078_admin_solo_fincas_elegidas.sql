-- El administrador ve solo las fincas que se le asignan (13 nov 2026): por
-- ahora AviCes de José, Marinilla (histórico) y Jericó (histórico). Las demás
-- fincas no se borran: siguen igual para sus dueños, solo que el administrador
-- no las ve. Para darle otra finca basta con poner soporte_admin = true.

ALTER TABLE public.fincas ADD COLUMN IF NOT EXISTS soporte_admin boolean NOT NULL DEFAULT false;

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
  ) OR (
    EXISTS (SELECT 1 FROM administradores WHERE perfil_id = auth.uid())
    AND EXISTS (SELECT 1 FROM fincas WHERE id = finca AND soporte_admin)
  );
$function$;

DROP POLICY IF EXISTS "Administrador edita finca" ON public.fincas;
CREATE POLICY "Administrador edita finca" ON public.fincas
  FOR UPDATE TO authenticated USING (es_admin() AND soporte_admin) WITH CHECK (es_admin() AND soporte_admin);

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
   WHERE f.soporte_admin
   ORDER BY f.created_at;
END;
$function$;

-- Las tres fincas del administrador: AviCes, Marinilla (histórico) y Jericó (histórico)
UPDATE public.fincas SET soporte_admin = true
 WHERE id IN ('e070824e-efe5-460f-bbd0-f35a227790fc', 'c4fda89e-b27e-4555-9584-c027dc4c5fe8', '5a81bb20-0df4-4c07-91d4-4cdeab027905');
