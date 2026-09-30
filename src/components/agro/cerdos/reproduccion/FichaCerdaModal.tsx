'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Indicador } from '@/components/ui/indicador'
import { Ic } from '@/components/ui/icon'
import type { Database } from '@/types/database'
import {
  ESTADOS_REPRODUCTORA, ESTADOS_LECHON, DIAS_GESTACION,
  diaDeGestacion, diasDesde, edadTexto,
} from '@/lib/cerdos'

type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Servicio = Database['public']['Tables']['servicios_cerdos']['Row']
type Parto = Database['public']['Tables']['partos_cerdos']['Row']
type Destete = Database['public']['Tables']['destetes_cerdos']['Row']
type Lechon = Database['public']['Tables']['lechones_cerdos']['Row']
type EventoClinico = Database['public']['Tables']['eventos_clinicos_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  cerda: Reproductora | null
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Todo lo de una cerda en un solo lugar: cuántas veces se sirvió, qué parió,
 * cuánto destetó, cómo va su ciclo y qué problemas de salud ha tenido. Es lo que
 * permite decidir si sigue en el plantel o se descarta.
 */
export default function FichaCerdaModal({ open, onClose, cerda }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [partos, setPartos] = useState<Parto[]>([])
  const [destetes, setDestetes] = useState<Destete[]>([])
  const [lechones, setLechones] = useState<Lechon[]>([])
  const [eventos, setEventos] = useState<EventoClinico[]>([])

  useEffect(() => {
    if (!open || !cerda) return
    let vigente = true
    setLoading(true)
    Promise.all([
      supabase.from('servicios_cerdos').select('*').eq('reproductora_id', cerda.id).order('fecha_servicio', { ascending: false }),
      supabase.from('partos_cerdos').select('*').eq('reproductora_id', cerda.id).order('fecha_parto', { ascending: false }),
      supabase.from('destetes_cerdos').select('*').eq('reproductora_id', cerda.id).order('fecha_destete', { ascending: false }),
      supabase.from('lechones_cerdos').select('*').eq('madre_id', cerda.id).order('numero'),
      supabase.from('eventos_clinicos_cerdos').select('*').eq('reproductora_id', cerda.id).order('fecha', { ascending: false }),
    ]).then(([s, p, d, l, e]) => {
      if (!vigente) return
      setServicios(s.data ?? [])
      setPartos(p.data ?? [])
      setDestetes(d.data ?? [])
      setLechones(l.data ?? [])
      setEventos(e.data ?? [])
      setLoading(false)
    })
    return () => { vigente = false }
  }, [open, cerda, supabase])

  if (!cerda) return null

  const estado = ESTADOS_REPRODUCTORA[cerda.estado] ?? { label: cerda.estado, clase: 'bg-gray-100 text-gray-600' }
  const nacidosVivos = partos.reduce((s, p) => s + p.nacidos_vivos, 0)
  const nacidosTotales = partos.reduce((s, p) => s + p.nacidos_vivos + p.nacidos_muertos + p.momificados, 0)
  const destetadosTotal = destetes.reduce((s, d) => s + d.lechones_destetados, 0)
  const promedioVivos = partos.length > 0 ? (nacidosVivos / partos.length).toFixed(1) : null
  // De los que nacieron vivos, cuántos llegaron al destete: mide su cría
  const supervivencia = nacidosVivos > 0 ? ((destetadosTotal / nacidosVivos) * 100).toFixed(0) : null
  // Lo que se demora entre un parto y el siguiente
  const intervalos = partos
    .map(p => p.fecha_parto)
    .sort()
    .map((fecha, i, lista) => i === 0 ? null : diasDesde(lista[i - 1], fecha))
    .filter((x): x is number => x != null)
  const intervaloPromedio = intervalos.length > 0
    ? Math.round(intervalos.reduce((s, x) => s + x, 0) / intervalos.length)
    : null

  const servicioAbierto = servicios.find(s => s.estado === 'pendiente' || s.estado === 'confirmado') ?? null
  const diaGestacion = servicioAbierto ? diaDeGestacion(servicioAbierto.fecha_servicio) : null
  const partosConDestete = new Set(destetes.map(d => d.parto_id).filter(Boolean))
  const lechonesVivos = lechones.filter(l => l.estado !== 'muerto' && l.estado !== 'vendido')

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Ic n="cerdo" /> Cerda {cerda.codigo}{cerda.nombre ? ` — ${cerda.nombre}` : ''}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {cerda.identificacion
              ? `${cerda.tipo_identificacion ?? 'Identificación'}: ${cerda.identificacion}`
              : 'Sin arete ni tatuaje registrado'}
            {cerda.linea_genetica ? ` · ${cerda.linea_genetica}` : ''}
            {cerda.fecha_nacimiento ? ` · ${edadTexto(cerda.fecha_nacimiento)}` : ''}
            {` · ingresó el ${fmt(cerda.fecha_ingreso)}`}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
              <Indicador
                tono="pink" icono="cerdo" etiqueta="Estado"
                valor={<Badge className={`text-xs ${estado.clase}`}>{estado.label}</Badge>}
                detalle={
                  servicioAbierto && diaGestacion != null && cerda.estado === 'gestante'
                    ? `Día ${diaGestacion} de ${DIAS_GESTACION}`
                    : `${cerda.numero_partos} parto${cerda.numero_partos === 1 ? '' : 's'}`
                }
              />
              <Indicador
                tono="purple" icono="tetero" etiqueta="Nacidos vivos por parto"
                valor={promedioVivos ?? '—'}
                detalle={`${nacidosVivos} vivos de ${nacidosTotales} nacidos`}
              />
              <Indicador
                tono="green" icono="brote" etiqueta="Llegaron al destete"
                valor={supervivencia ? `${supervivencia}%` : '—'}
                detalle={`${destetadosTotal} lechones destetados`}
              />
              <Indicador
                tono="blue" icono="ciclo" etiqueta="Entre partos"
                valor={intervaloPromedio ? `${intervaloPromedio} días` : '—'}
                detalle={intervalos.length > 0 ? `${intervalos.length + 1} partos seguidos` : 'Aún sin dos partos'}
              />
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">Servicios</h3>
              {servicios.length === 0 ? (
                <p className="text-sm text-gray-500">Todavía no se ha servido.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Semen</TableHead>
                      <TableHead>Parto probable</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicios.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="py-2 text-sm">{fmt(s.fecha_servicio)}</TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">{s.codigo_semen ?? s.verraco ?? '—'}</TableCell>
                        <TableCell className="py-2 text-sm">{s.fecha_probable_parto ? fmt(s.fecha_probable_parto) : '—'}</TableCell>
                        <TableCell className="py-2 text-xs">
                          {s.estado === 'parido' ? <span className="text-green-700">Parió</span>
                            : s.prenez_confirmada ? <span className="text-purple-700">Preñez confirmada</span>
                            : s.estado === 'repetido' ? <span className="text-amber-700">Repitió celo</span>
                            : s.estado === 'fallido' ? <span className="text-red-600">Falló</span>
                            : <span className="text-blue-700">Por confirmar</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">Partos y lactancias</h3>
              {partos.length === 0 ? (
                <p className="text-sm text-gray-500">Todavía no ha parido.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parto</TableHead>
                      <TableHead className="text-right">Vivos</TableHead>
                      <TableHead className="text-right">Muertos y momias</TableHead>
                      <TableHead className="text-right">Peso camada</TableHead>
                      <TableHead>Destete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partos.map(p => {
                      const destete = destetes.find(d => d.parto_id === p.id)
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="py-2 text-sm">{fmt(p.fecha_parto)}</TableCell>
                          <TableCell className="py-2 text-right text-sm font-semibold text-green-700">{p.nacidos_vivos}</TableCell>
                          <TableCell className="py-2 text-right text-sm text-gray-600">
                            {p.nacidos_muertos + p.momificados}
                            {p.muertos_postparto > 0 && <span className="block text-[0.6875rem] text-red-600">{p.muertos_postparto} en posparto</span>}
                          </TableCell>
                          <TableCell className="py-2 text-right text-sm">
                            {p.peso_camada_kg != null ? `${Number(p.peso_camada_kg).toFixed(1)} kg` : '—'}
                          </TableCell>
                          <TableCell className="py-2 text-xs">
                            {destete
                              ? `${destete.lechones_destetados} el ${fmt(destete.fecha_destete)} · ${diasDesde(p.fecha_parto, destete.fecha_destete)} días`
                              : partosConDestete.has(p.id) ? '—' : <span className="text-amber-700">En lactancia</span>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Lechones {lechones.length > 0 && <span className="font-normal text-gray-500">· {lechonesVivos.length} en pie de {lechones.length} nacidos</span>}
              </h3>
              {lechones.length === 0 ? (
                <p className="text-sm text-gray-500">Sus camadas todavía no tienen lechones identificados.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {lechones.map(l => {
                    const e = ESTADOS_LECHON[l.estado] ?? { label: l.estado, clase: 'bg-gray-100 text-gray-600' }
                    return (
                      <span key={l.id} className={`rounded-lg px-2 py-1 text-xs ${e.clase}`}>
                        {l.codigo}
                        {l.peso_destete_kg != null
                          ? ` · ${Number(l.peso_destete_kg).toFixed(1)} kg`
                          : l.peso_nacimiento_kg != null ? ` · ${Number(l.peso_nacimiento_kg).toFixed(2)} kg` : ''}
                      </span>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">Salud</h3>
              {eventos.length === 0 ? (
                <p className="text-sm text-gray-500">Sin eventos de salud registrados a nombre de esta cerda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell className="py-2 text-sm">{fmt(ev.fecha)}</TableCell>
                        <TableCell className="py-2 text-sm">{ev.tipo_evento}</TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">{ev.descripcion}</TableCell>
                        <TableCell className="py-2 text-xs">
                          {ev.resuelto ? <span className="text-green-700">Resuelto</span> : <span className="text-amber-700">Abierto</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
