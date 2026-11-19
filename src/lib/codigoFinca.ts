import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { dbGenerico } from './especiesConfig'
import type { RolFinca } from './roles'

/** La finca que se elige al entrar (la misma clave de FincaProvider) */
const CLAVE_FINCA = 'agro:finca-actual'

/**
 * Entrar a una finca con el código que dio su administrador (migración 085). La
 * base valida que sirva y agrega a la persona con el rol del código; aquí solo se
 * deja esa finca elegida para cuando cargue.
 */
export async function usarCodigoFinca(supabase: SupabaseClient<Database>, codigo: string) {
  const { data, error } = await dbGenerico(supabase).rpc('usar_codigo_finca', { p_codigo: codigo.trim() })
  if (error) throw new Error(error.message)
  const fila = (Array.isArray(data) ? data[0] : data) as { finca_id: string; finca_nombre: string; rol: RolFinca } | null
  if (!fila) throw new Error('No se pudo entrar a la finca')
  if (typeof window !== 'undefined') window.localStorage.setItem(CLAVE_FINCA, fila.finca_id)
  return { fincaId: fila.finca_id, fincaNombre: fila.finca_nombre, rol: fila.rol }
}
