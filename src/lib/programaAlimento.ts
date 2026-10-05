import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fechaDeSemanaDeVida } from '@/lib/referencias'

export type FaseAlimento = Database['public']['Tables']['fases_alimento']['Row']
export type CategoriaFase = FaseAlimento['categoria']

export const CATEGORIAS_FASE: { v: CategoriaFase; t: string }[] = [
  { v: 'iniciacion', t: 'Iniciación' },
  { v: 'crecimiento', t: 'Crecimiento' },
  { v: 'desarrollo', t: 'Desarrollo' },
  { v: 'prepostura', t: 'Pre-postura' },
  { v: 'postura', t: 'Postura' },
]

export const CATEGORIA_FASE_LABEL = Object.fromEntries(CATEGORIAS_FASE.map(c => [c.v, c.t])) as Record<CategoriaFase, string>

/** Las fases de una referencia, en orden. */
export async function cargarFases(supabase: SupabaseClient<Database>, lineaId: string): Promise<FaseAlimento[]> {
  const { data } = await supabase.from('fases_alimento').select('*').eq('linea_id', lineaId).order('orden')
  return data ?? []
}

const n = (v: number | null) => (v == null ? null : Number(v))

export interface FaseSugerida {
  fase: FaseAlimento
  /** Con qué se decidió: la edad (levante) o la postura del lote */
  por: 'edad' | 'pico' | 'postura'
  siguiente: FaseAlimento | null
  /** Desde cuándo toca la siguiente, si va por edad */
  cambioDesde: string | null
  /** Lo que dice el peso del último pesaje, si cambia la lectura por edad */
  notaPeso: string | null
}

/**
 * La fase de alimento que le corresponde al lote. En levante, por su semana de
 * vida (y el peso, que es lo que la guía usa para cambiar de dieta); en
 * producción, por su propia postura: en pico mientras no caiga más de lo que dice
 * la fase, y luego por el % de la última semana. Es una sugerencia, no una orden.
 */
export function faseSugerida(
  fases: FaseAlimento[],
  ctx: {
    vida: number | null
    enPostura: boolean
    fechaNacimiento: string | null
    /** % de postura de cada semana de producción, de la primera a la última */
    posturas: (number | null)[]
    pesoG: number | null
  },
): FaseSugerida | null {
  const ordenadas = [...fases].sort((a, b) => a.orden - b.orden)
  const levante = ordenadas.filter(f => f.categoria !== 'postura' && f.desde_semana != null)
  const produccion = ordenadas.filter(f => f.categoria === 'postura')
  const siguienteDe = (f: FaseAlimento) => ordenadas[ordenadas.indexOf(f) + 1] ?? null

  if (!ctx.enPostura) {
    if (levante.length === 0 || ctx.vida == null) return null
    const vida = ctx.vida
    const fase = levante.find(f => vida >= f.desde_semana! && vida <= (f.hasta_semana ?? 120))
      ?? (vida < levante[0].desde_semana! ? levante[0] : levante[levante.length - 1])
    const siguiente = siguienteDe(fase)
    const cambioDesde = siguiente?.desde_semana != null && ctx.fechaNacimiento
      ? fechaDeSemanaDeVida(ctx.fechaNacimiento, siguiente.desde_semana)
      : null

    let notaPeso: string | null = null
    const pesoCambio = n(fase.peso_cambio_g)
    if (ctx.pesoG != null && pesoCambio != null && siguiente) {
      // La guía cambia por peso, pero nunca más de una semana antes de la edad de la siguiente
      const yaPuede = siguiente.desde_semana == null || vida >= siguiente.desde_semana - 1
      if (ctx.pesoG >= pesoCambio && yaPuede) {
        notaPeso = `Con ${Math.round(ctx.pesoG)} g ya alcanzó el peso de cambio (${Math.round(pesoCambio)} g): puede pasar a ${siguiente.nombre}.`
      } else if (ctx.pesoG < pesoCambio && fase.hasta_semana != null && vida >= fase.hasta_semana) {
        notaPeso = `Con ${Math.round(ctx.pesoG)} g todavía no llega al peso de cambio (${Math.round(pesoCambio)} g): la guía cambia la dieta por peso, no solo por edad.`
      }
    }
    return { fase, por: 'edad', siguiente, cambioDesde, notaPeso }
  }

  if (produccion.length === 0) return null
  const reales = ctx.posturas.filter((p): p is number => p != null && Number.isFinite(p))
  if (reales.length === 0) return { fase: produccion[0], por: 'postura', siguiente: siguienteDe(produccion[0]), cambioDesde: null, notaPeso: null }

  const pico = Math.max(...reales)
  const ultima = reales[reales.length - 1]
  const faseDePico = produccion.find(f => f.bajo_pico != null)
  if (faseDePico && ultima >= pico - Number(faseDePico.bajo_pico)) {
    return { fase: faseDePico, por: 'pico', siguiente: siguienteDe(faseDePico), cambioDesde: null, notaPeso: null }
  }
  const porNivel = produccion.filter(f => f.postura_min != null)
  const fase = porNivel.find(f => ultima >= Number(f.postura_min)) ?? porNivel[porNivel.length - 1] ?? produccion[produccion.length - 1]
  return { fase, por: 'postura', siguiente: siguienteDe(fase), cambioDesde: null, notaPeso: null }
}

/**
 * Cómo se clasifica un alimento de ponedoras en el catálogo: con las fases del
 * programa, más las clases que ya existían (levante general, pollitas, otros).
 */
export const CATEGORIAS_ALIMENTO_AVES: { value: string; label: string }[] = [
  ...CATEGORIAS_FASE.map(c => ({ value: c.v as string, label: c.t })),
  { value: 'levante', label: 'Levante (general)' },
  { value: 'pollitas_ponedoras', label: 'Pollitas ponedoras' },
  { value: 'otros', label: 'Otros' },
]

/** ¿El alimento sirve para la fase? Un "levante" general sirve para cualquier fase de levante. */
export function alimentoSirveParaFase(categoriaAlimento: string | null, fase: CategoriaFase): boolean | null {
  if (!categoriaAlimento || categoriaAlimento === 'otros' || categoriaAlimento === 'pollitas_ponedoras') return null
  if (categoriaAlimento === 'levante') return fase !== 'postura' && fase !== 'prepostura'
  return categoriaAlimento === fase
}
