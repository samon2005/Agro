'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  onCreated: () => void
}

const VIAS = ['Agua de bebida', 'Alimento', 'Inyectable SC', 'Inyectable IM', 'Tópico', 'Spray']

export default function RegistrarMedicacionModal({ open, onClose, loteId, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '',
    medicamento: '',
    principio_activo: '',
    via_administracion: '',
    dosis: '',
    periodo_retiro_dias: '',
    motivo: '',
    costo: '',
    veterinario: '',
    observaciones: '',
  })

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const retiro = form.fecha_fin && form.periodo_retiro_dias
    ? (() => {
        const fin = new Date(form.fecha_fin)
        fin.setDate(fin.getDate() + Number(form.periodo_retiro_dias))
        return fin.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
      })()
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.medicamento.trim()) { toast.error('El medicamento es requerido'); return }

    setLoading(true)
    const { error } = await supabase.from('medicaciones_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin || null,
      medicamento: form.medicamento.trim(),
      principio_activo: form.principio_activo || null,
      via_administracion: form.via_administracion || null,
      dosis: form.dosis || null,
      periodo_retiro_dias: form.periodo_retiro_dias ? Number(form.periodo_retiro_dias) : null,
      motivo: form.motivo || null,
      costo: form.costo ? Number(form.costo) : null,
      veterinario: form.veterinario || null,
      observaciones: form.observaciones || null,
    })
    setLoading(false)
    if (error) { toast.error('Error al registrar medicación'); return }
    toast.success('Medicación registrada')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>💊 Registrar Medicación</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha inicio *</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha fin</Label>
              <Input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Medicamento *</Label>
              <Input placeholder="Nombre del medicamento" value={form.medicamento} onChange={e => set('medicamento', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Principio activo</Label>
              <Input placeholder="Ej: Enrofloxacina" value={form.principio_activo} onChange={e => set('principio_activo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vía de administración</Label>
              <Select value={form.via_administracion} onValueChange={v => set('via_administracion', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{VIAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Dosis</Label>
              <Input placeholder="Ej: 10 mg/kg" value={form.dosis} onChange={e => set('dosis', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Período de retiro (días)</Label>
              <Input type="number" min="0" placeholder="0" value={form.periodo_retiro_dias} onChange={e => set('periodo_retiro_dias', e.target.value)} />
            </div>
            {retiro && (
              <div className="col-span-2 p-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-800">
                ⚠️ Huevos no comercializables hasta: <strong>{retiro}</strong>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label>Motivo / Diagnóstico</Label>
              <Input placeholder="¿Por qué se aplica?" value={form.motivo} onChange={e => set('motivo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Costo (COP)</Label>
              <Input type="number" min="0" value={form.costo} onChange={e => set('costo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Veterinario</Label>
              <Input placeholder="Nombre" value={form.veterinario} onChange={e => set('veterinario', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
