'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { cn } from '@/lib/utils'
import { SelectorUnidades, type Unidad } from '@/components/ui/widgets/Selector'
import { Pildora } from '@/components/ui/widgets/Widget'
import { BandejaAlertas } from '@/components/ui/widgets/Alertas'
import CrearLoteModal from '@/components/agro/aves/CrearLoteModal'
import LotesAnterioresModal from '@/components/agro/aves/LotesAnterioresModal'
import TabRentabilidad from '@/components/agro/aves/rentabilidad/TabRentabilidad'
import TableroReportes from '@/components/agro/reportes/TableroReportes'
import { useRol } from '@/components/agro/RolProvider'
import { PROPOSITO_LABEL } from '@/lib/lotesAves'
import EditarFincaModal from '@/components/agro/EditarFincaModal'
import TabProduccion from '@/components/agro/aves/produccion/TabProduccion'
import TabAmbiental from '@/components/agro/aves/ambiental/TabAmbiental'
import TabSanitario from '@/components/agro/aves/sanitario/TabSanitario'
import TabEquipos from '@/components/agro/aves/equipos/TabEquipos'
import TabAlimentoAves from '@/components/agro/alimento/aves/TabAlimentoAves'
import TabPesajes from '@/components/agro/aves/pesajes/TabPesajes'
import TabResumenSemanal from '@/components/agro/aves/resumen/TabResumenSemanal'
import { calcularFechaLiberacion } from '@/lib/sanitario'
import type { Database } from '@/types/database'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { nombreSeccion } from '@/lib/especies'
import { recalcularStockAlimentoAves } from '@/lib/inventario'
import { semanaDeVida } from '@/lib/referencias'
import { hoyLocal } from '@/lib/fechas'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']
type Medicacion = Database['public']['Tables']['medicaciones_aves']['Row']
type Equipo = Database['public']['Tables']['equipos_aves']['Row']
type Ambiental = Database['public']['Tables']['parametros_ambientales_aves']['Row']
type Produccion = Database['public']['Tables']['produccion_diaria_aves']['Row']

type Tab = 'produccion' | 'alimento' | 'ambiental' | 'sanitario' | 'equipos' | 'pesajes' | 'semanal' | 'rentabilidad' | 'estadisticas'

const TABS: { id: Tab; label: string; icon: NombreIcono }[] = [
  { id: 'produccion', label: 'Producción', icon: 'tendencia' },
  { id: 'alimento', label: 'Alimento', icon: 'alimento' },
  { id: 'ambiental', label: 'Ambiental', icon: 'termometro' },
  { id: 'sanitario', label: 'Sanitario', icon: 'vacuna' },
  { id: 'equipos', label: 'Equipos', icon: 'ajustes' },
  { id: 'pesajes', label: 'Pesajes', icon: 'bascula' },
  { id: 'semanal', label: 'Resumen semanal', icon: 'resumen' },
  { id: 'rentabilidad', label: 'Rentabilidad', icon: 'dinero' },
  { id: 'estadisticas', label: 'Estadísticas', icon: 'grafica' },
]

interface Alerta { tipo: 'danger' | 'warning'; mensaje: string }

