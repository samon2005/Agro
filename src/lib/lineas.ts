/**
 * Lo normal de una línea genética según su guía: cuándo empieza a poner, el pico,
 * cuántas semanas sostiene 90 % o más, el consumo, el peso del huevo, cuántas
 * gallinas siguen vivas y cuántos huevos da cada gallina alojada a las 72, 80 y
 * 90 semanas. Lo usan "Lo normal de esta línea" (al registrar aves) y "Comparar
 * líneas" (Reportes).
 */
import { esperadoDeSemana, mortalidadEsperadaDesde, semanaInicioPostura, type FilaReferencia } from '@/lib/referencias'

export const EDADES_RESUMEN = [72, 80, 90] as const

export interface ResumenGuia {
  inicioPostura: number | null
  pico: { pct: number; semana: number } | null
  semanasSobre90: number
  /** Consumo promedio en postura, gramos por gallina al día */
  consumoPostura: number | null
  /** Peso promedio del huevo en postura, gramos */
  pesoHuevo: number | null
  /** % de gallinas vivas, contado desde que empieza la postura */
  viabilidad: Record<number, number | null>
  /** Huevos por gallina alojada al empezar la postura */
  huevosAve: Record<number, number | null>
  /** Hasta qué semana trae datos la guía */
  ultimaSemana: number | null
}

export function resumenDeGuia(ref: Map<number, FilaReferencia>): ResumenGuia | null {
  if (!ref || ref.size === 0) return null
  const semanas = [...ref.keys()].sort((a, b) => a - b)
  const inicio = semanaInicioPostura(ref)
  let pico: ResumenGuia['pico'] = null
  let sobre90 = 0
  const consumos: number[] = []
  const pesos: number[] = []
  for (const s of semanas) {
    const e = esperadoDeSemana(ref, s)
    if (!e) continue
    if (e.postura != null) {
      if (!pico || e.postura > pico.pct) pico = { pct: e.postura, semana: s }
      if (e.postura >= 90) sobre90++
    }
    if (inicio != null && s >= inicio) {
      if (e.consumo != null) consumos.push(e.consumo)
      if (e.pesoHuevo != null) pesos.push(e.pesoHuevo)
    }
  }
  const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

  // Huevos por gallina alojada: la postura de cada semana × las que siguen vivas × 7 días
  const viabilidad: Record<number, number | null> = {}
  const huevosAve: Record<number, number | null> = {}
  const ultima = semanas[semanas.length - 1] ?? null
  for (const edad of EDADES_RESUMEN) {
    if (inicio == null || ultima == null || edad > ultima) { viabilidad[edad] = null; huevosAve[edad] = null; continue }
    let huevos = 0
    for (let s = inicio; s <= edad; s++) {
      const p = esperadoDeSemana(ref, s)?.postura
      const m = mortalidadEsperadaDesde(ref, inicio, s) ?? 0
      if (p != null) huevos += (p / 100) * (1 - m / 100) * 7
    }
    const m = mortalidadEsperadaDesde(ref, inicio, edad)
    viabilidad[edad] = m != null ? 100 - m : null
    huevosAve[edad] = huevos
  }
  return {
    inicioPostura: inicio, pico, semanasSobre90: sobre90,
    consumoPostura: prom(consumos), pesoHuevo: prom(pesos),
    viabilidad, huevosAve, ultimaSemana: ultima,
  }
}
