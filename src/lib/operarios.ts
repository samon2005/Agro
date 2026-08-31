import type { SupabaseClient } from '@supabase/supabase-js'

export interface Operario {
  id: string
  full_name: string | null
}

/**
 * Miembros de una finca (id + nombre) para usar como opciones de "Encargado".
 * `database.ts` declara `Functions: Record<string, never>` a propósito — tipar las
 * funciones RPC ahí rompe la inferencia de otros `select('*, relacion(...)')` en la app,
 * así que esta llamada se castea puntualmente aquí en vez de en el tipo global.
 */
export async function obtenerMiembrosFinca(supabase: SupabaseClient, fincaId: string): Promise<Operario[]> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: 'obtener_miembros_finca',
    args: { p_finca_id: string }
  ) => Promise<{ data: Operario[] | null; error: unknown }>)('obtener_miembros_finca', { p_finca_id: fincaId })
  if (error || !data) return []
  return data.filter(o => o.full_name)
}
