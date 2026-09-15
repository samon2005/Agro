'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import { cn } from '@/lib/utils'
import CrearLoteCerdosModal from '@/components/agro/cerdos/CrearLoteCerdosModal'
import ConfigurarLoteCerdosModal from '@/components/agro/cerdos/ConfigurarLoteCerdosModal'
import TabDiarioCerdos from '@/components/agro/cerdos/diario/TabDiarioCerdos'
import TabReproduccion from '@/components/agro/cerdos/reproduccion/TabReproduccion'
import TabCrecimiento from '@/components/agro/cerdos/crecimiento/TabCrecimiento'
import TabNutricion from '@/components/agro/cerdos/nutricion/TabNutricion'
import TabSanitarioCerdos from '@/components/agro/cerdos/sanitario/TabSanitarioCerdos'
import TabAmbientalCerdos from '@/components/agro/cerdos/ambiental/TabAmbientalCerdos'
import TabEquiposCerdos from '@/components/agro/cerdos/equipos/TabEquiposCerdos'
import TabVentasGenerico from '@/components/agro/comun/TabVentasGenerico'
import TabCostosGenerico from '@/components/agro/comun/TabCostosGenerico'
import { CONFIG_ESPECIES } from '@/lib/especiesConfig'
import { Badge } from '@/components/ui/badge'
import { edadTexto } from '@/lib/cerdos'
import type { Database } from '@/types/database'
import { Ic, type NombreIcono } from '@/components/ui/icon'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Tab = 'diario' | 'crecimiento' | 'reproduccion' | 'nutricion' | 'sanitario' | 'ambiental' | 'ventas' | 'costos' | 'equipos'

/** La pestaña de Reproducción solo existe si el lote trabaja con sistema de cría. */
type TabItem = { id: Tab; label: string; icon: NombreIcono }
function tabsDelLote(sistema: string): TabItem[] {
  const base: TabItem[] = [
    { id: 'diario', label: 'Diario', icon: 'diario' },
    { id: 'crecimiento', label: 'Crecimiento', icon: 'tendencia' },
  ]
  if (sistema === 'cria') base.push({ id: 'reproduccion', label: 'Reproducción', icon: 'corazon' })
  return [
    ...base,
    { id: 'nutricion', label: 'Nutrición', icon: 'alimento' },
    { id: 'sanitario', label: 'Sanitario', icon: 'vacuna' },
    { id: 'ambiental', label: 'Ambiental', icon: 'termometro' },
    { id: 'ventas', label: 'Ventas', icon: 'recibo' },
    { id: 'costos', label: 'Finanzas', icon: 'dinero' },
    { id: 'equipos', label: 'Equipos', icon: 'ajustes' },
  ]
}

const CONFIG = CONFIG_ESPECIES.cerdos

const ETAPAS_LABEL: Record<string, string> = {
  precebo: 'Precebo', levante: 'Levante', ceba: 'Ceba', finalizacion: 'Finalización',
  vendido: 'Vendido', cria: 'Cría / Reproducción'
}

