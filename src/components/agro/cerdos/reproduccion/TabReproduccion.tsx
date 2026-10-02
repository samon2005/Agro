'use client'

import { Indicador } from '@/components/ui/indicador'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import RegistrarReproductoraModal from './RegistrarReproductoraModal'
import RegistrarServicioModal from './RegistrarServicioModal'
import RegistrarPartoModal from './RegistrarPartoModal'
import RegistrarDesteteModal from './RegistrarDesteteModal'
import FichaCerdaModal from './FichaCerdaModal'
import type { Database } from '@/types/database'
import {
  ESTADOS_REPRODUCTORA, DIAS_GESTACION, DIAS_LACTANCIA_MIN, DIAS_LACTANCIA_MAX,
  diaDeGestacion, diasDesde, edadTexto, fechaRepeticionCelo,
} from '@/lib/cerdos'
import { hoyLocal } from '@/lib/fechas'
import { Ic } from '@/components/ui/icon'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Servicio = Database['public']['Tables']['servicios_cerdos']['Row']
type Parto = Database['public']['Tables']['partos_cerdos']['Row']
type Destete = Database['public']['Tables']['destetes_cerdos']['Row']

type Aplicacion = Database['public']['Tables']['inseminaciones_cerdos']['Row']

type Lechon = Database['public']['Tables']['lechones_cerdos']['Row']

type SubTab = 'hembras' | 'servicios' | 'partos' | 'lechones' | 'destetes'
type Nave = Database['public']['Tables']['naves_cerdos']['Row']

interface Props {
  loteActual: LoteCerdos
  onLoteUpdated: () => void
  /** La nave que se está viendo: solo sus cerdas y lo de ellas */
  nave: Nave
  /** Todas las naves del corral, para pasar una cerda de una a otra */
  naves: Nave[]
}

/**
 * Las cerdas de una nave y su ciclo: hembras, servicios, partos, lechones y
 * destetes. Lo que ya terminó (camadas destetadas y sus lechones) sale de aquí y
 * queda en el Historial.
 */
