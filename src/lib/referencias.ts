import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aFechaLocal } from '@/lib/fechas'

export type LineaReferencia = Database['public']['Tables']['lineas_referencia']['Row']
export type FilaReferencia = Database['public']['Tables']['referencia_semanal']['Row']

const MS_DIA = 24 * 60 * 60 * 1000

/** Líneas de ponedoras que se ofrecen al registrar un lote */
export const LINEAS_PONEDORAS = ['Lohmann Brown', 'Isa Brown', 'Hy-Line Brown', 'Bovans Brown', 'Babcock B-380', 'Otra']

/**
 * Semana de vida de las aves en una fecha (1-indexada: los primeros 7 días son
 * la semana 1). Es la semana con que se leen las guías de cada línea.
 */
export function semanaDeVida(fechaNacimiento: string | null, fecha: string): number | null {
  if (!fechaNacimiento) return null
  const dias = (new Date(fecha + 'T00:00:00').getTime() - new Date(fechaNacimiento + 'T00:00:00').getTime()) / MS_DIA
  if (dias < 0) return null
  return Math.floor(dias / 7) + 1
}

/** Semanas cumplidas de las aves en una fecha (0 = recién nacidas). */
export function edadEnSemanas(fechaNacimiento: string | null, fecha: string): number | null {
  const s = semanaDeVida(fechaNacimiento, fecha)
  return s == null ? null : s - 1
}

/**
 * La fecha de nacimiento a partir de la edad con que llegaron. Se guarda la fecha
 * y no la edad, para que la edad avance sola con los días.
 */
export function nacimientoDesdeEdad(fechaEntrada: string, semanasCumplidas: number): string {
  const d = new Date(fechaEntrada + 'T00:00:00')
  d.setDate(d.getDate() - Math.round(semanasCumplidas * 7))
  return aFechaLocal(d)
}

/** Fecha en que las aves cumplen `semana` de vida (el primer día de esa semana). */
export function fechaDeSemanaDeVida(fechaNacimiento: string, semana: number): string {
  const d = new Date(fechaNacimiento + 'T00:00:00')
  d.setDate(d.getDate() + (semana - 1) * 7)
  return aFechaLocal(d)
}

/** Las líneas que puede usar una finca: las generales y sus propias copias. */
export async function cargarLineasReferencia(supabase: SupabaseClient<Database>, fincaId: string): Promise<LineaReferencia[]> {
  const { data } = await supabase
    .from('lineas_referencia')
    .select('*')
    .or(`finca_id.is.null,finca_id.eq.${fincaId}`)
    .eq('especie', 'aves_ponedoras')
    .order('nombre')
  return data ?? []
}

/** La tabla semana a semana de una referencia, indexada por semana de vida. */
export async function cargarReferencia(supabase: SupabaseClient<Database>, lineaId: string): Promise<Map<number, FilaReferencia>> {
  const { data } = await supabase.from('referencia_semanal').select('*').eq('linea_id', lineaId).order('semana')
  return new Map((data ?? []).map(f => [f.semana, f]))
}

const normalizar = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * La referencia que corresponde a una línea genética por su nombre. Si la finca
 * tiene su propia copia de esa línea, se prefiere la copia.
 */
export function referenciaParaLinea(lineas: LineaReferencia[], lineaGenetica: string | null): LineaReferencia | null {
  if (!lineaGenetica) return null
  const buscada = normalizar(lineaGenetica)
  if (!buscada) return null
  const coincide = (l: LineaReferencia) => {
    const n = normalizar(l.nombre)
    return n.startsWith(buscada) || buscada.startsWith(n)
  }
  return lineas.find(l => l.finca_id != null && coincide(l))
    ?? lineas.find(l => l.finca_id == null && coincide(l))
    ?? null
}

const medio = (a: number | null, b: number | null) => {
  if (a == null && b == null) return null
  if (a == null) return Number(b)
  if (b == null) return Number(a)
  return (Number(a) + Number(b)) / 2
}

