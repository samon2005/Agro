const MS_DIA = 24 * 60 * 60 * 1000

/** Semana de postura (1-indexada) a la que corresponde `fecha`, según la fecha de inicio de postura del lote. */
export function semanaDePostura(fechaInicioPostura: string | null, fecha: string): number | null {
  if (!fechaInicioPostura) return null
  const inicio = new Date(fechaInicioPostura + 'T00:00:00')
  const d = new Date(fecha + 'T00:00:00')
  return Math.max(1, Math.floor((d.getTime() - inicio.getTime()) / (7 * MS_DIA)) + 1)
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
