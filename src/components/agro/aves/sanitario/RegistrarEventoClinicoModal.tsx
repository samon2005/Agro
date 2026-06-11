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

const TIPOS = [
  { value: 'respiratorio', label: '🫁 Respiratorio' },
  { value: 'locomotor', label: '🦴 Locomotor' },
  { value: 'digestivo', label: '🫃 Digestivo' },
  { value: 'reproductivo', label: '🥚 Reproductivo' },
  { value: 'nervioso', label: '🧠 Nervioso' },
  { value: 'piel', label: '🐾 Piel / Plumas' },
  { value: 'otro', label: '❓ Otro' },
]

export default function RegistrarEventoClinicoModal({ open, onClose, loteId, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo_evento: '',
    descripcion: '',
    aves_afectadas: '',
    aves_muertas: '0',
    accion_tomada: '',
    veterinario: '',
    resuelto: false,
    observaciones: '',
  })

  function set(field: string, value: string | boolean | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo_evento) { toast.error('Selecciona el tipo de evento'); return }
    if (!form.descripcion.trim()) { toast.error('Describe el evento clínico'); return }

    setLoading(true)
    const { error } = await supabase.from('eventos_clinicos_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      fecha: form.fecha,
      tipo_evento: form.tipo_evento,
      descripcion: form.descripcion.trim(),
      aves_afectadas: form.aves_afectadas ? Number(form.aves_afectadas) : null,
      aves_muertas: Number(form.aves_muertas) || 0,
      accion_tomada: form.accion_tomada || null,
      veterinario: form.veterinario || null,
      resuelto: form.resuelto,
      observaciones: form.observaciones || null,
    })
    setLoading(false)
    if (error) { toast.error('Error al registrar evento'); return }
    toast.success('Evento clínico registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🏥 Registrar Evento Clínico</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo de signo *</Label>
              <Select value={form.tipo_evento} onValueChange={v => set('tipo_evento', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Descripción de signos clínicos *</Label>
              <Input placeholder="Describe los síntomas observados..." value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Aves afectadas</Label>
              <Input type="number" min="0" value={form.aves_afectadas} onChange={e => set('aves_afectadas', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Aves muertas</Label>
              <Input type="number" min="0" value={form.aves_muertas} onChange={e => set('aves_muertas', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Acción tomada</Label>
              <Input placeholder="Tratamiento o manejo aplicado" value={form.accion_tomada} onChange={e => set('accion_tomada', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Veterinario</Label>
              <Input placeholder="Nombre" value={form.veterinario} onChange={e => set('veterinario', e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="resuelto"
                checked={form.resuelto}
                onChange={e => set('resuelto', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600"
              />
              <Label htmlFor="resuelto" className="cursor-pointer">Evento resuelto</Label>
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
