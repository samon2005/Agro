import type { SupabaseClient } from '@supabase/supabase-js'
import { desdeFechaLocal, aFechaLocal } from '@/lib/fechas'
import type { Database } from '@/types/database'
import type { ConfigCerdos, EtapaEngorde } from '@/lib/configCerdos'
import { textoPesosEtapa } from '@/lib/configCerdos'

const MS_DIA = 24 * 60 * 60 * 1000

/*
 * Los días de gestación, lactancia, ciclo, etc. ya no están fijos aquí: son
 * parámetros de cada granja (src/lib/configCerdos.ts, hook useConfigCerdos).
 */

function sumarDias(fecha: string, dias: number): string {
  return aFechaLocal(new Date(desdeFechaLocal(fecha).getTime() + dias * MS_DIA))
}

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

/** Fecha probable de parto: servicio + días de gestación de la granja (114 por defecto). */
export function fechaProbableParto(fechaServicio: string, cfg: ConfigCerdos): string {
  return sumarDias(fechaServicio, cfg.reproduccion.diasGestacion)
}

/** Fecha en que la cerda repetiría celo si el servicio no prendió (ciclo estral, 21 días por defecto). */
export function fechaRepeticionCelo(fechaServicio: string, cfg: ConfigCerdos): string {
  return sumarDias(fechaServicio, cfg.reproduccion.cicloEstral)
}

/** Fecha en que la cerda pasa a parideras: unos días antes del parto probable. */
export function fechaTrasladoParideras(fechaServicio: string, cfg: ConfigCerdos): string {
  return sumarDias(fechaProbableParto(fechaServicio, cfg), -cfg.reproduccion.trasladoParideras)
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
  { value: 'precebo', label: 'Precebo', detalle: 'Del destete al levante' },
  { value: 'levante', label: 'Levante', detalle: 'Crecimiento' },
  { value: 'ceba', label: 'Ceba', detalle: 'Hasta el peso de venta' },
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

/** Etapas de engorde que puede tener un lote, según lo que maneje la finca, con sus pesos. */
export function etapasEngordeDeFinca(etapas: string[] | null | undefined, cfg: ConfigCerdos) {
  return ETAPAS_CERDOS
    .filter(e => e.value !== 'cria' && e.value !== 'lactancia' && etapasDeFinca(etapas).includes(e.value))
    .map(e => ({ ...e, detalle: textoPesosEtapa(cfg.engorde[e.value as EtapaEngorde]) }))
}

/**
 * El código con el que se identifica un lechón: el de su madre y su número
 * corrido (205-01). El número sigue de camada en camada, así una cerda no
 * repite el mismo código en su segundo parto.
 */
export function codigoLechon(codigoMadre: string, numero: number): string {
  return `${codigoMadre}-${String(numero).padStart(2, '0')}`
}

/**
 * Las tallas con que la granja clasifica a los lechones al destete. Cada una va
 * desde su peso (incluido) hasta el de la siguiente; la última no tiene tope.
 * Si la finca no ha puesto las suyas: S menos de 7 kg, M de 7 a 8, L de 8 en adelante.
 */
export interface TallaDestete { nombre: string; desde: number }

export const TALLAS_DESTETE_DEFECTO: TallaDestete[] = [
  { nombre: 'S', desde: 0 },
  { nombre: 'M', desde: 7 },
  { nombre: 'L', desde: 8 },
]

export function tallasDeFinca(tallas: TallaDestete[] | null | undefined): TallaDestete[] {
  const validas = (tallas ?? []).filter(t => t && t.nombre?.trim() && Number.isFinite(Number(t.desde)))
  const lista = validas.length > 0 ? validas : TALLAS_DESTETE_DEFECTO
  return [...lista].map(t => ({ nombre: t.nombre.trim(), desde: Number(t.desde) })).sort((a, b) => a.desde - b.desde)
}

/** La talla que le toca a un peso, o null si no hay peso. */
export function tallaDePeso(peso: number | null | undefined, tallas: TallaDestete[]): string | null {
  if (peso == null || !Number.isFinite(peso) || peso <= 0) return null
  let talla = tallas[0]?.nombre ?? null
  for (const t of tallas) if (peso >= t.desde) talla = t.nombre
  return talla
}

/** "S: menos de 7 kg · M: 7 a 8 kg · L: 8 kg o más" */
export function describirTallas(tallas: TallaDestete[]): string {
  const kg = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 })
  return tallas.map((t, i) => {
    const siguiente = tallas[i + 1]
    if (i === 0 && siguiente) return `${t.nombre}: menos de ${kg(siguiente.desde)} kg`
    if (siguiente) return `${t.nombre}: ${kg(t.desde)} a ${kg(siguiente.desde)} kg`
    return `${t.nombre}: ${kg(t.desde)} kg o más`
  }).join(' · ')
}

/** Cómo se llama cada estado de un lechón en la pantalla. */
export const ESTADOS_LECHON: Record<string, { label: string; clase: string }> = {
  lactante: { label: 'Lactante', clase: 'bg-pink-100 text-pink-700' },
  destetado: { label: 'Destetado', clase: 'bg-green-100 text-green-700' },
  precebo: { label: 'Precebo', clase: 'bg-blue-100 text-blue-700' },
  levante: { label: 'Levante', clase: 'bg-indigo-100 text-indigo-700' },
  ceba: { label: 'Ceba', clase: 'bg-orange-100 text-orange-700' },
  vendido: { label: 'Vendido', clase: 'bg-gray-100 text-gray-600' },
  muerto: { label: 'Muerto', clase: 'bg-red-100 text-red-700' },
}

/**
 * El pie de cría cuenta sus cerdas reales: animales_actuales = las que no están
 * descartadas y numero_animales = todas las que ha tenido. Ese número lo usan
 * los reportes, el Resumen, el diario (gramos por animal) y las alertas, así
 * que se recalcula cada vez que se registra, edita o borra una cerda.
 */
export async function sincronizarPieDeCria(supabase: SupabaseClient<Database>, loteId: string): Promise<void> {
  const { data } = await supabase.from('reproductoras_cerdos').select('estado').eq('lote_id', loteId)
  if (!data) return
  await supabase.from('lotes_cerdos')
    .update({ animales_actuales: data.filter(c => c.estado !== 'descartada').length, numero_animales: data.length })
    .eq('id', loteId).eq('sistema', 'cria')
}
