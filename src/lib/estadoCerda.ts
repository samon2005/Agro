/**
 * El estado de la cerda, calculado desde su historia: servicios, eventos de la
 * gestación (repetición, vacía, aborto), partos y destetes. Es la única fuente:
 * la tabla de cerdas, la ficha, las alertas y los indicadores leen de aquí, y la
 * columna reproductoras_cerdos.estado solo la escribe actualizarEstadoCerda()
 * (la usan el Resumen, el Historial y la versión publicada).
 *
 * Fase 1A del plan de cerdos. José: "clasificación según su estado fisiológico".
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ConfigCerdos } from '@/lib/configCerdos'
import { aFechaLocal, desdeFechaLocal } from '@/lib/fechas'

export type EstadoCerda =
  | 'vacia' | 'servida' | 'gestante' | 'lactante' | 'descartada'
  | 'en_cuarentena' | 'en_recuperacion' | 'aborto' | 'repetidora'

export type TipoEventoGestacion = 'repeticion' | 'vacia' | 'aborto'

/** Nombre y color de cada estado. Rojo y ámbar solo para los que piden atención. */
export const ESTADOS_CERDA: Record<EstadoCerda, { label: string; clase: string }> = {
  vacia: { label: 'Vacía', clase: 'bg-gray-100 text-gray-700 border-gray-300' },
  servida: { label: 'Servida', clase: 'bg-blue-100 text-blue-700 border-blue-300' },
  gestante: { label: 'Gestante', clase: 'bg-purple-100 text-purple-700 border-purple-300' },
  lactante: { label: 'Lactante', clase: 'bg-pink-100 text-pink-700 border-pink-300' },
  en_cuarentena: { label: 'En cuarentena', clase: 'bg-sky-100 text-sky-700 border-sky-300' },
  en_recuperacion: { label: 'En recuperación', clase: 'bg-amber-100 text-amber-800 border-amber-300' },
  repetidora: { label: 'Repetidora', clase: 'bg-amber-100 text-amber-800 border-amber-300' },
  aborto: { label: 'Abortó', clase: 'bg-red-100 text-red-700 border-red-300' },
  descartada: { label: 'Descartada', clase: 'bg-gray-200 text-gray-600 border-gray-400' },
}

/** Qué le pasa al servicio cuando se registra cada evento de la gestación. */
export const RESULTADO_SERVICIO: Record<TipoEventoGestacion, 'repetido' | 'fallido' | 'abortado'> = {
  repeticion: 'repetido',
  vacia: 'fallido',
  aborto: 'abortado',
}

export const EVENTOS_GESTACION: Record<TipoEventoGestacion, { label: string; verbo: string }> = {
  repeticion: { label: 'Repitió celo', verbo: 'repitió celo' },
  vacia: { label: 'Salió vacía', verbo: 'salió vacía' },
  aborto: { label: 'Abortó', verbo: 'abortó' },
}

// ─────────────────────────────────── El cálculo ───────────────────────────────────

export interface CerdaHistoria { estado: string; cuarentena_hasta: string | null; partos_previos: number }
export interface ServicioHistoria { id: string; fecha_servicio: string; estado: string; prenez_confirmada: boolean }
export interface EventoHistoria { fecha: string; tipo: TipoEventoGestacion; servicio_id: string | null }
export interface PartoHistoria { id: string; fecha_parto: string }
export interface DesteteHistoria { parto_id: string | null; fecha_destete: string }

export interface ResultadoEstado {
  estado: EstadoCerda
  /** Desde qué fecha está en ese estado (null si no se sabe) */
  desde: string | null
  /** Hasta cuándo, si el estado tiene fin conocido (cuarentena) */
  hasta?: string | null
  /** Partos que traía al llegar más los registrados en la app */
  numeroPartos: number
}

const MS_DIA = 86_400_000
const sumarDias = (f: string, n: number) => aFechaLocal(new Date(desdeFechaLocal(f).getTime() + n * MS_DIA))
const diasEntre = (desde: string, hasta: string) => Math.round((desdeFechaLocal(hasta).getTime() - desdeFechaLocal(desde).getTime()) / MS_DIA)

