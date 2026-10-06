'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { GRIS_OTROS, TINTA } from './paleta'
import { TooltipGrafico } from './TooltipGrafico'

export interface Porcion { nombre: string; valor: number; color: string }

/**
 * Torta de "parte del todo": dona con el total al centro y la leyenda al lado
 * con el valor y el %. Solo sirve para pocas partes: de la 6.ª en adelante se
 * juntan en "Otros", y las que valen cero no se dibujan.
 */
export function Torta({ porciones, formato = v => v.toLocaleString('es-CO'), etiquetaTotal = 'Total' }: {
  porciones: Porcion[]
  formato?: (v: number) => string
  etiquetaTotal?: string
}) {
  const positivas = porciones.filter(p => p.valor > 0).sort((a, b) => b.valor - a.valor)
  const visibles = positivas.length > 6
    ? [...positivas.slice(0, 5), { nombre: 'Otros', valor: positivas.slice(5).reduce((s, p) => s + p.valor, 0), color: GRIS_OTROS }]
    : positivas
  const total = visibles.reduce((s, p) => s + p.valor, 0)

  if (total <= 0) return <p className="py-12 text-center text-sm text-gray-400">No hay datos para repartir</p>

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visibles} dataKey="valor" nameKey="nombre"
              innerRadius="62%" outerRadius="100%" paddingAngle={visibles.length > 1 ? 1.5 : 0}
              stroke="#ffffff" strokeWidth={2} isAnimationActive={false}
            >
              {visibles.map(p => <Cell key={p.nombre} fill={p.color} />)}
            </Pie>
            <Tooltip content={<TooltipGrafico formato={formato} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[0.6875rem]" style={{ color: TINTA.tenue }}>{etiquetaTotal}</p>
          <p className="text-lg font-semibold" style={{ color: TINTA.primaria }}>{formato(total)}</p>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm sm:max-w-xs">
        {visibles.map(p => (
          <li key={p.nombre} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
              <span className="truncate" style={{ color: TINTA.secundaria }}>{p.nombre}</span>
            </span>
            <span className="shrink-0 tabular-nums" style={{ color: TINTA.primaria }}>
              {formato(p.valor)}
              <span className="ml-2 inline-block w-12 text-right text-xs" style={{ color: TINTA.tenue }}>
                {((p.valor / total) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
