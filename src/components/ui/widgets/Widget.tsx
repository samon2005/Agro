import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Ic, type NombreIcono } from '@/components/ui/icon'

/**
 * La tarjeta base de los tableros: un título corto arriba, una acción opcional
 * a la derecha y el contenido. La explicación larga va en el (i), no en párrafos.
 */
export function Widget({ titulo, icono, info, accion, className, children, cuerpo }: {
  titulo?: ReactNode
  icono?: NombreIcono
  /** Ayuda que aparece al pasar el cursor por la (i) */
  info?: string
  accion?: ReactNode
  className?: string
  /** Clases del contenido (por defecto ocupa el alto que sobre) */
  cuerpo?: string
  children: ReactNode
}) {
  return (
    <section className={cn(
      'flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgb(22_35_26/4%),0_8px_24px_-12px_rgb(22_35_26/10%)] ring-1 ring-black/5',
      className,
    )}>
      {(titulo || accion) && (
        <header className="mb-3 flex items-start justify-between gap-2">
          {titulo && (
            <h3 className="flex min-w-0 items-center gap-2 text-[0.8125rem] font-semibold text-gray-700">
              {icono && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  <Ic n={icono} className="size-3.5" />
                </span>
              )}
              <span className="truncate">{titulo}</span>
              {info && (
                <span title={info} className="flex size-4 shrink-0 cursor-help items-center justify-center rounded-full bg-gray-100 text-[0.625rem] font-bold text-gray-400">i</span>
              )}
            </h3>
          )}
          {accion && <div className="shrink-0">{accion}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', cuerpo)}>{children}</div>
    </section>
  )
}

/** Un enlace o botón chico para la esquina de un widget */
export function AccionWidget({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const clase = 'inline-flex h-7 items-center gap-1 rounded-full bg-gray-100 px-2.5 text-[0.6875rem] font-medium text-gray-600 transition-colors hover:bg-green-50 hover:text-green-800'
  if (href) return <a href={href} className={clase}>{children}</a>
  return <button type="button" onClick={onClick} className={clase}>{children}</button>
}

/** Una píldora de dato: "Lohmann Brown", "5.000 aves", "semana 24 de vida" */
export function Pildora({ children, tono = 'gris', icono }: { children: ReactNode; tono?: 'gris' | 'verde' | 'ambar' | 'rojo'; icono?: NombreIcono }) {
  const t = {
    gris: 'bg-gray-100 text-gray-600',
    verde: 'bg-green-50 text-green-800',
    ambar: 'bg-amber-50 text-amber-800',
    rojo: 'bg-red-50 text-red-700',
  }[tono]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[0.6875rem] font-medium whitespace-nowrap', t)}>
      {icono && <Ic n={icono} className="size-3" />}
      {children}
    </span>
  )
}

/** La cuadrícula de 12 columnas de los tableros */
export function Cuadricula({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-12 gap-4', className)}>{children}</div>
}

/** Cuántas columnas ocupa un widget: en celular siempre todo el ancho */
export const ANCHO = {
  cuarto: 'col-span-12 sm:col-span-6 xl:col-span-3',
  tercio: 'col-span-12 md:col-span-6 xl:col-span-4',
  mitad: 'col-span-12 xl:col-span-6',
  dosTercios: 'col-span-12 xl:col-span-8',
  todo: 'col-span-12',
} as const
