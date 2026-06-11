'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  lotes: LoteAves[]
  loteActual: LoteAves | null
  onSelect: (lote: LoteAves) => void
  onNuevoLote: () => void
  loading: boolean
}

export default function LoteSelector({ lotes, loteActual, onSelect, onNuevoLote, loading }: Props) {
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
            loteActual?.id === lote.id
              ? 'bg-green-700 text-white border-green-700'
              : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:text-green-700'
          )}
        >
          🐔 {lote.nombre}
          {lote.estado !== 'activo' && (
            <span className="ml-1 text-xs opacity-70">({lote.estado})</span>
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
    </div>
  )
}
