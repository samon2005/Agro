'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { ESTADOS_REPRODUCTORA } from '@/lib/cerdos'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  reproductoraExistente?: Reproductora | null
  onCreated: () => void
}

const LINEAS = ['Landrace', 'Yorkshire (Large White)', 'Duroc', 'Pietrain', 'Hampshire', 'PIC', 'Topigs', 'Otra']

function defaultForm(lote: LoteCerdos, r?: Reproductora | null) {
  return {
    codigo: r?.codigo ?? '',
    nombre: r?.nombre ?? '',
    linea_genetica: r?.linea_genetica ?? lote.linea_genetica ?? '',
    fecha_nacimiento: r?.fecha_nacimiento ?? '',
    fecha_ingreso: r?.fecha_ingreso ?? hoyLocal(),
    numero_partos: r ? String(r.numero_partos) : '0',
    estado: r?.estado ?? 'vacia',
    peso_kg: r?.peso_kg != null ? String(r.peso_kg) : '',
    observaciones: r?.observaciones ?? '',
  }
}

export default function RegistrarReproductoraModal({ open, onClose, lote, reproductoraExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(lote, reproductoraExistente))

  useEffect(() => { if (open) setForm(defaultForm(lote, reproductoraExistente)) }, [open, lote, reproductoraExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.codigo.trim()) { toast.error('El código o número de arete es obligatorio'); return }

    setLoading(true)
    const payload = {
      codigo: form.codigo.trim(),
      nombre: form.nombre || null,
      linea_genetica: form.linea_genetica || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      fecha_ingreso: form.fecha_ingreso,
      numero_partos: Number(form.numero_partos) || 0,
      estado: form.estado,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : null,
      observaciones: form.observaciones || null,
    }
    const { error } = reproductoraExistente
      ? await supabase.from('reproductoras_cerdos').update(payload).eq('id', reproductoraExistente.id)
      : await supabase.from('reproductoras_cerdos').insert({ ...payload, lote_id: lote.id, finca_id: lote.finca_id })

    setLoading(false)
    if (error) {
      toast.error(error.code === '23505' ? 'Ya hay una hembra con ese código en el lote' : 'Error al guardar la hembra')
      return
    }
    toast.success(reproductoraExistente ? 'Hembra actualizada' : 'Hembra registrada')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reproductoraExistente ? '✏️ Editar Hembra' : '🐖 Registrar Hembra Reproductora'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Código / arete *</Label>
              <Input placeholder="Ej: H-042" value={form.codigo} onChange={e => set('codigo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input placeholder="Opcional" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Línea genética</Label>
              <Select value={form.linea_genetica} onValueChange={v => set('linea_genetica', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{LINEAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set('estado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ESTADOS_REPRODUCTORA).map(([value, e]) => (
                    <SelectItem key={value} value={value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de ingreso al lote</Label>
              <Input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Partos previos</Label>
              <Input type="number" min="0" value={form.numero_partos} onChange={e => set('numero_partos', e.target.value)} />
              <p className="text-xs text-gray-400">Sube solo con cada parto registrado</p>
            </div>
            <div className="space-y-1">
              <Label>Peso (kg)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 180" value={form.peso_kg} onChange={e => set('peso_kg', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas de la hembra..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-pink-600 hover:bg-pink-700 text-white">
              {loading ? 'Guardando...' : reproductoraExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
