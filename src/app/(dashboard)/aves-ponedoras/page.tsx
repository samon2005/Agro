'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { cn } from '@/lib/utils'
import LoteSelector from '@/components/agro/aves/LoteSelector'
import CrearLoteModal from '@/components/agro/aves/CrearLoteModal'
import TabProduccion from '@/components/agro/aves/produccion/TabProduccion'
import TabAmbiental from '@/components/agro/aves/ambiental/TabAmbiental'
import TabSanitario from '@/components/agro/aves/sanitario/TabSanitario'
import TabCostos from '@/components/agro/aves/costos/TabCostos'
import TabEquipos from '@/components/agro/aves/equipos/TabEquipos'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Medicacion = Database['public']['Tables']['medicaciones_aves']['Row']
type Equipo = Database['public']['Tables']['equipos_aves']['Row']
type Ambiental = Database['public']['Tables']['parametros_ambientales_aves']['Row']
type Produccion = Database['public']['Tables']['produccion_diaria_aves']['Row']

type Tab = 'produccion' | 'ambiental' | 'sanitario' | 'costos' | 'equipos'

const TABS: { id: Tab; label: string }[] = [
  { id: 'produccion', label: '🥚 Producción' },
  { id: 'ambiental', label: '🌡️ Ambiental' },
  { id: 'sanitario', label: '💉 Sanitario' },
  { id: 'costos', label: '💰 Costos' },
  { id: 'equipos', label: '⚙️ Equipos' },
]

interface Alerta { tipo: 'danger' | 'warning'; mensaje: string }

