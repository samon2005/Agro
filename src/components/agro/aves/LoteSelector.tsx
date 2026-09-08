'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

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

const VISTAS_GLOBALES: { id: VistaGlobal; label: string }[] = [
  { id: 'huevos', label: '🥚 Huevos (toda la finca)' },
  { id: 'ventas', label: '🧾 Ventas (toda la finca)' },
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
          <div key={i} className="h-9 w-36 bg-gray-200 rounded-full animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {lotes.length === 0 && (
        <span className="text-sm text-gray-500">No hay lotes activos.</span>
      )}
      {lotes.map(lote => (
        <button
          key={lote.id}
          onClick={() => onSelect(lote)}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
            !vistaGlobal && loteActual?.id === lote.id
              ? 'bg-green-700 text-white border-green-700'
              : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:text-green-700'
          )}
        >
          🐔 {lote.nombre}
          {lote.estado !== 'activo' && (
            <span
              className={cn(
                'ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border',
                ESTADO_BADGE_CLASS[lote.estado] ?? 'bg-gray-200 text-gray-800 border-gray-300'
              )}
            >
              {ESTADO_LABEL[lote.estado] ?? lote.estado}
            </span>
          )}
        </button>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={onNuevoLote}
        className="rounded-full border-dashed border-green-400 text-green-700 hover:bg-green-50"
      >
        + Nuevo Lote
      </Button>

      {/* El huevo y las ventas no son de un galpón: son de la finca entera */}
      {lotes.length > 0 && (
        <>
          <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
          {VISTAS_GLOBALES.map(v => (
            <button
              key={v.id}
              onClick={() => onSelectVistaGlobal(v.id)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                vistaGlobal === v.id
                  ? 'bg-yellow-500 text-white border-yellow-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-400 hover:text-yellow-700'
              )}
            >
              {v.label}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
