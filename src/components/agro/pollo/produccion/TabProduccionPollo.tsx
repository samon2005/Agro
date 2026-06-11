'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'

type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']
type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_pollo']['Row']
type PesoPollo = Database['public']['Tables']['pesos_lote_pollo']['Row']

interface Props { loteActual: LotePollo; onLoteUpdated: () => void }

const CAUSAS = ['Ascitis', 'Síndrome de muerte súbita', 'Marek', 'Newcastle', 'Gumboro', 'Bronquitis infecciosa', 'Coccidiosis', 'Aplastamiento', 'Ayuno', 'Accidente', 'Otro']
const DIAS_ESTANDAR: Record<number, number> = { 7: 0.18, 14: 0.38, 21: 0.73, 28: 1.15, 35: 1.65, 42: 2.20 } // kg estándar por día de vida

export default function TabProduccionPollo({ loteActual, onLoteUpdated }: Props) {
  const supabase = createClient()
  const [produccion, setProduccion] = useState<ProduccionDiaria[]>([])
  const [pesos, setPesos] = useState<PesoPollo[]>([])
  const [loading, setLoading] = useState(true)
  const [showDiario, setShowDiario] = useState(false)
  const [showPeso, setShowPeso] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formDiario, setFormDiario] = useState({
    fecha: new Date().toISOString().split('T')[0], alimento_kg: '', agua_litros: '',
    muertes: '0', causa_muerte: '', observaciones: '',
  })
  const [formPeso, setFormPeso] = useState({
    fecha: new Date().toISOString().split('T')[0], peso_promedio: '', peso_minimo: '',
    peso_maximo: '', numero_pesados: '', dia_vida: '', metodo: 'manual', observaciones: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [p, w] = await Promise.all([
      supabase.from('produccion_diaria_pollo').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(60),
      supabase.from('pesos_lote_pollo').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(20),
    ])
    setProduccion(p.data ?? [])
    setPesos(w.data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDiario(e: React.FormEvent) {
    e.preventDefault()
    if (!formDiario.alimento_kg) { toast.error('Ingresa el alimento'); return }
    setSaving(true)
    const { data: existing } = await supabase.from('produccion_diaria_pollo').select('id').eq('lote_id', loteActual.id).eq('fecha', formDiario.fecha).maybeSingle()
    const payload = {
      lote_id: loteActual.id, finca_id: loteActual.finca_id, fecha: formDiario.fecha,
      alimento_kg: Number(formDiario.alimento_kg),
      agua_litros: formDiario.agua_litros ? Number(formDiario.agua_litros) : null,
      muertes: Number(formDiario.muertes),
      causa_muerte: Number(formDiario.muertes) > 0 ? (formDiario.causa_muerte || null) : null,
      observaciones: formDiario.observaciones || null,
    }
    let error
    if (existing) {
      const r = await supabase.from('produccion_diaria_pollo').update(payload).eq('id', existing.id); error = r.error
    } else {
      const r = await supabase.from('produccion_diaria_pollo').insert(payload); error = r.error
    }
    if (!error && Number(formDiario.muertes) > 0) {
      await supabase.from('lotes_pollo').update({ pollos_actuales: Math.max(0, loteActual.pollos_actuales - Number(formDiario.muertes)) }).eq('id', loteActual.id)
      onLoteUpdated()
    }
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success(existing ? 'Registro actualizado' : 'Producción registrada')
    setShowDiario(false)
    fetchData()
  }

  async function handlePeso(e: React.FormEvent) {
    e.preventDefault()
    if (!formPeso.peso_promedio) { toast.error('Peso promedio requerido'); return }
    setSaving(true)
    const { error } = await supabase.from('pesos_lote_pollo').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id, fecha: formPeso.fecha,
      peso_promedio: Number(formPeso.peso_promedio),
      peso_minimo: formPeso.peso_minimo ? Number(formPeso.peso_minimo) : null,
      peso_maximo: formPeso.peso_maximo ? Number(formPeso.peso_maximo) : null,
      numero_pesados: formPeso.numero_pesados ? Number(formPeso.numero_pesados) : null,
      dia_vida: formPeso.dia_vida ? Number(formPeso.dia_vida) : null,
      metodo: formPeso.metodo as PesoPollo['metodo'],
      observaciones: formPeso.observaciones || null,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Pesaje registrado')
    setShowPeso(false)
    fetchData()
  }

  // KPIs calculados
  const mortalidadAcum = produccion.reduce((s, r) => s + r.muertes, 0)
  const mortalidadPct = loteActual.pollos_iniciales > 0 ? ((mortalidadAcum / loteActual.pollos_iniciales) * 100).toFixed(2) : null
  const ultimoPeso = pesos[0]
  const primerPeso = loteActual.peso_promedio_inicial ?? pesos[pesos.length - 1]?.peso_promedio
  const gananciaTotal = ultimoPeso && primerPeso ? (ultimoPeso.peso_promedio - Number(primerPeso)).toFixed(3) : null
  const totalAlimento = produccion.reduce((s, r) => s + Number(r.alimento_kg), 0)
  const fcr = gananciaTotal && loteActual.pollos_actuales > 0 && Number(gananciaTotal) > 0
    ? (totalAlimento / (Number(gananciaTotal) * loteActual.pollos_actuales)).toFixed(3) : null

  // Uniformidad del último pesaje
  let uniformidad: string | null = null
  if (ultimoPeso?.peso_minimo && ultimoPeso?.peso_maximo) {
    const cv = ((ultimoPeso.peso_maximo - ultimoPeso.peso_minimo) / ultimoPeso.peso_promedio) * 100
    uniformidad = cv < 20 ? `✓ Uniforme (CV ${cv.toFixed(1)}%)` : `⚠ Heterogéneo (CV ${cv.toFixed(1)}%)`
  }

  function fmt(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-800">Producción y Crecimiento</h2>
        <div className="flex gap-2">
          <Button onClick={() => { setShowPeso(v => !v); setShowDiario(false) }} variant="outline" className="text-sm border-yellow-400 text-yellow-700 hover:bg-yellow-50">
            {showPeso ? 'Cerrar' : '⚖️ Registrar pesaje'}
          </Button>
          <Button onClick={() => { setShowDiario(v => !v); setShowPeso(false) }} className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm">
            {showDiario ? 'Cerrar' : '+ Producción diaria'}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-xs text-yellow-700 font-medium">⚖️ Último peso prom.</p>
            <p className="text-2xl font-bold text-yellow-800">{ultimoPeso ? `${ultimoPeso.peso_promedio.toFixed(3)} kg` : '—'}</p>
            {gananciaTotal && <p className="text-xs text-yellow-600">+{gananciaTotal} kg desde ingreso</p>}
          </CardContent>
        </Card>
        <Card className={`border-blue-200 bg-blue-50`}>
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 font-medium">📊 FCR acumulado</p>
            <p className="text-2xl font-bold text-blue-800">{fcr ?? '—'}</p>
            <p className="text-xs text-blue-600">kg alim / kg ganancia</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-xs text-green-700 font-medium">🐥 Pollos actuales</p>
            <p className="text-2xl font-bold text-green-800">{loteActual.pollos_actuales.toLocaleString('es-CO')}</p>
            {uniformidad && <p className={`text-xs ${uniformidad.startsWith('✓') ? 'text-green-600' : 'text-amber-600'}`}>{uniformidad}</p>}
          </CardContent>
        </Card>
        <Card className={`border-red-200 bg-red-50`}>
          <CardContent className="p-4">
            <p className="text-xs text-red-700 font-medium">💀 Mortalidad acum.</p>
            <p className="text-2xl font-bold text-red-800">{mortalidadAcum.toLocaleString('es-CO')}</p>
            {mortalidadPct && <p className="text-xs text-red-600">{mortalidadPct}% del lote</p>}
          </CardContent>
        </Card>
      </div>

      {/* Form producción diaria */}
      {showDiario && (
        <Card className="border-yellow-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Registro de producción diaria</p>
            <form onSubmit={handleDiario} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={formDiario.fecha} onChange={e => setFormDiario(p => ({ ...p, fecha: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Alimento (kg) *</Label><Input type="number" step="0.1" value={formDiario.alimento_kg} onChange={e => setFormDiario(p => ({ ...p, alimento_kg: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Agua (L)</Label><Input type="number" step="0.1" value={formDiario.agua_litros} onChange={e => setFormDiario(p => ({ ...p, agua_litros: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Muertes</Label><Input type="number" min="0" value={formDiario.muertes} onChange={e => setFormDiario(p => ({ ...p, muertes: e.target.value }))} /></div>
              {Number(formDiario.muertes) > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Causa muerte</Label>
                  <Select value={formDiario.causa_muerte} onValueChange={v => setFormDiario(p => ({ ...p, causa_muerte: v ?? '' }))}>
                    <SelectTrigger><SelectValue placeholder="Causa" /></SelectTrigger>
                    <SelectContent>{CAUSAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1"><Label className="text-xs">Observaciones</Label><Input value={formDiario.observaciones} onChange={e => setFormDiario(p => ({ ...p, observaciones: e.target.value }))} /></div>
              <div className="col-span-2 md:col-span-3 flex justify-end">
                <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Form pesaje */}
      {showPeso && (
        <Card className="border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Registrar pesaje del lote</p>
            {formPeso.peso_minimo && formPeso.peso_maximo && formPeso.peso_promedio && (
              <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${((Number(formPeso.peso_maximo) - Number(formPeso.peso_minimo)) / Number(formPeso.peso_promedio)) * 100 < 20 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                Uniformidad: CV = {(((Number(formPeso.peso_maximo) - Number(formPeso.peso_minimo)) / Number(formPeso.peso_promedio)) * 100).toFixed(1)}%
                {((Number(formPeso.peso_maximo) - Number(formPeso.peso_minimo)) / Number(formPeso.peso_promedio)) * 100 < 20 ? ' — Lote uniforme ✓' : ' — Lote heterogéneo ⚠'}
              </div>
            )}
            <form onSubmit={handlePeso} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={formPeso.fecha} onChange={e => setFormPeso(p => ({ ...p, fecha: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Peso prom. (kg) *</Label><Input type="number" step="0.001" value={formPeso.peso_promedio} onChange={e => setFormPeso(p => ({ ...p, peso_promedio: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Peso mín. (kg)</Label><Input type="number" step="0.001" value={formPeso.peso_minimo} onChange={e => setFormPeso(p => ({ ...p, peso_minimo: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Peso máx. (kg)</Label><Input type="number" step="0.001" value={formPeso.peso_maximo} onChange={e => setFormPeso(p => ({ ...p, peso_maximo: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Día de vida</Label><Input type="number" min="1" value={formPeso.dia_vida} onChange={e => setFormPeso(p => ({ ...p, dia_vida: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">N° pesados</Label><Input type="number" min="1" value={formPeso.numero_pesados} onChange={e => setFormPeso(p => ({ ...p, numero_pesados: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label className="text-xs">Método</Label>
                <Select value={formPeso.metodo} onValueChange={v => setFormPeso(p => ({ ...p, metodo: v ?? '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="bascula_dinamica">Báscula dinámica</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Observaciones</Label><Input value={formPeso.observaciones} onChange={e => setFormPeso(p => ({ ...p, observaciones: e.target.value }))} /></div>
              <div className="col-span-2 md:col-span-4 flex justify-end">
                <Button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white">{saving ? 'Guardando...' : 'Registrar pesaje'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Historial de pesajes */}
      {pesos.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <p className="text-xs font-semibold text-gray-500 px-4 pt-3 pb-1 uppercase tracking-wide">Curva de crecimiento</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Fecha</TableHead><TableHead>Día</TableHead><TableHead className="text-right">Peso prom. (kg)</TableHead><TableHead className="text-right">Mín.</TableHead><TableHead className="text-right">Máx.</TableHead><TableHead>Uniformidad</TableHead><TableHead>Método</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {pesos.map((p, i) => {
                    const prev = pesos[i + 1]
                    const ganancia = prev ? (p.peso_promedio - prev.peso_promedio).toFixed(3) : null
                    const cv = p.peso_minimo && p.peso_maximo ? (((p.peso_maximo - p.peso_minimo) / p.peso_promedio) * 100).toFixed(1) : null
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{fmt(p.fecha)}</TableCell>
                        <TableCell className="text-sm text-gray-500">{p.dia_vida ? `Día ${p.dia_vida}` : '—'}</TableCell>
                        <TableCell className="text-right font-semibold">{p.peso_promedio.toFixed(3)}{ganancia && <span className="text-xs text-green-600 ml-1">+{ganancia}</span>}</TableCell>
                        <TableCell className="text-right text-sm text-gray-500">{p.peso_minimo?.toFixed(3) ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm text-gray-500">{p.peso_maximo?.toFixed(3) ?? '—'}</TableCell>
                        <TableCell className="text-sm">{cv ? <Badge className={Number(cv) < 20 ? 'bg-green-100 text-green-700 text-[10px]' : 'bg-amber-100 text-amber-700 text-[10px]'}>CV {cv}%</Badge> : '—'}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{p.metodo === 'bascula_dinamica' ? '📡 Dinámica' : '✍️ Manual'}</Badge></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial producción diaria */}
      <Card>
        <CardContent className="p-0">
          <p className="text-xs font-semibold text-gray-500 px-4 pt-3 pb-1 uppercase tracking-wide">Consumo diario</p>
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : produccion.length === 0 ? (
            <div className="py-8 text-center"><p className="text-3xl mb-2">🐥</p><p className="text-gray-400">Sin registros</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Fecha</TableHead><TableHead className="text-right">Alimento (kg)</TableHead><TableHead className="text-right">Agua (L)</TableHead><TableHead className="text-right">Muertes</TableHead><TableHead>Causa</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {produccion.map(r => (
                    <TableRow key={r.id} className={r.muertes > 5 ? 'bg-red-50' : ''}>
                      <TableCell className="text-sm">{fmt(r.fecha)}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{Number(r.alimento_kg).toFixed(1)}</TableCell>
                      <TableCell className="text-right text-sm text-gray-500">{r.agua_litros ? Number(r.agua_litros).toFixed(0) : '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.muertes > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{r.muertes}</TableCell>
                      <TableCell className="text-sm text-gray-500">{r.causa_muerte ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
