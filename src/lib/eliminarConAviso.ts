import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriaInfo } from '@/lib/costos'

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

/**
 * Antes de eliminar un registro que puede tener un costo vinculado (tratamiento, vacuna,
 * desinfección, tipo de alimento, equipo), busca ese costo y devuelve un mensaje de aviso
 * para mostrar antes de confirmar el borrado. El borrado real del costo ocurre solo por la
 * FK en cascada al eliminar el registro origen.
 */
export async function avisoCostoVinculado(
  supabase: SupabaseClient,
  columna: 'medicacion_id' | 'vacunacion_id' | 'desinfeccion_id' | 'tipo_alimento_id' | 'equipo_id',
  id: string,
  tablaCostos = 'costos_lote_aves'
): Promise<string | null> {
  const { data } = await supabase.from(tablaCostos).select('monto, categoria').eq(columna, id).maybeSingle()
  if (!data) return null
  const cat = categoriaInfo(data.categoria)
  return `⚠️ También se eliminará el costo de ${cop(Number(data.monto))} (${cat?.label ?? data.categoria}) registrado en Finanzas.`
}
