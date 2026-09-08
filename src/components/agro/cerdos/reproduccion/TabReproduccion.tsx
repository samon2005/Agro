'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import type { Database } from '@/types/database'
import {
  ESTADOS_REPRODUCTORA, DIAS_GESTACION, DIAS_LACTANCIA_MAX,
  diaDeGestacion, diasDesde, edadTexto, fechaRepeticionCelo,
} from '@/lib/cerdos'
import { hoyLocal } from '@/lib/fechas'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Servicio = Database['public']['Tables']['servicios_cerdos']['Row']
type Parto = Database['public']['Tables']['partos_cerdos']['Row']
type Destete = Database['public']['Tables']['destetes_cerdos']['Row']

type SubTab = 'hembras' | 'servicios' | 'partos' | 'destetes'

interface Props {
  loteActual: LoteCerdos
  onLoteUpdated: () => void
}

export default function TabReproduccion({ loteActual, onLoteUpdated }: Props) {
  const supabase = createClient()
  const [subTab, setSubTab] = useState<SubTab>('hembras')
  const [hembras, setHembras] = useState<Reproductora[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [partos, setPartos] = useState<Parto[]>([])
  const [destetes, setDestetes] = useState<Destete[]>([])
  const [loading, setLoading] = useState(true)
  const [modalHembra, setModalHembra] = useState(false)
  const [hembraEditar, setHembraEditar] = useState<Reproductora | null>(null)
  const [modalServicio, setModalServicio] = useState(false)
  const [servicioEditar, setServicioEditar] = useState<Servicio | null>(null)
  const [modalParto, setModalParto] = useState(false)
  const [servicioParaParto, setServicioParaParto] = useState<Servicio | null>(null)
  const [modalDestete, setModalDestete] = useState(false)
  const [partoParaDestete, setPartoParaDestete] = useState<Parto | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [h, s, p, d] = await Promise.all([
      supabase.from('reproductoras_cerdos').select('*').eq('lote_id', loteActual.id).order('codigo'),
      supabase.from('servicios_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha_servicio', { ascending: false }),
      supabase.from('partos_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha_parto', { ascending: false }),
      supabase.from('destetes_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha_destete', { ascending: false }),
    ])
    setHembras(h.data ?? [])
    setServicios(s.data ?? [])
    setPartos(p.data ?? [])
    setDestetes(d.data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const hembraPorId = new Map(hembras.map(h => [h.id, h]))
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

  async function eliminar(tabla: 'reproductoras_cerdos' | 'servicios_cerdos' | 'partos_cerdos' | 'destetes_cerdos', id: string) {
    const key = `${tabla}-${id}`
    if (confirmandoEliminar !== key) { setConfirmandoEliminar(key); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) { toast.error('Error al eliminar el registro'); return }
    toast.success('Registro eliminado')
    fetchAll()
  }

  const subTabs: { id: SubTab; label: string; count: number }[] = [
    { id: 'hembras', label: '🐖 Hembras', count: activas.length },
    { id: 'servicios', label: '💉 Servicios', count: servicios.length },
    { id: 'partos', label: '🍼 Partos', count: partos.length },
    { id: 'destetes', label: '🐽 Destetes', count: destetes.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Reproducción</h2>
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
              onClick={() => { setServicioParaParto(null); setModalParto(true) }}
              disabled={activas.length === 0}
              className="bg-pink-600 hover:bg-pink-700 text-white text-sm"
            >
              + Registrar parto
            </Button>
          )}
          {subTab === 'destetes' && (
            <Button
              onClick={() => { setPartoParaDestete(null); setModalDestete(true) }}
              disabled={partos.length === 0}
              className="bg-pink-600 hover:bg-pink-700 text-white text-sm"
            >
              + Registrar destete
            </Button>
          )}
        </div>
      </div>

      {/* Avisos de manejo: lo que hay que hacer esta semana */}
      {(porConfirmar.length > 0 || partosProximos.length > 0 || destetesVencidos.length > 0) && (
        <div className="space-y-2">
          {porConfirmar.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-sm text-blue-800">
              🔍 <strong>{porConfirmar.length}</strong> {porConfirmar.length === 1 ? 'hembra servida lleva' : 'hembras servidas llevan'} más
              de 21 días sin confirmar preñez: {porConfirmar.map(s => hembraPorId.get(s.reproductora_id)?.codigo ?? '—').join(', ')}
            </div>
          )}
          {partosProximos.length > 0 && (
            <div className="p-3 bg-purple-50 border border-purple-300 rounded-lg text-sm text-purple-800">
              🍼 <strong>Partos esta semana:</strong> {partosProximos.map(s =>
                `${hembraPorId.get(s.reproductora_id)?.codigo ?? '—'} (${fmt(s.fecha_probable_parto!)})`
              ).join(', ')}
            </div>
          )}
          {destetesVencidos.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              🐽 <strong>{destetesVencidos.length}</strong> {destetesVencidos.length === 1 ? 'camada pasó' : 'camadas pasaron'} los {DIAS_LACTANCIA_MAX} días
              de lactancia sin registrar destete.
            </div>
          )}
        </div>
      )}

      {/* KPIs del núcleo de cría */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-pink-200 bg-pink-50">
          <CardContent className="p-4">
            <p className="text-xs text-pink-700 font-medium">Hembras activas</p>
            <p className="text-2xl font-bold text-pink-800">{activas.length}</p>
            <p className="text-xs text-pink-600 mt-0.5">
              {gestantes.length} gestantes · {lactantes.length} lactantes · {vacias.length} vacías
            </p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <p className="text-xs text-purple-700 font-medium">Nacidos vivos / parto</p>
            <p className="text-2xl font-bold text-purple-800">{promedioNacidosVivos ?? '—'}</p>
            <p className="text-xs text-purple-600 mt-0.5">{partos.length} partos registrados</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-700 font-medium">Mortinatos + momias</p>
            <p className="text-2xl font-bold text-gray-800">{mortalidadNacimiento ? `${mortalidadNacimiento}%` : '—'}</p>
            <p className="text-xs text-gray-600 mt-0.5">de los nacidos totales</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-xs text-green-700 font-medium">Lechones destetados</p>
            <p className="text-2xl font-bold text-green-800">{destetadosTotal}</p>
            <p className="text-xs text-green-600 mt-0.5">{partosMes.length} partos este mes</p>
          </CardContent>
        </Card>
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
              <Vacio emoji="🐖" texto="Sin hembras registradas" accion={() => { setHembraEditar(null); setModalHembra(true) }} etiqueta="+ Registrar hembra" />
            ) : (
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
                    {hembras.map(h => {
                      const servicioActivo = servicios.find(s => s.reproductora_id === h.id && (s.estado === 'pendiente' || s.estado === 'confirmado'))
                      const dia = servicioActivo ? diaDeGestacion(servicioActivo.fecha_servicio) : null
                      const partoAbierto = camadasLactando.find(p => p.reproductora_id === h.id)
                      const estado = ESTADOS_REPRODUCTORA[h.estado] ?? { label: h.estado, clase: 'bg-gray-100 text-gray-700 border-gray-300' }
                      return (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium text-sm">{h.codigo}</TableCell>
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
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setHembraEditar(h); setModalHembra(true) }}>✏️</Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === `reproductoras_cerdos-${h.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminar('reproductoras_cerdos', h.id)}
                              >
                                {confirmandoEliminar === `reproductoras_cerdos-${h.id}` ? '¿Confirmar?' : '🗑️'}
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
          ) : subTab === 'servicios' ? (
            servicios.length === 0 ? (
              <Vacio emoji="💉" texto="Sin servicios registrados" accion={() => { setServicioEditar(null); setModalServicio(true) }} etiqueta="+ Registrar servicio" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hembra</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Verraco / dosis</TableHead>
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
                          <TableCell className="text-sm text-gray-600">{s.tipo === 'monta_natural' ? '🐗 Monta' : '💉 Inseminación'}</TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {s.verraco ?? '—'}{s.numero_dosis ? ` · ${s.numero_dosis} dosis` : ''}
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.fecha_probable_parto ? fmt(s.fecha_probable_parto) : '—'}
                            {(s.estado === 'pendiente' || s.estado === 'confirmado') && dia != null && dia <= DIAS_GESTACION && (
                              <span className="block text-[11px] text-gray-400">día {dia} de {DIAS_GESTACION}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {s.estado === 'parido' ? <span className="text-green-700">🍼 Parió</span>
                              : s.prenez_confirmada ? <span className="text-purple-700">✅ Preñez confirmada</span>
                              : s.estado === 'repetido' ? <span className="text-amber-700">🔁 Repitió celo</span>
                              : s.estado === 'fallido' ? <span className="text-red-600">❌ Falló</span>
                              : <span className="text-blue-700">⏳ Por confirmar (celo el {fmt(fechaRepeticionCelo(s.fecha_servicio))})</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {s.estado !== 'parido' && (
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => { setServicioParaParto(s); setModalParto(true) }}
                                >
                                  + Parto
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setServicioEditar(s); setModalServicio(true) }}>✏️</Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === `servicios_cerdos-${s.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminar('servicios_cerdos', s.id)}
                              >
                                {confirmandoEliminar === `servicios_cerdos-${s.id}` ? '¿Confirmar?' : '🗑️'}
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
          ) : subTab === 'partos' ? (
            partos.length === 0 ? (
              <Vacio emoji="🍼" texto="Sin partos registrados" accion={() => { setServicioParaParto(null); setModalParto(true) }} etiqueta="+ Registrar parto" />
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
                              ? <span className="text-green-700">✅ Destetada</span>
                              : <span className={dias > DIAS_LACTANCIA_MAX ? 'text-amber-700 font-medium' : 'text-gray-500'}>Día {dias}</span>}
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
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === `partos_cerdos-${p.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminar('partos_cerdos', p.id)}
                              >
                                {confirmandoEliminar === `partos_cerdos-${p.id}` ? '¿Confirmar?' : '🗑️'}
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
          ) : (
            destetes.length === 0 ? (
              <Vacio emoji="🐽" texto="Sin destetes registrados" accion={() => { setPartoParaDestete(null); setModalDestete(true) }} etiqueta="+ Registrar destete" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hembra</TableHead>
                      <TableHead className="text-right">Destetados</TableHead>
                      <TableHead className="text-right">Peso prom.</TableHead>
                      <TableHead>Días de lactancia</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {destetes.map(d => {
                      const h = hembraPorId.get(d.reproductora_id)
                      const parto = partos.find(p => p.id === d.parto_id)
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="text-sm">{fmt(d.fecha_destete)}</TableCell>
                          <TableCell className="text-sm font-medium">{h?.codigo ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{d.lechones_destetados}</TableCell>
                          <TableCell className="text-right text-sm">{d.peso_promedio_kg != null ? `${Number(d.peso_promedio_kg).toFixed(2)} kg` : '—'}</TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {parto ? `${diasDesde(parto.fecha_parto, d.fecha_destete)} días` : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end">
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === `destetes_cerdos-${d.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminar('destetes_cerdos', d.id)}
                              >
                                {confirmandoEliminar === `destetes_cerdos-${d.id}` ? '¿Confirmar?' : '🗑️'}
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
          )}
        </CardContent>
      </Card>

      <RegistrarReproductoraModal
        open={modalHembra}
        onClose={() => { setModalHembra(false); setHembraEditar(null) }}
        lote={loteActual}
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
        onClose={() => { setModalParto(false); setServicioParaParto(null) }}
        lote={loteActual}
        hembras={activas}
        servicios={serviciosActivos}
        servicioPreseleccionado={servicioParaParto}
        onCreated={fetchAll}
      />
      <RegistrarDesteteModal
        open={modalDestete}
        onClose={() => { setModalDestete(false); setPartoParaDestete(null) }}
        lote={loteActual}
        hembras={activas}
        partos={camadasLactando}
        partoPreseleccionado={partoParaDestete}
        onCreated={fetchAll}
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
