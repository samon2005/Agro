'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Ic } from '@/components/ui/icon'

export interface AlertaBandeja {
  id: string
  nivel: 'urgente' | 'revisar' | 'info'
  texto: ReactNode
  /** Detalle que se ve al abrir la bandeja */
  detalle?: ReactNode
  accion?: { texto: string; onClick?: () => void; href?: string }
}

const ESTILO = {
  urgente: { fila: 'bg-red-50 text-red-800', punto: 'bg-red-500', icono: 'sirena' as const },
  revisar: { fila: 'bg-amber-50 text-amber-900', punto: 'bg-amber-500', icono: 'alerta' as const },
  info: { fila: 'bg-green-50 text-green-900', punto: 'bg-green-600', icono: 'idea' as const },
}

/**
 * Todas las alertas en una sola franja: cerrada muestra cuántas hay de cada
 * nivel y la más importante; abierta, la lista completa con su acción. Así
 * ninguna se pierde y no ocupan media pantalla.
 */
export function BandejaAlertas({ alertas, titulo = 'Alertas' }: { alertas: AlertaBandeja[]; titulo?: string }) {
  const [abierta, setAbierta] = useState(false)
  if (alertas.length === 0) return null
  const orden = { urgente: 0, revisar: 1, info: 2 }
  const lista = [...alertas].sort((a, b) => orden[a.nivel] - orden[b.nivel])
  const primera = lista[0]
  const cuenta = (n: AlertaBandeja['nivel']) => alertas.filter(a => a.nivel === n).length
  const e = ESTILO[primera.nivel]

  // Una sola alerta: se muestra completa, con su acción, sin bandeja
  if (lista.length === 1) {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm', e.fila)}>
        <p className="flex min-w-0 items-center gap-2"><Ic n={e.icono} className="size-4 shrink-0" /> <span className="min-w-0">{primera.texto}</span></p>
        {primera.accion && <BotonAccion accion={primera.accion} />}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
      <button type="button" onClick={() => setAbierta(a => !a)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50">
        <span className="font-semibold text-gray-800">{titulo}</span>
        <span className="flex gap-1.5">
          {(['urgente', 'revisar', 'info'] as const).filter(n => cuenta(n) > 0).map(n => (
            <span key={n} className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-semibold', ESTILO[n].fila)}>
              <span className={cn('size-1.5 rounded-full', ESTILO[n].punto)} />{cuenta(n)}
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate text-gray-500">{!abierta && primera.texto}</span>
        <Ic n="flecha" className={cn('size-4 shrink-0 text-gray-400 transition-transform', abierta && 'rotate-90')} />
      </button>
      {abierta && (
        <ul className="space-y-1.5 border-t border-gray-100 p-2">
          {lista.map(a => (
            <li key={a.id} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm', ESTILO[a.nivel].fila)}>
              <div className="flex min-w-0 items-start gap-2">
                <Ic n={ESTILO[a.nivel].icono} className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p>{a.texto}</p>
                  {a.detalle && <div className="mt-0.5 text-xs opacity-80">{a.detalle}</div>}
                </div>
              </div>
              {a.accion && <BotonAccion accion={a.accion} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BotonAccion({ accion }: { accion: NonNullable<AlertaBandeja['accion']> }) {
  const clase = 'inline-flex h-7 shrink-0 items-center rounded-full bg-white/80 px-3 text-xs font-semibold text-gray-800 ring-1 ring-black/10 hover:bg-white'
  if (accion.href) return <a href={accion.href} className={clase}>{accion.texto}</a>
  return <button type="button" onClick={accion.onClick} className={clase}>{accion.texto}</button>
}
