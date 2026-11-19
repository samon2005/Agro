/**
 * Parámetros de aves de cada finca. Como en cerdos (lib/configCerdos), cada finca
 * parte de los valores de siempre y guarda en `fincas.config_aves` solo lo que
 * cambie. Las alertas y las sugerencias leen de aquí.
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
}

export const CONFIG_AVES_DEFECTO: ConfigAves = {
  umbralRotosPct: 3,
  baseReferenciaId: null,
}

/** La configuración de la finca: lo guardado encima de los valores de siempre. */
export function leerConfigAves(guardado: Json | null | undefined): ConfigAves {
  const c = guardado && typeof guardado === 'object' && !Array.isArray(guardado) ? guardado as Record<string, unknown> : {}
  const umbral = Number(c.umbralRotosPct)
  return {
    umbralRotosPct: Number.isFinite(umbral) && umbral > 0 && umbral <= 50 ? umbral : CONFIG_AVES_DEFECTO.umbralRotosPct,
    baseReferenciaId: typeof c.baseReferenciaId === 'string' && c.baseReferenciaId ? c.baseReferenciaId : null,
  }
}

/** Lo que se guarda: solo lo que es distinto de los valores de siempre. */
export function configAvesParaGuardar(c: ConfigAves): Json | null {
  const out: Record<string, number | string> = {}
  if (c.umbralRotosPct !== CONFIG_AVES_DEFECTO.umbralRotosPct) out.umbralRotosPct = c.umbralRotosPct
  if (c.baseReferenciaId) out.baseReferenciaId = c.baseReferenciaId
  return Object.keys(out).length ? out : null
}
