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

const VACUNAS_COMUNES = ['Newcastle', 'Bronquitis infecciosa', 'Marek', 'Gumboro', 'Viruela aviar', 'Laringotraqueítis', 'Salmonelosis', 'Encefalomielitis', 'Otra']
const VIAS = ['Agua de bebida', 'Ocular', 'Spray', 'Inyectable SC', 'Inyectable IM', 'Ala-web', 'Intranasal']

export default function RegistrarVacunacionModal({ open, onClose, loteId, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha_aplicacion: new Date().toISOString().split('T')[0],
    vacuna: '',
    vacuna_otra: '',
    lote_vacuna: '',
    via_administracion: '',
    dosis: '',
    laboratorio: '',
    numero_aves: '',
    costo: '',
    proxima_dosis: '',
    veterinario: '',
    observaciones: '',
  })

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const vacunaFinal = form.vacuna === 'Otra' ? form.vacuna_otra : form.vacuna
    if (!vacunaFinal.trim()) { toast.error('Selecciona o escribe la vacuna'); return }

    setLoading(true)
    const { error } = await supabase.from('vacunaciones_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      fecha_aplicacion: form.fecha_aplicacion,
      vacuna: vacunaFinal.trim(),
      lote_vacuna: form.lote_vacuna || null,
      via_administracion: form.via_administracion || null,
      dosis: form.dosis || null,
      laboratorio: form.laboratorio || null,
      numero_aves: form.numero_aves ? Number(form.numero_aves) : null,
      costo: form.costo ? Number(form.costo) : null,
      proxima_dosis: form.proxima_dosis || null,
      veterinario: form.veterinario || null,
      observaciones: form.observaciones || null,
    })
    setLoading(false)
    if (error) { toast.error('Error al registrar vacunación'); return }
    toast.success('Vacunación registrada')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>💉 Registrar Vacunación</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha de aplicación</Label>
              <Input type="date" value={form.fecha_aplicacion} onChange={e => set('fecha_aplicacion', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vacuna *</Label>
              <Select value={form.vacuna} onValueChange={v => set('vacuna', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{VACUNAS_COMUNES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.vacuna === 'Otra' && (
              <div className="col-span-2 space-y-1">
                <Label>Nombre de la vacuna *</Label>
                <Input placeholder="Nombre de la vacuna" value={form.vacuna_otra} onChange={e => set('vacuna_otra', e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Lote de la vacuna</Label>
              <Input placeholder="Número de lote" value={form.lote_vacuna} onChange={e => set('lote_vacuna', e.target.value)} />
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
              <Input placeholder="Ej: 1 dosis/ave" value={form.dosis} onChange={e => set('dosis', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Laboratorio</Label>
              <Input placeholder="Fabricante" value={form.laboratorio} onChange={e => set('laboratorio', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>N° aves vacunadas</Label>
              <Input type="number" min="0" value={form.numero_aves} onChange={e => set('numero_aves', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Costo (COP)</Label>
              <Input type="number" min="0" placeholder="0" value={form.costo} onChange={e => set('costo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Próxima dosis</Label>
              <Input type="date" value={form.proxima_dosis} onChange={e => set('proxima_dosis', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Veterinario</Label>
              <Input placeholder="Nombre del veterinario" value={form.veterinario} onChange={e => set('veterinario', e.target.value)} />
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