export default function CerdosPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const rol = useRol()
  const supabase = createClient()
  const [lotes, setLotes] = useState<LoteCerdos[]>([])
  const [loteActual, setLoteActual] = useState<LoteCerdos | null>(null)
  const [loadingLotes, setLoadingLotes] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('diario')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

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
      <div className="text-center"><p className="text-4xl mb-2"><Ic n="hoja" /></p><p className="text-gray-600">Selecciona una finca para continuar</p></div>
    </div>
  )

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div>
        <h1 className="text-3xl font-medium text-gray-900">Cerdos</h1>
        <p className="text-sm text-gray-500">{fincaActual.nombre} · Gestión integral de lotes porcinos</p>
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
                    loteActual?.id === lote.id ? 'bg-orange-600 text-white shadow-[0_6px_16px_-10px_rgb(0_0_0/40%)]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200/70')}>
                  <Ic n="cerdo" /> {lote.nombre}
                </button>
              ))}
              <button onClick={() => setModalNuevo(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50">
                <Ic n="mas" className="size-4" /> Nuevo lote
              </button>
            </>
          )}
        </div>
        {loteActual && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <Badge className={loteActual.sistema === 'cria' ? 'bg-pink-100 text-pink-700 text-xs' : 'bg-orange-100 text-orange-700 text-xs'}>
                {ETAPAS_LABEL[loteActual.etapa_actual] ?? loteActual.etapa_actual}
              </Badge>
              <span>
                {loteActual.animales_actuales.toLocaleString('es-CO')} {loteActual.sistema === 'cria' ? 'hembras activas' : 'animales activos'}
              </span>
              {loteActual.fecha_nacimiento && <span>· {edadTexto(loteActual.fecha_nacimiento)} de edad</span>}
              {loteActual.linea_genetica && <span>· {loteActual.linea_genetica}</span>}
              {loteActual.corral && <span>· {loteActual.corral}</span>}
            </div>
            <button
              onClick={() => setConfigOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <Ic n="ajustes" /> Configurar lote
            </button>
          </div>
        )}
        {loteActual && loteActual.alimento_activo_id == null && (
          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800">
            <Ic n="alerta" /> Este lote no tiene alimento asignado. Regístralo en la pestaña Nutrición: sin alimento
            no se puede llevar el diario ni calcular costo ni conversión.
          </div>
        )}
      </div>

      {!loteActual && !loadingLotes && (
        <div className="py-16 text-center">
          <p className="text-5xl mb-3"><Ic n="cerdo" /></p>
          <p className="text-xl font-semibold text-gray-700 mb-1">Sin lotes activos</p>
          <p className="text-gray-400 mb-5">Crea tu primer lote de cerdos para comenzar</p>
          <button onClick={() => setModalNuevo(true)}
            className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors">
            + Crear primer lote
          </button>
        </div>
      )}

      {loteActual && (
        <div className="space-y-5">
          <div className="superficie flex gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
            {tabsDelLote(loteActual.sistema).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium transition-colors',
                  activeTab === tab.id ? 'bg-orange-50 text-orange-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800')}>
                <Ic n={tab.icon} className={cn('size-4', activeTab === tab.id ? 'text-orange-600' : 'text-gray-400')} />
                {tab.label}
              </button>
            ))}
          </div>
          <div>
            {activeTab === 'diario' && <TabDiarioCerdos loteActual={loteActual} onLoteUpdated={refreshLote} />}
            {activeTab === 'crecimiento' && <TabCrecimiento loteActual={loteActual} onLoteUpdated={refreshLote} />}
            {activeTab === 'reproduccion' && loteActual.sistema === 'cria' && (
              <TabReproduccion loteActual={loteActual} onLoteUpdated={refreshLote} />
            )}
            {activeTab === 'nutricion' && <TabNutricion loteActual={loteActual} />}
            {activeTab === 'sanitario' && <TabSanitarioCerdos loteActual={loteActual} />}
            {activeTab === 'ambiental' && <TabAmbientalCerdos loteActual={loteActual} />}
            {activeTab === 'ventas' && (rol === 'trabajador' ? <AccesoRestringido /> : (
              <TabVentasGenerico
                loteId={loteActual.id}
                fincaId={loteActual.finca_id}
                config={CONFIG}
                animalesActuales={loteActual.animales_actuales}
                precioKgObjetivo={loteActual.precio_kg_objetivo}
                onLoteCambiado={refreshLote}
              />
            ))}
            {activeTab === 'costos' && (rol === 'trabajador' ? <AccesoRestringido /> : (
              <TabCostosGenerico loteId={loteActual.id} fincaId={loteActual.finca_id} config={CONFIG} />
            ))}
            {activeTab === 'equipos' && <TabEquiposCerdos loteActual={loteActual} />}
          </div>
        </div>
      )}

      <CrearLoteCerdosModal
        open={modalNuevo}
        onClose={() => setModalNuevo(false)}
        fincaId={fincaActual.id}
        onCreated={lote => { setLotes(prev => [lote, ...prev]); setLoteActual(lote); setActiveTab('diario') }}
      />

      {loteActual && (
        <ConfigurarLoteCerdosModal
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          lote={loteActual}
          onUpdated={actualizado => { setLoteActual(actualizado); fetchLotes() }}
          onDeleted={() => { setLoteActual(null); fetchLotes() }}
        />
      )}
    </div>
  )
}
