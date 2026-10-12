'use client'

interface Entrada { name?: string | number; value?: number | string | null; color?: string; dataKey?: string | number; payload?: { fill?: string } }

/**
 * El globo oscuro que aparece al pasar el cursor. Con un solo dato muestra el
 * número grande y debajo de qué es; con varios, una fila por serie con su
 * punto de color.
 */
export function TooltipGrafico({ active, payload, label, formato, titulo }: {
  active?: boolean
  payload?: Entrada[]
  label?: string | number
  formato?: (v: number) => string
  titulo?: (label: string | number | undefined) => string
}) {
  if (!active || !payload?.length) return null
  const filas = payload.filter(p => p.value != null && p.value !== '' && p.dataKey !== 'guia_area')
  if (!filas.length) return null
  const valor = (v: Entrada['value']) => (typeof v === 'number' ? (formato ? formato(v) : v.toLocaleString('es-CO')) : v)
  const rotulo = label != null && label !== '' ? (titulo ? titulo(label) : String(label)) : null
  const caja = 'rounded-xl bg-[#16231a] px-3 py-2 text-white shadow-[0_10px_30px_-10px_rgb(22_35_26/60%)]'

  if (filas.length === 1) {
    const p = filas[0]
    return (
      <div className={caja}>
        <p className="text-sm font-semibold tabular-nums">{valor(p.value)}</p>
        <p className="text-[0.6875rem] text-white/60">{rotulo ?? p.name}{rotulo && p.name ? ` · ${p.name}` : ''}</p>
      </div>
    )
  }
  return (
    <div className={`${caja} min-w-40 text-xs`}>
      {rotulo && <p className="mb-1.5 text-[0.6875rem] text-white/60">{rotulo}</p>}
      {filas.map((p, i) => (
        <p key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="size-2 rounded-full ring-1 ring-white/30" style={{ background: p.color ?? p.payload?.fill }} />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums">{valor(p.value)}</span>
        </p>
      ))}
    </div>
  )
}
