import { desdeFechaLocal, aFechaLocal } from '@/lib/fechas'

const MS_DIA = 24 * 60 * 60 * 1000

/** Gestación de la cerda: 114 días — tres meses, tres semanas y tres días. */
export const DIAS_GESTACION = 114

/** El lechón se desteta entre los 21 y los 28 días de nacido. */
export const DIAS_LACTANCIA_MIN = 21
export const DIAS_LACTANCIA_MAX = 28

/** La cerda vuelve a celo entre 5 y 7 días después del destete. */
export const DIAS_DESTETE_SERVICIO = 6

/** El ciclo estral de la cerda es de 21 días: si repite celo, es a los 21 del servicio. */
export const DIAS_CICLO_ESTRAL = 21

/** Días transcurridos desde una fecha hasta hoy (o hasta la fecha dada). */
export function diasDesde(fecha: string, hasta?: string): number {
  const desde = desdeFechaLocal(fecha).getTime()
  const fin = hasta ? desdeFechaLocal(hasta).getTime() : desdeFechaLocal(aFechaLocal()).getTime()
  return Math.floor((fin - desde) / MS_DIA)
}

/** Edad legible a partir de la fecha de nacimiento: "8 semanas", "5 meses", "12 días". */
export function edadTexto(fechaNacimiento: string | null): string {
  if (!fechaNacimiento) return '—'
  const dias = diasDesde(fechaNacimiento)
  if (dias < 0) return '—'
  if (dias < 14) return `${dias} ${dias === 1 ? 'día' : 'días'}`
  if (dias < 120) {
    const semanas = Math.floor(dias / 7)
    return `${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`
  }
  const meses = Math.floor(dias / 30)
  return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
}

/** Fecha probable de parto: 114 días después del servicio. */
export function fechaProbableParto(fechaServicio: string): string {
  const d = desdeFechaLocal(fechaServicio)
  return aFechaLocal(new Date(d.getTime() + DIAS_GESTACION * MS_DIA))
}

/** Fecha en que la cerda repetiría celo si el servicio no prendió (21 días). */
export function fechaRepeticionCelo(fechaServicio: string): string {
  const d = desdeFechaLocal(fechaServicio)
  return aFechaLocal(new Date(d.getTime() + DIAS_CICLO_ESTRAL * MS_DIA))
}

/** Día de gestación en que va la cerda hoy, o null si el servicio es futuro. */
export function diaDeGestacion(fechaServicio: string): number | null {
  const dias = diasDesde(fechaServicio)
  return dias >= 0 ? dias : null
}

export const ESTADOS_REPRODUCTORA: Record<string, { label: string; clase: string }> = {
  vacia: { label: 'Vacía', clase: 'bg-gray-100 text-gray-700 border-gray-300' },
  servida: { label: 'Servida', clase: 'bg-blue-100 text-blue-700 border-blue-300' },
  gestante: { label: 'Gestante', clase: 'bg-purple-100 text-purple-700 border-purple-300' },
  lactante: { label: 'Lactante', clase: 'bg-pink-100 text-pink-700 border-pink-300' },
  descartada: { label: 'Descartada', clase: 'bg-gray-200 text-gray-600 border-gray-400' },
}

/** Causas de muerte más frecuentes en porcicultura colombiana. */
export const CAUSAS_MUERTE_CERDOS = [
  'PRRS', 'PCV2 (circovirus)', 'APP (pleuroneumonía)', 'Disentería', 'Salmonelosis',
  'Colibacilosis', 'Neumonía', 'Peste porcina clásica', 'Aplastamiento', 'Accidente',
  'Estrés calórico', 'Hernia', 'Bajo peso al nacer',
]

/**
 * Etapas del cerdo. Cada finca marca las que maneja: unas hacen el ciclo completo
 * y otras solo una parte, como criar y vender el lechón al destete.
 */
export const ETAPAS_CERDOS = [
  { value: 'cria', label: 'Cría', detalle: 'Gestación y parto' },
  { value: 'lactancia', label: 'Lactancia', detalle: 'Hasta el destete' },
  { value: 'precebo', label: 'Precebo', detalle: '7–40 kg' },
  { value: 'levante', label: 'Levante', detalle: '40–60 kg' },
  { value: 'ceba', label: 'Ceba', detalle: '60 kg en adelante' },
] as const

export type EtapaCerdos = typeof ETAPAS_CERDOS[number]['value']

/** Las etapas marcadas en la finca; si nunca se marcaron, se asume el ciclo completo. */
export function etapasDeFinca(etapas: string[] | null | undefined): EtapaCerdos[] {
  const validas = ETAPAS_CERDOS.map(e => e.value) as readonly string[]
  const propias = (etapas ?? []).filter((e): e is EtapaCerdos => validas.includes(e))
  return propias.length > 0 ? propias : (validas as EtapaCerdos[]).slice()
}

/** La finca cría cuando maneja la gestación o la lactancia. */
export function fincaCria(etapas: string[] | null | undefined): boolean {
  const propias = etapasDeFinca(etapas)
  return propias.includes('cria') || propias.includes('lactancia')
}

/** Etapas de engorde que puede tener un lote, según lo que maneje la finca. */
export function etapasEngordeDeFinca(etapas: string[] | null | undefined) {
  return ETAPAS_CERDOS.filter(e => e.value !== 'cria' && e.value !== 'lactancia' && etapasDeFinca(etapas).includes(e.value))
}
