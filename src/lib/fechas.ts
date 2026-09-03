/**
 * Fechas en calendario local, no en UTC.
 *
 * `new Date().toISOString().split('T')[0]` devuelve la fecha en UTC: en Colombia
 * (UTC−5) eso significa que desde las 7 pm de la noche devuelve la fecha de mañana,
 * y todo lo que se registra en la tarde queda guardado un día adelante. Estas
 * funciones arman el `YYYY-MM-DD` desde el calendario local del navegador.
 */

/** Fecha de `d` (por defecto hoy) como `YYYY-MM-DD` en hora local. */
export function aFechaLocal(d: Date = new Date()): string {
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/** Hoy como `YYYY-MM-DD` en hora local. */
export function hoyLocal(): string {
  return aFechaLocal()
}

/** Convierte un `YYYY-MM-DD` en un Date a medianoche local (evita el corrimiento de zona). */
export function desdeFechaLocal(fecha: string): Date {
  return new Date(fecha + 'T00:00:00')
}
