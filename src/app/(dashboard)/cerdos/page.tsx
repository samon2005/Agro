'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { cn } from '@/lib/utils'
import CrearLoteCerdosModal from '@/components/agro/cerdos/CrearLoteCerdosModal'
import ConfigurarLoteCerdosModal from '@/components/agro/cerdos/ConfigurarLoteCerdosModal'
import EditarFincaModal from '@/components/agro/EditarFincaModal'
import TabDiarioCerdos from '@/components/agro/cerdos/diario/TabDiarioCerdos'
import NavesCria from '@/components/agro/cerdos/corral/NavesCria'
import AlimentoCorral from '@/components/agro/cerdos/corral/AlimentoCorral'
import { edadTexto } from '@/lib/cerdos'
import { usoCorralLabel } from '@/lib/instalaciones'
import type { Database } from '@/types/database'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { nombreSeccion } from '@/lib/especies'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']
type Tab = 'naves' | 'diario' | 'alimento'

/**
 * Dentro del corral solo queda lo que se está montando: las naves de cerdas (en
 * los de cría), el diario y el alimento. Lo demás se irá agregando por partes.
 */
function tabsDelLote(lote: LoteCerdos): { id: Tab; label: string; icon: NombreIcono }[] {
  return [
    ...(lote.sistema === 'cria' ? [{ id: 'naves' as const, label: 'Naves', icon: 'cerdo' as const }] : []),
    { id: 'diario', label: 'Diario', icon: 'diario' },
    { id: 'alimento', label: 'Alimento', icon: 'alimento' },
  ]
}

