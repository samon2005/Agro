'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { cn } from '@/lib/utils'
import CrearLoteCerdosModal from '@/components/agro/cerdos/CrearLoteCerdosModal'
import ConfigurarLoteCerdosModal from '@/components/agro/cerdos/ConfigurarLoteCerdosModal'
import EditarFincaModal from '@/components/agro/EditarFincaModal'
import ParametrosCerdosModal from '@/components/agro/cerdos/ParametrosCerdosModal'
import TabDiarioCerdos from '@/components/agro/cerdos/diario/TabDiarioCerdos'
import TabReproduccion from '@/components/agro/cerdos/reproduccion/TabReproduccion'
import AlimentoCorral from '@/components/agro/cerdos/corral/AlimentoCorral'
import TableroReportes from '@/components/agro/reportes/TableroReportes'
import { useRol } from '@/components/agro/RolProvider'
import { edadTexto } from '@/lib/cerdos'
import { usoCorralLabel, esNaveDeCria, arbolNaves, nombrePuestos } from '@/lib/instalaciones'
import type { Database } from '@/types/database'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { nombreSeccion } from '@/lib/especies'
import { SelectorUnidades, type Unidad } from '@/components/ui/widgets/Selector'
import { Pildora } from '@/components/ui/widgets/Widget'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']
type Tab = 'cerdas' | 'diario' | 'alimento' | 'estadisticas'

/** Lo que se ve de un grupo: en las naves de cría, primero sus cerdas. */
function tabsDelLote(lote: LoteCerdos): { id: Tab; label: string; icon: NombreIcono }[] {
  return [
    ...(lote.sistema === 'cria' ? [{ id: 'cerdas' as const, label: 'Cerdas', icon: 'cerdo' as const }] : []),
    { id: 'diario', label: 'Diario', icon: 'diario' },
    { id: 'alimento', label: 'Alimento', icon: 'alimento' },
    { id: 'estadisticas', label: 'Estadísticas', icon: 'grafica' },
  ]
}

/** Lo elegido arriba: una nave, los corrales sin nave, o un lote que no quedó en ningún lugar. */
const SUELTOS = 'sueltos'

/**
 * Los cerdos de la granja, organizados como la granja: naves (una por etapa) y,
 * dentro de las de engorde, sus corrales con su grupo. Las naves de cría
 * (gestación, parideras, cuarentena, berraco) muestran las cerdas del pie de
 * cría que están en ellas.
 */
