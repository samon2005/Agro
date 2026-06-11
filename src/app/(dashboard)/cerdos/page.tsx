'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { cn } from '@/lib/utils'
import CrearLoteCerdosModal from '@/components/agro/cerdos/CrearLoteCerdosModal'
import TabCrecimiento from '@/components/agro/cerdos/crecimiento/TabCrecimiento'
import TabNutricion from '@/components/agro/cerdos/nutricion/TabNutricion'
import TabSanitarioCerdos from '@/components/agro/cerdos/sanitario/TabSanitarioCerdos'
import TabAmbientalCerdos from '@/components/agro/cerdos/ambiental/TabAmbientalCerdos'
import TabEquiposCerdos from '@/components/agro/cerdos/equipos/TabEquiposCerdos'
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Tab = 'crecimiento' | 'nutricion' | 'sanitario' | 'ambiental' | 'equipos'

const TABS: { id: Tab; label: string }[] = [
  { id: 'crecimiento', label: '📈 Crecimiento' },
  { id: 'nutricion', label: '🌾 Nutrición' },
  { id: 'sanitario', label: '💉 Sanitario' },
  { id: 'ambiental', label: '🌡️ Ambiental' },
  { id: 'equipos', label: '⚙️ Equipos' },
]

const ETAPAS_LABEL: Record<string, string> = {
  precebo: '🐷 Precebo', levante: '🐖 Levante', ceba: '🐗 Ceba', finalizacion: '✅ Finalización', vendido: '💰 Vendido'
}

export default function CerdosPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const supabase = createClient()
  const [lotes, setLotes] = useState<LoteCerdos[]>([])
  const [loteActual, setLoteActual] = useState<LoteCerdos | null>(null)
  const [loadingLotes, setLoadingLotes] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('crecimiento')
  const [modalNuevo, setModalNuevo] = useState(false)

  const fetchLotes = useCallback(async () => {
    if (!fincaActual) return
    setLoadingLotes(true)
    const { data } = await supabase
      .from('lotes_cerdos')
      .select('*')
      .eq('finca_id', fincaActual.id)
      .eq('estado', 'activo')
      .order('created_at', { ascending: false })
    setLotes(data ?? [])
    if (data && data.length > 0 && !loteActual) setLoteActual(data[0])
    setLoadingLotes(false)
  }, [fincaActual, loteActual, supabase])

  useEffect(() => { fetchLotes() }, [fincaActual?.id])

  const refreshLote = useCallback(async () => {
    if (!loteActual) return
    const { data } = await supabase.from('lotes_cerdos').select('*').eq('id', loteActual.id).single()
    if (data) setLoteActual(data)
    fetchLotes()
  }, [loteActual, supabase, fetchLotes])

  if (fincaLoading) return <div className="p-6 text-gray-500">Cargando...</div>
  if (!fincaActual) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center"><p className="text-4xl mb-2">🌿</p><p className="text-gray-600">Selecciona una finca para continuar</p></div>
    </div>
  )

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🐷 Cerdos</h1>
        <p className="text-sm text-gray-500">{fincaActual.nombre} · Gestión integral de lotes porcinos</p>
      </div>

      {/* Selector de lote */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lote activo</p>
        <div className="flex gap-2 flex-wrap items-center">
          {loadingLotes ? (
            <div className="h-9 w-36 bg-gray-200 rounded-full animate-pulse" />
          ) : (
            <>
              {lotes.length === 0 && <span className="text-sm text-gray-500">No hay lotes activos.</span>}
              {lotes.map(lote => (
                <button key={lote.id} onClick={() => setLoteActual(lote)}
                  className={cn('px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    loteActual?.id === lote.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-700')}>
                  🐷 {lote.nombre}
                </button>
              ))}
              <button onClick={() => setModalNuevo(true)}
                className="px-4 py-1.5 rounded-full text-sm font-medium border border-dashed border-orange-400 text-orange-700 hover:bg-orange-50 transition-colors">
                + Nuevo Lote
              </button>
            </>
          )}
        </div>
        {loteActual && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <Badge className="bg-orange-100 text-orange-700 text-xs">{ETAPAS_LABEL[loteActual.etapa_actual]}</Badge>
            <span>{loteActual.animales_actuales.toLocaleString('es-CO')} animales activos</span>
            {loteActual.linea_genetica && <span>· {loteActual.linea_genetica}</span>}
            {loteActual.corral && <span>· {loteActual.corral}</span>}
          </div>
        )}
      </div>

      {!loteActual && !loadingLotes && (
        <div className="py-16 text-center">
          <p className="text-5xl mb-3">🐷</p>
          <p className="text-xl font-semibold text-gray-700 mb-1">Sin lotes activos</p>
          <p className="text-gray-400 mb-5">Crea tu primer lote de cerdos para comenzar</p>
          <button onClick={() => setModalNuevo(true)}
            className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors">
            + Crear primer lote
          </button>
        </div>
      )}

      {loteActual && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex-shrink-0 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeTab === tab.id ? 'border-orange-600 text-orange-700 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50')}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {activeTab === 'crecimiento' && <TabCrecimiento loteActual={loteActual} onLoteUpdated={refreshLote} />}
            {activeTab === 'nutricion' && <TabNutricion loteActual={loteActual} />}
            {activeTab === 'sanitario' && <TabSanitarioCerdos loteActual={loteActual} />}
            {activeTab === 'ambiental' && <TabAmbientalCerdos loteActual={loteActual} />}
            {activeTab === 'equipos' && <TabEquiposCerdos loteActual={loteActual} />}
          </div>
        </div>
      )}

      <CrearLoteCerdosModal
        open={modalNuevo}
        onClose={() => setModalNuevo(false)}
        fincaId={fincaActual.id}
        onCreated={lote => { setLotes(prev => [lote, ...prev]); setLoteActual(lote) }}
      />
    </div>
  )
}
