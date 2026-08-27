'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  costosPredefinidos: Record<string, number>
  onCreated: () => void
}

const CATEGORIAS = [
  { value: 'pollitas', label: '🐣 Pollitas de levante' },
  { value: 'alimento', label: '🌾 Alimento / Concentrado' },
  { value: 'servicios_publicos', label: '💡 Servicios públicos (agua y energía)' },
  { value: 'mantenimiento', label: '🔧 Mantenimiento' },
  { value: 'sanitario', label: '💉 Sanitario' },
  { value: 'otro', label: '📋 Otro' },
]

function defaultForm() {
  return {
    fecha: new Date().toISOString().split('T')[0],
    categoria: '',
    descripcion: '',
    monto: '',
    proveedor: '',
    observaciones: '',
  }
}

export default function RegistrarCostoModal({ open, onClose, loteId, fincaId, costosPredefinidos, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => { if (open) setForm(defaultForm()) }, [open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  function setCategoria(categoria: string | null) {
    setForm(prev => {
      const referencia = categoria ? costosPredefinidos[categoria] : undefined
      return { ...prev, categoria: categoria ?? '', monto: prev.monto || (referencia ? String(referencia) : prev.monto) }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.categoria) { toast.error('Selecciona una categoría'); return }
    if (!form.descripcion.trim()) { toast.error('La descripción es requerida'); return }
    if (!form.monto || Number(form.monto) <= 0) { toast.error('Ingresa el monto'); return }

    setLoading(true)
    const { error } = await supabase.from('costos_lote_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      fecha: form.fecha,
      categoria: form.categoria,
      descripcion: form.descripcion.trim(),
      monto: Number(form.monto),
      proveedor: form.proveedor || null,
      observaciones: form.observaciones || null,
    })
    setLoading(false)
    if (error) { toast.error('Error al registrar costo'); return }
    toast.success('Costo registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>💰 Registrar Costo Operativo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Categoría *</Label>
              <Select value={form.categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Descripción *</Label>
              <Input placeholder="¿Qué se pagó?" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Monto *</Label>
              <CurrencyInput placeholder="0" value={form.monto} onValueChange={v => set('monto', v)} />
            </div>
            <div className="space-y-1">
              <Label>Proveedor</Label>
              <Input placeholder="Nombre del proveedor" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} />
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
