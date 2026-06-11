'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type NutricionDiaria = Database['public']['Tables']['nutricion_diaria_cerdos']['Row']

interface Props {
  loteActual: LoteCerdos
}

export default function TabNutricion({ loteActual }: Props) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<NutricionDiaria[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    alimento_kg: '',
    tipo_alimento: '',
    agua_litros: '',
    aditivos: '',
    costo_alimento: '',
    observaciones: '',
  })

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('nutricion_diaria_cerdos')
      .select('*')
      .eq('lote_id', loteActual.id)
      .order('fecha', { ascending: false })
      .limit(60)
    setRegistros(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetch() }, [fetch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.alimento_kg) { toast.error('Ingresa el alimento suministrado'); return }

    setSaving(true)
    const { data: existing } = await supabase
      .from('nutricion_diaria_cerdos')
      .select('id')
      .eq('lote_id', loteActual.id)
      .eq('fecha', form.fecha)
      .maybeSingle()

    const payload = {
      lote_id: loteActual.id, finca_id: loteActual.finca_id, fecha: form.fecha,
      alimento_kg: Number(form.alimento_kg),
      tipo_alimento: form.tipo_alimento || null,
      agua_litros: form.agua_litros ? Number(form.agua_litros) : null,
      aditivos: form.aditivos || null,
      costo_alimento: form.costo_alimento ? Number(form.costo_alimento) : null,
      observaciones: form.observaciones || null,
    }

    let error
    if (existing) {
      const r = await supabase.from('nutricion_diaria_cerdos').update(payload).eq('id', existing.id)
      error = r.error
    } else {
      const r = await supabase.from('nutricion_diaria_cerdos').insert(payload)
      error = r.error
    }
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success(existing ? 'Registro actualizado' : 'Nutrición registrada')
    setForm({ fecha: new Date().toISOString().split('T')[0], alimento_kg: '', tipo_alimento: '', agua_litros: '', aditivos: '', costo_alimento: '', observaciones: '' })
    fetch()
  }

  const totalAlimento30 = registros.slice(0, 30).reduce((s, r) => s + Number(r.alimento_kg), 0)
  const totalAgua30 = registros.slice(0, 30).reduce((s, r) => s + (r.agua_litros ? Number(r.agua_litros) : 0), 0)
  const promedioAlimentoDia = registros.length > 0 ? (totalAlimento30 / Math.min(registros.length, 30)).toFixed(1) : null
  const alimPorAnimal = promedioAlimentoDia && loteActual.animales_actuales > 0
    ? ((Number(promedioAlimentoDia) / loteActual.animales_actuales) * 1000).toFixed(0) + ' g/animal/día'
    : null

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }
  function cop(n: number) {
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Nutrición y Eficiencia Alimenticia</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-xs text-orange-700 font-medium">🌾 Alimento prom/día (30d)</p>
            <p className="text-2xl font-bold text-orange-800">{promedioAlimentoDia ? `${promedioAlimentoDia} kg` : '—'}</p>
            <p className="text-xs text-orange-600 mt-0.5">{alimPorAnimal ?? 'Total lote'}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 font-medium">💧 Agua total (30d)</p>
            <p className="text-2xl font-bold text-blue-800">{totalAgua30 > 0 ? `${totalAgua30.toFixed(0)} L` : '—'}</p>
            <p className="text-xs text-blue-600 mt-0.5">prom: {totalAgua30 > 0 && registros.length > 0 ? (totalAgua30 / Math.min(registros.length, 30)).toFixed(0) : '—'} L/día</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-xs text-green-700 font-medium">📦 Total alimento (30d)</p>
            <p className="text-2xl font-bold text-green-800">{totalAlimento30 > 0 ? `${totalAlimento30.toFixed(1)} kg` : '—'}</p>
            <p className="text-xs text-green-600 mt-0.5">acumulado</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <p className="text-xs text-purple-700 font-medium">📅 Días registrados</p>
            <p className="text-2xl font-bold text-purple-800">{registros.length}</p>
            <p className="text-xs text-purple-600 mt-0.5">historial completo</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulario de registro */}
      <Card className="border-orange-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Registrar consumo del día</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alimento (kg) *</Label>
              <Input type="number" min="0" step="0.1" placeholder="kg suministrados" value={form.alimento_kg} onChange={e => setForm(p => ({ ...p, alimento_kg: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de alimento</Label>
              <Input placeholder="Ej: Precebo, Ceba 1" value={form.tipo_alimento} onChange={e => setForm(p => ({ ...p, tipo_alimento: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">💧 Agua (litros) <span className="text-gray-400 font-normal">Manual</span></Label>
              <Input type="number" min="0" step="0.1" placeholder="Litros consumidos" value={form.agua_litros} onChange={e => setForm(p => ({ ...p, agua_litros: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aditivos / Medicamentos en agua</Label>
              <Input placeholder="Vitaminas, electrolitos..." value={form.aditivos} onChange={e => setForm(p => ({ ...p, aditivos: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Costo alimento (COP)</Label>
              <Input type="number" min="0" value={form.costo_alimento} onChange={e => setForm(p => ({ ...p, costo_alimento: e.target.value }))} />
            </div>
            <div className="col-span-2 md:col-span-2 space-y-1">
              <Label className="text-xs">Observaciones</Label>
              <Input placeholder="Notas del día..." value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full bg-green-700 hover:bg-green-800 text-white">
                {saving ? 'Guardando...' : '+ Registrar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial de Consumo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : registros.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <p className="text-3xl mb-2">🌾</p>
              <p>Sin registros de nutrición</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Alimento (kg)</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Agua (L)</TableHead>
                    <TableHead>Aditivos</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-sm">{fmt(r.fecha)}</TableCell>
                      <TableCell className="text-right font-semibold">{Number(r.alimento_kg).toFixed(1)}</TableCell>
                      <TableCell className="text-sm text-gray-500">{r.tipo_alimento ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.agua_litros ? Number(r.agua_litros).toFixed(1) : '—'}</TableCell>
                      <TableCell className="text-sm text-gray-500">{r.aditivos ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.costo_alimento ? cop(Number(r.costo_alimento)) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed border-gray-300 bg-gray-50">
        <CardContent className="p-4 text-center space-y-1">
          <p className="text-xl">⚙️</p>
          <p className="font-medium text-gray-600 text-sm">Báscula dinámica + medidor de flujo de agua — Próximamente</p>
          <p className="text-xs text-gray-400">Registro automático de consumo en tiempo real mediante sensores IoT (protocolo LoRaWAN/MQTT)</p>
        </CardContent>
      </Card>
    </div>
  )
}
