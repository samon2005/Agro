'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'
import { Ic, type NombreIcono } from '@/components/ui/icon'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

const ESTADO_LABEL: Record<string, string> = {
  preparacion: 'en preparación',
  activo: 'activo',
  finalizado: 'finalizado',
  vendido: 'vendido',
}

const ESTADO_BADGE_CLASS: Record<string, string> = {
  preparacion: 'bg-amber-100 text-amber-900 border-amber-300',
  finalizado: 'bg-gray-200 text-gray-800 border-gray-300',
  vendido: 'bg-blue-100 text-blue-900 border-blue-300',
}

/** Vistas que abarcan toda la finca en vez de un galpón concreto. */
export type VistaGlobal = 'huevos' | 'ventas'

const VISTAS_GLOBALES: { id: VistaGlobal; label: string; icono: NombreIcono }[] = [
  { id: 'huevos', label: 'Huevos de la finca', icono: 'huevo' },
  { id: 'ventas', label: 'Ventas de la finca', icono: 'recibo' },
]

interface Props {
  lotes: LoteAves[]
  loteActual: LoteAves | null
  /** Si hay una vista global activa, ningún galpón está seleccionado */
  vistaGlobal: VistaGlobal | null
  onSelect: (lote: LoteAves) => void
  onSelectVistaGlobal: (vista: VistaGlobal) => void
  onNuevoLote: () => void
  loading: boolean
}

export default function LoteSelector({ lotes, loteActual, vistaGlobal, onSelect, onSelectVistaGlobal, onNuevoLote, loading }: Props) {
  if (loading) {
    return (
      <div className="flex gap-2 flex-wrap">
        {[...Array(3)].map((_, i) => (
          <div key={i} data-slot="skeleton" className="h-9 w-36 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {lotes.length === 0 && (
          <span className="text-sm text-gray-500">No hay lotes activos.</span>
        )}
        {lotes.map(lote => {
          const activo = !vistaGlobal && loteActual?.id === lote.id
          return (
            <button
              key={lote.id}
              onClick={() => onSelect(lote)}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors',
                activo
                  ? 'bg-green-700 text-white shadow-[0_6px_16px_-10px_rgb(42_93_34/70%)]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200/70'
              )}
            >
              <Ic n="gallina" className={cn('size-4', activo ? 'text-white' : 'text-gray-500')} />
              {lote.nombre}
              {lote.estado !== 'activo' && (
                <span className={cn('text-xs font-normal', activo ? 'text-green-100' : 'text-gray-500')}>
                  · {ESTADO_LABEL[lote.estado] ?? lote.estado}
                </span>
              )}
            </button>
          )
        })}
        <button
          onClick={onNuevoLote}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-green-800 transition-colors hover:bg-green-50"
        >
          <Ic n="mas" className="size-4" /> Nuevo lote
        </button>
      </div>

      {/* El huevo y las ventas no son de un galpón: son de la finca entera */}
      {lotes.length > 0 && (
        <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          {VISTAS_GLOBALES.map(v => (
            <button
              key={v.id}
              onClick={() => onSelectVistaGlobal(v.id)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-[0.8125rem] font-medium transition-colors',
                vistaGlobal === v.id
                  ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgb(22_35_26/10%)]'
                  : 'text-gray-500 hover:text-gray-800'
              )}
            >
              <Ic n={v.icono} className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
