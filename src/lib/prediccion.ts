/**
 * Predicción de la curva de postura con el modelo compartimental (MCM) de
 * Sharifi et al. (2022), Poultry Science 101:101766:
 *
 *   Y(x) = A · e^(−B·x) / (1 + e^(−C·(x − D)))
 *
 * x: semana de vida · Y: % de postura · A: nivel · B: caída semanal (persistencia)
 * · C: qué tan rápido sube al pico · D: semana del 50 % de la subida.
 *
 * Se ajusta por mínimos cuadrados (Gauss-Newton amortiguado) a las semanas
 * reales del lote, partiendo de la curva de la guía de su línea y tirando hacia
 * ella cuando hay pocas semanas: con pocos datos la guía pesa más. Las semanas con
 * eventos clínicos pesan menos, para que un bache no tuerza toda la curva.
 * El resultado es una estimación, no un veredicto.
 */

export type ParametrosMCM = [A: number, B: number, C: number, D: number]

export function mcm(p: ParametrosMCM, x: number): number {
  const [A, B, C, D] = p
  // Un % de postura vive entre 0 y 100
  return Math.min(100, Math.max(0, (A * Math.exp(-B * x)) / (1 + Math.exp(-C * (x - D)))))
}

export interface Punto { x: number; y: number; peso?: number }

// Escala de cada parámetro para la atadura a la guía y para las derivadas
const ESCALA: ParametrosMCM = [10, 0.003, 0.5, 2]
const INICIAL: ParametrosMCM = [105, 0.003, 0.8, 20.5]