export default function TabReproduccion({ loteActual, onLoteUpdated, nave, naves }: Props) {
  const supabase = createClient()
  const [subTab, setSubTab] = useState<SubTab>('hembras')
  const [hembras, setHembras] = useState<Reproductora[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [partos, setPartos] = useState<Parto[]>([])
  const [destetes, setDestetes] = useState<Destete[]>([])
  const [loading, setLoading] = useState(true)
  const [modalHembra, setModalHembra] = useState(false)
  const [hembraEditar, setHembraEditar] = useState<Reproductora | null>(null)
  const [modalServicio, setModalServicio] = useState(false)
  const [servicioEditar, setServicioEditar] = useState<Servicio | null>(null)
  const [modalParto, setModalParto] = useState(false)
  const [partoEditar, setPartoEditar] = useState<Parto | null>(null)
  const [confirmandoPrenez, setConfirmandoPrenez] = useState<string | null>(null)
  const [lechones, setLechones] = useState<Lechon[]>([])
  const [fichaCerda, setFichaCerda] = useState<Reproductora | null>(null)
  // Un plantel grande no se lee como lista: primero los grupos, y al abrir uno su detalle
  const [grupoHembras, setGrupoHembras] = useState<string | null>(null)
  const [servicioParaParto, setServicioParaParto] = useState<Servicio | null>(null)
  const [modalDestete, setModalDestete] = useState(false)
  const [partoParaDestete, setPartoParaDestete] = useState<Parto | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [h, s, p, d] = await Promise.all([
      supabase.from('reproductoras_cerdos').select('*').eq('lote_id', loteActual.id).eq('nave_id', nave.id).order('codigo'),
      supabase.from('servicios_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha_servicio', { ascending: false }),
      supabase.from('partos_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha_parto', { ascending: false }),
      supabase.from('destetes_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha_destete', { ascending: false }),
    ])
    // Lo de la nave: los registros de sus cerdas
    const deLaNave = new Set((h.data ?? []).map(x => x.id))
    const serviciosNave = (s.data ?? []).filter(x => deLaNave.has(x.reproductora_id))
    // Las aplicaciones de cada servicio: van aparte porque son varias por servicio
    const ids = serviciosNave.map(x => x.id)
    const ap = ids.length > 0
      ? await supabase.from('inseminaciones_cerdos').select('*').in('servicio_id', ids).order('fecha')
      : { data: [] }
    setAplicaciones(ap.data ?? [])
    const lech = await supabase.from('lechones_cerdos').select('*').eq('lote_id', loteActual.id).order('codigo')
    setLechones((lech.data ?? []).filter(x => x.madre_id && deLaNave.has(x.madre_id)))
    setHembras(h.data ?? [])
    setServicios(serviciosNave)
    setPartos((p.data ?? []).filter(x => deLaNave.has(x.reproductora_id)))
    setDestetes((d.data ?? []).filter(x => deLaNave.has(x.reproductora_id)))
    setLoading(false)
  }, [loteActual.id, nave.id, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const hembraPorId = new Map(hembras.map(h => [h.id, h]))
  const aplicacionesPorServicio = new Map<string, Aplicacion[]>()
  for (const ap of aplicaciones) {
    const lista = aplicacionesPorServicio.get(ap.servicio_id) ?? []
    lista.push(ap)
    aplicacionesPorServicio.set(ap.servicio_id, lista)
  }
  const activas = hembras.filter(h => h.estado !== 'descartada')
  const gestantes = activas.filter(h => h.estado === 'gestante')
  const lactantes = activas.filter(h => h.estado === 'lactante')
  const vacias = activas.filter(h => h.estado === 'vacia')

  // Indicadores del núcleo
  const hoyStr = hoyLocal()
  const mesActual = hoyStr.slice(0, 7)
  const partosMes = partos.filter(p => p.fecha_parto.slice(0, 7) === mesActual)
  const nacidosVivosTotal = partos.reduce((s, p) => s + p.nacidos_vivos, 0)
  const promedioNacidosVivos = partos.length > 0 ? (nacidosVivosTotal / partos.length).toFixed(1) : null
  const nacidosTotales = partos.reduce((s, p) => s + p.nacidos_vivos + p.nacidos_muertos + p.momificados, 0)
  const mortalidadNacimiento = nacidosTotales > 0
    ? (((nacidosTotales - nacidosVivosTotal) / nacidosTotales) * 100).toFixed(1)
    : null
  const destetadosTotal = destetes.reduce((s, d) => s + d.lechones_destetados, 0)

  // Servicios pendientes de confirmar preñez y partos que ya vienen
  const serviciosActivos = servicios.filter(s => s.estado === 'pendiente' || s.estado === 'confirmado')
  const porConfirmar = serviciosActivos.filter(s => !s.prenez_confirmada && diasDesde(s.fecha_servicio) >= 21)
  const partosProximos = serviciosActivos
    .filter(s => s.fecha_probable_parto && diasDesde(hoyStr, s.fecha_probable_parto) <= 7 && diasDesde(hoyStr, s.fecha_probable_parto) >= 0)

  // Camadas sin destetar, con su día de lactancia
  const partosConDestete = new Set(destetes.map(d => d.parto_id).filter(Boolean))
  const camadasLactando = partos.filter(p => !partosConDestete.has(p.id))
  const destetesVencidos = camadasLactando.filter(p => diasDesde(p.fecha_parto) > DIAS_LACTANCIA_MAX)
  // En la ventana de destete: ya se pueden destetar, todavía sin atraso
  // El parto más cercano de las hembras preñadas, para el cuadro de "por venir"
  const proximoParto = servicios
    .filter(s => s.estado !== 'parido' && s.fecha_probable_parto)
    .map(s => s.fecha_probable_parto!)
    .sort()[0] ?? null

  // Lechones que siguen con la madre: al destetarse pasan al Historial
  const lechonesLactantes = lechones.filter(l => l.estado === 'lactante')

  // Las hembras por estado: es como las mira el encargado del plantel
  const gruposHembras = [
    { id: 'gestante', label: 'Gestantes', tono: 'bg-purple-50 text-purple-800 ring-purple-200' },
    { id: 'lactante', label: 'Lactantes', tono: 'bg-pink-50 text-pink-800 ring-pink-200' },
    { id: 'servida', label: 'Servidas', tono: 'bg-blue-50 text-blue-800 ring-blue-200' },
    { id: 'vacia', label: 'Vacías', tono: 'bg-gray-50 text-gray-700 ring-gray-200' },
    { id: 'descartada', label: 'Descartadas', tono: 'bg-red-50 text-red-700 ring-red-200' },
  ].map(g => ({ ...g, total: hembras.filter(h => h.estado === g.id).length }))
    .filter(g => g.total > 0)

  const hembrasVisibles = grupoHembras === null
    ? hembras
    : grupoHembras === '__todas__'
      ? hembras
      : hembras.filter(h => h.estado === grupoHembras)

  const destetesListos = camadasLactando.filter(p => {
    const d = diasDesde(p.fecha_parto)
    return d >= DIAS_LACTANCIA_MIN && d <= DIAS_LACTANCIA_MAX
  })

  /**
   * A los 21 días se sabe si el servicio prendió. Responder aquí deja a la cerda
   * gestante y el parto en pie, o la devuelve a vacía por haber repetido celo.
   */
  async function responderPrenez(servicio: Servicio, prendio: boolean) {
    setConfirmandoPrenez(servicio.id)
    const { error } = await supabase.from('servicios_cerdos').update({
      estado: prendio ? 'confirmado' : 'repetido',
      prenez_confirmada: prendio,
      fecha_confirmacion: prendio ? hoyLocal() : null,
    }).eq('id', servicio.id)

    if (!error) {
      await supabase.from('reproductoras_cerdos')
        .update({ estado: prendio ? 'gestante' : 'vacia' })
        .eq('id', servicio.reproductora_id)
    }
    setConfirmandoPrenez(null)
    if (error) { toast.error('Error al guardar la confirmación'); return }

    const codigo = hembraPorId.get(servicio.reproductora_id)?.codigo ?? 'La hembra'
    toast.success(prendio
      ? `${codigo} queda preñada · parto probable el ${servicio.fecha_probable_parto ? fmt(servicio.fecha_probable_parto) : 'por calcular'}`
      : `${codigo} repitió celo y vuelve a estar vacía: hay que servirla de nuevo`)
    fetchAll()
  }

  /**
   * Borrar un registro deshace lo que ese registro había cambiado: si se borra el
   * parto, la cerda vuelve a estar preñada y su servicio a estar confirmado; si se
   * borra el destete, la cerda vuelve a lactante.
   */
  async function eliminar(tabla: 'reproductoras_cerdos' | 'servicios_cerdos' | 'partos_cerdos', id: string) {
    const key = `${tabla}-${id}`
    if (confirmandoEliminar !== key) { setConfirmandoEliminar(key); return }
    setConfirmandoEliminar(null)

    const parto = tabla === 'partos_cerdos' ? partos.find(p => p.id === id) ?? null : null

    // Una camada destetada ya salió: primero se anula su destete en el Historial
    if (parto && partosConDestete.has(parto.id)) {
      toast.error('Esta camada ya se destetó: anula el destete en el Historial antes de borrar el parto')
      return
    }

    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) { toast.error('Error al eliminar el registro'); return }

    if (parto) {
      const hembra = hembraPorId.get(parto.reproductora_id)
      await supabase.from('reproductoras_cerdos').update({
        estado: 'gestante',
        numero_partos: Math.max(0, (hembra?.numero_partos ?? 1) - 1),
      }).eq('id', parto.reproductora_id)
      if (parto.servicio_id) {
        await supabase.from('servicios_cerdos')
          .update({ estado: 'confirmado', prenez_confirmada: true })
          .eq('id', parto.servicio_id)
      }
      toast.success(`Parto eliminado · ${hembra?.codigo ?? 'la hembra'} vuelve a figurar preñada`)
    } else {
      toast.success('Registro eliminado')
    }
    fetchAll()
  }

  const subTabs: { id: SubTab; label: string; count: number }[] = [
    { id: 'hembras', label: 'Hembras', count: activas.length },
    { id: 'servicios', label: 'Servicios', count: servicios.length },
    { id: 'partos', label: 'Partos', count: partos.length },
    { id: 'lechones', label: 'Lechones', count: lechonesLactantes.length },
    { id: 'destetes', label: 'Destetes', count: camadasLactando.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{nave.nombre}</h2>
          <p className="text-xs text-gray-400">
            Gestación de {DIAS_GESTACION} días · destete entre los 21 y los {DIAS_LACTANCIA_MAX} días · la cerda repite celo a los 21 días si no prendió
          </p>
        </div>
        <div className="flex gap-2">
          {subTab === 'hembras' && (
            <Button onClick={() => { setHembraEditar(null); setModalHembra(true) }} className="bg-pink-600 hover:bg-pink-700 text-white text-sm">
              + Registrar hembra
            </Button>
          )}
          {subTab === 'servicios' && (
            <Button
              onClick={() => { setServicioEditar(null); setModalServicio(true) }}
              disabled={activas.length === 0}
              className="bg-pink-600 hover:bg-pink-700 text-white text-sm"
            >
              + Registrar servicio
            </Button>
          )}
          {subTab === 'partos' && (
            <Button
              onClick={() => { setServicioParaParto(null); setPartoEditar(null); setModalParto(true) }}
              disabled={activas.length === 0}
              className="bg-pink-600 hover:bg-pink-700 text-white text-sm"
            >
              + Registrar parto
            </Button>
          )}
          {subTab === 'destetes' && (
            <Button
              onClick={() => { setPartoParaDestete(null); setModalDestete(true) }}
              disabled={camadasLactando.length === 0}
              className="bg-pink-600 hover:bg-pink-700 text-white text-sm"
            >
              + Registrar destete
            </Button>
          )}
        </div>
      </div>

      {/* Avisos de manejo: lo que hay que hacer esta semana */}
      {(porConfirmar.length > 0 || partosProximos.length > 0 || destetesVencidos.length > 0 || destetesListos.length > 0) && (
        <div className="space-y-2">
          {porConfirmar.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-sm text-blue-800">
              <Ic n="buscar" /> <strong>{porConfirmar.length}</strong> {porConfirmar.length === 1 ? 'hembra servida lleva' : 'hembras servidas llevan'} más
              de 21 días sin confirmar preñez: {porConfirmar.map(s => hembraPorId.get(s.reproductora_id)?.codigo ?? '—').join(', ')}
            </div>
          )}
          {partosProximos.length > 0 && (
            <div className="p-3 bg-purple-50 border border-purple-300 rounded-lg text-sm text-purple-800">
              <Ic n="tetero" /> <strong>Partos esta semana:</strong> {partosProximos.map(s =>
                `${hembraPorId.get(s.reproductora_id)?.codigo ?? '—'} (${fmt(s.fecha_probable_parto!)})`
              ).join(', ')}
            </div>
          )}
          {destetesListos.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800">
              <Ic n="tetero" /> <strong>{destetesListos.length}</strong> {destetesListos.length === 1 ? 'camada está' : 'camadas están'} en edad de destete
              ({DIAS_LACTANCIA_MIN} a {DIAS_LACTANCIA_MAX} días): {destetesListos.map(p =>
                `${hembraPorId.get(p.reproductora_id)?.codigo ?? '—'} · día ${diasDesde(p.fecha_parto)}`
              ).join(', ')}. Al destetar se registra el peso de salida.
            </div>
          )}
          {destetesVencidos.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              <Ic n="cerdo" /> <strong>{destetesVencidos.length}</strong> {destetesVencidos.length === 1 ? 'camada pasó' : 'camadas pasaron'} los {DIAS_LACTANCIA_MAX} días
              de lactancia sin registrar destete.
            </div>
          )}
        </div>
      )}

      {/* KPIs del núcleo de cría */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Indicador tono="pink" icono="cerdo" etiqueta="Hembras activas" valor={activas.length} detalle={<>{gestantes.length} gestantes · {lactantes.length} lactantes · {vacias.length} vacías</>} />
        {gestantes.length > 0 && (
          <Indicador
            tono="purple" icono="tetero" etiqueta="Partos por venir" valor={gestantes.length}
            detalle={proximoParto ? `El más cercano el ${fmt(proximoParto)}` : 'Sin fecha probable registrada'}
          />
        )}
        {/* Lo de partos solo cuando ya hubo uno: antes no hay nada que medir */}
        {partos.length > 0 && (
          <>
            <Indicador tono="purple" icono="tetero" etiqueta="Nacidos vivos / parto" valor={promedioNacidosVivos ?? '—'} detalle={<>{partos.length} partos registrados</>} />
            <Indicador tono="gray" icono="muerte" etiqueta="Mortinatos + momias" valor={mortalidadNacimiento ? `${mortalidadNacimiento}%` : '—'} detalle="de los nacidos totales" />
            <Indicador tono="green" icono="brote" etiqueta="Lechones destetados" valor={destetadosTotal} detalle={<>{partosMes.length} partos este mes</>} />
          </>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-0 overflow-x-auto">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              subTab === t.id ? 'border-pink-600 text-pink-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : subTab === 'hembras' ? (
            hembras.length === 0 ? (
              <Vacio emoji="" texto="Sin hembras registradas" accion={() => { setHembraEditar(null); setModalHembra(true) }} etiqueta="+ Registrar hembra" />
            ) : (
              <>
              {/* Los grupos primero: se entra al que interesa en vez de leer toda la lista */}
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
                <button
                  type="button"
                  onClick={() => setGrupoHembras('__todas__')}
                  className={`rounded-xl px-3 py-2 text-left text-xs ring-1 transition-colors ${
                    grupoHembras === '__todas__' || grupoHembras === null
                      ? 'bg-gray-900 text-white ring-gray-900'
                      : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300'
                  }`}
                >
                  <span className="block text-base font-semibold leading-none">{hembras.length}</span>
                  <span className="text-[0.6875rem]">Todas</span>
                </button>
                {gruposHembras.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGrupoHembras(grupoHembras === g.id ? '__todas__' : g.id)}
                    className={`rounded-xl px-3 py-2 text-left text-xs ring-1 transition-colors ${g.tono} ${
                      grupoHembras === g.id ? 'ring-2' : 'hover:ring-2'
                    }`}
                  >
                    <span className="block text-base font-semibold leading-none">{g.total}</span>
                    <span className="text-[0.6875rem]">{g.label}</span>
                  </button>
                ))}
                {grupoHembras && grupoHembras !== '__todas__' && (
                  <span className="text-xs text-gray-500">
                    Mostrando {hembrasVisibles.length} de {hembras.length}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Edad</TableHead>
                      <TableHead className="text-right">Partos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Situación</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hembrasVisibles.map(h => {
                      const servicioActivo = servicios.find(s => s.reproductora_id === h.id && (s.estado === 'pendiente' || s.estado === 'confirmado'))
                      const dia = servicioActivo ? diaDeGestacion(servicioActivo.fecha_servicio) : null
                      const partoAbierto = camadasLactando.find(p => p.reproductora_id === h.id)
                      const estado = ESTADOS_REPRODUCTORA[h.estado] ?? { label: h.estado, clase: 'bg-gray-100 text-gray-700 border-gray-300' }
                      return (
                        <TableRow key={h.id}>
                          <TableCell className="text-sm font-medium">
                            <button
                              type="button"
                              className="text-left text-pink-700 underline-offset-2 hover:underline"
                              onClick={() => setFichaCerda(h)}
                            >
                              {h.codigo}
                            </button>
                            {h.identificacion && (
                              <span className="block text-[0.6875rem] font-normal text-gray-400">
                                {h.tipo_identificacion ?? 'arete'} {h.identificacion}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">{h.nombre ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-500">{edadTexto(h.fecha_nacimiento)}</TableCell>
                          <TableCell className="text-right text-sm">{h.numero_partos}</TableCell>
                          <TableCell><Badge className={cn('text-[10px] border', estado.clase)}>{estado.label}</Badge></TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {partoAbierto
                              ? `Día ${diasDesde(partoAbierto.fecha_parto)} de lactancia`
                              : dia != null
                                ? `Día ${dia} de gestación${servicioActivo?.fecha_probable_parto ? ` · parto ${fmt(servicioActivo.fecha_probable_parto)}` : ''}`
                                : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setHembraEditar(h); setModalHembra(true) }}><Ic n="editar" /></Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === `reproductoras_cerdos-${h.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminar('reproductoras_cerdos', h.id)}
                              >
                                {confirmandoEliminar === `reproductoras_cerdos-${h.id}` ? '¿Confirmar?' : <Ic n="borrar" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              </>
            )
          ) : subTab === 'servicios' ? (
            servicios.length === 0 ? (
              <Vacio emoji="" texto="Sin servicios registrados" accion={() => { setServicioEditar(null); setModalServicio(true) }} etiqueta="+ Registrar servicio" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hembra</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Semen</TableHead>
                      <TableHead>Aplicaciones</TableHead>
                      <TableHead>Parto probable</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicios.map(s => {
                      const h = hembraPorId.get(s.reproductora_id)
                      const dia = diaDeGestacion(s.fecha_servicio)
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{fmt(s.fecha_servicio)}</TableCell>
                          <TableCell className="text-sm font-medium">{h?.codigo ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-600">{s.tipo === 'monta_natural' ? 'Monta' : 'Inseminación'}</TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {s.codigo_semen ?? s.verraco ?? '—'}
                            {s.codigo_semen && s.verraco && <span className="block text-[0.6875rem] text-gray-400">{s.verraco}</span>}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {(aplicacionesPorServicio.get(s.id) ?? []).length === 0
                              ? (s.numero_dosis ? `${s.numero_dosis} dosis` : '—')
                              : (aplicacionesPorServicio.get(s.id) ?? []).map(ap => (
                                  <span key={ap.id} className="block">
                                    {fmt(ap.fecha)}{ap.hora ? ` · ${ap.hora.slice(0, 5)}` : ''}
                                  </span>
                                ))}
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.fecha_probable_parto ? fmt(s.fecha_probable_parto) : '—'}
                            {(s.estado === 'pendiente' || s.estado === 'confirmado') && dia != null && dia <= DIAS_GESTACION && (
                              <span className="block text-[11px] text-gray-400">día {dia} de {DIAS_GESTACION}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {s.estado === 'parido' ? <span className="text-green-700"><Ic n="tetero" /> Parió</span>
                              : s.prenez_confirmada ? <span className="text-purple-700"><Ic n="listo" /> Preñez confirmada</span>
                              : s.estado === 'repetido' ? <span className="text-amber-700"><Ic n="repetir" /> Repitió celo</span>
                              : s.estado === 'fallido' ? <span className="text-red-600"><Ic n="x" /> Falló</span>
                              : (
                                <div className="space-y-1.5">
                                  <span className="block text-blue-700">
                                    <Ic n="reloj" /> ¿Quedó preñada? Se revisa hacia el {fmt(fechaRepeticionCelo(s.fecha_servicio))}
                                  </span>
                                  <div className="flex gap-1.5">
                                    <Button
                                      size="sm" variant="outline" className="h-7 text-xs"
                                      disabled={confirmandoPrenez === s.id}
                                      onClick={() => responderPrenez(s, true)}
                                    >
                                      <Ic n="listo" /> Sí, está preñada
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost" className="h-7 text-xs text-amber-700"
                                      disabled={confirmandoPrenez === s.id}
                                      onClick={() => responderPrenez(s, false)}
                                    >
                                      <Ic n="repetir" /> No, repitió celo
                                    </Button>
                                  </div>
                                </div>
                              )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {s.estado !== 'parido' && (
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => { setServicioParaParto(s); setPartoEditar(null); setModalParto(true) }}
                                >
                                  + Parto
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setServicioEditar(s); setModalServicio(true) }}><Ic n="editar" /></Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === `servicios_cerdos-${s.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminar('servicios_cerdos', s.id)}
                              >
                                {confirmandoEliminar === `servicios_cerdos-${s.id}` ? '¿Confirmar?' : <Ic n="borrar" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : subTab === 'lechones' ? (
            lechonesLactantes.length === 0 ? (
              <Vacio emoji="" texto="No hay lechones con sus madres en esta nave" accion={() => setSubTab('partos')} etiqueta="Ver partos" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Madre</TableHead>
                      <TableHead>Nació</TableHead>
                      <TableHead className="text-right">Días</TableHead>
                      <TableHead className="text-right">Peso al nacer</TableHead>
                      <TableHead>Sexo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lechonesLactantes.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="py-2 text-sm font-medium">{l.codigo}</TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">{hembraPorId.get(l.madre_id ?? '')?.codigo ?? '—'}</TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">{l.fecha_nacimiento ? fmt(l.fecha_nacimiento) : '—'}</TableCell>
                        <TableCell className="py-2 text-right text-sm">{l.fecha_nacimiento ? diasDesde(l.fecha_nacimiento) : '—'}</TableCell>
                        <TableCell className="py-2 text-right text-sm">
                          {l.peso_nacimiento_kg != null ? `${Number(l.peso_nacimiento_kg).toFixed(2)} kg` : '—'}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">{l.sexo ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : subTab === 'partos' ? (
            partos.length === 0 ? (
              <Vacio emoji="" texto="Sin partos registrados" accion={() => { setServicioParaParto(null); setPartoEditar(null); setModalParto(true) }} etiqueta="+ Registrar parto" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hembra</TableHead>
                      <TableHead className="text-right">Vivos</TableHead>
                      <TableHead className="text-right">Muertos</TableHead>
                      <TableHead className="text-right">Momias</TableHead>
                      <TableHead className="text-right">Posparto</TableHead>
                      <TableHead className="text-right">Peso camada</TableHead>
                      <TableHead>Lactancia</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partos.map(p => {
                      const h = hembraPorId.get(p.reproductora_id)
                      const destetado = partosConDestete.has(p.id)
                      const dias = diasDesde(p.fecha_parto)
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{fmt(p.fecha_parto)}</TableCell>
                          <TableCell className="text-sm font-medium">{h?.codigo ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-green-700">{p.nacidos_vivos}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{p.nacidos_muertos || '—'}</TableCell>
                          <TableCell className="text-right text-sm text-gray-500">{p.momificados || '—'}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{p.muertos_postparto || '—'}</TableCell>
                          <TableCell className="text-right text-sm">
                            {p.peso_camada_kg != null ? `${Number(p.peso_camada_kg).toFixed(1)} kg` : '—'}
                            {p.peso_camada_kg != null && p.nacidos_vivos > 0 && (
                              <span className="block text-[11px] text-gray-400">
                                {(Number(p.peso_camada_kg) / p.nacidos_vivos).toFixed(2)} kg/lechón
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {destetado
                              ? <span className="text-green-700"><Ic n="listo" /> Destetada</span>
                              : dias > DIAS_LACTANCIA_MAX
                                ? <span className="font-medium text-red-700">Día {dias} · destete atrasado</span>
                                : dias >= DIAS_LACTANCIA_MIN
                                  ? <span className="font-medium text-green-700">Día {dias} · lista para destetar</span>
                                  : <span className="text-gray-500">Día {dias} de {DIAS_LACTANCIA_MIN}</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {!destetado && (
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => { setPartoParaDestete(p); setModalDestete(true) }}
                                >
                                  + Destete
                                </Button>
                              )}
                              <Button
                                size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500"
                                onClick={() => { setPartoEditar(p); setServicioParaParto(null); setModalParto(true) }}
                              >
                                <Ic n="editar" />
                              </Button>
                              {!destetado && (
                                <Button
                                  size="sm" variant="ghost"
                                  className={confirmandoEliminar === `partos_cerdos-${p.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                  onClick={() => eliminar('partos_cerdos', p.id)}
                                >
                                  {confirmandoEliminar === `partos_cerdos-${p.id}` ? '¿Confirmar?' : <Ic n="borrar" />}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            camadasLactando.length === 0 ? (
              <div className="py-10 text-center">
                <p className="font-medium text-gray-600">No hay camadas por destetar</p>
                <p className="mt-1 text-xs text-gray-400">Las camadas destetadas, con sus lechones y su destino, quedan en el Historial.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Madre</TableHead>
                      <TableHead>Parto</TableHead>
                      <TableHead className="text-right">Lechones</TableHead>
                      <TableHead>Lactancia</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {camadasLactando.map(p => {
                      const dias = diasDesde(p.fecha_parto)
                      const vivos = lechonesLactantes.filter(l => l.parto_id === p.id).length
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm font-medium">{hembraPorId.get(p.reproductora_id)?.codigo ?? '—'}</TableCell>
                          <TableCell className="text-sm">{fmt(p.fecha_parto)}</TableCell>
                          <TableCell className="text-right text-sm">{vivos > 0 ? vivos : p.nacidos_vivos}</TableCell>
                          <TableCell className="text-xs">
                            {dias > DIAS_LACTANCIA_MAX
                              ? <span className="font-medium text-red-700">Día {dias} · destete atrasado</span>
                              : dias >= DIAS_LACTANCIA_MIN
                                ? <span className="font-medium text-green-700">Día {dias} · lista para destetar</span>
                                : <span className="text-gray-500">Día {dias} de {DIAS_LACTANCIA_MIN}</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" className="h-7 bg-pink-600 text-xs text-white hover:bg-pink-700"
                              onClick={() => { setPartoParaDestete(p); setModalDestete(true) }}>
                              Destetar
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <RegistrarReproductoraModal
        open={modalHembra}
        onClose={() => { setModalHembra(false); setHembraEditar(null) }}
        lote={loteActual}
        naveId={nave.id}
        naves={naves}
        reproductoraExistente={hembraEditar}
        onCreated={() => { fetchAll(); onLoteUpdated() }}
      />
      <RegistrarServicioModal
        open={modalServicio}
        onClose={() => { setModalServicio(false); setServicioEditar(null) }}
        lote={loteActual}
        hembras={activas}
        servicioExistente={servicioEditar}
        onCreated={fetchAll}
      />
      <RegistrarPartoModal
        open={modalParto}
        onClose={() => { setModalParto(false); setServicioParaParto(null); setPartoEditar(null) }}
        lote={loteActual}
        hembras={activas}
        servicios={serviciosActivos}
        servicioPreseleccionado={servicioParaParto}
        partoExistente={partoEditar}
        onCreated={fetchAll}
      />
      <FichaCerdaModal
        open={fichaCerda != null}
        onClose={() => setFichaCerda(null)}
        cerda={fichaCerda}
      />

      <RegistrarDesteteModal
        open={modalDestete}
        onClose={() => { setModalDestete(false); setPartoParaDestete(null) }}
        lote={loteActual}
        hembras={activas}
        partos={camadasLactando}
        partoPreseleccionado={partoParaDestete}
        onCreated={() => { fetchAll(); onLoteUpdated() }}
      />
    </div>
  )
}

function Vacio({ emoji, texto, accion, etiqueta }: { emoji: string; texto: string; accion: () => void; etiqueta: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-4xl mb-2">{emoji}</p>
      <p className="text-gray-600 font-medium">{texto}</p>
      <Button onClick={accion} className="mt-4 bg-pink-600 hover:bg-pink-700 text-white">{etiqueta}</Button>
    </div>
  )
}
