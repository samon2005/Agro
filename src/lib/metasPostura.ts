/**
 * Meta de postura de cada semana, en %. Es la única fuente: los cuadros del
 * galpón, la curva, el cierre semanal del Resumen y el Resumen de la finca leen
 * de aquí. La meta en huevos nunca se escribe: sale de las aves del día.
 *
 * Orden para saber la meta de una semana de vida:
 *   1. la que la finca puso para esa semana (lotes_aves.metas_postura_semanal);
 *   2. la de la guía de la línea genética (si el lote tiene guía);
 *   3. la meta de pico del lote (meta_postura_pct).
 */
import type { Json } from '@/types/database'
import { esperadoDeSemana, semanaDeVida, type FilaReferencia } from '@/lib/referencias'

export type MetasSemanales = Record<number, number>
export type OrigenMeta = 'propia' | 'guia' | 'pico'

export interface LoteConMeta {
  fecha_nacimiento: string | null
  meta_postura_pct: number | null
  metas_postura_semanal: Json | null
}

/** Lee las metas guardadas (jsonb) y descarta lo que no sea un % válido. */
export function leerMetasSemanales(guardado: Json | null | undefined): MetasSemanales {
  const out: MetasSemanales = {}
  if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return out
  for (const [k, v] of Object.entries(guardado)) {
    const semana = Number(k)
    const pct = typeof v === 'number' ? v : Number(v)
    if (Number.isInteger(semana) && semana > 0 && Number.isFinite(pct) && pct >= 0 && pct <= 100) out[semana] = pct
  }
  return out
}

/** La meta (%) de una semana de vida y de dónde salió, o null si no hay ninguna. */
export function metaDeSemana(
  lote: LoteConMeta, semana: number | null, guia?: Map<number, FilaReferencia>,
): { pct: number; origen: OrigenMeta } | null {
  if (semana != null) {
    const propia = leerMetasSemanales(lote.metas_postura_semanal)[semana]
    if (propia != null) return { pct: propia, origen: 'propia' }
    const deGuia = guia && guia.size > 0 ? esperadoDeSemana(guia, semana)?.postura : null
    if (deGuia != null) return { pct: Math.round(deGuia * 10) / 10, origen: 'guia' }
  }
  if (lote.meta_postura_pct != null) return { pct: Number(lote.meta_postura_pct), origen: 'pico' }
  return null
}

/** La meta (%) del lote en una fecha: busca la semana de vida de ese día. */
export function metaDeFecha(lote: LoteConMeta, fecha: string, guia?: Map<number, FilaReferencia>) {
  return metaDeSemana(lote, semanaDeVida(lote.fecha_nacimiento, fecha), guia)
}

/** Cuántos huevos son un % de postura con las aves de ese día. */
export function huevosDeMeta(aves: number | null | undefined, pct: number | null | undefined): number | null {
  if (aves == null || pct == null || aves <= 0) return null
  return Math.round(aves * (pct / 100))
}

/**
 * Propuesta de metas para llenar la tabla: la guía de la línea si la hay; si
 * no, una subida en línea recta desde el inicio de postura hasta el pico en 6
 * semanas, y el pico de ahí en adelante.
 */
export function proponerMetas(
  semanas: number[], pico: number | null, semanaInicio: number | null, guia?: Map<number, FilaReferencia>,
): MetasSemanales {
  const out: MetasSemanales = {}
  for (const s of semanas) {
    const deGuia = guia && guia.size > 0 ? esperadoDeSemana(guia, s)?.postura : null
    if (deGuia != null) { out[s] = Math.round(deGuia * 10) / 10; continue }
    if (pico == null) continue
    if (semanaInicio == null || s >= semanaInicio + 6) { out[s] = pico; continue }
    const avance = Math.max(0, s - semanaInicio + 1) / 6
    out[s] = Math.round(pico * avance * 10) / 10
  }
  return out
}

/** Las semanas de vida del ciclo de postura: desde que empieza a poner hasta el fin del ciclo. */
export function semanasDelCiclo(
  fechaNacimiento: string | null, inicioPostura: string | null, semanasCiclo: number | null,
): number[] {
  const desde = inicioPostura ? semanaDeVida(fechaNacimiento, inicioPostura) : null
  if (desde == null) return []
  const cuantas = Math.min(Math.max(semanasCiclo ?? 60, 1), 100)
  return Array.from({ length: cuantas }, (_, i) => desde + i)
}

/** Lo que se guarda: solo las semanas con número, redondeadas a un decimal. */
export function metasParaGuardar(metas: MetasSemanales): Json | null {
  const limpias = Object.entries(metas)
    .filter(([, v]) => Number.isFinite(v) && v >= 0 && v <= 100)
    .map(([k, v]) => [k, Math.round(v * 10) / 10] as const)
  return limpias.length > 0 ? Object.fromEntries(limpias) : null
}
