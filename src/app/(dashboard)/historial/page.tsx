'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { cop } from '@/lib/huevos'
import { dbGenerico } from '@/lib/especiesConfig'
import { diasDesde, ESTADOS_LECHON } from '@/lib/cerdos'
import type { Database } from '@/types/database'

type T = Database['public']['Tables']
type Reproductora = T['reproductoras_cerdos']['Row']
type Servicio = T['servicios_cerdos']['Row']
type Parto = T['partos_cerdos']['Row']
type Destete = T['destetes_cerdos']['Row']
type Lechon = T['lechones_cerdos']['Row']
type Venta = Pick<T['ventas_cerdos']['Row'], 'id' | 'cantidad' | 'precio_animal' | 'cliente'>

type Categoria = 'partos' | 'servicios' | 'destetes' | 'lechones'

const CATEGORIAS: { id: Categoria; label: string; icon: NombreIcono }[] = [
  { id: 'servicios', label: 'Servicios', icon: 'corazon' },
  { id: 'partos', label: 'Partos', icon: 'tetero' },
  { id: 'lechones', label: 'Lechones', icon: 'cerdo' },
  { id: 'destetes', label: 'Destetes', icon: 'brote' },
]

const TODAS = '__todas__'

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * El historial completo de la cría: servicios, partos, destetes y lechones de
 * todas las cerdas, en tablas resumidas. Se filtra por hembra, por fecha de parto
 * y por categoría. Lo que se destetó deja de verse en la nave y queda aquí.
 */
