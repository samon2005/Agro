'use client'

import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { Ic } from '@/components/ui/icon'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']

const ESTADO_LABEL: Record<string, string> = {
  preparacion: 'levante',
  activo: 'en postura',
}

interface Props {
  /** Todos los galpones de la finca, tengan aves o no */
  galpones: Instalacion[]
  /** Lotes vivos: cada uno ocupa un galpón */
  lotes: LoteAves[]
  loteActual: LoteAves | null
  onSelect: (lote: LoteAves) => void
  /** Abre el registro de aves; con un galpón vacío, ya elegido */
  onRegistrarAves: (galponId: string | null) => void
  onDatosFinca: () => void
  loading: boolean
}

/**
 * Los galpones de la finca, uno junto al otro. El que tiene aves se abre; el que
 * está vacío ofrece registrar las que entran. Los lotes que quedaron sin galpón
 * (anteriores a esta forma de trabajar) se muestran igual para no perderlos.
 */
export default function LoteSelector({ galpones, lotes, loteActual, onSelect, onRegistrarAves, onDatosFinca, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[...Array(3)].map((_, i) => <div key={i} data-slot="skeleton" className="h-9 w-36 rounded-xl" />)}
      </div>
    )
  }

  const lotePorGalpon = new Map(lotes.filter(l => l.instalacion_id).map(l => [l.instalacion_id as string, l]))
  const lotesSueltos = lotes.filter(l => !l.instalacion_id || !galpones.some(g => g.id === l.instalacion_id))
  const vacios = galpones.filter(g => !lotePorGalpon.has(g.id)).length

  function BotonLote({ lote }: { lote: LoteAves }) {
    const activo = loteActual?.id === lote.id
    return (
      <button
        onClick={() => onSelect(lote)}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors',
          activo
            ? 'bg-green-700 text-white shadow-[0_6px_16px_-10px_rgb(42_93_34/70%)]'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200/70',
        )}
      >
        <Ic n="gallina" className={cn('size-4', activo ? 'text-white' : 'text-gray-500')} />
        {lote.nombre}
        <span className={cn('text-xs font-normal', activo ? 'text-green-100' : 'text-gray-500')}>
          · {ESTADO_LABEL[lote.estado] ?? lote.estado}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {galpones.length === 0 && lotes.length === 0 && (
          <span className="text-sm text-gray-500">La finca todavía no tiene galpones.</span>
        )}
        {galpones.map(g => {
          const lote = lotePorGalpon.get(g.id)
          if (lote) return <BotonLote key={g.id} lote={lote} />
          return (
            <button
              key={g.id}
              onClick={() => onRegistrarAves(g.id)}
              title="Galpón sin aves: registrar las que entran"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3.5 text-sm text-gray-500 transition-colors hover:border-green-500 hover:text-green-800"
            >
              <Ic n="casa" className="size-4" />
              {g.nombre}
              <span className="text-xs">· vacío</span>
            </button>
          )
        })}
        {lotesSueltos.map(l => <BotonLote key={l.id} lote={l} />)}
      </div>

      <div className="flex items-center gap-1">
        {vacios > 0 && (
          <button
            onClick={() => onRegistrarAves(null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-green-800 transition-colors hover:bg-green-50"
          >
            <Ic n="mas" className="size-4" /> Registrar aves
          </button>
        )}
        <button
          onClick={onDatosFinca}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
        >
          <Ic n="ajustes" className="size-4" /> Galpones
        </button>
      </div>
    </div>
  )
}
