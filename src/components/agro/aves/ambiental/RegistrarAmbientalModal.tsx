'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  onCreated: () => void
}

function FieldWithBadge({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className="text-xs">{label}</Label>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Manual</Badge>
      </div>
      {children}
    </div>
  )
}

export default function RegistrarAmbientalModal({ open, onClose, loteId, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    temperatura_interior: '',
    temperatura_exterior: '',
    humedad_interior: '',
    humedad_exterior: '',
    nh3_ppm: '',
    co2_ppm: '',
    lux_intensidad: '',
    observaciones: '',
  })

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('parametros_ambientales_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      fecha: form.fecha,
      hora: form.hora || null,
      temperatura_interior: form.temperatura_interior ? Number(form.temperatura_interior) : null,
      temperatura_exterior: form.temperatura_exterior ? Number(form.temperatura_exterior) : null,
      humedad_interior: form.humedad_interior ? Number(form.humedad_interior) : null,
      humedad_exterior: form.humedad_exterior ? Number(form.humedad_exterior) : null,
      nh3_ppm: form.nh3_ppm ? Number(form.nh3_ppm) : null,
      co2_ppm: form.co2_ppm ? Number(form.co2_ppm) : null,
      lux_intensidad: form.lux_intensidad ? Number(form.lux_intensidad) : null,
      fuente: 'manual',
      observaciones: form.observaciones || null,
    })
    setLoading(false)
    if (error) { toast.error('Error al guardar parámetros'); return }
    toast.success('Parámetros ambientales registrados')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🌡️ Registrar Parámetros Ambientales</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hora</Label>
              <Input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-3">
            <p className="text-xs font-semibold text-red-700">🌡️ Temperatura (°C) — umbral crítico: &gt; 30°C</p>
            <div className="grid grid-cols-2 gap-3">
              <FieldWithBadge label="Interior">
                <Input type="number" step="0.1" placeholder="Ej: 24.5" value={form.temperatura_interior} onChange={e => set('temperatura_interior', e.target.value)} />
              </FieldWithBadge>
              <FieldWithBadge label="Exterior">
                <Input type="number" step="0.1" placeholder="Ej: 28.0" value={form.temperatura_exterior} onChange={e => set('temperatura_exterior', e.target.value)} />
              </FieldWithBadge>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
            <p className="text-xs font-semibold text-blue-700">💧 Humedad relativa (%) — rango óptimo: 40–75%</p>
            <div className="grid grid-cols-2 gap-3">
              <FieldWithBadge label="Interior">
                <Input type="number" step="0.1" placeholder="Ej: 65.0" value={form.humedad_interior} onChange={e => set('humedad_interior', e.target.value)} />
              </FieldWithBadge>
              <FieldWithBadge label="Exterior">
                <Input type="number" step="0.1" placeholder="Ej: 70.0" value={form.humedad_exterior} onChange={e => set('humedad_exterior', e.target.value)} />
              </FieldWithBadge>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <p className="text-xs font-semibold text-gray-700">🌬️ Calidad del aire</p>
            <div className="grid grid-cols-2 gap-3">
              <FieldWithBadge label="NH₃ (ppm) — máx: 25">
                <Input type="number" step="0.1" placeholder="Ej: 12.0" value={form.nh3_ppm} onChange={e => set('nh3_ppm', e.target.value)} />
              </FieldWithBadge>
              <FieldWithBadge label="CO₂ (ppm) — máx: 3000">
                <Input type="number" step="1" placeholder="Ej: 1200" value={form.co2_ppm} onChange={e => set('co2_ppm', e.target.value)} />
              </FieldWithBadge>
            </div>
          </div>

          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <FieldWithBadge label="💡 Intensidad lumínica (lux)">
              <Input type="number" step="0.1" placeholder="Ej: 20.0 lux para postura" value={form.lux_intensidad} onChange={e => set('lux_intensidad', e.target.value)} />
            </FieldWithBadge>
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Condiciones especiales del día..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
