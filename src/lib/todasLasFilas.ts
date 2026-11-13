/**
 * La base entrega como mucho 1.000 filas por consulta. Una finca con varios
 * lotes pasa de eso (Jericó tiene 1.113 días), así que lo que suma todos los
 * días de una finca pide de a 1.000 hasta acabar.
 *
 * La consulta que se pasa debe tener un orden fijo (por ejemplo `.order('id')`),
 * para que ninguna fila se repita ni se salte entre una página y otra.
 */
export async function todasLasFilas<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>,
): Promise<{ data: T[] }> {
  const filas: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data } = await pagina(desde, desde + 999)
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return { data: filas }
}