export default function HistorialPage() {
  const supabase = createClient()
  const { fincaActual, loading: fincaLoading } = useFinca()
  const [cargando, setCargando] = useState(true)
  const [hembras, setHembras] = useState<Reproductora[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [partos, setPartos] = useState<Parto[]>([])
  const [destetes, setDestetes] = useState<Destete[]>([])
  const [lechones, setLechones] = useState<Lechon[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [nombreLote, setNombreLote] = useState<Record<string, string>>({})
  const [nombreNave, setNombreNave] = useState<Record<string, string>>({})

  const [categoria, setCategoria] = useState<Categoria>('partos')
  const [hembraFiltro, setHembraFiltro] = useState(TODAS)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estadoLechon, setEstadoLechon] = useState(TODAS)
  const [anulando, setAnulando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!fincaActual) return
    const f = fincaActual.id
    const [h, s, p, d, l, v, lo, na] = await Promise.all([
      supabase.from('reproductoras_cerdos').select('*').eq('finca_id', f).order('codigo'),
      supabase.from('servicios_cerdos').select('*').eq('finca_id', f).order('fecha_servicio', { ascending: false }),
      supabase.from('partos_cerdos').select('*').eq('finca_id', f).order('fecha_parto', { ascending: false }),
      supabase.from('destetes_cerdos').select('*').eq('finca_id', f).order('fecha_destete', { ascending: false }),
      supabase.from('lechones_cerdos').select('*').eq('finca_id', f).order('codigo'),
      supabase.from('ventas_cerdos').select('id, cantidad, precio_animal, cliente').eq('finca_id', f),
      supabase.from('lotes_cerdos').select('id, nombre, corral').eq('finca_id', f),
      supabase.from('naves_cerdos').select('id, nombre').eq('finca_id', f),
    ])
    setHembras(h.data ?? [])
    setServicios(s.data ?? [])
    setPartos(p.data ?? [])
    setDestetes(d.data ?? [])
    setLechones(l.data ?? [])
    setVentas(v.data ?? [])
    setNombreLote(Object.fromEntries((lo.data ?? []).map(x => [x.id, x.corral ? `${x.corral}` : x.nombre])))
    setNombreNave(Object.fromEntries((na.data ?? []).map(x => [x.id, x.nombre])))
    setCargando(false)
  }, [fincaActual, supabase])

  useEffect(() => { cargar() }, [cargar])

  if (fincaLoading) return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>

  const hembraPorId = new Map(hembras.map(h => [h.id, h]))
  const partoPorId = new Map(partos.map(p => [p.id, p]))
  const ventaPorId = new Map(ventas.map(v => [v.id, v]))
  const destetePorParto = new Map(destetes.filter(d => d.parto_id).map(d => [d.parto_id as string, d]))

  // ── Filtros: hembra y fecha de parto (cada registro se ubica por el parto al que pertenece) ──
  const enRango = (fecha: string | null | undefined) =>
    (!desde || (fecha != null && fecha >= desde)) && (!hasta || (fecha != null && fecha <= hasta))
  const deHembra = (id: string | null | undefined) => hembraFiltro === TODAS || id === hembraFiltro
  // El servicio se ubica por su parto (o por el probable, si todavía no parió)
  const partoDeServicio = new Map(partos.filter(p => p.servicio_id).map(p => [p.servicio_id as string, p]))

  const serviciosF = servicios.filter(s => deHembra(s.reproductora_id)
    && enRango(partoDeServicio.get(s.id)?.fecha_parto ?? s.fecha_probable_parto))
  const partosF = partos.filter(p => deHembra(p.reproductora_id) && enRango(p.fecha_parto))
  const destetesF = destetes.filter(d => deHembra(d.reproductora_id) && enRango(d.parto_id ? partoPorId.get(d.parto_id)?.fecha_parto : null))
  const lechonesF = lechones.filter(l => deHembra(l.madre_id) && enRango(l.fecha_nacimiento)
    && (estadoLechon === TODAS
      || (estadoLechon.startsWith('talla:') ? l.talla_destete === estadoLechon.slice(6) : l.estado === estadoLechon)))

  const conteo: Record<Categoria, number> = {
    servicios: serviciosF.length, partos: partosF.length, destetes: destetesF.length, lechones: lechonesF.length,
  }
  const tallasUsadas = [...new Set(lechones.map(l => l.talla_destete).filter((x): x is string => Boolean(x)))].sort()
  const estadosUsados = [...new Set(lechones.map(l => l.estado))]
  const codigo = (id: string | null | undefined) => (id ? hembraPorId.get(id)?.codigo ?? '—' : '—')

  async function anular(d: Destete) {
    if (anulando !== d.id) { setAnulando(d.id); return }
    setAnulando(null)
    const { error } = await dbGenerico(supabase).rpc('anular_destete', { p_destete: d.id })
    if (error) { toast.error(error.hint === 'destete' ? error.message : 'No se pudo anular el destete'); return }
    toast.success(`Destete anulado: los lechones vuelven con ${codigo(d.reproductora_id)}`)
    cargar()
  }

  // Resumen de lo filtrado
  const vivos = partosF.reduce((s, p) => s + p.nacidos_vivos, 0)
  const totales = partosF.reduce((s, p) => s + p.nacidos_vivos + p.nacidos_muertos + p.momificados, 0)
  const destetados = destetesF.reduce((s, d) => s + d.lechones_destetados, 0)

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div>
        <h2 className="font-heading text-3xl font-medium text-gray-900">Historial</h2>
        <p className="mt-1 text-gray-500">{fincaActual?.nombre} · servicios, partos, destetes y lechones de todas las cerdas</p>
      </div>

      {/* Resumen corto de lo que está filtrado */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra etiqueta="Partos" valor={partosF.length} detalle={partosF.length > 0 ? `${(vivos / partosF.length).toLocaleString('es-CO', { maximumFractionDigits: 1 })} nacidos vivos por parto` : '—'} />
        <Cifra etiqueta="Nacidos vivos" valor={vivos} detalle={totales > 0 ? `${(((totales - vivos) / totales) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} % muertos y momias` : '—'} />
        <Cifra etiqueta="Destetados" valor={destetados} detalle={vivos > 0 ? `${((destetados / vivos) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} % de los nacidos vivos` : '—'} />
        <Cifra etiqueta="Servicios" valor={serviciosF.length} detalle={`${serviciosF.filter(s => s.estado === 'repetido').length} repitieron celo`} />
      </div>

      {/* Filtros */}
      <div className="superficie flex flex-wrap items-end gap-3 rounded-2xl p-3">
        <div className="space-y-1">
          <p className="text-[0.6875rem] font-medium text-gray-500">Hembra</p>
          <Select value={hembraFiltro} onValueChange={v => setHembraFiltro(v ?? TODAS)}
            items={{ [TODAS]: 'Todas las hembras', ...Object.fromEntries(hembras.map(h => [h.id, `${h.codigo}${h.nombre ? ` · ${h.nombre}` : ''}`])) }}>
            <SelectTrigger className="h-9 w-48 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-72">
              <SelectItem value={TODAS}>Todas las hembras</SelectItem>
              {hembras.map(h => <SelectItem key={h.id} value={h.id}>{h.codigo}{h.nombre ? ` · ${h.nombre}` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-[0.6875rem] font-medium text-gray-500">Fecha de parto desde</p>
          <Input type="date" className="h-9 w-40 bg-white" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-[0.6875rem] font-medium text-gray-500">hasta</p>
          <Input type="date" className="h-9 w-40 bg-white" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        {categoria === 'lechones' && (
          <div className="space-y-1">
            <p className="text-[0.6875rem] font-medium text-gray-500">Talla o estado</p>
            <Select value={estadoLechon} onValueChange={v => setEstadoLechon(v ?? TODAS)}
              items={{
                [TODAS]: 'Todos',
                ...Object.fromEntries(tallasUsadas.map(t => [`talla:${t}`, `Talla ${t}`])),
                ...Object.fromEntries(estadosUsados.map(e => [e, ESTADOS_LECHON[e]?.label ?? e])),
              }}>
              <SelectTrigger className="h-9 w-40 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todos</SelectItem>
                {tallasUsadas.map(t => <SelectItem key={t} value={`talla:${t}`}>Talla {t}</SelectItem>)}
                {estadosUsados.map(e => <SelectItem key={e} value={e}>{ESTADOS_LECHON[e]?.label ?? e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {(hembraFiltro !== TODAS || desde || hasta || estadoLechon !== TODAS) && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setHembraFiltro(TODAS); setDesde(''); setHasta(''); setEstadoLechon(TODAS) }}>
            Quitar filtros
          </Button>
        )}
      </div>

      {/* Categoría */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 [scrollbar-width:none]">
        {CATEGORIAS.map(c => (
          <button key={c.id} onClick={() => setCategoria(c.id)}
            className={cn('-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              categoria === c.id ? 'border-pink-600 text-pink-800' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            <Ic n={c.icon} className="size-4" /> {c.label}
            <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{conteo[c.id]}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {cargando ? (
            <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : conteo[categoria] === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">Sin registros con estos filtros</p>
          ) : (
            <div className="max-h-[36rem] overflow-auto">
              <Table className="text-sm">
                {categoria === 'servicios' && (
                  <>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow>
                        <TableHead>Fecha</TableHead><TableHead>Hembra</TableHead><TableHead>Nave</TableHead><TableHead>Tipo</TableHead>
                        <TableHead>Semen / verraco</TableHead><TableHead>Parto probable</TableHead><TableHead>Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviciosF.map(s => {
                        const parto = partoDeServicio.get(s.id)
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="py-2">{fmt(s.fecha_servicio)}</TableCell>
                            <TableCell className="py-2 font-medium">{codigo(s.reproductora_id)}</TableCell>
                            <TableCell className="py-2 text-gray-500">{nombreNave[hembraPorId.get(s.reproductora_id)?.nave_id ?? ''] ?? '—'}</TableCell>
                            <TableCell className="py-2 text-gray-600">{s.tipo === 'monta_natural' ? 'Monta' : 'Inseminación'}</TableCell>
                            <TableCell className="py-2 text-gray-500">{s.codigo_semen ?? s.verraco ?? '—'}</TableCell>
                            <TableCell className="py-2">{fmt(s.fecha_probable_parto)}</TableCell>
                            <TableCell className="py-2 text-xs">
                              {s.estado === 'parido' ? <span className="text-green-700">Parió {parto ? `el ${fmt(parto.fecha_parto)}` : ''}</span>
                                : s.estado === 'repetido' ? <span className="text-amber-700">Repitió celo</span>
                                : s.estado === 'fallido' ? <span className="text-red-600">Falló</span>
                                : s.prenez_confirmada ? <span className="text-purple-700">Preñada</span>
                                : <span className="text-blue-700">Por confirmar</span>}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </>
                )}

                {categoria === 'partos' && (
                  <>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow>
                        <TableHead>Fecha</TableHead><TableHead>Hembra</TableHead><TableHead>Parto n°</TableHead>
                        <TableHead className="text-right">Vivos</TableHead><TableHead className="text-right">Muertos</TableHead>
                        <TableHead className="text-right">Momias</TableHead><TableHead className="text-right">Peso camada</TableHead>
                        <TableHead>Destete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partosF.map(p => {
                        const d = destetePorParto.get(p.id)
                        // Número de parto de la cerda: los anteriores a este más uno
                        const numero = partos.filter(x => x.reproductora_id === p.reproductora_id && x.fecha_parto <= p.fecha_parto).length
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="py-2">{fmt(p.fecha_parto)}</TableCell>
                            <TableCell className="py-2 font-medium">{codigo(p.reproductora_id)}</TableCell>
                            <TableCell className="py-2 text-gray-500">{numero}</TableCell>
                            <TableCell className="py-2 text-right font-semibold text-green-700">{p.nacidos_vivos}</TableCell>
                            <TableCell className="py-2 text-right text-red-600">{p.nacidos_muertos || '—'}</TableCell>
                            <TableCell className="py-2 text-right text-gray-500">{p.momificados || '—'}</TableCell>
                            <TableCell className="py-2 text-right">{p.peso_camada_kg != null ? `${Number(p.peso_camada_kg).toFixed(1)} kg` : '—'}</TableCell>
                            <TableCell className="py-2 text-xs">
                              {d ? `${fmt(d.fecha_destete)} · ${d.lechones_destetados} lechones` : <span className="text-pink-700">Lactando · día {diasDesde(p.fecha_parto)}</span>}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </>
                )}

                {categoria === 'destetes' && (
                  <>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow>
                        <TableHead>Fecha</TableHead><TableHead>Hembra</TableHead><TableHead>Parto</TableHead>
                        <TableHead className="text-right">Lechones</TableHead><TableHead className="text-right">Peso prom.</TableHead>
                        <TableHead>Lactancia</TableHead><TableHead>Destino</TableHead><TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {destetesF.map(d => {
                        const parto = d.parto_id ? partoPorId.get(d.parto_id) : null
                        const venta = d.venta_id ? ventaPorId.get(d.venta_id) : null
                        const tallas = lechones.filter(l => l.parto_id === d.parto_id && l.talla_destete)
                          .reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.talla_destete!]: (acc[l.talla_destete!] ?? 0) + 1 }), {})
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="py-2">{fmt(d.fecha_destete)}</TableCell>
                            <TableCell className="py-2 font-medium">{codigo(d.reproductora_id)}</TableCell>
                            <TableCell className="py-2 text-gray-500">{fmt(parto?.fecha_parto ?? null)}</TableCell>
                            <TableCell className="py-2 text-right font-semibold">
                              {d.lechones_destetados}
                              {Object.keys(tallas).length > 0 && (
                                <span className="block text-[0.6875rem] font-normal text-gray-400">
                                  {Object.entries(tallas).sort().map(([t, n]) => `${t}: ${n}`).join(' · ')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right">{d.peso_promedio_kg != null ? `${Number(d.peso_promedio_kg).toFixed(2)} kg` : '—'}</TableCell>
                            <TableCell className="py-2 text-gray-500">{parto ? `${diasDesde(parto.fecha_parto, d.fecha_destete)} días` : '—'}</TableCell>
                            <TableCell className="py-2 text-xs">
                              {d.destino === 'venta'
                                ? <Badge className="bg-green-100 text-[10px] text-green-800">Vendida{venta?.precio_animal ? ` · ${cop(Number(venta.precio_animal) * venta.cantidad)}` : ''}</Badge>
                                : d.destino === 'corral'
                                  ? <Badge className="bg-blue-100 text-[10px] text-blue-800">A {nombreLote[d.destino_lote_id ?? ''] ?? 'precebo'}</Badge>
                                  : <span className="text-gray-400">—</span>}
                              {venta?.cliente && <span className="block text-[0.6875rem] text-gray-400">{venta.cliente}</span>}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Button size="sm" variant="ghost"
                                className={cn('h-7 px-2 text-xs', anulando === d.id ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600')}
                                onClick={() => anular(d)} onBlur={() => setAnulando(null)}>
                                {anulando === d.id ? '¿Anular?' : 'Anular'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </>
                )}

                {categoria === 'lechones' && (
                  <>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow>
                        <TableHead>Código</TableHead><TableHead>Madre</TableHead><TableHead>Nació</TableHead><TableHead>Sexo</TableHead>
                        <TableHead className="text-right">Peso al nacer</TableHead><TableHead className="text-right">Peso al destete</TableHead>
                        <TableHead>Talla</TableHead><TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lechonesF.map(l => {
                        const e = ESTADOS_LECHON[l.estado] ?? { label: l.estado, clase: 'bg-gray-100 text-gray-600' }
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="py-2 font-medium">{l.codigo}</TableCell>
                            <TableCell className="py-2">{codigo(l.madre_id)}</TableCell>
                            <TableCell className="py-2 text-gray-500">{fmt(l.fecha_nacimiento)}</TableCell>
                            <TableCell className="py-2 text-gray-500">{l.sexo ?? '—'}</TableCell>
                            <TableCell className="py-2 text-right">{l.peso_nacimiento_kg != null ? `${Number(l.peso_nacimiento_kg).toFixed(2)} kg` : '—'}</TableCell>
                            <TableCell className="py-2 text-right">{l.peso_destete_kg != null ? `${Number(l.peso_destete_kg).toFixed(2)} kg` : '—'}</TableCell>
                            <TableCell className="py-2">{l.talla_destete ? <Badge className="bg-pink-100 text-[10px] text-pink-800">{l.talla_destete}</Badge> : '—'}</TableCell>
                            <TableCell className="py-2">
                              <Badge className={`text-[10px] ${e.clase}`}>{e.label}</Badge>
                              {l.causa_salida && <span className="block text-[0.6875rem] text-gray-400">{l.causa_salida}</span>}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Cifra({ etiqueta, valor, detalle }: { etiqueta: string; valor: number; detalle: string }) {
  return (
    <div className="superficie rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">{valor.toLocaleString('es-CO')}</p>
      <p className="text-[0.6875rem] text-gray-400">{detalle}</p>
    </div>
  )
}