export default function CerdosPage() {
  const { fincaActual, loading: fincaLoading, refetch: refetchFinca } = useFinca()
  const supabase = createClient()
  const [corrales, setCorrales] = useState<Instalacion[]>([])
  const [lotes, setLotes] = useState<LoteCerdos[]>([])
  const [seleccion, setSeleccion] = useState<string | null>(null)   // id del corral (o "lote:<id>" si no tiene corral)
  const [cargando, setCargando] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('diario')
  const [corralParaLote, setCorralParaLote] = useState<Instalacion | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [modalFinca, setModalFinca] = useState(false)

  const cargar = useCallback(async () => {
    if (!fincaActual) return
    const [inst, lot] = await Promise.all([
      supabase.from('instalaciones').select('*').eq('finca_id', fincaActual.id).eq('especie', 'cerdos'),
      supabase.from('lotes_cerdos').select('*').eq('finca_id', fincaActual.id).eq('estado', 'activo').order('created_at'),
    ])
    const lista = (inst.data ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
    setCorrales(lista)
    setLotes(lot.data ?? [])
    setSeleccion(prev => {
      if (prev) return prev
      // Al llegar desde el Resumen (?lote=) se abre el corral de ese lote
      const pedido = new URLSearchParams(window.location.search).get('lote')
      const lotePedido = (lot.data ?? []).find(l => l.id === pedido)
      if (lotePedido) return lotePedido.instalacion_id ?? `lote:${lotePedido.id}`
      const conLote = lista.find(c => (lot.data ?? []).some(l => l.instalacion_id === c.id))
      return conLote?.id ?? null
    })
    setCargando(false)
  }, [fincaActual, supabase])

  useEffect(() => { cargar() }, [cargar])

  const lotePorCorral = new Map(lotes.filter(l => l.instalacion_id).map(l => [l.instalacion_id as string, l]))
  const lotesSueltos = lotes.filter(l => !l.instalacion_id || !corrales.some(c => c.id === l.instalacion_id))
  const loteActual = seleccion?.startsWith('lote:')
    ? lotes.find(l => `lote:${l.id}` === seleccion) ?? null
    : seleccion ? lotePorCorral.get(seleccion) ?? null : null
  const corralActual = corrales.find(c => c.id === seleccion) ?? null
  const tabs = loteActual ? tabsDelLote(loteActual) : []
  const tabVisible: Tab = tabs.some(t => t.id === activeTab) ? activeTab : (tabs[0]?.id ?? 'diario')

  function elegirCorral(c: Instalacion) {
    setSeleccion(c.id)
    const lote = lotePorCorral.get(c.id)
    // La primera vez que se entra a un corral vacío se pide su lote
    if (!lote) setCorralParaLote(c)
    else setActiveTab(lote.sistema === 'cria' ? 'naves' : 'diario')
  }

  if (fincaLoading) return <div className="p-6 text-gray-500">Cargando...</div>
  if (!fincaActual) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center"><p className="mb-2 text-4xl"><Ic n="hoja" /></p><p className="text-gray-600">Selecciona una finca para continuar</p></div>
    </div>
  )

  return (
    <div className="flex-1 space-y-5 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium text-gray-900">{nombreSeccion('cerdos', fincaActual.tipo_produccion)}</h1>
          <p className="text-sm text-gray-500">{fincaActual.nombre} · corrales de la finca</p>
        </div>
        <button
          onClick={() => setModalFinca(true)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
        >
          <Ic n="ubicacion" /> Datos de la finca
        </button>
      </div>

      {/* Corrales: lugares fijos, cada uno con su tipo de producción debajo */}
      <div className="superficie space-y-3 rounded-2xl p-4">
        {cargando ? (
          <div className="flex gap-2">{[...Array(3)].map((_, i) => <div key={i} data-slot="skeleton" className="h-12 w-32 rounded-xl" />)}</div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {corrales.length === 0 && lotes.length === 0 && <span className="text-sm text-gray-500">La finca todavía no tiene corrales.</span>}
            {corrales.map(c => {
              const lote = lotePorCorral.get(c.id)
              const activo = seleccion === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => elegirCorral(c)}
                  title={lote ? undefined : 'Corral vacío: agregar su lote'}
                  className={cn(
                    'flex min-w-28 flex-col items-start rounded-xl px-3.5 py-2 text-left transition-colors',
                    activo ? 'bg-orange-600 text-white shadow-[0_6px_16px_-10px_rgb(0_0_0/40%)]'
                      : lote ? 'bg-gray-100 text-gray-800 hover:bg-gray-200/70'
                        : 'border border-dashed border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-800',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium"><Ic n="cerdo" className="size-4" /> {c.nombre}</span>
                  <span className={cn('text-[0.6875rem]', activo ? 'text-orange-100' : 'text-gray-500')}>
                    {usoCorralLabel(c.uso)?.toLowerCase() ?? 'sin tipo'}{lote ? ` · ${lote.animales_actuales.toLocaleString('es-CO')}` : ' · vacío'}
                  </span>
                </button>
              )
            })}
            {lotesSueltos.map(l => (
              <button
                key={l.id}
                onClick={() => { setSeleccion(`lote:${l.id}`); setActiveTab(l.sistema === 'cria' ? 'naves' : 'diario') }}
                className={cn(
                  'flex flex-col items-start rounded-xl px-3.5 py-2 text-left',
                  seleccion === `lote:${l.id}` ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200/70',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium"><Ic n="cerdo" className="size-4" /> {l.nombre}</span>
                <span className="text-[0.6875rem] opacity-80">sin corral</span>
              </button>
            ))}
            <button
              onClick={() => setModalFinca(true)}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
            >
              <Ic n="ajustes" className="size-4" /> Corrales
            </button>
          </div>
        )}

        {loteActual && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="text-sm font-medium text-gray-800">{loteActual.nombre}</span>
              <span>{loteActual.animales_actuales.toLocaleString('es-CO')} {loteActual.sistema === 'cria' ? 'hembras' : 'animales'}</span>
              {loteActual.fecha_nacimiento && <span>· {edadTexto(loteActual.fecha_nacimiento)} de edad</span>}
              {loteActual.linea_genetica && <span>· {loteActual.linea_genetica}</span>}
            </div>
            <button
              onClick={() => setConfigOpen(true)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              <Ic n="ajustes" /> Configurar lote
            </button>
          </div>
        )}
      </div>

      {!cargando && !loteActual && (
        <div className="py-16 text-center">
          <p className="mb-3 text-5xl text-gray-300"><Ic n="cerdo" /></p>
          {corrales.length === 0 ? (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">La finca no tiene corrales</p>
              <p className="mb-5 text-gray-400">Registra tus corrales con su medida y para qué es cada uno (cría o precebo)</p>
              <button onClick={() => setModalFinca(true)} className="rounded-lg bg-orange-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-orange-700">
                Registrar corrales
              </button>
            </>
          ) : corralActual ? (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">{corralActual.nombre} está vacío</p>
              <p className="mb-5 text-gray-400">Agrega el lote que entra a este corral de {usoCorralLabel(corralActual.uso)?.toLowerCase() ?? 'cerdos'}</p>
              <button onClick={() => setCorralParaLote(corralActual)} className="rounded-lg bg-orange-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-orange-700">
                Agregar lote
              </button>
            </>
          ) : (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">Elige un corral</p>
              <p className="text-gray-400">Los corrales vacíos piden su lote al abrirlos</p>
            </>
          )}
        </div>
      )}

      {loteActual && (
        <div className="space-y-5">
          <div className="superficie flex gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium transition-colors',
                  tabVisible === tab.id ? 'bg-orange-50 text-orange-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800')}>
                <Ic n={tab.icon} className={cn('size-4', tabVisible === tab.id ? 'text-orange-600' : 'text-gray-400')} />
                {tab.label}
              </button>
            ))}
          </div>
          <div>
            {tabVisible === 'naves' && <NavesCria key={loteActual.id} lote={loteActual} onLoteUpdated={cargar} />}
            {tabVisible === 'diario' && (
              <TabDiarioCerdos key={loteActual.id} loteActual={loteActual} onLoteUpdated={cargar} onIrAlimento={() => setActiveTab('alimento')} />
            )}
            {tabVisible === 'alimento' && <AlimentoCorral key={loteActual.id} lote={loteActual} onCambio={cargar} />}
          </div>
        </div>
      )}

      <CrearLoteCerdosModal
        open={corralParaLote != null}
        onClose={() => setCorralParaLote(null)}
        fincaId={fincaActual.id}
        corral={corralParaLote}
        onCreated={lote => {
          setLotes(prev => [...prev, lote])
          setSeleccion(lote.instalacion_id ?? `lote:${lote.id}`)
          setActiveTab(lote.sistema === 'cria' ? 'naves' : 'alimento')
          cargar()
        }}
      />

      {loteActual && (
        <ConfigurarLoteCerdosModal
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          lote={loteActual}
          onUpdated={() => cargar()}
          onDeleted={() => cargar()}
        />
      )}

      <EditarFincaModal
        open={modalFinca}
        onClose={() => setModalFinca(false)}
        finca={fincaActual}
        onUpdated={() => { refetchFinca(); cargar() }}
      />
    </div>
  )
}