function resolver4(M: number[][], v: number[]): number[] | null {
  // Eliminación de Gauss con pivoteo parcial para un sistema pequeño
  const n = v.length
  const a = M.map((fila, i) => [...fila, v[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let f = c + 1; f < n; f++) if (Math.abs(a[f][c]) > Math.abs(a[piv][c])) piv = f
    if (Math.abs(a[piv][c]) < 1e-12) return null
    ;[a[c], a[piv]] = [a[piv], a[c]]
    for (let f = c + 1; f < n; f++) {
      const k = a[f][c] / a[c][c]
      for (let j = c; j <= n; j++) a[f][j] -= k * a[c][j]
    }
  }
  const x = new Array(n).fill(0)
  for (let f = n - 1; f >= 0; f--) {
    let s = a[f][n]
    for (let j = f + 1; j < n; j++) s -= a[f][j] * x[j]
    x[f] = s / a[f][f]
  }
  return x
}

function valido(p: ParametrosMCM) {
  const [A, B, C, D] = p
  // La postura no sube para siempre: B ≥ 0 (después del pico solo se mantiene o cae)
  return A > 0 && A < 150 && B >= 0.0005 && B < 0.05 && C > 0.05 && C < 5 && D > 5 && D < 60
}

/**
 * Ajusta los parámetros a los puntos. `previo` (la guía) y `fuerza` atan el
 * ajuste: la fuerza se reparte entre los puntos, así con muchas semanas reales
 * manda lo real.
 */
export function ajustarMCM(puntos: Punto[], previo: ParametrosMCM = INICIAL, fuerza = 0): ParametrosMCM {
  let p: ParametrosMCM = [...previo] as ParametrosMCM
  let lambda = 1e-2
  const costo = (q: ParametrosMCM) => {
    let s = 0
    for (const pt of puntos) s += (pt.peso ?? 1) * (pt.y - mcm(q, pt.x)) ** 2
    for (let j = 0; j < 4; j++) s += fuerza * ((q[j] - previo[j]) / ESCALA[j]) ** 2
    return s
  }
  let actual = costo(p)
  for (let iter = 0; iter < 200; iter++) {
    // Normales: (JᵀWJ + fuerza·D + λ·diag) δ = JᵀW r − fuerza·D (p − previo), en unidades de ESCALA
    const JTJ = [...Array(4)].map(() => new Array(4).fill(0))
    const JTr = new Array(4).fill(0)
    for (const pt of puntos) {
      const w = pt.peso ?? 1
      const f0 = mcm(p, pt.x)
      const r = pt.y - f0
      const J = [0, 1, 2, 3].map(j => {
        const h = ESCALA[j] * 1e-4
        const q = [...p] as ParametrosMCM
        q[j] += h
        return ((mcm(q, pt.x) - f0) / h) * ESCALA[j]
      })
      for (let a = 0; a < 4; a++) {
        JTr[a] += w * J[a] * r
        for (let b = 0; b < 4; b++) JTJ[a][b] += w * J[a] * J[b]
      }
    }
    for (let j = 0; j < 4; j++) {
      JTJ[j][j] += fuerza + lambda * (1 + JTJ[j][j])
      JTr[j] -= fuerza * (p[j] - previo[j]) / ESCALA[j]
    }
    const d = resolver4(JTJ, JTr)
    if (!d) break
    const q = p.map((v, j) => v + d[j] * ESCALA[j]) as ParametrosMCM
    const nuevo = valido(q) ? costo(q) : Infinity
    if (nuevo < actual) {
      const mejora = actual - nuevo
      p = q
      actual = nuevo
      lambda = Math.max(lambda / 3, 1e-6)
      if (mejora < 1e-9 * (1 + actual)) break
    } else {
      lambda *= 4
      if (lambda > 1e8) break
    }
  }
  return p
}

export interface Prediccion {
  parametros: ParametrosMCM
  /** El % estimado en una semana de vida: la curva ajustada, o la guía tal cual si aún no hay datos */
  curva: (x: number) => number
  /** Semanas reales que entraron al ajuste */
  semanasReales: number
  /** Si la curva sale solo de la guía (sin semanas reales suficientes) */
  soloGuia: boolean
  picoSemana: number
  picoPct: number
  /** Semanas de vida con postura estimada ≥ 90 % */
  semanasSobre90: number
  /** Qué tan bien sigue la curva a lo real (error medio, en puntos de %) */
  errorMedio: number | null
}

/**
 * La curva del lote. `guia`: la postura media de la guía por semana de vida;
 * `reales`: las semanas de postura del lote (semana de vida y %), con menos peso
 * las de eventos clínicos.
 */
export function predecirPostura(guia: Punto[], reales: Punto[], hastaSemana = 100): Prediccion | null {
  const previo = guia.length >= 6 ? ajustarMCM(guia, INICIAL, 0) : INICIAL
  const utiles = reales.filter(p => Number.isFinite(p.y) && p.y >= 0 && p.y <= 100)
  if (utiles.length === 0 && guia.length < 6) return null
  // Con pocas semanas la guía pesa más; con muchas, lo real
  const fuerza = guia.length >= 6 ? 6 : 0.5
  const parametros = utiles.length >= 2 ? ajustarMCM(utiles, previo, fuerza) : previo
  const soloGuia = utiles.length < 2
  // Sin datos reales la guía misma es mejor que su ajuste (el MCM no copia bien la meseta del pico)
  const guiaPorSemana = new Map(guia.map(g => [g.x, g.y]))
  const curva = (x: number) => (soloGuia && guiaPorSemana.has(x) ? guiaPorSemana.get(x)! : mcm(parametros, x))

  let picoSemana = 0
  let picoPct = -Infinity
  let semanasSobre90 = 0
  const desde = Math.max(1, Math.floor(parametros[3] - 6))
  for (let x = desde; x <= hastaSemana; x++) {
    const y = curva(x)
    if (y > picoPct) { picoPct = y; picoSemana = x }
    if (y >= 90) semanasSobre90++
  }
  const errorMedio = utiles.length
    ? utiles.reduce((s, p) => s + Math.abs(p.y - curva(p.x)), 0) / utiles.length
    : null
  return { parametros, curva, semanasReales: utiles.length, soloGuia, picoSemana, picoPct, semanasSobre90, errorMedio }
}
