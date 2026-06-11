'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import RegistrarPesoModal from './RegistrarPesoModal'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type PesoLote = Database['public']['Tables']['pesos_lote_cerdos']['Row']
type Mortalidad = Database['public']['Tables']['mortalidad_cerdos']['Row']
type Etapa = Database['public']['Tables']['etapas_cerdos']['Row']
type Movimiento = Database['public']['Tables']['movimientos_cerdos']['Row']

interface Props {
  loteActual: LoteCerdos
  onLoteUpdated: () => void
}

const ETAPAS_LABEL: Record<string, string> = {
  precebo: '🐷 Precebo', levante: '🐖 Levante', ceba: '🐗 Ceba', finalizacion: '✅ Finalización', vendido: '💰 Vendido'
}
const CAUSAS = ['PRRS', 'PCV2', 'APP', 'Disentería', 'Salmonelosis', 'Accidente', 'Neumonía', 'Otro']
const TIPOS_MOV = [
  { value: 'traslado', label: '🔄 Traslado de corral' },
  { value: 'venta', label: '💰 Venta' },
  { value: 'ingreso', label: '➕ Ingreso de animales' },
  { value: 'descarte', label: '🗑️ Descarte' },
]

export default function TabCrecimiento({ loteActual, onLoteUpdated }: Props) {
  const supabase = createClient()
  const [pesos, setPesos] = useState<PesoLote[]>([])
  const [mortalidad, setMortalidad] = useState<Mortalidad[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [modalPeso, setModalPeso] = useState(false)
  const [subTab, setSubTab] = useState<'pesos' | 'mortalidad' | 'etapas' | 'movimientos'>('pesos')

  // Mortalidad form
  const [formMort, setFormMort] = useState({ fecha: new Date().toISOString().split('T')[0], cantidad: '1', causa: '', descripcion: '', peso_estimado: '' })
  const [savingMort, setSavingMort] = useState(false)
  // Etapa form
  const [formEtapa, setFormEtapa] = useState({ fecha: new Date().toISOString().split('T')[0], etapa_nueva: '', peso_promedio: '', corral_destino: '', observaciones: '' })
  const [savingEtapa, setSavingEtapa] = useState(false)
  // Movimiento form
  const [formMov, setFormMov] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: '', cantidad: '', peso_promedio: '', destino_origen: '', precio_unitario: '', observaciones: '' })
  const [savingMov, setSavingMov] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [p, m, et, mv] = await Promise.all([
      supabase.from('pesos_lote_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(30),
      supabase.from('mortalidad_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
      supabase.from('etapas_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
      supabase.from('movimientos_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
    ])
    setPesos(p.data ?? [])
    setMortalidad(m.data ?? [])
    setEtapas(et.data ?? [])
    setMovimientos(mv.data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  // KPIs
  const ultimoPeso = pesos[0]
  const primerPeso = pesos[pesos.length - 1]
  const gananciaTotal = ultimoPeso && primerPeso ? (ultimoPeso.peso_promedio - (loteActual.peso_promedio_inicial ?? primerPeso.peso_promedio)) : null
  const mortAcum = mortalidad.reduce((s, m) => s + m.cantidad, 0)
  const mortPct = loteActual.numero_animales > 0 ? ((mortAcum / loteActual.numero_animales) * 100).toFixed(1) : '0.0'

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  async function saveMortalidad(e: React.FormEvent) {
    e.preventDefault()
    if (!formMort.cantidad || Number(formMort.cantidad) <= 0) { toast.error('Ingresa la cantidad'); return }
    setSavingMort(true)
    const { error } = await supabase.from('mortalidad_cerdos').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha: formMort.fecha, cantidad: Number(formMort.cantidad),
      causa: formMort.causa || null, descripcion: formMort.descripcion || null,
      peso_estimado: formMort.peso_estimado ? Number(formMort.peso_estimado) : null,
    })
    if (!error) {
      await supabase.from('lotes_cerdos').update({ animales_actuales: Math.max(0, loteActual.animales_actuales - Number(formMort.cantidad)) }).eq('id', loteActual.id)
    }
    setSavingMort(false)
    if (error) { toast.error('Error'); return }
    toast.success('Mortalidad registrada')
    setFormMort({ fecha: new Date().toISOString().split('T')[0], cantidad: '1', causa: '', descripcion: '', peso_estimado: '' })
    fetchAll(); onLoteUpdated()
  }

  async function saveEtapa(e: React.FormEvent) {
    e.preventDefault()
    if (!formEtapa.etapa_nueva) { toast.error('Selecciona la nueva etapa'); return }
    setSavingEtapa(true)
    const { error } = await supabase.from('etapas_cerdos').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha: formEtapa.fecha, etapa_anterior: loteActual.etapa_actual, etapa_nueva: formEtapa.etapa_nueva,
      peso_promedio: formEtapa.peso_promedio ? Number(formEtapa.peso_promedio) : null,
      numero_animales: loteActual.animales_actuales,
      corral_destino: formEtapa.corral_destino || null, observaciones: formEtapa.observaciones || null,
    })
    if (!error) {
      await supabase.from('lotes_cerdos').update({ etapa_actual: formEtapa.etapa_nueva }).eq('id', loteActual.id)
    }
    setSavingEtapa(false)
    if (error) { toast.error('Error'); return }
    toast.success('Cambio de etapa registrado')
    setFormEtapa({ fecha: new Date().toISOString().split('T')[0], etapa_nueva: '', peso_promedio: '', corral_destino: '', observaciones: '' })
    fetchAll(); onLoteUpdated()
  }

  async function saveMovimiento(e: React.FormEvent) {
    e.preventDefault()
    if (!formMov.tipo || !formMov.cantidad) { toast.error('Tipo y cantidad son requeridos'); return }
    setSavingMov(true)
    const cant = Number(formMov.cantidad)
    const pu = formMov.precio_unitario ? Number(formMov.precio_unitario) : null
    const { error } = await supabase.from('movimientos_cerdos').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id, fecha: formMov.fecha,
      tipo: formMov.tipo, cantidad: cant,
      peso_promedio: formMov.peso_promedio ? Number(formMov.peso_promedio) : null,
      destino_origen: formMov.destino_origen || null,
      precio_unitario: pu, valor_total: pu ? pu * cant : null,
      observaciones: formMov.observaciones || null,
    })
    if (!error) {
      const delta = formMov.tipo === 'ingreso' ? cant : -cant
      await supabase.from('lotes_cerdos').update({ animales_actuales: Math.max(0, loteActual.animales_actuales + delta) }).eq('id', loteActual.id)
    }
    setSavingMov(false)
    if (error) { toast.error('Error'); return }
    toast.success('Movimiento registrado')
    setFormMov({ fecha: new Date().toISOString().split('T')[0], tipo: '', cantidad: '', peso_promedio: '', destino_origen: '', precio_unitario: '', observaciones: '' })
    fetchAll(); onLoteUpdated()
  }

  const subTabs = [
    { id: 'pesos' as const, label: '⚖️ Pesajes', count: pesos.length },
    { id: 'mortalidad' as const, label: '💀 Mortalidad', count: mortalidad.length },
    { id: 'etapas' as const, label: '🔄 Etapas', count: etapas.length },
    { id: 'movimientos' as const, label: '📦 Movimientos', count: movimientos.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Producción y Crecimiento</h2>
        {subTab === 'pesos' && (
          <Button onClick={() => setModalPeso(true)} className="bg-green-700 hover:bg-green-800 text-white text-sm">+ Registrar pesaje</Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 font-medium">Peso promedio</p>
            <p className="text-2xl font-bold text-blue-800">{ultimoPeso ? `${ultimoPeso.peso_promedio.toFixed(1)} kg` : '—'}</p>
            <p className="text-xs text-blue-600 mt-0.5">{ultimoPeso ? fmt(ultimoPeso.fecha) : 'Sin pesajes'}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-xs text-green-700 font-medium">Ganancia total</p>
            <p className="text-2xl font-bold text-green-800">{gananciaTotal !== null ? `${gananciaTotal.toFixed(1)} kg` : '—'}</p>
            <p className="text-xs text-green-600 mt-0.5">vs peso inicial</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-xs text-orange-700 font-medium">Etapa actual</p>
            <p className="text-lg font-bold text-orange-800">{ETAPAS_LABEL[loteActual.etapa_actual] ?? loteActual.etapa_actual}</p>
            <p className="text-xs text-orange-600 mt-0.5">{loteActual.animales_actuales} animales</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-700 font-medium">Mortalidad acum.</p>
            <p className="text-2xl font-bold text-gray-800">{mortAcum}</p>
            <p className="text-xs text-gray-600 mt-0.5">{mortPct}% del lote inicial</p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            {t.count > 0 && <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {subTab === 'pesos' && (
              pesos.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-4xl mb-2">⚖️</p>
                  <p className="text-gray-600 font-medium">Sin pesajes registrados</p>
                  <Button onClick={() => setModalPeso(true)} className="mt-4 bg-green-700 hover:bg-green-800 text-white">+ Registrar pesaje</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Peso prom. (kg)</TableHead>
                        <TableHead className="text-right">Mín</TableHead>
                        <TableHead className="text-right">Máx</TableHead>
                        <TableHead className="text-right">Variación</TableHead>
                        <TableHead>Método</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pesos.map((p, idx) => {
                        const variacion = p.peso_minimo && p.peso_maximo ? (((p.peso_maximo - p.peso_minimo) / p.peso_promedio) * 100).toFixed(1) : null
                        const prevPeso = pesos[idx + 1]
                        const ganancia = prevPeso ? (p.peso_promedio - prevPeso.peso_promedio).toFixed(2) : null
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium text-sm">{fmt(p.fecha)}</TableCell>
                            <TableCell className="text-right font-semibold">{p.peso_promedio.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-sm text-gray-500">{p.peso_minimo?.toFixed(1) ?? '—'}</TableCell>
                            <TableCell className="text-right text-sm text-gray-500">{p.peso_maximo?.toFixed(1) ?? '—'}</TableCell>
                            <TableCell className="text-right text-sm">
                              {variacion ? <span className={Number(variacion) < 20 ? 'text-green-600' : 'text-amber-600'}>{variacion}%</span> : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">{p.metodo === 'bascula_dinamica' ? '⚙️ Báscula' : '✍️ Manual'}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )
            )}

            {subTab === 'mortalidad' && (
              <div className="p-4 space-y-4">
                <form onSubmit={saveMortalidad} className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha</Label>
                    <Input type="date" value={formMort.fecha} onChange={e => setFormMort(p => ({ ...p, fecha: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad *</Label>
                    <Input type="number" min="1" value={formMort.cantidad} onChange={e => setFormMort(p => ({ ...p, cantidad: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Causa</Label>
                    <Select value={formMort.causa} onValueChange={v => setFormMort(p => ({ ...p, causa: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder="Causa..." /></SelectTrigger>
                      <SelectContent>{CAUSAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso estimado (kg)</Label>
                    <Input type="number" step="0.1" value={formMort.peso_estimado} onChange={e => setFormMort(p => ({ ...p, peso_estimado: e.target.value }))} />
                  </div>
                  <div className="col-span-2 md:col-span-3 space-y-1">
                    <Label className="text-xs">Descripción</Label>
                    <Input placeholder="Describe lo ocurrido..." value={formMort.descripcion} onChange={e => setFormMort(p => ({ ...p, descripcion: e.target.value }))} />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={savingMort} className="w-full bg-red-700 hover:bg-red-800 text-white text-sm">
                      {savingMort ? '...' : '+ Registrar'}
                    </Button>
                  </div>
                </form>
                {mortalidad.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">Sin registros de mortalidad</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Fecha</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead>Causa</TableHead><TableHead>Descripción</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {mortalidad.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm">{fmt(m.fecha)}</TableCell>
                          <TableCell className="text-right"><Badge variant="destructive">{m.cantidad}</Badge></TableCell>
                          <TableCell className="text-sm">{m.causa ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-500">{m.descripcion ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            {subTab === 'etapas' && (
              <div className="p-4 space-y-4">
                <form onSubmit={saveEtapa} className="grid grid-cols-2 gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha</Label>
                    <Input type="date" value={formEtapa.fecha} onChange={e => setFormEtapa(p => ({ ...p, fecha: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nueva etapa *</Label>
                    <Select value={formEtapa.etapa_nueva} onValueChange={v => setFormEtapa(p => ({ ...p, etapa_nueva: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar etapa..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="levante">🐖 Levante</SelectItem>
                        <SelectItem value="ceba">🐗 Ceba / Engorde</SelectItem>
                        <SelectItem value="finalizacion">✅ Finalización</SelectItem>
                        <SelectItem value="vendido">💰 Vendido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso prom. al pasar (kg)</Label>
                    <Input type="number" step="0.1" value={formEtapa.peso_promedio} onChange={e => setFormEtapa(p => ({ ...p, peso_promedio: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Corral destino</Label>
                    <Input placeholder="Ej: Corral B-2" value={formEtapa.corral_destino} onChange={e => setFormEtapa(p => ({ ...p, corral_destino: e.target.value }))} />
                  </div>
                  <div className="col-span-2 flex gap-3">
                    <Input placeholder="Observaciones..." value={formEtapa.observaciones} onChange={e => setFormEtapa(p => ({ ...p, observaciones: e.target.value }))} />
                    <Button type="submit" disabled={savingEtapa} className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white">
                      {savingEtapa ? '...' : 'Cambiar etapa'}
                    </Button>
                  </div>
                </form>
                {etapas.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">Sin cambios de etapa registrados</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Fecha</TableHead><TableHead>Etapa anterior</TableHead><TableHead>Etapa nueva</TableHead><TableHead className="text-right">Peso (kg)</TableHead><TableHead>Corral</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {etapas.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{fmt(e.fecha)}</TableCell>
                          <TableCell className="text-sm text-gray-500">{e.etapa_anterior ? ETAPAS_LABEL[e.etapa_anterior] : '—'}</TableCell>
                          <TableCell className="text-sm font-medium">{ETAPAS_LABEL[e.etapa_nueva] ?? e.etapa_nueva}</TableCell>
                          <TableCell className="text-right text-sm">{e.peso_promedio?.toFixed(1) ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-500">{e.corral_destino ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            {subTab === 'movimientos' && (
              <div className="p-4 space-y-4">
                <form onSubmit={saveMovimiento} className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha</Label>
                    <Input type="date" value={formMov.fecha} onChange={e => setFormMov(p => ({ ...p, fecha: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo *</Label>
                    <Select value={formMov.tipo} onValueChange={v => setFormMov(p => ({ ...p, tipo: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder="Tipo..." /></SelectTrigger>
                      <SelectContent>{TIPOS_MOV.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad *</Label>
                    <Input type="number" min="1" value={formMov.cantidad} onChange={e => setFormMov(p => ({ ...p, cantidad: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso prom. (kg)</Label>
                    <Input type="number" step="0.1" value={formMov.peso_promedio} onChange={e => setFormMov(p => ({ ...p, peso_promedio: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Destino / Origen</Label>
                    <Input placeholder="A dónde / de dónde" value={formMov.destino_origen} onChange={e => setFormMov(p => ({ ...p, destino_origen: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Precio unit. (COP)</Label>
                    <Input type="number" min="0" value={formMov.precio_unitario} onChange={e => setFormMov(p => ({ ...p, precio_unitario: e.target.value }))} />
                  </div>
                  <div className="col-span-2 md:col-span-2 flex gap-3">
                    <Input placeholder="Observaciones..." value={formMov.observaciones} onChange={e => setFormMov(p => ({ ...p, observaciones: e.target.value }))} />
                    <Button type="submit" disabled={savingMov} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white">{savingMov ? '...' : 'Registrar'}</Button>
                  </div>
                </form>
                {movimientos.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">Sin movimientos registrados</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Peso prom.</TableHead><TableHead>Destino/Origen</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientos.map(m => (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm">{fmt(m.fecha)}</TableCell>
                            <TableCell className="text-sm">{TIPOS_MOV.find(t => t.value === m.tipo)?.label ?? m.tipo}</TableCell>
                            <TableCell className="text-right text-sm">{m.cantidad}</TableCell>
                            <TableCell className="text-right text-sm">{m.peso_promedio?.toFixed(1) ?? '—'}</TableCell>
                            <TableCell className="text-sm text-gray-500">{m.destino_origen ?? '—'}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{m.valor_total ? Number(m.valor_total).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <RegistrarPesoModal
        open={modalPeso}
        onClose={() => setModalPeso(false)}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        animalesActuales={loteActual.animales_actuales}
        onCreated={fetchAll}
      />
    </div>
  )
}
