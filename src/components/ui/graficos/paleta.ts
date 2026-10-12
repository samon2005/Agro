/**
 * Colores y estilo de todas las gráficas de la app, en un solo lugar.
 *
 * Todo va en el verde de la web, en varias intensidades: un solo tono se ve
 * limpio y no compite con el resto de la pantalla. Para que dos series
 * vecinas no se confundan, la lista de series alterna oscuro y claro. Solo
 * los estados (falta, sobra, pérdida) usan otro color, y siempre con su
 * etiqueta al lado.
 */

/** El verde de la web, de oscuro a claro */
export const TONOS = ['#193617', '#2a5d22', '#337327', '#418b30', '#62a24c', '#8cbd78', '#b6d6a6', '#d9ead0'] as const

/**
 * Series de entidades (galpones, corrales): se asignan en este orden, que
 * alterna oscuro/claro para que dos vecinas en una pila se distingan. El color
 * sigue a la entidad, no a su lugar en un filtro; del 7.º en adelante, gris.
 */
export const SERIES = ['#2a5d22', '#8cbd78', '#193617', '#62a24c', '#b6d6a6', '#418b30'] as const
export const GRIS_OTROS = '#c9cec5'

/** Papeles fijos dentro de una gráfica */
export const C = {
  /** La serie principal (ingresos, postura, huevos) */
  principal: '#2a5d22',
  /** La que se compara con la principal (costos, real frente a estimada) */
  claro: '#8cbd78',
  /** Estados: siempre con su texto al lado */
  bien: '#418b30',
  falta: '#d0453b',
  sobra: '#d39b1f',
} as const

/** Tinta y cromo: el dato es lo único que se ve fuerte */
export const TINTA = {
  primaria: '#16231a',
  secundaria: '#4d5a50',
  tenue: '#8a948b',
  rejilla: '#eef1ec',
  eje: '#dde3da',
  bueno: '#2a5d22',
  malo: '#c03636',
}

/** El color de una entidad según su lugar en la lista COMPLETA (no la filtrada) */
export function colorDe(indice: number): string {
  return indice >= 0 && indice < SERIES.length ? SERIES[indice] : GRIS_OTROS
}

/**
 * Tonos de oscuro a claro para `n` partes ordenadas de mayor a menor (una dona,
 * un ranking): la más grande es la más oscura.
 */
export function tonosPorOrden(n: number): string[] {
  if (n <= 1) return [TONOS[1]]
  const desde = 1, hasta = Math.min(TONOS.length - 1, 1 + Math.max(n - 1, 4))
  return Array.from({ length: n }, (_, i) => TONOS[Math.round(desde + (i * (hasta - desde)) / (n - 1))])
}

/**
 * Barras de una sola serie en el tiempo: las viejas más claras y la más
 * reciente la más oscura, para que el ojo vaya a lo último.
 */
export function tonoPorRecencia(i: number, n: number): string {
  if (n <= 1) return TONOS[1]
  const t = i / (n - 1)
  return TONOS[Math.round(6 - t * 5)]
}

/** Props comunes de recharts para que todas las gráficas se vean iguales */
export const EJE = {
  tick: { fontSize: 11, fill: TINTA.tenue },
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const
export const EJE_Y = { ...EJE, width: 58 } as const
export const REJILLA = { stroke: TINTA.rejilla, vertical: false } as const
/** Barras redondeadas arriba, apenas redondeadas en la base */
export const BARRA = { maxBarSize: 30, radius: [7, 7, 2, 2] as [number, number, number, number] }
export const BARRA_H = { maxBarSize: 22, radius: [2, 7, 7, 2] as [number, number, number, number] }
/** La línea punteada que sigue al cursor en las curvas */
export const CURSOR_LINEA = { stroke: TINTA.tenue, strokeWidth: 1, strokeDasharray: '4 4' }
/** El sombreado que sigue al cursor en las barras */
export const CURSOR_BARRA = { fill: 'rgb(42 93 34 / 6%)', radius: 8 }

/** Curva suave con relleno degradado y puntos (usar con <Degradado id=…/>) */
export function estiloCurva(color: string, idDegradado: string, puntos = 0) {
  return {
    type: 'monotone' as const,
    stroke: color,
    strokeWidth: 2.5,
    fill: `url(#${idDegradado})`,
    // Con muchos puntos la curva sola se lee mejor
    dot: puntos > 26 ? (false as const) : { r: 3.5, strokeWidth: 2, stroke: color, fill: '#ffffff' },
    activeDot: { r: 6, strokeWidth: 3, stroke: '#ffffff', fill: color },
    connectNulls: true,
    isAnimationActive: false,
  }
}

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