type Hito =
  | { tipo: 'parto'; fecha: string; orden: 0 }
  | { tipo: 'destete'; fecha: string; orden: 1 }
  | { tipo: 'evento'; fecha: string; orden: 2; evento: EventoHistoria }
  | { tipo: 'servicio'; fecha: string; orden: 3; servicio: ServicioHistoria }

/**
 * El estado sale de lo último que le pasó a la cerda:
 * parto sin destete → lactante; destete → vacía, o en recuperación si pasaron
 * los días destete-servicio sin servirla; servicio → servida, o gestante si se
 * confirmó; repetición → repetidora y aborto → abortó (hasta el siguiente
 * servicio); diagnóstico de vacía → vacía; sin historia → en cuarentena (si la
 * tiene vigente) o vacía. La descartada se queda descartada.
 */
export function estadoCerda(p: {
  cerda: CerdaHistoria
  servicios: ServicioHistoria[]
  eventos: EventoHistoria[]
  partos: PartoHistoria[]
  destetes: DesteteHistoria[]
  cfg: ConfigCerdos
  hoy?: string
}): ResultadoEstado {
  const hoy = p.hoy ?? aFechaLocal()
  const numeroPartos = (p.cerda.partos_previos ?? 0) + p.partos.length
  if (p.cerda.estado === 'descartada') return { estado: 'descartada', desde: null, numeroPartos }

  // El mismo día, primero lo que cierra un ciclo y después lo que abre otro:
  // si repite celo y la sirven ese mismo día, queda servida.
  const hitos: Hito[] = [
    ...p.partos.map(x => ({ tipo: 'parto' as const, fecha: x.fecha_parto, orden: 0 as const })),
    ...p.destetes.map(x => ({ tipo: 'destete' as const, fecha: x.fecha_destete, orden: 1 as const })),
    ...p.eventos.map(x => ({ tipo: 'evento' as const, fecha: x.fecha, orden: 2 as const, evento: x })),
    ...p.servicios.map(x => ({ tipo: 'servicio' as const, fecha: x.fecha_servicio, orden: 3 as const, servicio: x })),
  ].filter(h => h.fecha <= hoy)
  hitos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden)
  const ultimo = hitos[hitos.length - 1]

  if (!ultimo) {
    if (p.cerda.cuarentena_hasta && p.cerda.cuarentena_hasta >= hoy)
      return { estado: 'en_cuarentena', desde: null, hasta: p.cerda.cuarentena_hasta, numeroPartos }
    return { estado: 'vacia', desde: p.cerda.cuarentena_hasta ? sumarDias(p.cerda.cuarentena_hasta, 1) : null, numeroPartos }
  }

  switch (ultimo.tipo) {
    case 'parto':
      return { estado: 'lactante', desde: ultimo.fecha, numeroPartos }
    case 'destete': {
      const limite = sumarDias(ultimo.fecha, p.cfg.reproduccion.desteteServicioMax)
      if (diasEntre(limite, hoy) > 0) return { estado: 'en_recuperacion', desde: sumarDias(limite, 1), numeroPartos }
      return { estado: 'vacia', desde: ultimo.fecha, numeroPartos }
    }
    case 'evento': {
      const e = ultimo.evento.tipo
      return { estado: e === 'repeticion' ? 'repetidora' : e === 'aborto' ? 'aborto' : 'vacia', desde: ultimo.fecha, numeroPartos }
    }
    case 'servicio': {
      const s = ultimo.servicio
      // Datos de antes de la Fase 1A: el resultado quedó solo en el servicio, sin evento
      if (s.estado === 'repetido') return { estado: 'repetidora', desde: s.fecha_servicio, numeroPartos }
      if (s.estado === 'fallido') return { estado: 'vacia', desde: s.fecha_servicio, numeroPartos }
      if (s.estado === 'abortado') return { estado: 'aborto', desde: s.fecha_servicio, numeroPartos }
      if (s.estado === 'confirmado' || s.prenez_confirmada || s.estado === 'parido')
        return { estado: 'gestante', desde: s.fecha_servicio, numeroPartos }
      return { estado: 'servida', desde: s.fecha_servicio, numeroPartos }
    }
  }
}

/** "desde el 3 nov" · "hasta el 10 dic" · null si no se sabe */
export function desdeCuando(r: ResultadoEstado): string | null {
  const f = (x: string) => desdeFechaLocal(x).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  if (r.hasta) return `hasta el ${f(r.hasta)}`
  if (r.desde) return `desde el ${f(r.desde)}`
  return null
}

