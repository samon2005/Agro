'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import { cn } from '@/lib/utils'
import LoteSelector, { type VistaGlobal } from '@/components/agro/aves/LoteSelector'
import HuevosFinca from '@/components/agro/aves/global/HuevosFinca'
import VentasFinca from '@/components/agro/aves/global/VentasFinca'
import CrearLoteModal from '@/components/agro/aves/CrearLoteModal'
import EditarFincaModal from '@/components/agro/EditarFincaModal'
import TabProduccion from '@/components/agro/aves/produccion/TabProduccion'
import TabAmbiental from '@/components/agro/aves/ambiental/TabAmbiental'
import TabSanitario from '@/components/agro/aves/sanitario/TabSanitario'
import TabCostos from '@/components/agro/aves/costos/TabCostos'
import TabVentas from '@/components/agro/aves/ventas/TabVentas'
import TabEquipos from '@/components/agro/aves/equipos/TabEquipos'
import { calcularFechaLiberacion } from '@/lib/sanitario'
import type { Database } from '@/types/database'
import { Ic, type NombreIcono } from '@/components/ui/icon'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Medicacion = Database['public']['Tables']['medicaciones_aves']['Row']
type Equipo = Database['public']['Tables']['equipos_aves']['Row']
type Ambiental = Database['public']['Tables']['parametros_ambientales_aves']['Row']
type Produccion = Database['public']['Tables']['produccion_diaria_aves']['Row']

type Tab = 'produccion' | 'ambiental' | 'sanitario' | 'ventas' | 'costos' | 'equipos'

const TABS: { id: Tab; label: string; icon: NombreIcono }[] = [
  { id: 'produccion', label: 'Producción', icon: 'tendencia' },
  { id: 'ambiental', label: 'Ambiental', icon: 'termometro' },
  { id: 'sanitario', label: 'Sanitario', icon: 'vacuna' },
  { id: 'ventas', label: 'Ventas', icon: 'recibo' },
  { id: 'costos', label: 'Finanzas', icon: 'dinero' },
  { id: 'equipos', label: 'Equipos', icon: 'ajustes' },
]

interface Alerta { tipo: 'danger' | 'warning'; mensaje: string }

