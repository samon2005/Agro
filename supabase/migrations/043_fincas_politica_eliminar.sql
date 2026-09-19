-- La finca no tenía política de DELETE: el borrado no fallaba pero no borraba nada.
-- Solo el propietario puede eliminarla; todo lo que cuelga de ella cae en cascada.
DROP POLICY IF EXISTS "Propietario elimina finca" ON public.fincas;
CREATE POLICY "Propietario elimina finca" ON public.fincas
  FOR DELETE USING (propietario_id = auth.uid());
