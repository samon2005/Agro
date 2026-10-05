'use client'

import type { RefObject } from 'react'
import { toast } from 'sonner'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { descargarExcel, imprimirElemento, type Hoja } from '@/lib/exportar'

export type Vista = 'tabla' | 'grafica'

interface Props {
  /** Título del archivo y de la hoja impresa */
  titulo: string
  subtitulo?: string
  /** Las tablas que van al Excel (se arman al hacer clic) */
  hojas: () => Hoja[]
  /** Lo que se imprime */
  imprimir: RefObject<HTMLElement | null>
  /** Si la tabla también se puede ver como gráfica */
  vista?: Vista
  onVista?: (v: Vista) => void
  className?: string
}

/**
 * Los botones de cada tabla: verla como tabla o como gráfica, imprimirla y
 * bajarla a Excel. No se imprime a sí misma.
 */
export function BarraExportar({ titulo, subtitulo, hojas, imprimir, vista, onVista, className }: Props) {
  const archivo = `${titulo} ${new Date().toISOString().slice(0, 10)}`.replace(/[\\/:*?"<>|]/g, '-')
  return (
    <div data-no-imprimir className={cn('flex flex-wrap items-center gap-1', className)}>
      {vista && onVista && (
        <div className="mr-1 inline-flex rounded-lg bg-gray-100 p-0.5">
          {(['tabla', 'grafica'] as const).map(v => (
            <button
              key={v} type="button" onClick={() => onVista(v)}
              className={cn('h-7 rounded-md px-2.5 text-xs font-medium', vista === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
            >
              {v === 'tabla' ? 'Tabla' : 'Gráfica'}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => { if (imprimir.current) imprimirElemento(imprimir.current, titulo, subtitulo) }}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100"
        title="Imprimir"
      >
        <Ic n="recibo" className="size-3.5" /> Imprimir
      </button>
      <button
        type="button"
        onClick={() => {
          const h = hojas()
          if (h.every(x => x.filas.length === 0)) { toast.error('No hay datos para exportar'); return }
          descargarExcel(archivo, h)
        }}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-green-700 hover:bg-green-50"
        title="Descargar en Excel"
      >
        <Ic n="inventario" className="size-3.5" /> Excel
      </button>
    </div>
  )
}
