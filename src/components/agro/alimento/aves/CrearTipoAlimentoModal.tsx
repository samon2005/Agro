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
  fincaId: string
  onCreated: () => void
}

export default function CrearTipoAlimentoModal({ open, onClose, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    proteina_bruta_pct: '',
    grasa_pct: '',
    calcio_pct: '',
    fosforo_pct: '',
    precio_bulto: '',
    peso_bulto_kg: '40',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre del alimento es requerido'); return }

    setLoading(true)
    const { error } = await supabase.from('tipos_alimento_aves').insert({
      finca_id: fincaId,
      nombre: form.nombre.trim(),
      proteina_bruta_pct: form.proteina_bruta_pct ? Number(form.proteina_bruta_pct) : null,
      grasa_pct: form.grasa_pct ? Number(form.grasa_pct) : null,
      calcio_pct: form.calcio_pct ? Number(form.calcio_pct) : null,
      fosforo_pct: form.fosforo_pct ? Number(form.fosforo_pct) : null,
      precio_bulto: form.precio_bulto ? Number(form.precio_bulto) : null,
      peso_bulto_kg: form.peso_bulto_kg ? Number(form.peso_bulto_kg) : 40,
    })
    setLoading(false)
    if (error) { toast.error('Error al registrar el alimento'); return }
    toast.success(`Alimento "${form.nombre}" registrado`)
    setForm({ nombre: '', proteina_bruta_pct: '', grasa_pct: '', calcio_pct: '', fosforo_pct: '', precio_bulto: '', peso_bulto_kg: '40' })
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🌾 Nuevo Tipo de Alimento</DialogTitle>
          <p className="text-sm text-gray-500">Composición nutricional según la ficha técnica del fabricante</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre del alimento *</Label>
              <Input placeholder="Ej: Concentrado Postura 18%" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Proteína bruta (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ej: 18" value={form.proteina_bruta_pct} onChange={e => set('proteina_bruta_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Grasa (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ej: 3.5" value={form.grasa_pct} onChange={e => set('grasa_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Calcio (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ej: 4.0" value={form.calcio_pct} onChange={e => set('calcio_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fósforo (%)</Label>
              <Input type="number" step="0.01" min="0" placeholder="Ej: 0.45" value={form.fosforo_pct} onChange={e => set('fosforo_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Precio por bulto (COP)</Label>
              <Input type="number" min="0" placeholder="0" value={form.precio_bulto} onChange={e => set('precio_bulto', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso del bulto (kg)</Label>
              <Input type="number" min="1" value={form.peso_bulto_kg} onChange={e => set('peso_bulto_kg', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Registrar alimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
