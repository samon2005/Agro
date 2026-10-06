/**
 * Colores y estilo de todas las gráficas de la app, en un solo lugar.
 *
 * Paleta categórica de 8 colores validada para daltonismo sobre fondo blanco
 * (separación entre vecinos ≥ 9 ΔE). El orden es parte de la validación: se
 * asignan en orden, nunca se generan colores nuevos; del 9.º en adelante se
 * agrupa en "Otros". El color sigue a la entidad (el galpón), no a su posición
 * en un filtro: un galpón es siempre del mismo color.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'] as const
export const GRIS_OTROS = '#b4b2a9'

/** Tinta y cromo: el dato es lo único que se ve fuerte */
export const TINTA = {
  primaria: '#1f2421',
  secundaria: '#52514e',
  tenue: '#898781',
  rejilla: '#ecebe6',
  eje: '#d6d4cc',
  bueno: '#167a16',
  malo: '#c03636',
}

/** El color de una entidad según su lugar en la lista COMPLETA (no la filtrada) */
export function colorDe(indice: number): string {
  return indice >= 0 && indice < SERIES.length ? SERIES[indice] : GRIS_OTROS
}

/** Props comunes de recharts para que todas las gráficas se vean iguales */
export const EJE = {
  tick: { fontSize: 11, fill: TINTA.tenue },
  tickLine: false,
  axisLine: { stroke: TINTA.eje },
} as const
export const EJE_Y = { ...EJE, axisLine: false, width: 48 } as const
export const REJILLA = { stroke: TINTA.rejilla, vertical: false } as const
/** Barras delgadas con punta redondeada y base recta */
export const BARRA = { maxBarSize: 24, radius: [4, 4, 0, 0] as [number, number, number, number] }
export const BARRA_H = { maxBarSize: 20, radius: [0, 4, 4, 0] as [number, number, number, number] }

/** 1.234 · 12,9 mil · 4,2 M */
export function compacto(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (a >= 10_000) return `${(n / 1_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} mil`
  return n.toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

/** $ 1,2 M · $ 850 mil · $ 9.500 */
export function pesosCompacto(n: number): string {
  const a = Math.abs(n)
  const signo = n < 0 ? '-' : ''
  if (a >= 1_000_000) return `${signo}$ ${(a / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (a >= 10_000) return `${signo}$ ${Math.round(a / 1_000).toLocaleString('es-CO')} mil`
  return `${signo}$ ${Math.round(a).toLocaleString('es-CO')}`
}
