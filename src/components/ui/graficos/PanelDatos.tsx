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
    <section className={cn('flex flex-col rounded-2xl bg-white p-4 ring-1 ring-black/5', className)}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: TINTA.primaria }}>{titulo}</h3>
          {subtitulo && <p className="text-xs" style={{ color: TINTA.tenue }}>{subtitulo}</p>}
        </div>
        <div className="flex items-center gap-2" data-no-imprimir>
          {accion}
          {vistas.length > 1 && (
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="tablist" aria-label="Cómo ver el dato">
              {vistas.map(v => (
                <button
                  key={v} type="button" role="tab" aria-selected={vista === v}
                  onClick={() => setVista(v)}
                  className={cn('h-6 rounded-md px-2 text-[0.6875rem] font-medium transition-colors',
                    vista === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
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
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-100">
            {columnas.map(c => (
              <th key={c.titulo} className={cn('px-2 py-1.5 font-medium', c.numero ? 'text-right' : 'text-left')} style={{ color: TINTA.tenue }}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              {f.map((v, j) => (
                <td key={j} className={cn('px-2 py-1.5', columnas[j]?.numero ? 'text-right tabular-nums' : 'text-left')} style={{ color: j === 0 ? TINTA.secundaria : TINTA.primaria }}>{celda(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t border-gray-200">
              {total.map((v, j) => (
                <td key={j} className={cn('px-2 py-1.5 font-semibold', columnas[j]?.numero ? 'text-right tabular-nums' : 'text-left')} style={{ color: TINTA.primaria }}>{celda(v)}</td>
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
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {items.map(i => (
        <li key={i.nombre} className="flex items-center gap-1.5 text-[0.6875rem]" style={{ color: TINTA.secundaria }}>
          <span className="size-2 rounded-full" style={{ background: i.color }} /> {i.nombre}
        </li>
      ))}
    </ul>
  )
}
