import * as React from 'react'
import { cn } from '@/lib/utils'
import { Ic, type NombreIcono } from '@/components/ui/icon'

export type TonoIndicador = 'green' | 'amber' | 'orange' | 'red' | 'blue' | 'purple' | 'pink' | 'gray'

/**
 * Un color por indicador, siempre como acento: la barra lateral, el chip del
 * icono y el subtítulo. La tarjeta se queda blanca para que el número mande.
 */
const TONOS: Record<TonoIndicador, { barra: string; chip: string; detalle: string }> = {
  green:  { barra: 'bg-green-500',  chip: 'bg-green-100 text-green-700',   detalle: 'text-green-700' },
  amber:  { barra: 'bg-amber-500',  chip: 'bg-amber-100 text-amber-700',   detalle: 'text-amber-700' },
  orange: { barra: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700', detalle: 'text-orange-700' },
  red:    { barra: 'bg-red-500',    chip: 'bg-red-100 text-red-700',       detalle: 'text-red-700' },
  blue:   { barra: 'bg-blue-500',   chip: 'bg-blue-100 text-blue-700',     detalle: 'text-blue-700' },
  purple: { barra: 'bg-purple-500', chip: 'bg-purple-100 text-purple-700', detalle: 'text-purple-700' },
  pink:   { barra: 'bg-pink-500',   chip: 'bg-pink-100 text-pink-700',     detalle: 'text-pink-700' },
  gray:   { barra: 'bg-gray-400',   chip: 'bg-gray-100 text-gray-600',     detalle: 'text-gray-500' },
}

interface Props extends Omit<React.ComponentProps<'div'>, 'title'> {
  etiqueta: React.ReactNode
  valor: React.ReactNode
  /** Texto pequeño bajo el número: unidad, comparación, fecha */
  detalle?: React.ReactNode
  icono?: NombreIcono
  tono?: TonoIndicador
  /** El número en tamaño menor, para textos largos ("Sin registrar") */
  compacto?: boolean
}

export function Indicador({ etiqueta, valor, detalle, icono, tono = 'gray', compacto, className, children, ...props }: Props) {
  const t = TONOS[tono]
  return (
    <div
      data-slot="indicador"
      className={cn(
        'relative flex min-h-[6.25rem] flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-3.5 transition-[box-shadow,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_10px_24px_-14px_rgb(27_26_23/20%)]',
        className
      )}
      {...props}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', t.barra)} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-gray-500">{etiqueta}</p>
        {icono && (
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', t.chip)}>
            <Ic n={icono} className="size-[15px]" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className={cn('font-heading leading-none tracking-tight text-gray-900', compacto ? 'text-lg font-medium' : 'text-[1.75rem] font-medium')}>
          {valor}
        </p>
        {detalle && <p className={cn('mt-1.5 text-xs leading-snug', t.detalle)}>{detalle}</p>}
        {children}
      </div>
    </div>
  )
}

/** Un grupo de indicadores con su título pequeño encima, para que se lea por bloques. */
export function GrupoIndicadores({ titulo, columnas = 4, className, children }: {
  titulo?: string
  columnas?: 2 | 3 | 4 | 5
  className?: string
  children: React.ReactNode
}) {
  const cols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
  }[columnas]
  return (
    <section className={cn('space-y-2', className)}>
      {titulo && (
        <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-gray-400">
          {titulo}
          <span aria-hidden className="h-px flex-1 bg-gray-200" />
        </p>
      )}
      <div className={cn('grid gap-3', cols)}>{children}</div>
    </section>
  )
}
