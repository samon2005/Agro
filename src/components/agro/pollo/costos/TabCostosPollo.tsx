'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'

type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']
type Costo = Database['public']['Tables']['costos_lote_pollo']['Row']

interface Props { loteActual: LotePollo }

const CATEGORIAS: Record<string, { label: string; color: string; icon: string }> = {
  pollitos:      { label: 'Pollitos',       color: 'bg-yellow-100 text-yellow-800', icon: '🐥' },
  alimento:      { label: 'Alimento',       color: 'bg-orange-100 text-orange-800', icon: '🌾' },
  agua:          { label: 'Agua',           color: 'bg-blue-100 text-blue-800',     icon: '💧' },
  energia:       { label: 'Energía',        color: 'bg-amber-100 text-amber-800',   icon: '⚡' },
  mano_obra:     { label: 'Mano de obra',   color: 'bg-slate-100 text-slate-800',   icon: '👷' },
  mantenimiento: { label: 'Mantenimiento',  color: 'bg-gray-100 text-gray-800',     icon: '🔧' },
  sanitario:     { label: 'Sanitario',      color: 'bg-purple-100 text-purple-800', icon: '💉' },
  otro:          { label: 'Otro',           color: 'bg-gray-100 text-gray-600',     icon: '📋' },
}

export default function TabCostosPollo({ loteActual }: Props) {
  const supabase = createClient()
  const [costos, setCostos] = useState<Costo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0], categoria: '', descripcion: '', monto: '', proveedor: '', observaciones: '',
  })

  const fetchCostos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('costos_lote_pollo').select('*')
      .eq('lote_id', loteActual.id).order('fecha', { ascending: false })
    setCostos(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchCostos() }, [fetchCostos])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.categoria || !form.descripcion || !form.monto) { toast.error('Categoría, descripción y monto son requeridos'); return }
    setSaving(true)
    const { error } = await supabase.from('costos_lote_pollo').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id, fecha: form.fecha,
      categoria: form.categoria, descripcion: form.descripcion, monto: Number(form.monto),
      proveedor: form.proveedor || null, observaciones: form.observaciones || null,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Costo registrado')
    setShowForm(false)
    setForm({ fecha: new Date().toISOString().split('T')[0], categoria: '', descripcion: '', monto: '', proveedor: '', observaciones: '' })
    fetchCostos()
  }

  const totalesPorCategoria = Object.keys(CATEGORIAS).reduce((acc, cat) => {
    acc[cat] = costos.filter(c => c.categoria === cat).reduce((s, c) => s + Number(c.monto), 0)
    return acc
  }, {} as Record<string, number>)
  const totalGeneral = costos.reduce((s, c) => s + Number(c.monto), 0)
  const costoPorPollo = loteActual.pollos_iniciales > 0 ? (totalGeneral / loteActual.pollos_iniciales) : 0

  function cop(n: number) { return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) }
  function fmt(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Insumos y Costos del Lote</h2>
        <Button onClick={() => setShowForm(v => !v)} className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm">
          {showForm ? 'Cerrar' : '+ Registrar costo'}
        </Button>
      </div>

      {/* Cards de resumen por categoría */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(CATEGORIAS).map(([key, cfg]) => (
          <Card key={key}>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">{cfg.icon} {cfg.label}</p>
              <p className={`text-base font-bold px-1.5 py-0.5 rounded text-right ${cfg.color}`}>{cop(totalesPorCategoria[key])}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-green-300 bg-green-50 md:col-span-4">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-semibold">💰 TOTAL ACUMULADO</p>
              <p className="text-xs text-green-600">{cop(costoPorPollo)} / pollo inicial</p>
            </div>
            <p className="text-2xl font-bold text-green-800">{cop(totalGeneral)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Trazabilidad del lote */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
          <div><span className="font-medium">Línea:</span> {loteActual.linea_genetica ?? '—'}</div>
          <div><span className="font-medium">Ingreso:</span> {fmt(loteActual.fecha_ingreso)}</div>
          <div><span className="font-medium">Iniciales:</span> {loteActual.pollos_iniciales.toLocaleString('es-CO')}</div>
          <div><span className="font-medium">Galpón:</span> {loteActual.galpone ?? '—'}</div>
          <div><span className="font-medium">Origen:</span> {loteActual.origen_pollos ?? '—'}</div>
          <div><span className="font-medium">Actuales:</span> {loteActual.pollos_actuales.toLocaleString('es-CO')}</div>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-yellow-200">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label className="text-xs">Categoría *</Label>
                <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIAS).map(([k, c]) => <SelectItem key={k} value={k}>{c.icon} {c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Monto (COP) *</Label><Input type="number" min="0" step="1" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs">Descripción *</Label><Input placeholder="Detalle del gasto..." value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Proveedor</Label><Input value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} /></div>
              <div className="col-span-2 md:col-span-3 flex justify-end">
                <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Guardando...' : 'Registrar'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Historial de costos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : costos.length === 0 ? (
            <div className="py-8 text-center text-gray-400"><p className="text-3xl mb-2">💰</p><p>Sin costos registrados</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Categoría</TableHead><TableHead>Descripción</TableHead><TableHead>Proveedor</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                <TableBody>
                  {costos.map(c => {
                    const cfg = CATEGORIAS[c.categoria] ?? CATEGORIAS.otro
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{fmt(c.fecha)}</TableCell>
                        <TableCell><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</span></TableCell>
                        <TableCell className="text-sm">{c.descripcion}</TableCell>
                        <TableCell className="text-sm text-gray-500">{c.proveedor ?? '—'}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{cop(Number(c.monto))}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
