'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import CrearLotePolloModal from '@/components/agro/pollo/CrearLotePolloModal'
import TabProduccionPollo from '@/components/agro/pollo/produccion/TabProduccionPollo'
import TabAmbientalPollo from '@/components/agro/pollo/ambiental/TabAmbientalPollo'
import TabSanitarioPollo from '@/components/agro/pollo/sanitario/TabSanitarioPollo'
import TabEquiposPollo from '@/components/agro/pollo/equipos/TabEquiposPollo'
import TabVentasGenerico from '@/components/agro/comun/TabVentasGenerico'
import TabCostosGenerico from '@/components/agro/comun/TabCostosGenerico'
import { CONFIG_ESPECIES } from '@/lib/especiesConfig'
import type { Database } from '@/types/database'
import { Ic, type NombreIcono } from '@/components/ui/icon'

type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']
type Tab = 'produccion' | 'ambiental' | 'sanitario' | 'ventas' | 'costos' | 'equipos'

const TABS: { id: Tab; label: string; icon: NombreIcono }[] = [
  { id: 'produccion', label: 'Producción', icon: 'tendencia' },
  { id: 'ambiental',  label: 'Ambiental', icon: 'termometro' },
  { id: 'sanitario',  label: 'Sanitario', icon: 'vacuna' },
  { id: 'ventas',     label: 'Ventas', icon: 'recibo' },
  { id: 'costos',     label: 'Finanzas', icon: 'dinero' },
  { id: 'equipos',    label: 'Equipos', icon: 'ajustes' },
]

const CONFIG = CONFIG_ESPECIES.pollo_engorde

export default function PolloEngordePage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const rol = useRol()
  const supabase = createClient()
  const [lotes, setLotes] = useState<LotePollo[]>([])
  const [loteActual, setLoteActual] = useState<LotePollo | null>(null)
  const [loadingLotes, setLoadingLotes] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('produccion')
  const [modalNuevo, setModalNuevo] = useState(false)

  const fetchLotes = useCallback(async () => {
    if (!fincaActual) return
    setLoadingLotes(true)
    const { data } = await supabase
      .from('lotes_pollo')
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
    const { data } = await supabase.from('lotes_pollo').select('*').eq('id', loteActual.id).single()
    if (data) setLoteActual(data)
    fetchLotes()
  }, [loteActual, supabase, fetchLotes])

  if (fincaLoading) return <div className="p-6 text-gray-500">Cargando...</div>
  if (!fincaActual) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center"><p className="text-4xl mb-2"><Ic n="hoja" /></p><p className="text-gray-600">Selecciona una finca para continuar</p></div>
    </div>
  )

  // Días de vida del lote
  const diasVida = loteActual
    ? Math.floor((Date.now() - new Date(loteActual.fecha_ingreso + 'T00:00:00').getTime()) / 86400000)
    : null

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div>
        <h1 className="text-3xl font-medium text-gray-900">Pollo de Engorde</h1>
        <p className="text-sm text-gray-500">{fincaActual.nombre} · Gestión integral de lotes broiler</p>
      </div>

      {/* Selector de lote */}
      <div className="superficie space-y-3 rounded-2xl p-4">
        <div className="flex gap-2 flex-wrap items-center">
          {loadingLotes ? (
            <div data-slot="skeleton" className="h-9 w-36 rounded-xl" />
          ) : (
            <>
              {lotes.length === 0 && <span className="text-sm text-gray-500">No hay lotes activos.</span>}
              {lotes.map(lote => (
                <button key={lote.id} onClick={() => setLoteActual(lote)}
                  className={cn('inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors',
                    loteActual?.id === lote.id
                      ? 'bg-amber-600 text-white shadow-[0_6px_16px_-10px_rgb(0_0_0/40%)]'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200/70')}>
                  <Ic n="pollo" /> {lote.nombre}
                </button>
              ))}
              <button onClick={() => setModalNuevo(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50">
                <Ic n="mas" className="size-4" /> Nuevo lote
              </button>
            </>
          )}
        </div>
        {loteActual && (
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            {diasVida !== null && (
              <Badge className="bg-yellow-100 text-yellow-700 text-xs">Día {diasVida} de vida</Badge>
            )}
            <span>{loteActual.pollos_actuales.toLocaleString('es-CO')} pollos activos</span>
            {loteActual.linea_genetica && <span>· {loteActual.linea_genetica}</span>}
            {loteActual.galpone && <span>· {loteActual.galpone}</span>}
            {loteActual.origen_pollos && <span>· {loteActual.origen_pollos}</span>}
          </div>
        )}
      </div>

      {!loteActual && !loadingLotes && (
        <div className="py-16 text-center">
          <p className="text-5xl mb-3"><Ic n="pollo" /></p>
          <p className="text-xl font-semibold text-gray-700 mb-1">Sin lotes activos</p>
          <p className="text-gray-400 mb-5">Crea tu primer lote de pollos de engorde para comenzar</p>
          <button onClick={() => setModalNuevo(true)}
            className="px-6 py-2.5 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors">
            + Crear primer lote
          </button>
        </div>
      )}

      {loteActual && (
        <div className="space-y-5">
          <div className="superficie flex gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-amber-50 text-amber-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800')}>
                <Ic n={tab.icon} className={cn('size-4', activeTab === tab.id ? 'text-amber-600' : 'text-gray-400')} />
                {tab.label}
              </button>
            ))}
          </div>
          <div>
            {activeTab === 'produccion' && <TabProduccionPollo loteActual={loteActual} onLoteUpdated={refreshLote} />}
            {activeTab === 'ambiental'  && <TabAmbientalPollo loteActual={loteActual} />}
            {activeTab === 'sanitario'  && <TabSanitarioPollo loteActual={loteActual} />}
            {activeTab === 'ventas'     && (rol === 'trabajador' ? <AccesoRestringido /> : (
              <TabVentasGenerico
                loteId={loteActual.id}
                fincaId={loteActual.finca_id}
                config={CONFIG}
                animalesActuales={loteActual.pollos_actuales}
                precioKgObjetivo={loteActual.precio_kg_objetivo}
                onLoteCambiado={refreshLote}
              />
            ))}
            {activeTab === 'costos'     && (rol === 'trabajador' ? <AccesoRestringido /> : (
              <TabCostosGenerico loteId={loteActual.id} fincaId={loteActual.finca_id} config={CONFIG} />
            ))}
            {activeTab === 'equipos'    && <TabEquiposPollo loteActual={loteActual} />}
          </div>
        </div>
      )}

      <CrearLotePolloModal
        open={modalNuevo}
        onClose={() => setModalNuevo(false)}
        fincaId={fincaActual.id}
        onCreated={lote => { setLotes(prev => [lote, ...prev]); setLoteActual(lote) }}
      />
    </div>
  )
}
