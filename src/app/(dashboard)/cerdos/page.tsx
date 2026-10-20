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
import TableroReportes from '@/components/agro/reportes/TableroReportes'
import { useRol } from '@/components/agro/RolProvider'
import { edadTexto } from '@/lib/cerdos'
import { usoCorralLabel } from '@/lib/instalaciones'
import type { Database } from '@/types/database'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { nombreSeccion } from '@/lib/especies'
import { SelectorUnidades, type Unidad } from '@/components/ui/widgets/Selector'
import { Pildora } from '@/components/ui/widgets/Widget'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']
type Tab = 'naves' | 'diario' | 'alimento' | 'estadisticas'

/**
 * Dentro del corral solo queda lo que se está montando: las naves de cerdas (en
 * los de cría), el diario y el alimento. Lo demás se irá agregando por partes.
 */
function tabsDelLote(lote: LoteCerdos): { id: Tab; label: string; icon: NombreIcono }[] {
  return [
    ...(lote.sistema === 'cria' ? [{ id: 'naves' as const, label: 'Naves', icon: 'cerdo' as const }] : []),
    { id: 'diario', label: 'Diario', icon: 'diario' },
    { id: 'alimento', label: 'Alimento', icon: 'alimento' },
    { id: 'estadisticas', label: 'Estadísticas', icon: 'grafica' },
  ]
}

export default function CerdosPage() {
  const { fincaActual, loading: fincaLoading, refetch: refetchFinca } = useFinca()
  const rol = useRol()
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium text-gray-900">{nombreSeccion('cerdos', fincaActual.tipo_produccion)}</h1>
          <p className="text-sm text-gray-500">{fincaActual.nombre} · {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'} de cerdos · {corrales.length} {corrales.length === 1 ? 'corral' : 'corrales'}</p>
        </div>
        <button onClick={() => setModalFinca(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-gray-500 transition-colors hover:bg-white hover:text-gray-800">
          <Ic n="ajustes" className="size-4" /> Corrales y finca
        </button>
      </div>

      {/* Los corrales: cada uno con su mini anillo (animales frente a los que entraron) */}
      {cargando ? (
        <div className="flex gap-2">{[...Array(3)].map((_, i) => <div key={i} data-slot="skeleton" className="h-[60px] w-44 rounded-2xl" />)}</div>
      ) : corrales.length === 0 && lotes.length === 0 ? null : (
        <SelectorUnidades
          icono="cerdo"
          elegida={seleccion}
          onElegir={id => {
            if (id.startsWith('lote:')) {
              const l = lotes.find(x => `lote:${x.id}` === id)
              setSeleccion(id)
              if (l) setActiveTab(l.sistema === 'cria' ? 'naves' : 'diario')
              return
            }
            const c = corrales.find(x => x.id === id)
            if (c) elegirCorral(c)
          }}
          unidades={[
            ...corrales.map((c): Unidad => {
              const l = lotePorCorral.get(c.id)
              const uso = usoCorralLabel(c.uso)?.toLowerCase() ?? 'sin tipo'
              if (!l) return { id: c.id, nombre: c.nombre, estado: 'vacio', sub: `${uso} · vacío` }
              const pct = l.numero_animales > 0 ? (l.animales_actuales / l.numero_animales) * 100 : null
              return {
                id: c.id, nombre: c.nombre, estado: 'activo', pct, centro: l.animales_actuales.toLocaleString('es-CO'),
                sub: `${uso} · ${l.animales_actuales.toLocaleString('es-CO')} ${l.sistema === 'cria' ? 'hembras' : 'cerdos'}`,
              }
            }),
            ...lotesSueltos.map((l): Unidad => ({
              id: `lote:${l.id}`, nombre: l.nombre, estado: 'activo', sub: 'sin corral',
              pct: l.numero_animales > 0 ? (l.animales_actuales / l.numero_animales) * 100 : null, centro: l.animales_actuales.toLocaleString('es-CO'),
            })),
          ]}
        />
      )}

      {/* El lote del corral elegido: sus datos en píldoras */}
      {loteActual && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm font-semibold text-gray-800">{loteActual.nombre}</span>
            <Pildora tono="verde" icono="cerdo">{loteActual.sistema === 'cria' ? 'Cría' : 'Engorde'}</Pildora>
            <Pildora>{loteActual.animales_actuales.toLocaleString('es-CO')} {loteActual.sistema === 'cria' ? 'hembras' : 'animales'}</Pildora>
            {loteActual.fecha_nacimiento && <Pildora icono="calendario">{edadTexto(loteActual.fecha_nacimiento)} de edad</Pildora>}
            {loteActual.linea_genetica && <Pildora>{loteActual.linea_genetica}</Pildora>}
          </div>
          <button onClick={() => setConfigOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-gray-500 transition-colors hover:bg-white hover:text-gray-800">
            <Ic n="ajustes" /> Configurar lote
          </button>
        </div>
      )}

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
          <div className="flex gap-1 overflow-x-auto border-b border-gray-200 [scrollbar-width:none]">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('-mb-px inline-flex flex-shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
                  tabVisible === tab.id ? 'border-green-700 text-green-900' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                <Ic n={tab.icon} className={cn('size-4', tabVisible === tab.id ? 'text-green-700' : 'text-gray-400')} />
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
            {tabVisible === 'estadisticas' && (
              <TableroReportes key={loteActual.id} fincaId={fincaActual.id} fincaNombre={fincaActual.nombre} especies={['cerdos']}
                especie="cerdos" loteId={loteActual.id} verDinero={rol !== 'trabajador'} />
            )}
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
