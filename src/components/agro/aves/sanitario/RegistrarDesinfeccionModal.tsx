'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import EncargadoSelect from '@/components/agro/EncargadoSelect'
import type { Database } from '@/types/database'

type Desinfeccion = Database['public']['Tables']['desinfecciones_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  desinfeccionExistente?: Desinfeccion | null
  onCreated: () => void
}

function defaultForm(d?: Desinfeccion | null) {
  return {
    fecha: d?.fecha ?? new Date().toISOString().split('T')[0],
    producto: d?.producto ?? '',
    previene: d?.previene ?? '',
    dosis: d?.dosis ?? '',
    responsable: d?.responsable ?? '',
    costo: d?.costo != null ? String(d.costo) : '',
    observaciones: d?.observaciones ?? '',
  }
}

export default function RegistrarDesinfeccionModal({ open, onClose, loteId, fincaId, desinfeccionExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(desinfeccionExistente))

  useEffect(() => { if (open) setForm(defaultForm(desinfeccionExistente)) }, [open, desinfeccionExistente])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.producto.trim()) { toast.error('Ingresa el producto usado'); return }

    setLoading(true)
    const payload = {
      fecha: form.fecha,
      producto: form.producto.trim(),
      previene: form.previene || null,
      dosis: form.dosis || null,
      responsable: form.responsable || null,
      costo: form.costo ? Number(form.costo) : null,
      observaciones: form.observaciones || null,
    }
    const { data: desinfeccion, error } = desinfeccionExistente
      ? await supabase.from('desinfecciones_aves').update(payload).eq('id', desinfeccionExistente.id).select().single()
      : await supabase.from('desinfecciones_aves').insert({ ...payload, lote_id: loteId, finca_id: fincaId }).select().single()

    if (!error && !desinfeccionExistente && desinfeccion && form.costo && Number(form.costo) > 0) {
      await supabase.from('costos_lote_aves').insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha,
        categoria: 'sanitario',
        descripcion: `Desinfección: ${form.producto.trim()}`,
        monto: Number(form.costo),
        desinfeccion_id: desinfeccion.id,
      })
    }

    setLoading(false)
    if (error) { toast.error(desinfeccionExistente ? 'Error al actualizar la desinfección' : 'Error al registrar la desinfección'); return }
    toast.success(desinfeccionExistente ? 'Desinfección actualizada' : 'Desinfección registrada')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{desinfeccionExistente ? '✏️ Editar Desinfección' : '🧴 Registrar Desinfección'}</DialogTitle>
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
              <EncargadoSelect fincaId={fincaId} value={form.responsable} onChange={v => set('responsable', v)} />
            </div>
            <div className="space-y-1">
              <Label>Costo</Label>
              <CurrencyInput placeholder="0" value={form.costo} onValueChange={v => set('costo', v)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : desinfeccionExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
