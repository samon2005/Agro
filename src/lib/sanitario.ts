const MS_DIA = 24 * 60 * 60 * 1000

/**
 * El período de retiro se cuenta a partir del día SIGUIENTE a la fecha de fin
 * del tratamiento (fecha_fin no cuenta como día 1 de retiro).
 */
export function calcularFechaLiberacion(fechaFin: string, periodoRetiroDias: number): Date {
  const fin = new Date(fechaFin + 'T00:00:00')
  return new Date(fin.getTime() + (periodoRetiroDias + 1) * MS_DIA)
}
