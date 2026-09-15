import * as React from 'react'
import { cn } from '@/lib/utils'
import { Ic, type NombreIcono } from '@/components/ui/icon'

export type TonoIndicador = 'green' | 'amber' | 'orange' | 'red' | 'blue' | 'purple' | 'pink' | 'gray'

/**
 * El color vive solo en el chip del icono y en el detalle: la tarjeta es blanca
 * y el número es negro, para que varias juntas no compitan entre sí.
 */
const TONOS: Record<TonoIndicador, { chip: string }> = {
  green:  { chip: 'bg-green-100 text-green-700' },
  amber:  { chip: 'bg-amber-100 text-amber-700' },
  orange: { chip: 'bg-orange-100 text-orange-700' },
  red:    { chip: 'bg-red-100 text-red-700' },
  blue:   { chip: 'bg-blue-100 text-blue-700' },
  purple: { chip: 'bg-purple-100 text-purple-700' },
  pink:   { chip: 'bg-pink-100 text-pink-700' },
  gray:   { chip: 'bg-gray-100 text-gray-600' },
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
      className={cn('flex flex-col rounded-2xl p-5', className)}
      {...props}
    >
      <div className="flex items-center gap-2.5">
        {icono && (
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', t.chip)}>
            <Ic n={icono} className="size-4" strokeWidth={1.9} />
          </span>
        )}
        <p className="text-[0.8125rem] leading-tight font-medium text-gray-600">{etiqueta}</p>
      </div>
      {/* El número va siempre a la misma distancia del rótulo: así los de una fila
          quedan alineados aunque una tarjeta tenga más líneas de detalle que otra. */}
      <div className="pt-4">
        <p className={cn(
          'leading-none tracking-tight tabular-nums',
          compacto ? 'text-lg' : 'text-[1.75rem]',
          valor === '—' ? 'font-normal text-gray-300' : 'font-semibold text-gray-900'
        )}>
          {valor}
        </p>
        {/* El detalle va en gris: el color queda para los estados (pasar un <span> con color).
            Siempre ocupa su línea, así los números de una fila quedan a la misma altura. */}
        <p className="mt-2 min-h-[1rem] text-xs leading-snug text-gray-500">{detalle}</p>
        {children}
      </div>
    </div>
  )
}

/**
 * Un bloque de indicadores con su rótulo. Las columnas se reparten solas: con
 * una, tres o cuatro tarjetas la fila queda llena, sin huecos a la derecha.
 */
export function GrupoIndicadores({ titulo, className, children }: {
  titulo?: string
  /** Se conserva por compatibilidad; el reparto ahora es automático */
  columnas?: 2 | 3 | 4 | 5
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {titulo && <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">{children}</div>
    </section>
  )
}
