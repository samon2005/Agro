import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type Veterinario = Database['public']['Tables']['veterinarios']['Row']

export interface CasoVeterinario {
  tipo: 'evento' | 'tratamiento' | 'vacuna'
  fecha: string
  detalle: string
  lote_id: string
}

export interface VeterinarioConHistorial extends Veterinario {
  casos: CasoVeterinario[]
}

/** Para comparar nombres sin importar mayúsculas, tildes ni espacios */
export const normalizarNombre = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')

/**
 * Los veterinarios de la finca con su historial: los eventos clínicos,
 * tratamientos y vacunas de las aves donde aparecen como encargados.
 */
export async function cargarVeterinarios(supabase: SupabaseClient<Database>, fincaId: string): Promise<VeterinarioConHistorial[]> {
  const [vets, eventos, meds, vacunas] = await Promise.all([
    supabase.from('veterinarios').select('*').eq('finca_id', fincaId).order('nombre'),
    supabase.from('eventos_clinicos_aves').select('fecha, tipo_evento, descripcion, veterinario, lote_id').eq('finca_id', fincaId).not('veterinario', 'is', null),
    supabase.from('medicaciones_aves').select('fecha_inicio, medicamento, veterinario, lote_id').eq('finca_id', fincaId).not('veterinario', 'is', null),
    supabase.from('vacunaciones_aves').select('fecha_aplicacion, vacuna, veterinario, lote_id').eq('finca_id', fincaId).not('veterinario', 'is', null),
  ])
  const casos: (CasoVeterinario & { quien: string })[] = [
    ...(eventos.data ?? []).map(e => ({ tipo: 'evento' as const, fecha: e.fecha, detalle: `${e.tipo_evento}: ${e.descripcion}`, lote_id: e.lote_id, quien: e.veterinario! })),
    ...(meds.data ?? []).map(m => ({ tipo: 'tratamiento' as const, fecha: m.fecha_inicio, detalle: m.medicamento, lote_id: m.lote_id, quien: m.veterinario! })),
    ...(vacunas.data ?? []).map(v => ({ tipo: 'vacuna' as const, fecha: v.fecha_aplicacion, detalle: v.vacuna, lote_id: v.lote_id, quien: v.veterinario! })),
  ]
  return (vets.data ?? []).map(v => ({
    ...v,
    casos: casos
      .filter(c => normalizarNombre(c.quien) === normalizarNombre(v.nombre))
      .map(c => ({ tipo: c.tipo, fecha: c.fecha, detalle: c.detalle, lote_id: c.lote_id }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
  }))
}
