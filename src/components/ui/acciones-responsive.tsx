'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

/**
 * Las acciones secundarias de una pantalla. En computador se ven en fila; en
 * celular se guardan en un botón "Más" para que la pantalla no se llene de
 * botones (pedido de Samuel, nov 2026). Las mismas acciones, sin duplicar lógica.
 */
export function AccionesResponsive({ children, etiqueta = 'Más', className }: { children: ReactNode; etiqueta?: string; className?: string }) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  // Se cierra al tocar fuera
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  return (
    <>
      <div className={cn('hidden flex-wrap items-center gap-1 sm:flex', className)}>{children}</div>
      <div ref={caja} className="relative sm:hidden">
        <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-gray-700 ring-1 ring-gray-200">
          <Ic n="ajustes" className="size-4" /> {etiqueta}
        </button>
        {abierto && (
          <div onClick={() => setAbierto(false)}
            className="absolute right-0 z-40 mt-1.5 flex w-60 flex-col items-stretch gap-0.5 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5 [&>*]:w-full [&>*]:justify-start [&>*]:rounded-lg">
            {children}
          </div>
        )}
      </div>
    </>
  )
}
