/**
 * El relleno degradado bajo una curva: el color arriba y transparente abajo.
 * Va como hijo de la gráfica de recharts y se usa con `fill="url(#id)"`.
 */
export function Degradado({ id, color, fuerza = 0.28 }: { id: string; color: string; fuerza?: number }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={fuerza} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  )
}