export interface Esperado {
  postura: number | null
  posturaMin: number | null
  posturaMax: number | null
  pesoAve: number | null
  pesoAveMin: number | null
  pesoAveMax: number | null
  consumo: number | null
  pesoHuevo: number | null
}

/** Lo esperado en una semana de vida: el punto medio de cada rango de la guía. */
export function esperadoDeSemana(ref: Map<number, FilaReferencia>, semana: number | null): Esperado | null {
  if (semana == null) return null
  const f = ref.get(semana)
  if (!f) return null
  const n = (v: number | null) => (v == null ? null : Number(v))
  return {
    postura: medio(f.postura_min, f.postura_max),
    posturaMin: n(f.postura_min),
    posturaMax: n(f.postura_max),
    pesoAve: medio(f.peso_ave_min_g, f.peso_ave_max_g),
    pesoAveMin: n(f.peso_ave_min_g),
    pesoAveMax: n(f.peso_ave_max_g),
    consumo: medio(f.consumo_min_g, f.consumo_max_g),
    pesoHuevo: medio(f.peso_huevo_min_g, f.peso_huevo_max_g),
  }
}

/**
 * Mortalidad que la guía espera entre la semana en que entraron las aves y
 * `semana`, en % de las que entraron. Las guías publican la acumulada desde su
 * propio punto de partida, y algunas vuelven a contar al empezar la postura (la
 * cifra baja de una semana a la otra): ese salto se toma como un nuevo conteo.
 */
export function mortalidadEsperadaDesde(ref: Map<number, FilaReferencia>, semanaEntrada: number, semana: number): number | null {
  if (semana < semanaEntrada) return null
  let total = 0
  let alguna = false
  for (let w = semanaEntrada; w <= semana; w++) {
    const actual = ref.get(w)?.mortalidad_acum_pct
    if (actual == null) continue
    const previa = ref.get(w - 1)?.mortalidad_acum_pct
    const a = Number(actual)
    const p = previa == null ? 0 : Number(previa)
    total += a >= p ? a - p : a
    alguna = true
  }
  return alguna ? total : null
}

/**
 * La primera semana de vida en que la guía espera postura (≥ 5 %): sirve para
 * estimar cuándo empiezan a poner unas pollas.
 */
export function semanaInicioPostura(ref: Map<number, FilaReferencia>): number | null {
  for (const [semana, f] of [...ref.entries()].sort((a, b) => a[0] - b[0])) {
    const p = medio(f.postura_min, f.postura_max)
    if (p != null && p >= 5) return semana
  }
  return null
}

/** Diferencia de lo real contra lo esperado, en % del esperado. */
export function desvioPct(real: number | null, esperado: number | null): number | null {
  if (real == null || esperado == null || esperado === 0) return null
  return ((real - esperado) / esperado) * 100
}

export type EstadoComparacion = 'ok' | 'atento' | 'alerta'

/**
 * Qué tan lejos está un valor real del rango de la guía. Dentro del rango (o
 * mejor, si `mejorArriba`) está bien; hasta `tolerancia` % por fuera, atento;
 * más allá, alerta. Son señales para mirar, no un veredicto.
 */
export function compararConRango(
  real: number | null,
  min: number | null,
  max: number | null,
  opciones: { mejorArriba?: boolean; tolerancia?: number } = {},
): EstadoComparacion | null {
  if (real == null || (min == null && max == null)) return null
  const lo = min ?? max!
  const hi = max ?? min!
  const tol = (opciones.tolerancia ?? 5) / 100
  if (real >= lo && (opciones.mejorArriba || real <= hi)) return 'ok'
  const desvio = real < lo ? (lo - real) / lo : (real - hi) / hi
  return desvio <= tol ? 'atento' : 'alerta'
}

/** Mortalidad acumulada real contra la esperada: por encima en más de 1 punto ya es alerta. */
export function compararMortalidad(real: number | null, esperada: number | null): EstadoComparacion | null {
  if (real == null || esperada == null) return null
  const exceso = real - esperada
  if (exceso <= 0.25) return 'ok'
  return exceso <= 1 ? 'atento' : 'alerta'
}
