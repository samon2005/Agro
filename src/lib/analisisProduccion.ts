/**
 * Análisis de la producción de huevo de lotes enteros, sin nada de ventas: por
 * mes, por semana de vida y por tamaño. Lo usa el análisis de las fincas con
 * datos viejos (fincas.sin_registro_ventas), donde solo hay producción.
 */
import { TAMANOS_HUEVO, type TamanoHuevo } from '@/lib/huevos'
import { semanaDeVida } from '@/lib/referencias'

export interface DiaProduccion {
  lote_id: string
  fecha: string
  huevos_totales: number
  aves_en_dia: number | null
  muertes: number
  alimento_kg: number
  huevos_c: number; huevos_b: number; huevos_a: number; huevos_aa: number; huevos_aaa: number; huevos_jumbo: number
  huevos_rotos: number
  huevos_sucios: number
}

export interface LoteAnalisis {
  id: string
  nombre: string
  fecha_nacimiento: string | null
  fecha_inicio_postura: string | null
  aves_iniciales: number
}

export interface Acumulado {
  huevos: number
  /** Suma de las aves de cada día con aves contadas: el divisor de la postura */
  avesDias: number
  /** Huevos de esos mismos días, para que la postura no cuente días sin aves */
  huevosConAves: number
  alimentoConAvesKg: number
  muertes: number
  dias: number
  tamanos: Record<TamanoHuevo, number>
  clasificados: number
  rotos: number
  sucios: number
}

const vacio = (): Acumulado => ({
  huevos: 0, avesDias: 0, huevosConAves: 0, alimentoConAvesKg: 0, muertes: 0, dias: 0,
  tamanos: Object.fromEntries(TAMANOS_HUEVO.map(t => [t.key, 0])) as Record<TamanoHuevo, number>,
  clasificados: 0, rotos: 0, sucios: 0,
})

function sumar(a: Acumulado, d: DiaProduccion) {
  a.huevos += d.huevos_totales
  a.muertes += d.muertes
  a.dias += 1
  if (d.aves_en_dia && d.aves_en_dia > 0) {
    a.avesDias += d.aves_en_dia
    a.huevosConAves += d.huevos_totales
    a.alimentoConAvesKg += Number(d.alimento_kg)
  }
  for (const t of TAMANOS_HUEVO) {
    const v = d[`huevos_${t.key}` as const] ?? 0
    a.tamanos[t.key] += v
    a.clasificados += v
  }
  a.rotos += d.huevos_rotos
  a.sucios += d.huevos_sucios
}

/** Postura (%) de lo acumulado: huevos sobre aves de los días con aves contadas. */
export const posturaDe = (a: Acumulado) => (a.avesDias > 0 ? (a.huevosConAves / a.avesDias) * 100 : null)
/** Alimento por ave al día, en gramos. */
export const gramosAveDe = (a: Acumulado) => (a.avesDias > 0 ? (a.alimentoConAvesKg * 1000) / a.avesDias : null)
/** Parte (%) de un tamaño entre los huevos clasificados. */
export const parteDe = (a: Acumulado, t: TamanoHuevo) => (a.clasificados > 0 ? (a.tamanos[t] / a.clasificados) * 100 : null)

const MS_DIA = 86_400_000

/**
 * Los días de postura: desde el inicio de postura, o desde el primer huevo si no
 * hay fecha. Pasadas 4 semanas de postura, un día con 0 huevos es un día que no
 * se anotó (en los Excel quedan así los últimos días): no cuenta como 0 %.
 */
function enPostura(d: DiaProduccion, lote: LoteAnalisis | undefined) {
  const inicio = lote?.fecha_inicio_postura
  if (!inicio) return d.huevos_totales > 0
  if (d.fecha < inicio) return false
  const dias = (new Date(d.fecha + 'T00:00:00').getTime() - new Date(inicio + 'T00:00:00').getTime()) / MS_DIA
  return d.huevos_totales > 0 || dias < 28
}

/** Acumulado de cada mes ('2024-05'), en orden. Solo días de postura. */
export function porMes(dias: DiaProduccion[], lotes: LoteAnalisis[]): { mes: string; a: Acumulado }[] {
  const lotePor = new Map(lotes.map(l => [l.id, l]))
  const meses = new Map<string, Acumulado>()
  for (const d of dias) {
    if (!enPostura(d, lotePor.get(d.lote_id))) continue
    const mes = d.fecha.slice(0, 7)
    if (!meses.has(mes)) meses.set(mes, vacio())
    sumar(meses.get(mes)!, d)
  }
  return [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, a]) => ({ mes, a }))
}

/** Acumulado de cada semana de vida de un lote, en orden. Solo días de postura. */
export function porSemanaDeVida(dias: DiaProduccion[], lote: LoteAnalisis): { semana: number; a: Acumulado }[] {
  const semanas = new Map<number, Acumulado>()
  for (const d of dias) {
    if (d.lote_id !== lote.id || !enPostura(d, lote)) continue
    const s = semanaDeVida(lote.fecha_nacimiento, d.fecha)
    if (s == null) continue
    if (!semanas.has(s)) semanas.set(s, vacio())
    sumar(semanas.get(s)!, d)
  }
  return [...semanas.entries()].sort(([a], [b]) => a - b).map(([semana, a]) => ({ semana, a }))
}

/** Todo junto: los días de postura de los lotes dados, y la mortalidad de todo el ciclo. */
export function resumenLotes(dias: DiaProduccion[], lotes: LoteAnalisis[]) {
  const lotePor = new Map(lotes.map(l => [l.id, l]))
  const total = vacio()
  let muertesCiclo = 0
  for (const d of dias) {
    if (!lotePor.has(d.lote_id)) continue
    muertesCiclo += d.muertes
    if (enPostura(d, lotePor.get(d.lote_id))) sumar(total, d)
  }
  const avesIniciales = lotes.reduce((s, l) => s + l.aves_iniciales, 0)
  // El pico: la mejor semana de vida de cualquiera de los lotes
  let pico: { pct: number; semana: number; lote: string } | null = null
  for (const l of lotes) {
    for (const { semana, a } of porSemanaDeVida(dias, l)) {
      const p = posturaDe(a)
      if (p != null && a.dias >= 5 && (!pico || p > pico.pct)) pico = { pct: p, semana, lote: l.nombre }
    }
  }
  return {
    total,
    postura: posturaDe(total),
    gramosAve: gramosAveDe(total),
    mortalidad: avesIniciales > 0 ? (muertesCiclo / avesIniciales) * 100 : null,
    muertesCiclo,
    pico,
  }
}

/** "may 2024" */
export function nombreMes(mes: string, corto = true) {
  return new Date(mes + '-01T00:00:00').toLocaleDateString('es-CO', { month: corto ? 'short' : 'long', year: 'numeric' })
}