/** "Repetidora desde el 3 nov" · "En cuarentena hasta el 10 dic" */
export function textoEstado(r: ResultadoEstado): string {
  const cuando = desdeCuando(r)
  return cuando ? `${ESTADOS_CERDA[r.estado].label} ${cuando}` : ESTADOS_CERDA[r.estado].label
}

/** Último día de cuarentena de una primeriza que entra hoy (o en la fecha dada). */
export function finCuarentena(fechaIngreso: string, cfg: ConfigCerdos): string {
  return sumarDias(fechaIngreso, Math.max(cfg.reemplazo.diasCuarentena, 1) - 1)
}

// ─────────────────────────── Guardar el estado en la base ───────────────────────────

type Db = SupabaseClient<Database>

/**
 * Recalcula y guarda el estado y el número de partos de una cerda. Se llama
 * después de cualquier cambio en su historia: servicio, evento de gestación,
 * parto, destete, o al borrar o anular uno de ellos.
 */
export async function actualizarEstadoCerda(supabase: Db, cerdaId: string, cfg: ConfigCerdos): Promise<ResultadoEstado | null> {
  const [cerda, servicios, eventos, partos, destetes] = await Promise.all([
    supabase.from('reproductoras_cerdos').select('estado, cuarentena_hasta, partos_previos, numero_partos').eq('id', cerdaId).maybeSingle(),
    supabase.from('servicios_cerdos').select('id, fecha_servicio, estado, prenez_confirmada').eq('reproductora_id', cerdaId),
    supabase.from('eventos_gestacion_cerdos').select('fecha, tipo, servicio_id').eq('reproductora_id', cerdaId),
    supabase.from('partos_cerdos').select('id, fecha_parto').eq('reproductora_id', cerdaId),
    supabase.from('destetes_cerdos').select('parto_id, fecha_destete').eq('reproductora_id', cerdaId),
  ])
  if (!cerda.data) return null
  const r = estadoCerda({
    cerda: cerda.data, servicios: servicios.data ?? [], eventos: eventos.data ?? [],
    partos: partos.data ?? [], destetes: destetes.data ?? [], cfg,
  })
  if (r.estado !== cerda.data.estado || r.numeroPartos !== cerda.data.numero_partos) {
    await supabase.from('reproductoras_cerdos').update({ estado: r.estado, numero_partos: r.numeroPartos }).eq('id', cerdaId)
  }
  return r
}

/**
 * Pone al día, con los datos que la pantalla ya cargó, las cerdas cuyo estado
 * guardado quedó viejo. Hace falta porque algunos estados cambian solos con el
 * tiempo (termina la cuarentena, se pasan los días sin celo después del destete).
 * Devuelve el estado calculado de cada cerda.
 */
export async function sincronizarEstados(supabase: Db, p: {
  cerdas: (CerdaHistoria & { id: string; numero_partos: number })[]
  servicios: (ServicioHistoria & { reproductora_id: string })[]
  eventos: (EventoHistoria & { reproductora_id: string })[]
  partos: (PartoHistoria & { reproductora_id: string })[]
  destetes: (DesteteHistoria & { reproductora_id: string })[]
  cfg: ConfigCerdos
}): Promise<Map<string, ResultadoEstado>> {
  const de = <T extends { reproductora_id: string }>(lista: T[], id: string) => lista.filter(x => x.reproductora_id === id)
  const out = new Map<string, ResultadoEstado>()
  const cambios: PromiseLike<unknown>[] = []
  for (const c of p.cerdas) {
    const r = estadoCerda({
      cerda: c, servicios: de(p.servicios, c.id), eventos: de(p.eventos, c.id),
      partos: de(p.partos, c.id), destetes: de(p.destetes, c.id), cfg: p.cfg,
    })
    out.set(c.id, r)
    if (r.estado !== c.estado || r.numeroPartos !== c.numero_partos)
      cambios.push(supabase.from('reproductoras_cerdos').update({ estado: r.estado, numero_partos: r.numeroPartos }).eq('id', c.id))
  }
  await Promise.all(cambios)
  return out
}
