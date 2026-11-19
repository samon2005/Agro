/**
 * Desempeño y pago de cada operario en un periodo (reunión con Juliana, nov 2026).
 * Única fuente de estas cuentas: la página de Operarios y el cierre semanal leen
 * de aquí.
 *
 * El pago es un estimado por lo trabajado según cómo se le paga a cada uno. No
 * incluye prestaciones, aportes a seguridad social ni recargos: eso lo liquida el
 * contador con los valores de ley del año.
 */
export type PeriodoPago = 'mensual' | 'quincenal' | 'semanal' | 'diario' | 'por_hora' | 'por_tarea'
export type TipoContrato = 'indefinido' | 'fijo' | 'obra_labor' | 'prestacion_servicios' | 'jornal'

export const PERIODOS_PAGO: { v: PeriodoPago; t: string }[] = [
  { v: 'mensual', t: 'Mensual' },
  { v: 'quincenal', t: 'Quincenal' },
  { v: 'semanal', t: 'Semanal' },
  { v: 'diario', t: 'Por día (jornal)' },
  { v: 'por_hora', t: 'Por hora' },
  { v: 'por_tarea', t: 'Por tarea' },
]

export const CONTRATOS: { v: TipoContrato; t: string }[] = [
  { v: 'indefinido', t: 'Término indefinido' },
  { v: 'fijo', t: 'Término fijo' },
  { v: 'obra_labor', t: 'Obra o labor' },
  { v: 'prestacion_servicios', t: 'Prestación de servicios' },
  { v: 'jornal', t: 'Jornal (por días)' },
]

export interface TareaD { operario_id: string | null; fecha: string; estado: string; completada_en: string | null }
export interface TurnoD { operario_id: string; fecha: string; hora_inicio: string; hora_fin: string | null }
export interface OperarioD { id: string; pago_monto: number | null; pago_periodo: string | null }

export interface Desempeno {
  asignadas: number
  hechas: number
  /** Hechas el mismo día que tocaban (o antes) */
  aTiempo: number
  /** Ya pasó su día y no se hicieron */
  atrasadas: number
  /** Hechas de las asignadas, en % (null sin tareas) */
  cumplimiento: number | null
  diasTrabajados: number
  horas: number
  /** Lo que toca pagar por lo trabajado (null si no tiene pago anotado) */
  pago: number | null
  /** Cómo se sacó el pago, en palabras */
  comoPago: string
}

/** Horas entre dos horas del día ("06:00", "14:30"); si la salida es menor, pasó la medianoche */
export function horasTurno(inicio: string, fin: string | null): number {
  if (!fin) return 0
  const m = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + (b || 0) }
  let d = m(fin) - m(inicio)
  if (d < 0) d += 24 * 60
  return Math.round((d / 60) * 100) / 100
}

/** Días calendario entre dos fechas YYYY-MM-DD, contando ambas */
export function diasEntre(desde: string, hasta: string): number {
  const ms = new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()
  return Math.max(0, Math.round(ms / 86400000) + 1)
}

const DIAS_PERIODO: Partial<Record<PeriodoPago, number>> = { mensual: 30, quincenal: 15, semanal: 7 }

export function desempenoOperario(op: OperarioD, tareas: TareaD[], turnos: TurnoD[], desde: string, hasta: string, hoy: string): Desempeno {
  const t = tareas.filter(x => x.operario_id === op.id && x.fecha >= desde && x.fecha <= hasta)
  const hechas = t.filter(x => x.estado === 'completada')
  const aTiempo = hechas.filter(x => !x.completada_en || x.completada_en.slice(0, 10) <= x.fecha).length
  const atrasadas = t.filter(x => x.estado !== 'completada' && x.fecha < hoy).length
  const tu = turnos.filter(x => x.operario_id === op.id && x.fecha >= desde && x.fecha <= hasta)
  const diasTrabajados = new Set(tu.map(x => x.fecha)).size
  const horas = Math.round(tu.reduce((s, x) => s + horasTurno(x.hora_inicio, x.hora_fin), 0) * 100) / 100

  const monto = op.pago_monto != null ? Number(op.pago_monto) : null
  const periodo = op.pago_periodo as PeriodoPago | null
  let pago: number | null = null
  let comoPago = 'Sin pago anotado'
  if (monto != null && periodo) {
    const base = DIAS_PERIODO[periodo]
    if (base) {
      const dias = diasEntre(desde, hasta)
      pago = (monto / base) * dias
      comoPago = `${dias} ${dias === 1 ? 'día' : 'días'} del periodo de ${base}`
    } else if (periodo === 'diario') {
      pago = monto * diasTrabajados
      comoPago = `${diasTrabajados} ${diasTrabajados === 1 ? 'día' : 'días'} con turno`
    } else if (periodo === 'por_hora') {
      pago = monto * horas
      comoPago = `${horas.toLocaleString('es-CO')} h en turnos`
    } else if (periodo === 'por_tarea') {
      pago = monto * hechas.length
      comoPago = `${hechas.length} ${hechas.length === 1 ? 'tarea hecha' : 'tareas hechas'}`
    }
    if (pago != null) pago = Math.round(pago)
  }

  return {
    asignadas: t.length,
    hechas: hechas.length,
    aTiempo,
    atrasadas,
    cumplimiento: t.length ? Math.round((hechas.length / t.length) * 100) : null,
    diasTrabajados,
    horas,
    pago,
    comoPago,
  }
}

/** Las tareas de toda la finca en un periodo, para el cierre semanal */
export function tareasDelPeriodo(tareas: TareaD[], desde: string, hasta: string, hoy: string) {
  const t = tareas.filter(x => x.fecha >= desde && x.fecha <= hasta)
  const hechas = t.filter(x => x.estado === 'completada').length
  return {
    asignadas: t.length,
    hechas,
    atrasadas: t.filter(x => x.estado !== 'completada' && x.fecha < hoy).length,
    cumplimiento: t.length ? Math.round((hechas / t.length) * 100) : null,
  }
}
