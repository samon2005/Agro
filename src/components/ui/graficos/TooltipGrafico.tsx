'use client'

import { TINTA } from './paleta'

interface Entrada { name?: string | number; value?: number | string | null; color?: string; dataKey?: string | number; payload?: { fill?: string } }

/**
 * El cuadro que aparece al pasar el cursor: blanco, con el color de cada serie
 * en un punto al lado (el texto va en tinta, nunca del color de la serie).
 */
export function TooltipGrafico({ active, payload, label, formato, titulo }: {
  active?: boolean
  payload?: Entrada[]
  label?: string | number
  formato?: (v: number) => string
  titulo?: (label: string | number | undefined) => string
}) {
  if (!active || !payload?.length) return null
  const filas = payload.filter(p => p.value != null && p.value !== '')
  if (!filas.length) return null
  return (
    <div className="min-w-36 rounded-lg bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgb(27_26_23/30%),0_0_0_1px_rgb(27_26_23/8%)]">
      {label != null && label !== '' && <p className="mb-1 font-medium" style={{ color: TINTA.primaria }}>{titulo ? titulo(label) : label}</p>}
      {filas.map((p, i) => (
        <p key={i} className="flex items-center justify-between gap-4" style={{ color: TINTA.secundaria }}>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums" style={{ color: TINTA.primaria }}>
            {typeof p.value === 'number' ? (formato ? formato(p.value) : p.value.toLocaleString('es-CO')) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}
