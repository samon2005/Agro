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
  equipoId: string
  equipoNombre: string
  fincaId: string
  onCreated: () => void
}

const ESTADOS = [
  { value: 'operativo', label: '✅ Operativo' },
  { value: 'mantenimiento', label: '🔧 En mantenimiento' },
  { value: 'falla', label: '❌ Con falla' },
  { value: 'inactivo', label: '⏸️ Inactivo' },
]

export default function RegistrarLogEquipoModal({ open, onClose, equipoId, equipoNombre, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    estado_registrado: 'operativo',
    alerta: false,
    descripcion_alerta: '',
  })

  function set(field: string, value: string | boolean | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.alerta && !form.descripcion_alerta.trim()) { toast.error('Describe la alerta'); return }

    setLoading(true)
    const { error } = await supabase.from('equipos_aves_logs').insert({
      equipo_id: equipoId,
      finca_id: fincaId,
      fecha: form.fecha,
      estado_registrado: form.estado_registrado,
      alerta: form.alerta,
      descripcion_alerta: form.alerta ? form.descripcion_alerta : null,
      fuente: 'manual',
    })

    if (!error) {
      await supabase.from('equipos_aves').update({ estado: form.estado_registrado }).eq('id', equipoId)
    }

    setLoading(false)
    if (error) { toast.error('Error al registrar log'); return }
    toast.success('Estado registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📋 Log de Equipo — {equipoNombre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado_registrado} onValueChange={v => set('estado_registrado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="alerta" checked={form.alerta} onChange={e => set('alerta', e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="alerta" className="cursor-pointer text-red-600">🚨 Hay alerta</Label>
            </div>
            {form.alerta && (
              <div className="col-span-2 space-y-1">
                <Label>Descripción de la alerta *</Label>
                <Input placeholder="¿Qué ocurrió?" value={form.descripcion_alerta} onChange={e => set('descripcion_alerta', e.target.value)} />
              </div>
            )}
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