export default function AvesPonedorasPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const supabase = createClient()

  const [lotes, setLotes] = useState<LoteAves[]>([])
  const [loteActual, setLoteActual] = useState<LoteAves | null>(null)
  const [loadingLotes, setLoadingLotes] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('produccion')
  const [modalNuevoLote, setModalNuevoLote] = useState(false)

  // Alertas cross-módulo
  const [alertas, setAlertas] = useState<Alerta[]>([])

  const fetchLotes = useCallback(async () => {
    if (!fincaActual) return
    setLoadingLotes(true)
    const { data } = await supabase
      .from('lotes_aves')
      .select('*')
      .eq('finca_id', fincaActual.id)
      .eq('estado', 'activo')
      .order('created_at', { ascending: false })
    setLotes(data ?? [])
    if (data && data.length > 0 && !loteActual) {
      setLoteActual(data[0])
    }
    setLoadingLotes(false)
  }, [fincaActual, loteActual, supabase])

  useEffect(() => { fetchLotes() }, [fincaActual?.id])

  // Evaluar alertas cuando cambia el lote
  useEffect(() => {
    if (!loteActual) { setAlertas([]); return }
    async function evalAlertas() {
      if (!loteActual) return
      const nuevasAlertas: Alerta[] = []

      const [{ data: ultimoAmb }, { data: ultimaProd }, { data: meds }, { data: equiposFalla }] = await Promise.all([
        supabase.from('parametros_ambientales_aves').select('temperatura_interior,nh3_ppm,co2_ppm,humedad_interior').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(1).maybeSingle() as unknown as Promise<{ data: Partial<Ambiental> | null }>,
        supabase.from('produccion_diaria_aves').select('huevos_totales,aves_en_dia').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(1).maybeSingle() as unknown as Promise<{ data: Partial<Produccion> | null }>,
        supabase.from('medicaciones_aves').select('medicamento,fecha_fin,periodo_retiro_dias').eq('lote_id', loteActual.id) as unknown as Promise<{ data: Partial<Medicacion>[] | null }>,
        supabase.from('equipos_aves').select('nombre').eq('lote_id', loteActual.id).eq('estado', 'falla') as unknown as Promise<{ data: Partial<Equipo>[] | null }>,
      ])

      if (ultimoAmb?.temperatura_interior && ultimoAmb.temperatura_interior > 30)
        nuevasAlertas.push({ tipo: 'danger', mensaje: `Temperatura interior: ${ultimoAmb.temperatura_interior}°C — crítico > 30°C` })
      if (ultimoAmb?.nh3_ppm && ultimoAmb.nh3_ppm > 25)
        nuevasAlertas.push({ tipo: 'danger', mensaje: `NH₃: ${ultimoAmb.nh3_ppm} ppm — supera el límite (25 ppm)` })

      if (ultimaProd?.huevos_totales && ultimaProd?.aves_en_dia && ultimaProd.aves_en_dia > 0) {
        const postura = (ultimaProd.huevos_totales / ultimaProd.aves_en_dia) * 100
        if (postura < 70)
          nuevasAlertas.push({ tipo: 'warning', mensaje: `Postura: ${postura.toFixed(1)}% — por debajo del umbral (70%)` })
      }

      const hoy = new Date()
      const medEnRetiro = (meds ?? []).filter(m => {
        if (!m.periodo_retiro_dias || !m.fecha_fin) return false
        const fin = new Date(m.fecha_fin)
        fin.setDate(fin.getDate() + m.periodo_retiro_dias)
        return fin >= hoy
      })
      if (medEnRetiro.length > 0)
        nuevasAlertas.push({ tipo: 'warning', mensaje: `Período de retiro activo: ${medEnRetiro.map(m => m.medicamento).join(', ')}` })

      if ((equiposFalla ?? []).length > 0)
        nuevasAlertas.push({ tipo: 'danger', mensaje: `Equipos con falla: ${(equiposFalla ?? []).map(e => e.nombre).join(', ')}` })

      setAlertas(nuevasAlertas)
    }
    evalAlertas()
  }, [loteActual?.id, supabase])

  if (fincaLoading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }

  if (!fincaActual) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-2">🌿</p>
          <p className="text-gray-600">Selecciona una finca para continuar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🐔 Aves Ponedoras</h1>
        <p className="text-sm text-gray-500">{fincaActual.nombre} · Gestión integral de lotes</p>
      </div>

      {/* Alertas cross-módulo */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${
                a.tipo === 'danger' ? 'bg-red-50 border-red-300 text-red-800' : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}
            >
              {a.tipo === 'danger' ? '🚨' : '⚠️'} {a.mensaje}
            </div>
          ))}
        </div>
      )}

      {/* Selector de lote */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lote activo</p>
        <LoteSelector
          lotes={lotes}
          loteActual={loteActual}
          onSelect={l => { setLoteActual(l); setAlertas([]) }}
          onNuevoLote={() => setModalNuevoLote(true)}
          loading={loadingLotes}
        />
        {loteActual && (
          <p className="text-xs text-gray-400">
            {loteActual.linea_genetica && `${loteActual.linea_genetica} · `}
            {loteActual.aves_actuales.toLocaleString('es-CO')} aves activas
            {loteActual.origen_aves && ` · ${loteActual.origen_aves}`}
          </p>
        )}
      </div>

      {!loteActual && !loadingLotes && (
        <div className="py-16 text-center">
          <p className="text-5xl mb-3">🐔</p>
          <p className="text-xl font-semibold text-gray-700 mb-1">Sin lotes activos</p>
          <p className="text-gray-400 mb-5">Crea tu primer lote para comenzar el seguimiento</p>
          <button
            onClick={() => setModalNuevoLote(true)}
            className="px-6 py-2.5 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 transition-colors"
          >
            + Crear primer lote
          </button>
        </div>
      )}

      {loteActual && (
        <>
          {/* Tab bar */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-shrink-0 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-green-600 text-green-700 bg-green-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'produccion' && (
                <TabProduccion
                  loteActual={loteActual}
                  onLoteUpdated={() => {
                    fetchLotes()
                    setLoteActual(prev => prev ? { ...prev, aves_actuales: prev.aves_actuales } : prev)
                  }}
                />
              )}
              {activeTab === 'ambiental' && <TabAmbiental loteActual={loteActual} />}
              {activeTab === 'sanitario' && <TabSanitario loteActual={loteActual} />}
              {activeTab === 'costos' && <TabCostos loteActual={loteActual} />}
              {activeTab === 'equipos' && <TabEquipos loteActual={loteActual} />}
            </div>
          </div>
        </>
      )}

      <CrearLoteModal
        open={modalNuevoLote}
        onClose={() => setModalNuevoLote(false)}
        fincaId={fincaActual.id}
        onCreated={lote => {
          setLotes(prev => [lote, ...prev])
          setLoteActual(lote)
        }}
      />
    </div>
  )
}
