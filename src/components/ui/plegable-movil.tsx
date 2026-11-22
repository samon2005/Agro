'use client'

import { useState, type ReactNode } from 'react'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

/**
 * Una sección grande (gráficas, predicción, calidad…) que en celular se ve
 * como una barra con su título y se despliega al tocarla, para que la pantalla
 * no se sature (Samuel, nov 2026). En computador se ve completa, como siempre.
 */
export function PlegableMovil({ titulo, icono, resumen, className, children }: {
  titulo: string
  icono?: NombreIcono
  resumen?: string
  className?: string
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className={className}>
      <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
        className={cn('flex w-full items-center gap-2 rounded-2xl bg-white p-4 text-left ring-1 ring-black/5 sm:hidden', abierto && 'mb-2')}>
        {icono && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <Ic n={icono} className="size-3.5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-semibold text-gray-700">{titulo}</span>
          {resumen && !abierto && <span className="block truncate text-[0.75rem] text-gray-500">{resumen}</span>}
        </span>
        <span className={cn('shrink-0 text-gray-400 transition-transform', abierto && 'rotate-180')} aria-hidden>▾</span>
      </button>
      <div className={cn('h-full', !abierto && 'hidden sm:block')}>{children}</div>
    </div>
  )
}
