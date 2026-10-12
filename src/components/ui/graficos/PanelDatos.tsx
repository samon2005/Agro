'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TINTA } from './paleta'

export type VistaDatos = 'grafica' | 'torta' | 'tabla'

const NOMBRE: Record<VistaDatos, string> = { grafica: 'Gráfica', torta: 'Torta', tabla: 'Tabla' }

/**
 * Una tarjeta del tablero: título, una línea de contexto y el dato en la vista
 * que se elija (gráfica, torta o tabla). Todas las tarjetas tienen tabla, para
 * leer los números exactos.
 */
export function PanelDatos({ titulo, subtitulo, vistas = ['grafica', 'tabla'], inicial, children, className, accion }: {
  titulo: string
  subtitulo?: string
  vistas?: VistaDatos[]
  inicial?: VistaDatos
  children: (vista: VistaDatos) => ReactNode
  className?: string
  accion?: ReactNode
}) {
  const [vista, setVista] = useState<VistaDatos>(inicial ?? vistas[0])
  return (
    <section className={cn('flex flex-col rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgb(22_35_26/4%),0_8px_24px_-12px_rgb(22_35_26/10%)] ring-1 ring-black/5', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold tracking-tight" style={{ color: TINTA.primaria }}>{titulo}</h3>
          {subtitulo && <p className="text-xs" style={{ color: TINTA.tenue }}>{subtitulo}</p>}
        </div>
        <div className="flex items-center gap-2" data-no-imprimir>
          {accion}
          {vistas.length > 1 && (
            <div className="inline-flex rounded-full bg-gray-100 p-0.5" role="tablist" aria-label="Cómo ver el dato">
              {vistas.map(v => (
                <button
                  key={v} type="button" role="tab" aria-selected={vista === v}
                  onClick={() => setVista(v)}
                  className={cn('h-6 rounded-full px-2.5 text-[0.6875rem] font-medium transition-colors',
                    vista === v ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
                >
                  {NOMBRE[v]}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children(vista)}</div>
    </section>
  )
}

/** Tabla simple de los datos de una tarjeta, con fila de total opcional */
export function TablaDatos({ columnas, filas, total }: {
  columnas: { titulo: string; numero?: boolean }[]
  filas: (string | number | null)[][]
  total?: (string | number | null)[]
}) {
  const celda = (v: string | number | null) => (v == null ? '—' : typeof v === 'number' ? v.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : v)
  if (filas.length === 0) return <p className="py-10 text-center text-sm text-gray-400">Sin datos en el período</p>
  return (
    <div className="max-h-80 overflow-auto rounded-xl ring-1 ring-black/5">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-green-50">
          <tr>
            {columnas.map(c => (
              <th key={c.titulo} className={cn('px-3 py-2 text-[0.6875rem] font-semibold tracking-wide whitespace-nowrap text-green-900/70 uppercase', c.numero ? 'text-right' : 'text-left')}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-t border-gray-100 transition-colors hover:bg-green-50/50">
              {f.map((v, j) => (
                <td key={j} className={cn('px-3 py-2', columnas[j]?.numero ? 'text-right tabular-nums' : 'text-left', j === 0 && 'font-medium')}
                  style={{ color: j === 0 ? TINTA.primaria : TINTA.secundaria }}>{celda(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot className="sticky bottom-0 bg-white">
            <tr className="border-t-2 border-green-100">
              {total.map((v, j) => (
                <td key={j} className={cn('px-3 py-2 font-semibold', columnas[j]?.numero ? 'text-right tabular-nums' : 'text-left')} style={{ color: TINTA.primaria }}>{celda(v)}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Leyenda compacta debajo de una gráfica de varias series */
export function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  if (items.length < 2) return null
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map(i => (
        <li key={i.nombre} className="flex items-center gap-1.5 text-xs" style={{ color: TINTA.secundaria }}>
          <span className="size-2.5 rounded-full" style={{ background: i.color }} /> {i.nombre}
        </li>
      ))}
    </ul>
  )
}
