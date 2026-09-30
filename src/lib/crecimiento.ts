import { hoyLocal } from '@/lib/fechas'

/** Un pesaje del lote: la fecha y el peso promedio de ese día. */
export interface Pesaje {
  fecha: string
  peso_promedio: number
}

/** Días entre dos fechas, contando solo días completos. */
function dias(desde: string, hasta: string): number {
  return Math.round(
    (new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / 86400000,
  )
}

/**
 * Ganancia diaria de peso entre dos pesajes, en kg por animal y día. Es la
 * medida que dice si el lote avanza como debería: se pesa cada cierto tiempo y
 * se compara contra lo esperado.
 */
export function gdpEntre(anterior: Pesaje, actual: Pesaje): number | null {
  const d = dias(anterior.fecha, actual.fecha)
  if (d <= 0) return null
  return (actual.peso_promedio - anterior.peso_promedio) / d
}

/**
 * Ganancia diaria desde que entró el lote hasta el último pesaje. Sirve para
 * comparar lotes entre sí, aunque se hayan pesado en días distintos.
 */
export function gdpAcumulada(
  pesajes: Pesaje[],
  pesoInicial: number | null | undefined,
  fechaInicio: string,
): number | null {
  const ordenados = [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultimo = ordenados[ordenados.length - 1]
  if (!ultimo) return null
  const base = pesoInicial != null
    ? { fecha: fechaInicio, peso_promedio: Number(pesoInicial) }
    : ordenados[0]
  if (!base || base === ultimo) return null
  return gdpEntre(base, ultimo)
}

/** Cuándo toca el siguiente pesaje, contando desde el último que se hizo. */
export function proximoPesajeDesde(ultimaFecha: string | null, frecuenciaDias: number | null | undefined): string | null {
  if (!ultimaFecha || !frecuenciaDias || frecuenciaDias <= 0) return null
  const d = new Date(ultimaFecha + 'T00:00:00')
  d.setDate(d.getDate() + frecuenciaDias)
  return d.toISOString().slice(0, 10)
}

/** Cómo va un pesaje programado: vencido, para hoy, próximo o todavía lejos. */
export function estadoPesaje(proximo: string | null | undefined): 'sin_programar' | 'vencido' | 'hoy' | 'pronto' | 'lejos' {
  if (!proximo) return 'sin_programar'
  const faltan = dias(hoyLocal(), proximo)
  if (faltan < 0) return 'vencido'
  if (faltan === 0) return 'hoy'
  if (faltan <= 2) return 'pronto'
  return 'lejos'
}

/** Cuántos días faltan (o pasaron) para una fecha. */
export function diasHasta(fecha: string): number {
  return dias(hoyLocal(), fecha)
}
