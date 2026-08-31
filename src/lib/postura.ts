const MS_DIA = 24 * 60 * 60 * 1000

/** Semana de postura (1-indexada) a la que corresponde `fecha`, según la fecha de inicio de postura del lote. */
export function semanaDePostura(fechaInicioPostura: string | null, fecha: string): number | null {
  if (!fechaInicioPostura) return null
  const inicio = new Date(fechaInicioPostura + 'T00:00:00')
  const d = new Date(fecha + 'T00:00:00')
  return Math.max(1, Math.floor((d.getTime() - inicio.getTime()) / (7 * MS_DIA)) + 1)
}