export default function AvesPonedorasPage() {
  // Los costos y la utilidad no son para el operario
  const puedeVerCostos = useRol() !== 'trabajador'
  const { fincaActual, loading: fincaLoading, refetch: refetchFinca } = useFinca()
  const supabase = createClient()

  const [lotes, setLotes] = useState<LoteAves[]>([])
  // Los que ya salieron: su historial y el vacío sanitario de su galpón
  const [cerrados, setCerrados] = useState<LoteAves[]>([])
  const [verAnteriores, setVerAnteriores] = useState(false)
  const [loteActual, setLoteActual] = useState<LoteAves | null>(null)
  const [loadingLotes, setLoadingLotes] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('produccion')
  const [modalNuevoLote, setModalNuevoLote] = useState(false)
  // Los galpones son lugares fijos de la finca: se muestran todos, con aves o vacíos
  const [galpones, setGalpones] = useState<Instalacion[]>([])
  const [galponParaRegistrar, setGalponParaRegistrar] = useState<string | null>(null)
  const [modalFinca, setModalFinca] = useState(false)
  // Lo de hoy de cada galpón: su postura y si ya se registró el día
  const [hoyPorLote, setHoyPorLote] = useState<Record<string, { huevos: number; aves: number | null }>>({})

  // Alertas cross-módulo
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [alertasVersion, setAlertasVersion] = useState(0)
  const bumpAlertas = useCallback(() => setAlertasVersion(v => v + 1), [])

  const fetchLotes = useCallback(async () => {
    if (!fincaActual) return
    setLoadingLotes(true)
    await recalcularStockAlimentoAves(supabase, fincaActual.id)
    const [{ data }, { data: inst }, { data: salieron }] = await Promise.all([
      supabase
        .from('lotes_aves')
        .select('*')
        .eq('finca_id', fincaActual.id)
        .in('estado', ['activo', 'preparacion'])
        .order('nombre'),
      supabase
        .from('instalaciones')
        .select('*')
        .eq('finca_id', fincaActual.id)
        .eq('especie', 'aves_ponedoras')
        .order('nombre'),
      supabase
        .from('lotes_aves')
        .select('*')
        .eq('finca_id', fincaActual.id)
        .in('estado', ['vendido', 'finalizado'])
        .order('fecha_fin', { ascending: false, nullsFirst: false }),
    ])
    setLotes(data ?? [])
    setCerrados(salieron ?? [])
    setGalpones(inst ?? [])
    if (data && data.length > 0) {
      const { data: deHoy } = await supabase.from('produccion_diaria_aves').select('lote_id, huevos_totales, aves_en_dia')
        .in('lote_id', data.map(l => l.id)).eq('fecha', hoyLocal())
      setHoyPorLote(Object.fromEntries((deHoy ?? []).map(r => [r.lote_id, { huevos: r.huevos_totales, aves: r.aves_en_dia }])))
    }
    if (data && data.length > 0) {
      if (!loteActual) {
        // Al volver desde Alimento (?lote=), se abre el galpón del que se venía
        const pedido = new URLSearchParams(window.location.search).get('lote')
        setLoteActual(data.find(l => l.id === pedido) ?? data[0])
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

      // En las primeras semanas de postura lo normal es estar subiendo: no es alerta
      const semanasPostura = loteActual.estado === 'activo' && loteActual.fecha_inicio_postura
        ? (Date.now() - new Date(loteActual.fecha_inicio_postura + 'T00:00:00').getTime()) / (7 * 86_400_000)
        : 0
      if (semanasPostura > 6 && ultimaProd?.huevos_totales && ultimaProd?.aves_en_dia && ultimaProd.aves_en_dia > 0) {
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

  const ocupados = new Set(lotes.map(l => l.instalacion_id).filter((x): x is string => Boolean(x)))
  // Galpones vacíos que todavía están en limpieza y desinfección: hasta qué día
  const vacioSanitario: Record<string, string> = {}
  for (const l of cerrados) {
    const g = l.instalacion_id
    if (!g || ocupados.has(g) || !l.vacio_sanitario_hasta || l.vacio_sanitario_hasta <= hoyLocal()) continue
    if (!vacioSanitario[g] || vacioSanitario[g] < l.vacio_sanitario_hasta) vacioSanitario[g] = l.vacio_sanitario_hasta
  }

  function unidadDeLote(l: LoteAves): Unidad {
    const h = hoyPorLote[l.id]
    const postura = h && h.aves ? (h.huevos / h.aves) * 100 : null
    if (l.estado === 'activo') {
      return {
        id: l.id, nombre: l.nombre, estado: 'activo', pct: postura, centro: postura != null ? `${Math.round(postura)}%` : undefined,
        sub: `en postura · ${l.aves_actuales.toLocaleString('es-CO')} aves`, aviso: !h,
      }
    }
    const semana = Math.floor((new Date(hoyLocal() + 'T00:00:00').getTime() - new Date(l.fecha_inicio + 'T00:00:00').getTime()) / (7 * 86_400_000)) + 1
    // En levante el anillo es el camino hacia la postura (si tiene fecha tentativa)
    const total = l.fecha_inicio_postura
      ? Math.max(1, Math.round((new Date(l.fecha_inicio_postura + 'T00:00:00').getTime() - new Date(l.fecha_inicio + 'T00:00:00').getTime()) / (7 * 86_400_000)))
      : null
    return {
      id: l.id, nombre: l.nombre, estado: 'levante', sub: `levante · semana ${semana}`, aviso: !h,
      pct: total ? (semana / total) * 100 : null, centro: `S${semana}`,
    }
  }

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium text-gray-900">{nombreSeccion('aves_ponedoras', fincaActual.tipo_produccion)}</h1>
          <p className="text-sm text-gray-500">{fincaActual.nombre} · {lotes.length} {lotes.length === 1 ? 'galpón' : 'galpones'} con aves de {galpones.length}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {galpones.some(g => !ocupados.has(g.id)) && (
            <button onClick={() => { setGalponParaRegistrar(null); setModalNuevoLote(true) }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-green-700 px-4 text-sm font-medium text-white transition-colors hover:bg-green-800">
              <Ic n="mas" className="size-4" /> Registrar aves
            </button>
          )}
          {cerrados.length > 0 && (
            <button onClick={() => setVerAnteriores(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-gray-500 transition-colors hover:bg-white hover:text-gray-800">
              <Ic n="agenda" className="size-4" /> Lotes anteriores ({cerrados.length})
            </button>
          )}
          <button onClick={() => setModalFinca(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-gray-500 transition-colors hover:bg-white hover:text-gray-800">
            <Ic n="ajustes" className="size-4" /> Galpones y finca
          </button>
        </div>
      </div>

      {/* Los galpones: cada uno con su postura de hoy en el mini anillo */}
      {loadingLotes ? (
        <div className="flex gap-2">{[...Array(3)].map((_, i) => <div key={i} data-slot="skeleton" className="h-[60px] w-44 rounded-2xl" />)}</div>
      ) : (galpones.length > 0 || lotes.length > 0) && (
        <SelectorUnidades
          icono="gallina"
          elegida={loteActual?.id ?? null}
          onElegir={id => {
            const lote = lotes.find(l => l.id === id)
            if (lote) { setLoteActual(lote); setAlertas([]); return }
            // Un galpón vacío: registrar las aves que entran
            setGalponParaRegistrar(id); setModalNuevoLote(true)
          }}
          unidades={[
            ...galpones.map((g): Unidad => {
              const l = lotes.find(x => x.instalacion_id === g.id)
              if (!l) {
                const hasta = vacioSanitario[g.id]
                return {
                  id: g.id, nombre: g.nombre, estado: hasta ? 'limpieza' : 'vacio',
                  sub: hasta ? `limpieza hasta ${new Date(hasta + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}` : 'vacío · registrar aves',
                }
              }
              return unidadDeLote(l)
            }),
            ...lotes.filter(l => !l.instalacion_id || !galpones.some(g => g.id === l.instalacion_id)).map(unidadDeLote),
          ]}
        />
      )}

      {/* El galpón elegido: sus datos en píldoras */}
      {loteActual && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm font-semibold text-gray-800">{loteActual.nombre}</span>
          <Pildora tono={loteActual.estado === 'activo' ? 'verde' : 'gris'} icono={loteActual.estado === 'activo' ? 'huevo' : 'brote'}>
            {loteActual.estado === 'activo' ? 'En postura' : 'Levante'}
          </Pildora>
          {loteActual.linea_genetica && <Pildora icono="gallina">{loteActual.linea_genetica}</Pildora>}
          <Pildora>{loteActual.aves_actuales.toLocaleString('es-CO')} aves activas</Pildora>
          {loteActual.fecha_nacimiento && <Pildora icono="calendario">Semana {semanaDeVida(loteActual.fecha_nacimiento, hoyLocal()) ?? '—'} de vida</Pildora>}
          {loteActual.proposito !== 'ciclo_completo' && <Pildora tono="ambar">{PROPOSITO_LABEL[loteActual.proposito]}</Pildora>}
          {loteActual.fecha_salida_programada && <Pildora>Salida {new Date(loteActual.fecha_salida_programada + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</Pildora>}
          {loteActual.origen_aves && <Pildora>{loteActual.origen_aves}</Pildora>}
        </div>
      )}

      {/* Alertas del galpón (ambiente, postura, retiro, equipos), en una sola franja */}
      <BandejaAlertas titulo="Alertas del galpón" alertas={alertas.map((a, i) => ({
        id: String(i), nivel: a.tipo === 'danger' ? 'urgente' : 'revisar', texto: a.mensaje,
      }))} />

      {!loteActual && !loadingLotes && (
        <div className="py-16 text-center">
          <p className="mb-3 text-5xl text-gray-300"><Ic n="gallina" /></p>
          {galpones.length === 0 ? (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">La finca no tiene galpones</p>
              <p className="mb-5 text-gray-400">Registra tus galpones con su medida y luego las aves que entran a cada uno</p>
              <button
                onClick={() => setModalFinca(true)}
                className="rounded-lg bg-green-700 px-6 py-2.5 font-medium text-white transition-colors hover:bg-green-800"
              >
                Registrar galpones
              </button>
            </>
          ) : (
            <>
              <p className="mb-1 text-xl font-semibold text-gray-700">Ningún galpón tiene aves</p>
              <p className="mb-5 text-gray-400">Registra las aves que entran a uno de tus galpones</p>
              <button
                onClick={() => { setGalponParaRegistrar(null); setModalNuevoLote(true) }}
                className="rounded-lg bg-green-700 px-6 py-2.5 font-medium text-white transition-colors hover:bg-green-800"
              >
                Registrar aves
              </button>
            </>
          )}
        </div>
      )}

      {loteActual && (
        <>
          {/* Tab bar */}
          <div className="space-y-5">
            <div className="flex gap-1 overflow-x-auto border-b border-gray-200 [scrollbar-width:none]">
              {TABS.filter(tab => tab.id !== 'rentabilidad' || puedeVerCostos).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    '-mb-px inline-flex flex-shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
                    activeTab === tab.id
                      ? 'border-green-700 text-green-900'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
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
                  onIrAlimento={() => setActiveTab('alimento')}
                />
              )}
              {/* El alimento de este galpón: su consumo, horarios y balance, sin inventario */}
              {activeTab === 'alimento' && (
                <TabAlimentoAves
                  key={loteActual.id}
                  modo="galpon"
                  lotes={[loteActual]}
                  loteInicialId={loteActual.id}
                  onLoteCambiado={fetchLotes}
                />
              )}
              {activeTab === 'ambiental' && <TabAmbiental loteActual={loteActual} finca={fincaActual} />}
              {activeTab === 'sanitario' && <TabSanitario loteActual={loteActual} onChange={bumpAlertas} />}
              {activeTab === 'equipos' && <TabEquipos loteActual={loteActual} />}
              {activeTab === 'pesajes' && <TabPesajes key={loteActual.id} loteActual={loteActual} />}
              {activeTab === 'semanal' && <TabResumenSemanal key={loteActual.id} loteActual={loteActual} />}
              {activeTab === 'rentabilidad' && puedeVerCostos && <TabRentabilidad key={loteActual.id} loteActual={loteActual} />}
              {activeTab === 'estadisticas' && (
                <TableroReportes key={loteActual.id} fincaId={fincaActual.id} fincaNombre={fincaActual.nombre} especies={['aves_ponedoras']}
                  especie="aves_ponedoras" loteId={loteActual.id} verDinero={puedeVerCostos} />
              )}
            </div>
          </div>
        </>
      )}

      <LotesAnterioresModal open={verAnteriores} onClose={() => setVerAnteriores(false)} lotes={cerrados} />

      <CrearLoteModal
        open={modalNuevoLote}
        onClose={() => { setModalNuevoLote(false); setGalponParaRegistrar(null) }}
        fincaId={fincaActual.id}
        galpones={galpones}
        ocupados={ocupados}
        vacioSanitario={vacioSanitario}
        galponInicialId={galponParaRegistrar}
        onCreated={lote => {
          setLotes(prev => [...prev, lote].sort((a, b) => a.nombre.localeCompare(b.nombre)))
          setLoteActual(lote)
        }}
      />

      <EditarFincaModal
        open={modalFinca}
        onClose={() => setModalFinca(false)}
        finca={fincaActual}
        onUpdated={() => { refetchFinca(); fetchLotes() }}
      />
    </div>
  )
}
