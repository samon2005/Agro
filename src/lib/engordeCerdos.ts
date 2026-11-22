/**
 * Cuentas del engorde (precebo, levante y ceba) con lo que pidió José: el
 * pesaje de cada cerdo con su uniformidad, la proyección del peso y de la fecha
 * de salida, y el tamaño de la muestra. Única fuente: el pesaje, la pestaña de
 * crecimiento, las predicciones y el tablero de engorde leen de aquí.
 */
import { sumarDias } from '@/lib/cierreSemanal'

/** Lee los pesos escritos a mano ("6,5 7.2 8 …"), con coma o punto decimal */
export function leerPesos(texto: string): number[] {
  return texto
    .split(/[\s;\n]+|,(?=\s)/)
    .map(x => Number(x.trim().replace(',', '.')))
    .filter(x => Number.isFinite(x) && x > 0)
}

export interface ResumenPesaje {
  n: number
  promedio: number
  minimo: number
  maximo: number
  /** % de cerdos dentro de ±10 % del promedio (José: uniformidad) */
  uniformidadPct: number
  /** Coeficiente de variación, % */
  cvPct: number
}

export function resumenPesaje(pesos: number[]): ResumenPesaje | null {
  if (pesos.length === 0) return null
  const n = pesos.length
  const promedio = pesos.reduce((s, x) => s + x, 0) / n
  const dentro = pesos.filter(x => Math.abs(x - promedio) <= promedio * 0.1).length
  const varianza = pesos.reduce((s, x) => s + (x - promedio) ** 2, 0) / n
  return {
    n, promedio,
    minimo: Math.min(...pesos), maximo: Math.max(...pesos),
    uniformidadPct: (dentro / n) * 100,
    cvPct: promedio > 0 ? (Math.sqrt(varianza) / promedio) * 100 : 0,
  }
}

/** Cuántos pesar: todos si son pocos; si no, una muestra (10 %, mínimo 30). Por validar con José. */
export function muestraSugerida(animales: number): number {
  if (animales <= 30) return animales
  return Math.min(animales, Math.max(30, Math.ceil(animales * 0.1)))
}

export interface PesajeProy { fecha: string; peso_promedio: number }

/**
 * Ganancia diaria reciente (kg/día) con los dos últimos pesajes, o con el peso
 * de entrada si hay uno solo.
 */
export function gananciaReciente(
  pesajes: PesajeProy[],
  inicio?: { fecha: string; peso: number | null },
): number | null {
  const orden = [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const fin = orden[orden.length - 1]
  const ini = orden.length >= 2 ? orden[orden.length - 2] : inicio?.peso != null ? { fecha: inicio.fecha, peso_promedio: inicio.peso } : null
  if (!fin || !ini) return null
  const dias = (new Date(fin.fecha + 'T00:00:00').getTime() - new Date(ini.fecha + 'T00:00:00').getTime()) / 86400000
  if (dias <= 0) return null
  return (Number(fin.peso_promedio) - Number(ini.peso_promedio)) / dias
}

/**
 * Proyección: el peso de hoy y el día en que el grupo llega al peso de salida,
 * siguiendo la ganancia reciente. Es una sugerencia, se corrige con cada pesaje.
 */
export function proyeccionGrupo(p: {
  pesajes: PesajeProy[]
  inicio?: { fecha: string; peso: number | null }
  pesoObjetivo: number
  hoy: string
}): { gdp: number; pesoHoy: number; fechaObjetivo: string | null; diasFaltan: number | null } | null {
  const gdp = gananciaReciente(p.pesajes, p.inicio)
  const orden = [...p.pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultimo = orden[orden.length - 1] ?? (p.inicio?.peso != null ? { fecha: p.inicio.fecha, peso_promedio: p.inicio.peso } : null)
  if (gdp == null || !ultimo || gdp <= 0) return null
  const diasDesdeUltimo = Math.max(0, (new Date(p.hoy + 'T00:00:00').getTime() - new Date(ultimo.fecha + 'T00:00:00').getTime()) / 86400000)
  const pesoHoy = Number(ultimo.peso_promedio) + gdp * diasDesdeUltimo
  const faltan = p.pesoObjetivo - pesoHoy
  const diasFaltan = faltan <= 0 ? 0 : Math.ceil(faltan / gdp)
  return { gdp, pesoHoy, diasFaltan, fechaObjetivo: sumarDias(p.hoy, diasFaltan) }
}