export default function AvesPonedorasPage() {
  const { fincaActual, loading: fincaLoading, refetch: refetchFinca } = useFinca()
  const rol = useRol()
  const supabase = createClient()

  const [lotes, setLotes] = useState<LoteAves[]>([])
  const [loteActual, setLoteActual] = useState<LoteAves | null>(null)
  const [loadingLotes, setLoadingLotes] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('produccion')
  const [modalNuevoLote, setModalNuevoLote] = useState(false)
  // Huevos y ventas de toda la finca: no cuelgan de un galpón concreto
  const [vistaGlobal, setVistaGlobal] = useState<VistaGlobal | null>(null)
  const [modalFinca, setModalFinca] = useState(false)

  // Alertas cross-módulo
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [alertasVersion, setAlertasVersion] = useState(0)
  const bumpAlertas = useCallback(() => setAlertasVersion(v => v + 1), [])

  const fetchLotes = useCallback(async () => {
    if (!fincaActual) return
    setLoadingLotes(true)
    const { data } = await supabase
      .from('lotes_aves')
      .select('*')
      .eq('finca_id', fincaActual.id)
      .in('estado', ['activo', 'preparacion'])
      .order('created_at', { ascending: false })
    setLotes(data ?? [])
    if (data && data.length > 0) {
      if (!loteActual) {
        setLoteActual(data[0])
      } else {
        const refrescado = data.find(l => l.id === loteActual.id)
        setLoteActual(refrescado ?? data[0])
      }
    } else if (loteActual) {
      setLoteActual(null)
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
        return calcularFechaLiberacion(m.fecha_fin, m.periodo_retiro_dias) >= hoy
      })
      if (medEnRetiro.length > 0)
        nuevasAlertas.push({ tipo: 'warning', mensaje: `Período de retiro activo: ${medEnRetiro.map(m => m.medicamento).join(', ')}` })

      if ((equiposFalla ?? []).length > 0)
        nuevasAlertas.push({ tipo: 'danger', mensaje: `Equipos con falla: ${(equiposFalla ?? []).map(e => e.nombre).join(', ')}` })

      setAlertas(nuevasAlertas)
    }
    evalAlertas()
  }, [loteActual?.id, supabase, alertasVersion])

  if (fincaLoading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }

  if (!fincaActual) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-2"><Ic n="hoja" /></p>
          <p className="text-gray-600">Selecciona una finca para continuar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium text-gray-900">Galpones</h1>
          <p className="text-sm text-gray-500">{fincaActual.nombre} · Gestión integral de lotes</p>
        </div>
        <button
          onClick={() => setModalFinca(true)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <Ic n="ubicacion" /> Datos geográficos de la finca
        </button>
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
              {a.tipo === 'danger' ? '' : ''} {a.mensaje}
            </div>
          ))}
        </div>
      )}

      {/* Selector de lote */}
      <div className="superficie space-y-3 rounded-2xl p-4">
        <LoteSelector
          lotes={lotes}
          loteActual={loteActual}
          vistaGlobal={vistaGlobal}
          onSelect={l => { setLoteActual(l); setVistaGlobal(null); setAlertas([]) }}
          onSelectVistaGlobal={v => setVistaGlobal(v)}
          onNuevoLote={() => setModalNuevoLote(true)}
          loading={loadingLotes}
        />
        {!vistaGlobal && loteActual && (
          <p className="text-xs text-gray-500">
            {loteActual.linea_genetica && `${loteActual.linea_genetica} · `}
            {loteActual.aves_actuales.toLocaleString('es-CO')} aves activas
            {loteActual.origen_aves && ` · ${loteActual.origen_aves}`}
          </p>
        )}
      </div>

      {vistaGlobal === 'huevos' && <HuevosFinca fincaId={fincaActual.id} lotes={lotes} />}
      {vistaGlobal === 'ventas' && (
        rol === 'trabajador' ? <AccesoRestringido /> : <VentasFinca fincaId={fincaActual.id} lotes={lotes} />
      )}

      {!vistaGlobal && !loteActual && !loadingLotes && (
        <div className="py-16 text-center">
          <p className="mb-3 text-5xl text-gray-300"><Ic n="gallina" /></p>
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

      {!vistaGlobal && loteActual && (
        <>
          {/* Tab bar */}
          <div className="space-y-5">
            <div className="superficie flex gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-green-50 text-green-900'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  )}
                >
                  <Ic n={tab.icon} className={cn('size-4', activeTab === tab.id ? 'text-green-700' : 'text-gray-400')} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div>
              {activeTab === 'produccion' && (
                <TabProduccion
                  loteActual={loteActual}
                  onLoteUpdated={updated => {
                    fetchLotes()
                    if (updated) setLoteActual(updated)
                  }}
                  onLoteDeleted={() => {
                    setLoteActual(null)
                    fetchLotes()
                  }}
                />
              )}
              {activeTab === 'ambiental' && <TabAmbiental loteActual={loteActual} finca={fincaActual} />}
              {activeTab === 'sanitario' && <TabSanitario loteActual={loteActual} onChange={bumpAlertas} />}
              {activeTab === 'ventas' && (rol === 'trabajador' ? <AccesoRestringido /> : (
                <TabVentas
                  loteActual={loteActual}
                  onLoteUpdated={updated => { fetchLotes(); setLoteActual(updated) }}
                />
              ))}
              {activeTab === 'costos' && (rol === 'trabajador' ? <AccesoRestringido /> : <TabCostos loteActual={loteActual} />)}
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

      <EditarFincaModal
        open={modalFinca}
        onClose={() => setModalFinca(false)}
        finca={fincaActual}
        onUpdated={refetchFinca}
      />
    </div>
  )
}
