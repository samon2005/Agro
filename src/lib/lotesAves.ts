import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
export type Proposito = LoteAves['proposito']
export type MotivoCierre = NonNullable<LoteAves['motivo_cierre']>

/** Para qué entran las aves al galpón */
export const PROPOSITOS: { v: Proposito; t: string; d: string; semanaSalida: number | null }[] = [
  { v: 'ciclo_completo', t: 'Ciclo completo', d: 'Levante y postura hasta el descarte', semanaSalida: null },
  { v: 'venta_postura', t: 'Vender en postura', d: 'Se venden ya poniendo', semanaSalida: null },
  { v: 'venta_levante', t: 'Levante y venta', d: 'Se venden como pollas', semanaSalida: 16 },
]

export const PROPOSITO_LABEL: Record<Proposito, string> = {
  ciclo_completo: 'ciclo completo',
  venta_postura: 'venta en postura',
  venta_levante: 'levante y venta',
}

/** Por qué salió el lote del galpón */
export const MOTIVOS_CIERRE: { v: MotivoCierre; t: string }[] = [
  { v: 'fin_ciclo', t: 'Fin del ciclo (descarte)' },
  { v: 'venta_pollas', t: 'Venta de pollas' },
  { v: 'venta_postura', t: 'Venta de gallinas en postura' },
  { v: 'otro', t: 'Otro motivo' },
]

export const MOTIVO_LABEL: Record<MotivoCierre, string> = Object.fromEntries(MOTIVOS_CIERRE.map(m => [m.v, m.t])) as Record<MotivoCierre, string>

/** El motivo de salida que corresponde al propósito con que entró el lote */
export function motivoSegunProposito(p: Proposito, estado: string): MotivoCierre {
  if (p === 'venta_levante' || estado === 'preparacion') return 'venta_pollas'
  if (p === 'venta_postura') return 'venta_postura'
  return 'fin_ciclo'
}

/** Los lotes que ocupan un galpón: los demás ya salieron */
export const ESTADOS_VIVOS = ['activo', 'preparacion'] as const

export function estaVivo(estado: string) {
  return estado === 'activo' || estado === 'preparacion'
}
