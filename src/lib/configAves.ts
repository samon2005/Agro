/**
 * Parámetros de aves de cada finca. Como en cerdos (lib/configCerdos), cada finca
 * parte de los valores de siempre y guarda en `fincas.config_aves` solo lo que
 * cambie. Las alertas, las sugerencias y el registro de aves leen de aquí.
 *
 * Varios valores son la "encuesta inicial del productor" que pidió José (19 nov
 * 2026): las semanas de levante y de producción cambian de un productor a otro,
 * así que no se fijan en el código.
 */
import type { Json } from '@/types/database'

export interface ConfigAves {
  /** Desde qué % de huevos rotos (en 7 días) se avisa. Las guías buscan menos de 3 %. */
  umbralRotosPct: number
  /**
   * La tabla base de la finca, "lo que se quiere tener": una referencia (una guía
   * o la copia ajustada de la finca). La meta de cada semana sale de ella cuando el
   * lote no tiene meta propia (lib/metasPostura). null = sin tabla base.
   */
  baseReferenciaId: string | null
  /** Semana de vida en que se venden las pollas de levante y venta (15, 16, 17, 18…) */
  semanaVentaPollas: number
  /** Semana de vida en que suele terminar la producción (70, 80…) */
  semanaFinProduccion: number
  /** Semanas de anticipación para avisar que se acerca la postura y preparar el galpón */
  avisoPosturaSemanas: number
  /** Días de anticipación para avisar una venta y su lista de chequeo */
  avisoVentaDias: number
  /** Densidad máxima recomendada (aves por m²); se avisa si se pasa */
  densidadMaxAvesM2: number
  /** Puntos propios de la finca en la lista de chequeo antes de vender */
  checklistVentaPropio: string[]
}

export const CONFIG_AVES_DEFECTO: ConfigAves = {
  umbralRotosPct: 3,
  baseReferenciaId: null,
  semanaVentaPollas: 16,
  semanaFinProduccion: 80,
  avisoPosturaSemanas: 2,
  avisoVentaDias: 7,
  densidadMaxAvesM2: 8,
  checklistVentaPropio: [],
}

const numero = (v: unknown, min: number, max: number, defecto: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : defecto
}

/** La configuración de la finca: lo guardado encima de los valores de siempre. */
export function leerConfigAves(guardado: Json | null | undefined): ConfigAves {
  const c = guardado && typeof guardado === 'object' && !Array.isArray(guardado) ? guardado as Record<string, unknown> : {}
  const d = CONFIG_AVES_DEFECTO
  return {
    umbralRotosPct: numero(c.umbralRotosPct, 0.1, 50, d.umbralRotosPct),
    baseReferenciaId: typeof c.baseReferenciaId === 'string' && c.baseReferenciaId ? c.baseReferenciaId : null,
    semanaVentaPollas: numero(c.semanaVentaPollas, 1, 40, d.semanaVentaPollas),
    semanaFinProduccion: numero(c.semanaFinProduccion, 30, 130, d.semanaFinProduccion),
    avisoPosturaSemanas: numero(c.avisoPosturaSemanas, 0, 8, d.avisoPosturaSemanas),
    avisoVentaDias: numero(c.avisoVentaDias, 0, 60, d.avisoVentaDias),
    densidadMaxAvesM2: numero(c.densidadMaxAvesM2, 1, 60, d.densidadMaxAvesM2),
    checklistVentaPropio: Array.isArray(c.checklistVentaPropio) ? c.checklistVentaPropio.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [],
  }
}

/** Lo que se guarda: solo lo que es distinto de los valores de siempre. */
export function configAvesParaGuardar(c: ConfigAves): Json | null {
  const out: Record<string, number | string | string[]> = {}
  const d = CONFIG_AVES_DEFECTO
  for (const k of ['umbralRotosPct', 'semanaVentaPollas', 'semanaFinProduccion', 'avisoPosturaSemanas', 'avisoVentaDias', 'densidadMaxAvesM2'] as const) {
    if (c[k] !== d[k]) out[k] = c[k]
  }
  if (c.baseReferenciaId) out.baseReferenciaId = c.baseReferenciaId
  if (c.checklistVentaPropio.length) out.checklistVentaPropio = c.checklistVentaPropio
  return Object.keys(out).length ? out : null
}
