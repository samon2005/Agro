'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Ic, type NombreIcono } from '@/components/ui/icon'

export interface Unidad {
  id: string
  nombre: string
  /** "en postura · 4.900 aves", "vacío" */
  sub: string
  /** 0–100 para el mini anillo (postura de hoy, ocupación…); null sin anillo */
  pct?: number | null
  /** El número que va dentro del anillo */
  centro?: string
  estado?: 'activo' | 'levante' | 'vacio' | 'limpieza'
  aviso?: boolean
}

/**
 * Los galpones o corrales como tarjetitas en fila, cada una con su mini anillo
 * (la postura de hoy, por ejemplo). La elegida va en verde oscuro.
 */
export function SelectorUnidades({ unidades, elegida, onElegir, icono, extra }: {
  unidades: Unidad[]
  elegida: string | null
  onElegir: (id: string) => void
  icono: NombreIcono
  /** Botones al final de la fila (lotes anteriores, configurar…) */
  extra?: ReactNode
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {unidades.map(u => {
        const activa = elegida === u.id
        const vacia = u.estado === 'vacio' || u.estado === 'limpieza'
        return (
          <button key={u.id} type="button" onClick={() => onElegir(u.id)} title={u.aviso ? 'Todavía no se registra el día de hoy' : undefined}
            className={cn('group relative flex min-w-44 shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all',
              activa ? 'bg-green-800 text-white shadow-[0_10px_24px_-12px_rgb(42_93_34/70%)]'
                : u.estado === 'limpieza' ? 'border border-dashed border-amber-300 bg-amber-50/60 text-amber-800 hover:border-amber-500'
                : vacia ? 'border border-dashed border-gray-300 bg-white/60 text-gray-500 hover:border-green-500'
                  : 'bg-white text-gray-800 ring-1 ring-black/5 hover:ring-green-300')}>
            <MiniAnillo pct={u.pct ?? null} centro={u.centro} activa={activa} icono={icono} vacia={vacia} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{u.nombre}</span>
              <span className={cn('block truncate text-[0.6875rem]', activa ? 'text-green-100' : 'text-gray-500')}>{u.sub}</span>
            </span>
            {u.aviso && <span className="absolute top-2 right-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />}
          </button>
        )
      })}
      {extra}
    </div>
  )
}

function MiniAnillo({ pct, centro, activa, icono, vacia }: { pct: number | null; centro?: string; activa: boolean; icono: NombreIcono; vacia: boolean }) {
  const t = 38, g = 4, r = (t - g) / 2, c = 2 * Math.PI * r
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: t, height: t }}>
      <svg width={t} height={t} className="absolute inset-0 -rotate-90">
        <circle cx={t / 2} cy={t / 2} r={r} fill="none" stroke={activa ? 'rgb(255 255 255 / 20%)' : '#eef3ea'} strokeWidth={g} />
        {p > 0 && <circle cx={t / 2} cy={t / 2} r={r} fill="none" stroke={activa ? '#b6d6a6' : '#2a5d22'} strokeWidth={g} strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} />}
      </svg>
      {centro && pct != null ? (
        <span className={cn('text-[0.625rem] font-bold tabular-nums', activa ? 'text-white' : 'text-gray-800')}>{centro}</span>
      ) : (
        <Ic n={vacia ? 'mas' : icono} className={cn('size-4', activa ? 'text-white' : vacia ? 'text-gray-400' : 'text-green-700')} />
      )}
    </span>
  )
}
