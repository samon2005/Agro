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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'

type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']
type Parametro = Database['public']['Tables']['parametros_ambientales_pollo']['Row']

interface Props { loteActual: LotePollo }

export default function TabAmbientalPollo({ loteActual }: Props) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<Parametro[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    temperatura_interior: '', temperatura_exterior: '',
    humedad_interior: '', nh3_ppm: '', co2_ppm: '', observaciones: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('parametros_ambientales_pollo').select('*')
      .eq('lote_id', loteActual.id).order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(20)
    setRegistros(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('parametros_ambientales_pollo').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha: form.fecha, hora: form.hora || null,
      temperatura_interior: form.temperatura_interior ? Number(form.temperatura_interior) : null,
      temperatura_exterior: form.temperatura_exterior ? Number(form.temperatura_exterior) : null,
      humedad_interior: form.humedad_interior ? Number(form.humedad_interior) : null,
      nh3_ppm: form.nh3_ppm ? Number(form.nh3_ppm) : null,
      co2_ppm: form.co2_ppm ? Number(form.co2_ppm) : null,
      fuente: 'manual', observaciones: form.observaciones || null,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Lectura registrada')
    setShowForm(false)
    fetchData()
  }

  const ultimo = registros[0]
  const alertas: string[] = []
  if (ultimo?.temperatura_interior) {
    if (ultimo.temperatura_interior > 32) alertas.push(`🌡️ Temperatura: ${ultimo.temperatura_interior}°C — crítico para pollos > 32°C (estrés calórico)`)
    else if (ultimo.temperatura_interior < 18) alertas.push(`❄️ Temperatura: ${ultimo.temperatura_interior}°C — baja para pollos < 18°C`)
  }
  if (ultimo?.nh3_ppm && ultimo.nh3_ppm > 25) alertas.push(`🌬️ NH₃: ${ultimo.nh3_ppm} ppm — supera límite (25 ppm)`)
  if (ultimo?.co2_ppm && ultimo.co2_ppm > 3000) alertas.push(`💨 CO₂: ${ultimo.co2_ppm} ppm — supera 3000 ppm`)
  if (ultimo?.humedad_interior) {
    if (ultimo.humedad_interior > 75) alertas.push(`💧 Humedad: ${ultimo.humedad_interior}% — alta (favorece coccidiosis)`)
    else if (ultimo.humedad_interior < 40) alertas.push(`🏜️ Humedad: ${ultimo.humedad_interior}% — baja (polvo excesivo)`)
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Parámetros Ambientales del Galpón</h2>
        <Button onClick={() => setShowForm(v => !v)} className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm">
          {showForm ? 'Cerrar' : '+ Registrar lectura'}
        </Button>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-1.5">
          {alertas.map((a, i) => (
            <div key={i} className="px-3 py-2 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">🚨 {a}</div>
          ))}
        </div>
      )}

      {showForm && (
        <Card className="border-yellow-200">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Hora</Label><Input type="time" value={form.hora} onChange={e => setForm(p => ({ ...p, hora: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">T° interior (°C) <span className="text-gray-400 font-normal text-[10px]">Manual</span></Label><Input type="number" step="0.1" placeholder="Ej: 24.0" value={form.temperatura_interior} onChange={e => setForm(p => ({ ...p, temperatura_interior: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">T° exterior (°C)</Label><Input type="number" step="0.1" value={form.temperatura_exterior} onChange={e => setForm(p => ({ ...p, temperatura_exterior: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Humedad int. (%)</Label><Input type="number" step="0.1" value={form.humedad_interior} onChange={e => setForm(p => ({ ...p, humedad_interior: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">NH₃ (ppm) máx 25</Label><Input type="number" step="0.1" value={form.nh3_ppm} onChange={e => setForm(p => ({ ...p, nh3_ppm: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">CO₂ (ppm) máx 3000</Label><Input type="number" step="1" value={form.co2_ppm} onChange={e => setForm(p => ({ ...p, co2_ppm: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Observaciones</Label><Input value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
              <div className="col-span-2 md:col-span-4 flex justify-end">
                <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Guardando...' : 'Guardar lectura'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {ultimo && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: '🌡️ T° interior', val: ultimo.temperatura_interior?.toFixed(1), unit: '°C', warn: !!ultimo.temperatura_interior && (ultimo.temperatura_interior > 32 || ultimo.temperatura_interior < 18) },
            { label: '🌡️ T° exterior', val: ultimo.temperatura_exterior?.toFixed(1), unit: '°C', warn: false },
            { label: '💧 Humedad', val: ultimo.humedad_interior?.toFixed(1), unit: '%', warn: !!ultimo.humedad_interior && (ultimo.humedad_interior > 75 || ultimo.humedad_interior < 40) },
            { label: '🌬️ NH₃', val: ultimo.nh3_ppm?.toFixed(1), unit: 'ppm', warn: !!ultimo.nh3_ppm && ultimo.nh3_ppm > 25 },
            { label: '💨 CO₂', val: ultimo.co2_ppm?.toFixed(0), unit: 'ppm', warn: !!ultimo.co2_ppm && ultimo.co2_ppm > 3000 },
          ].map((item, i) => (
            <Card key={i} className={item.warn ? 'border-red-300 bg-red-50' : ''}>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-xl font-bold ${item.warn ? 'text-red-700' : 'text-gray-800'}`}>{item.val ?? '—'}</p>
                <p className="text-xs text-gray-400">{item.unit}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : registros.length === 0 ? (
            <div className="py-10 text-center"><p className="text-4xl mb-2">🌡️</p><p className="text-gray-500">Sin lecturas ambientales</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Fecha</TableHead><TableHead>Hora</TableHead><TableHead className="text-right">T° int.</TableHead><TableHead className="text-right">T° ext.</TableHead><TableHead className="text-right">HR (%)</TableHead><TableHead className="text-right">NH₃</TableHead><TableHead className="text-right">CO₂</TableHead><TableHead>Fuente</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map(r => (
                    <TableRow key={r.id} className={r.temperatura_interior && r.temperatura_interior > 32 ? 'bg-red-50' : ''}>
                      <TableCell className="text-sm">{fmt(r.fecha)}</TableCell>
                      <TableCell className="text-sm text-gray-500">{r.hora ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.temperatura_interior && r.temperatura_interior > 32 ? 'text-red-600 font-semibold' : ''}`}>{r.temperatura_interior?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.temperatura_exterior?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.humedad_interior && (r.humedad_interior > 75 || r.humedad_interior < 40) ? 'text-amber-600' : ''}`}>{r.humedad_interior?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.nh3_ppm && r.nh3_ppm > 25 ? 'text-red-600 font-semibold' : ''}`}>{r.nh3_ppm?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.co2_ppm && r.co2_ppm > 3000 ? 'text-red-600 font-semibold' : ''}`}>{r.co2_ppm?.toFixed(0) ?? '—'}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{r.fuente === 'sensor' ? '📡' : '✍️'}</Badge></TableCell>
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
          <p className="text-xl">📡</p>
          <p className="font-medium text-gray-600 text-sm">Sensores IoT para Galpón — Próximamente</p>
          <p className="text-xs text-gray-400">SHT40 (T°/HR), MQ-135 (NH₃), MH-Z19B (CO₂). LoRaWAN para zonas rurales sin WiFi. Alertas automáticas si T° &gt; 32°C.</p>
        </CardContent>
      </Card>
    </div>
  )
}
