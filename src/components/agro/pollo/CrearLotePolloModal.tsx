'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  onCreated: (lote: LotePollo) => void
}

const LINEAS = ['Ross 308', 'Ross 708', 'Cobb 500', 'Cobb 700', 'Arbor Acres', 'Hubbard Flex', 'Hubbard Classic', 'Otra']

export default function CrearLotePolloModal({ open, onClose, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: '', linea_genetica: '', fecha_ingreso: new Date().toISOString().split('T')[0],
    pollos_iniciales: '', peso_promedio_inicial: '', origen_pollos: '', galpone: '', observaciones: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.pollos_iniciales) { toast.error('Nombre y cantidad de pollos son requeridos'); return }
    setSaving(true)
    const n = Number(form.pollos_iniciales)
    const { data, error } = await supabase.from('lotes_pollo').insert({
      finca_id: fincaId, nombre: form.nombre,
      linea_genetica: form.linea_genetica || null,
      fecha_ingreso: form.fecha_ingreso,
      pollos_iniciales: n, pollos_actuales: n,
      peso_promedio_inicial: form.peso_promedio_inicial ? Number(form.peso_promedio_inicial) : null,
      origen_pollos: form.origen_pollos || null,
      galpone: form.galpone || null,
      observaciones: form.observaciones || null,
      estado: 'activo',
    }).select().single()
    setSaving(false)
    if (error || !data) { toast.error('Error al crear lote'); return }
    toast.success('Lote creado')
    onCreated(data)
    onClose()
    setForm({ nombre: '', linea_genetica: '', fecha_ingreso: new Date().toISOString().split('T')[0], pollos_iniciales: '', peso_promedio_inicial: '', origen_pollos: '', galpone: '', observaciones: '' })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>🐥 Nuevo Lote de Pollo de Engorde</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label className="text-xs">Nombre del lote *</Label><Input placeholder="Ej: Lote Engorde Jun-2026" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Línea genética</Label>
              <Select value={form.linea_genetica} onValueChange={v => setForm(p => ({ ...p, linea_genetica: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{LINEAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Fecha de ingreso *</Label><Input type="date" value={form.fecha_ingreso} onChange={e => setForm(p => ({ ...p, fecha_ingreso: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Cantidad de pollos *</Label><Input type="number" min="1" placeholder="Ej: 10000" value={form.pollos_iniciales} onChange={e => setForm(p => ({ ...p, pollos_iniciales: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Peso promedio inicial (g)</Label><Input type="number" step="0.1" placeholder="Ej: 42" value={form.peso_promedio_inicial} onChange={e => setForm(p => ({ ...p, peso_promedio_inicial: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Galpón</Label><Input placeholder="Ej: Galpón Norte" value={form.galpone} onChange={e => setForm(p => ({ ...p, galpone: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Origen</Label><Input placeholder="Incubadora, proveedor..." value={form.origen_pollos} onChange={e => setForm(p => ({ ...p, origen_pollos: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Observaciones</Label><Input value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Creando...' : 'Crear lote'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
