'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  onCreated: () => void
}

export default function RegistrarDesinfeccionModal({ open, onClose, loteId, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    producto: '',
    previene: '',
    dosis: '',
    responsable: '',
    costo: '',
    observaciones: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.producto.trim()) { toast.error('Ingresa el producto usado'); return }

    setLoading(true)
    const { error } = await supabase.from('desinfecciones_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      fecha: form.fecha,
      producto: form.producto.trim(),
      previene: form.previene || null,
      dosis: form.dosis || null,
      responsable: form.responsable || null,
      costo: form.costo ? Number(form.costo) : null,
      observaciones: form.observaciones || null,
    })
    setLoading(false)
    if (error) { toast.error('Error al registrar la desinfección'); return }
    toast.success('Desinfección registrada')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🧴 Registrar Desinfección</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Producto usado *</Label>
              <Input placeholder="Ej: Amonio cuaternario" value={form.producto} onChange={e => set('producto', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Qué previene</Label>
              <Input placeholder="Ej: Salmonella, Newcastle, coccidios..." value={form.previene} onChange={e => set('previene', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Dosis / dilución</Label>
              <Input placeholder="Ej: 1:200" value={form.dosis} onChange={e => set('dosis', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Responsable</Label>
              <Input placeholder="Nombre" value={form.responsable} onChange={e => set('responsable', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Costo (COP)</Label>
              <Input type="number" min="0" placeholder="0" value={form.costo} onChange={e => set('costo', e.target.value)} />
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