export default function CerdosPage() {
  const { fincaActual, loading: fincaLoading, refetch: refetchFinca } = useFinca()
  const rol = useRol()
  const supabase = createClient()
  const [lugares, setLugares] = useState<Instalacion[]>([])
  const [lotes, setLotes] = useState<LoteCerdos[]>([])
  const [cerdasPorNave, setCerdasPorNave] = useState<Record<string, number>>({})
  const [seleccion, setSeleccion] = useState<string | null>(null)   // id de la nave, SUELTOS o "lote:<id>"
  const [corralElegido, setCorralElegido] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('diario')
  const [lugarParaLote, setLugarParaLote] = useState<Instalacion | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [modalFinca, setModalFinca] = useState(false)
  const [modalParametros, setModalParametros] = useState(false)
  // Lo que se abre al entrar se elige una vez por finca (las recargas no cambian la nave elegida)
  const yaElegido = useRef<string | null>(null)

  const cargar = useCallback(async () => {
    if (!fincaActual) return
    const [inst, lot, cer] = await Promise.all([
      supabase.from('instalaciones').select('*').eq('finca_id', fincaActual.id).eq('especie', 'cerdos'),
      supabase.from('lotes_cerdos').select('*').eq('finca_id', fincaActual.id).eq('estado', 'activo').order('created_at'),
      supabase.from('reproductoras_cerdos').select('ubicacion_id, estado').eq('finca_id', fincaActual.id).neq('estado', 'descartada'),
    ])
    const lista = inst.data ?? []
    const activos = lot.data ?? []
    const cuenta: Record<string, number> = {}
    for (const c of cer.data ?? []) if (c.ubicacion_id) cuenta[c.ubicacion_id] = (cuenta[c.ubicacion_id] ?? 0) + 1
    setLugares(lista)
    setLotes(activos)
    setCerdasPorNave(cuenta)

    // La primera vez se abre lo que pidió el Resumen (?lote=) o la primera nave con animales,
    // con la pestaña que le corresponde (Cerdas en las naves de cría, Diario en las de engorde)
    if (yaElegido.current !== fincaActual.id) {
      yaElegido.current = fincaActual.id
      const { naves } = arbolNaves(lista)
      const pedido = activos.find(l => l.id === new URLSearchParams(window.location.search).get('lote'))
      let id: string | null
      let corral: string | null = null
      if (pedido?.sistema === 'cria') id = naves.find(n => esNaveDeCria(n.uso))?.id ?? null
      else if (pedido) {
        const lugar = lista.find(l => l.id === pedido.instalacion_id)
        if (!lugar) id = `lote:${pedido.id}`
        else { corral = lugar.id; id = lugar.padre_id ?? (lugar.tipo === 'nave' ? lugar.id : SUELTOS) }
      } else {
        const conAnimales = naves.find(n => esNaveDeCria(n.uso)
          ? (cuenta[n.id] ?? 0) > 0
          : n.corrales.some(c => activos.some(l => l.instalacion_id === c.id)))
        const nave = conAnimales ?? naves[0] ?? null
        id = nave?.id ?? null
        if (nave && !esNaveDeCria(nave.uso)) corral = (nave.corrales.find(c => activos.some(l => l.instalacion_id === c.id)) ?? nave.corrales[0])?.id ?? null
      }
      setSeleccion(id)
      setCorralElegido(corral)
      setActiveTab(naves.some(n => n.id === id && esNaveDeCria(n.uso)) ? 'cerdas' : 'diario')
    }
    setCargando(false)
  }, [fincaActual, supabase])

  useEffect(() => { cargar() }, [cargar])

  const { naves, sueltos } = arbolNaves(lugares)
  const navesCria = naves.filter(n => esNaveDeCria(n.uso))
  // Todas las cerdas de la granja van en un solo grupo: el pie de cría
  const pieDeCria = lotes.find(l => l.sistema === 'cria') ?? null
  const lotePorLugar = new Map(lotes.filter(l => l.sistema !== 'cria' && l.instalacion_id).map(l => [l.instalacion_id as string, l]))
  const lotesSinLugar = lotes.filter(l => l.sistema !== 'cria' && (!l.instalacion_id || !lugares.some(c => c.id === l.instalacion_id)))

  const naveActual = naves.find(n => n.id === seleccion) ?? null
  const enCria = naveActual != null && esNaveDeCria(naveActual.uso)
  const corrales = naveActual && !enCria ? naveActual.corrales : seleccion === SUELTOS ? sueltos : []
  const corralActual = corrales.find(c => c.id === corralElegido) ?? null
  const loteActual = enCria
    ? pieDeCria
    : seleccion?.startsWith('lote:')
      ? lotes.find(l => `lote:${l.id}` === seleccion) ?? null
      : corralActual ? lotePorLugar.get(corralActual.id) ?? null : null
  const tabs = loteActual ? tabsDelLote(loteActual) : []
  const tabVisible: Tab = tabs.some(t => t.id === activeTab) ? activeTab : (tabs[0]?.id ?? 'diario')

  function elegirNave(id: string) {
    setSeleccion(id)
    const nave = naves.find(n => n.id === id)
    if (nave && esNaveDeCria(nave.uso)) { setActiveTab('cerdas'); return }
    // En una nave de engorde se abre el primer corral con cerdos (o el primero)
    const lista = nave ? nave.corrales : id === SUELTOS ? sueltos : []
    const primero = lista.find(c => lotePorLugar.has(c.id)) ?? lista[0] ?? null
    setCorralElegido(primero?.id ?? null)
    setActiveTab('diario')
  }

  function elegirCorral(c: Instalacion) {
    setCorralElegido(c.id)
    // La primera vez que se entra a un corral vacío se pide su lote
    if (!lotePorLugar.has(c.id)) setLugarParaLote(c)
    else setActiveTab('diario')
  }

  if (fincaLoading) return <div className="p-6 text-gray-500">Cargando...</div>
  if (!fincaActual) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center"><p className="mb-2 text-4xl"><Ic n="hoja" /></p><p className="text-gray-600">Selecciona una finca para continuar</p></div>
    </div>
  )

  const totalCerdas = Object.values(cerdasPorNave).reduce((s, n) => s + n, 0)
  const unidadesNaves: Unidad[] = [
    ...naves.map((n): Unidad => {
      const uso = usoCorralLabel(n.uso)?.toLowerCase() ?? 'sin tipo'
      if (esNaveDeCria(n.uso)) {
        const cerdas = cerdasPorNave[n.id] ?? 0
        const cupo = nombrePuestos(n.uso) ? n.puestos : null
        return {
          id: n.id, nombre: n.nombre, estado: cerdas > 0 ? 'activo' : 'vacio',
          pct: cupo ? Math.min(100, (cerdas / cupo) * 100) : null,
          centro: cerdas > 0 ? cerdas.toLocaleString('es-CO') : undefined,
          sub: `${uso} · ${cerdas} ${cerdas === 1 ? 'cerda' : 'cerdas'}${cupo ? ` de ${cupo}` : ''}`,
        }
      }
      const grupos = n.corrales.map(c => lotePorLugar.get(c.id)).filter((l): l is LoteCerdos => l != null)
      const animales = grupos.reduce((s, l) => s + l.animales_actuales, 0)
      const iniciales = grupos.reduce((s, l) => s + l.numero_animales, 0)
      return {
        id: n.id, nombre: n.nombre, estado: animales > 0 ? 'activo' : 'vacio',
        pct: iniciales > 0 ? (animales / iniciales) * 100 : null,
        centro: animales > 0 ? animales.toLocaleString('es-CO') : undefined,
        sub: `${uso} · ${n.corrales.length} ${n.corrales.length === 1 ? 'corral' : 'corrales'}`,
      }
    }),
    ...(sueltos.length > 0 ? [{ id: SUELTOS, nombre: 'Corrales sin nave', estado: 'activo' as const, sub: `${sueltos.length} ${sueltos.length === 1 ? 'corral' : 'corrales'}` }] : []),
    ...lotesSinLugar.map((l): Unidad => ({
      id: `lote:${l.id}`, nombre: l.nombre, estado: 'activo', sub: 'sin corral',
      pct: l.numero_animales > 0 ? (l.animales_actuales / l.numero_animales) * 100 : null, centro: l.animales_actuales.toLocaleString('es-CO'),
    })),
  ]

  return (
    <div className="flex-1 space-y-5 overflow-auto p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium text-gray-900">{nombreSeccion('cerdos', fincaActual.tipo_produccion)}</h1>
          <p className="text-sm text-gray-500">
            {fincaActual.nombre} · {naves.length} {naves.length === 1 ? 'nave' : 'naves'}
            {totalCerdas > 0 && <> · {totalCerdas} {totalCerdas === 1 ? 'cerda' : 'cerdas'}</>}
            {' '}· {lotes.filter(l => l.sistema !== 'cria').length} {lotes.filter(l => l.sistema !== 'cria').length === 1 ? 'grupo' : 'grupos'} de engorde
          </p>
        </div>
        <div className="flex items-center gap-1">
          {rol !== 'trabajador' && (
            <button onClick={() => setModalParametros(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-gray-500 transition-colors hover:bg-white hover:text-gray-800">
              <Ic n="grafica" className="size-4" /> Parámetros
            </button>
          )}
          <button onClick={() => setModalFinca(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-gray-500 transition-colors hover:bg-white hover:text-gray-800">
            <Ic n="ajustes" className="size-4" /> Naves y finca
          </button>
        </div>
      </div>

      {/* Las naves: las de cría con sus cerdas (frente a sus puestos), las de engorde con sus cerdos */}
      {cargando ? (
        <div className="flex gap-2">{[...Array(3)].map((_, i) => <div key={i} data-slot="skeleton" className="h-[60px] w-44 rounded-2xl" />)}</div>
      ) : unidadesNaves.length > 0 && (
        <SelectorUnidades icono="cerdo" elegida={seleccion} onElegir={elegirNave} unidades={unidadesNaves} />
      )}

      {/* Dentro de una nave de engorde: sus corrales, cada uno con su grupo */}
      {!cargando && (naveActual && !enCria || seleccion === SUELTOS) && (
        corrales.length === 0 ? (
          <div className="superficie flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <p className="text-sm text-gray-600">{naveActual?.nombre} todavía no tiene corrales.</p>
            <button onClick={() => setModalFinca(true)} className="text-sm font-medium text-green-800 hover:underline">Agregar corrales</button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Corrales de {naveActual?.nombre ?? 'la granja'}</p>
            <SelectorUnidades
              icono="cerdo"
              elegida={corralElegido}
              onElegir={id => { const c = corrales.find(x => x.id === id); if (c) elegirCorral(c) }}
              unidades={corrales.map((c): Unidad => {
                const l = lotePorLugar.get(c.id)
                if (!l) return { id: c.id, nombre: c.nombre, estado: 'vacio', sub: 'vacío' }
                return {
                  id: c.id, nombre: c.nombre, estado: 'activo',
                  pct: l.numero_animales > 0 ? (l.animales_actuales / l.numero_animales) * 100 : null,
                  centro: l.animales_actuales.toLocaleString('es-CO'),
                  sub: `${l.nombre} · ${l.animales_actuales.toLocaleString('es-CO')} cerdos`,
                }
              })}
            />
          </div>
        )
      )}

      {/* El grupo elegido: sus datos en píldoras */}
      {loteActual && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm font-semibold text-gray-800">{loteActual.nombre}</span>
            <Pildora tono="verde" icono="cerdo">{loteActual.sistema === 'cria' ? 'Pie de cría' : usoCorralLabel(loteActual.etapa_actual) ?? 'Engorde'}</Pildora>
            {loteActual.sistema === 'cria'
              ? <Pildora>{totalCerdas.toLocaleString('es-CO')} {totalCerdas === 1 ? 'cerda' : 'cerdas'} en la granja</Pildora>
              : <Pildora>{loteActual.animales_actuales.toLocaleString('es-CO')} animales</Pildora>}
            {loteActual.fecha_nacimiento && loteActual.sistema !== 'cria' && <Pildora icono="calendario">{edadTexto(loteActual.fecha_nacimiento)} de edad</Pildora>}
            {loteActual.linea_genetica && <Pildora>{loteActual.linea_genetica}</Pildora>}
          </div>
          <button onClick={() => setConfigOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-gray-500 transition-colors hover:bg-white hover:text-gray-800">
            <Ic n="ajustes" /> {loteActual.sistema === 'cria' ? 'Configurar pie de cría' : 'Configurar lote'}
          </button>
        </div>
      )}

      {!cargando && !loteActual && (
        <div className="py-16 text-center">
          <p className="mb-3 text-5xl text-gray-300"><Ic n="cerdo" /></p>
          {naves.length === 0 && sueltos.length === 0 && lotesSinLugar.length === 0 ? (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">La granja no tiene naves</p>
              <p className="mb-5 text-gray-400">Registra una nave por etapa: gestación, parideras, precebo, levante, ceba…</p>
              <button onClick={() => setModalFinca(true)} className="rounded-lg bg-green-700 px-6 py-2.5 font-medium text-white transition-colors hover:bg-green-800">
                Registrar naves
              </button>
            </>
          ) : enCria && naveActual ? (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">Todavía no está el pie de cría</p>
              <p className="mb-5 text-gray-400">Créalo una vez y después ubica cada cerda en su nave y su puesto</p>
              <button onClick={() => setLugarParaLote(naveActual)} className="rounded-lg bg-green-700 px-6 py-2.5 font-medium text-white transition-colors hover:bg-green-800">
                Crear el pie de cría
              </button>
            </>
          ) : corralActual ? (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">{corralActual.nombre} está vacío</p>
              <p className="mb-5 text-gray-400">Agrega el grupo que entra a este corral de {usoCorralLabel(corralActual.uso)?.toLowerCase() ?? 'cerdos'}</p>
              <button onClick={() => setLugarParaLote(corralActual)} className="rounded-lg bg-green-700 px-6 py-2.5 font-medium text-white transition-colors hover:bg-green-800">
                Agregar lote
              </button>
            </>
          ) : corrales.length > 0 ? (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">Elige un corral</p>
              <p className="text-gray-400">Los corrales vacíos piden su grupo al abrirlos</p>
            </>
          ) : naveActual ? null : (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">Elige una nave</p>
              <p className="text-gray-400">Arriba están las naves de la granja</p>
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
            {tabVisible === 'cerdas' && naveActual && (
              <TabReproduccion key={naveActual.id} loteActual={loteActual} nave={naveActual} naves={navesCria} onLoteUpdated={cargar} />
            )}
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
        open={lugarParaLote != null}
        onClose={() => setLugarParaLote(null)}
        fincaId={fincaActual.id}
        corral={lugarParaLote}
        onCreated={lote => {
          setLotes(prev => [...prev, lote])
          setActiveTab(lote.sistema === 'cria' ? 'cerdas' : 'alimento')
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

      <ParametrosCerdosModal key={modalParametros ? 'abierto' : 'cerrado'} open={modalParametros} onClose={() => setModalParametros(false)} />

      <EditarFincaModal
        open={modalFinca}
        onClose={() => setModalFinca(false)}
        finca={fincaActual}
        onUpdated={() => { refetchFinca(); cargar() }}
      />
    </div>
  )
}
