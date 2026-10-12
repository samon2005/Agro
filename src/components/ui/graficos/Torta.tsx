'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { GRIS_OTROS, TINTA, tonosPorOrden } from './paleta'
import { TooltipGrafico } from './TooltipGrafico'

export interface Porcion { nombre: string; valor: number; color?: string }

/**
 * Dona de "parte del todo": el total al centro y al lado la lista con su %.
 * Las partes van de mayor a menor y se pintan del verde más oscuro al más
 * claro. De la 6.ª en adelante se juntan en "Otros"; las que valen cero no se
 * dibujan.
 */
export function Torta({ porciones, formato = v => v.toLocaleString('es-CO'), etiquetaTotal = 'Total' }: {
  porciones: Porcion[]
  formato?: (v: number) => string
  etiquetaTotal?: string
}) {
  const positivas = porciones.filter(p => p.valor > 0).sort((a, b) => b.valor - a.valor)
  const partes = positivas.length > 6
    ? [...positivas.slice(0, 5), { nombre: 'Otros', valor: positivas.slice(5).reduce((s, p) => s + p.valor, 0) }]
    : positivas
  const tonos = tonosPorOrden(partes.length)
  const visibles = partes.map((p, i) => ({ ...p, color: p.nombre === 'Otros' && positivas.length > 6 ? GRIS_OTROS : tonos[i] }))
  const total = visibles.reduce((s, p) => s + p.valor, 0)

  if (total <= 0) return <p className="py-12 text-center text-sm text-gray-400">No hay datos para repartir</p>

  return (
    // La lista va al lado de la dona si la tarjeta es ancha, y debajo si es angosta
    <div className="@container">
    <div className="flex flex-col items-center gap-5 @md:flex-row @md:gap-6">
      <div className="relative size-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visibles} dataKey="valor" nameKey="nombre"
              innerRadius="68%" outerRadius="100%" paddingAngle={visibles.length > 1 ? 2.5 : 0} cornerRadius={visibles.length > 1 ? 5 : 0}
              stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}
            >
              {visibles.map(p => <Cell key={p.nombre} fill={p.color} />)}
            </Pie>
            <Tooltip content={<TooltipGrafico formato={formato} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[0.6875rem]" style={{ color: TINTA.tenue }}>{etiquetaTotal}</p>
          <p className="text-xl font-semibold tracking-tight" style={{ color: TINTA.primaria }}>{formato(total)}</p>
        </div>
      </div>
      <ul className="@container w-full min-w-0 flex-1 space-y-2.5 text-sm @md:max-w-xs">
        {visibles.map(p => (
          <li key={p.nombre} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="truncate" style={{ color: TINTA.secundaria }}>{p.nombre}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              {/* El valor solo si hay espacio: el nombre y el % van primero */}
              <span className="hidden text-xs @[16rem]:inline" style={{ color: TINTA.tenue }}>{formato(p.valor)}</span>
              <span className="w-10 text-right font-semibold" style={{ color: TINTA.primaria }}>
                {((p.valor / total) * 100).toLocaleString('es-CO', { maximumFractionDigits: 0 })} %
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  )
}
