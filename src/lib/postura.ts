const MS_DIA = 24 * 60 * 60 * 1000

/** Semana de postura (1-indexada) a la que corresponde `fecha`, según la fecha de inicio de postura del lote. */
export function semanaDePostura(fechaInicioPostura: string | null, fecha: string): number | null {
  if (!fechaInicioPostura) return null
  const inicio = new Date(fechaInicioPostura + 'T00:00:00')
  const d = new Date(fecha + 'T00:00:00')
  return Math.max(1, Math.floor((d.getTime() - inicio.getTime()) / (7 * MS_DIA)) + 1)
}

/**
 * La semana que lleva el lote en una fecha: en levante se cuenta desde que entró
 * al galpón; ya en postura, desde que empezó a poner. `fecha_inicio_postura` de
 * un lote en levante es solo lo esperado, así que no cuenta hasta que sea activo.
 */
export function semanaDelLote(
  lote: { estado: string; fecha_inicio: string; fecha_inicio_postura: string | null },
  fecha: string,
): { etapa: 'levante' | 'postura'; semana: number } {
  const enPostura = lote.estado !== 'preparacion' && lote.fecha_inicio_postura != null && fecha >= lote.fecha_inicio_postura
  const origen = enPostura ? lote.fecha_inicio_postura as string : lote.fecha_inicio
  const dias = (new Date(fecha + 'T00:00:00').getTime() - new Date(origen + 'T00:00:00').getTime()) / MS_DIA
  return { etapa: enPostura ? 'postura' : 'levante', semana: Math.max(1, Math.floor(dias / 7) + 1) }
}

export type EstadoPostura =
  | { iniciada: true; semana: number; inicioSemana: Date; finSemana: Date }
  | { iniciada: false; semanasFaltantes: number | null }

/**
 * Calcula si la postura ya inició para `fecha` respecto a `fechaInicioPostura`.
 * Si la fecha de inicio de postura es futura (o no está configurada), devuelve
 * cuántas semanas faltan en vez de forzar "semana 1".
 */
export function estadoPostura(fechaInicioPostura: string | null, fecha: string): EstadoPostura {
  if (!fechaInicioPostura) return { iniciada: false, semanasFaltantes: null }
  const inicio = new Date(fechaInicioPostura + 'T00:00:00')
  const d = new Date(fecha + 'T00:00:00')
  const diffMs = d.getTime() - inicio.getTime()
  if (diffMs < 0) {
    const semanasFaltantes = Math.ceil(Math.abs(diffMs) / (7 * MS_DIA))
    return { iniciada: false, semanasFaltantes }
  }
  const semana = Math.floor(diffMs / (7 * MS_DIA)) + 1
  const inicioSemana = new Date(inicio.getTime() + (semana - 1) * 7 * MS_DIA)
  const finSemana = new Date(inicioSemana.getTime() + 6 * MS_DIA)
  return { iniciada: true, semana, inicioSemana, finSemana }
}
