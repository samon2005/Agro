'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  onCreated: (lote: LoteCerdos) => void
}

const LINEAS = ['Landrace', 'Yorkshire (Large White)', 'Duroc', 'Pietrain', 'Hampshire', 'PIC', 'Topigs', 'Otra']
const ETAPAS = [
  { value: 'precebo', label: '🐷 Precebo (lechones)' },
  { value: 'levante', label: '🐖 Levante' },
  { value: 'ceba', label: '🐗 Ceba / Engorde' },
]

export default function CrearLoteCerdosModal({ open, onClose, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    linea_genetica: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    etapa_actual: 'precebo',
    numero_animales: '',
    peso_promedio_inicial: '',
    origen_animales: '',
    corral: '',
    observaciones: '',
  })

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre del lote es requerido'); return }
    if (!form.numero_animales || Number(form.numero_animales) <= 0) { toast.error('Ingresa la cantidad de animales'); return }

    setLoading(true)
    const cant = Number(form.numero_animales)
    const { data, error } = await supabase
      .from('lotes_cerdos')
      .insert({
        finca_id: fincaId,
        nombre: form.nombre.trim(),
        linea_genetica: form.linea_genetica || null,
        fecha_ingreso: form.fecha_ingreso,
        etapa_actual: form.etapa_actual,
        numero_animales: cant,
        animales_actuales: cant,
        peso_promedio_inicial: form.peso_promedio_inicial ? Number(form.peso_promedio_inicial) : null,
        origen_animales: form.origen_animales || null,
        corral: form.corral || null,
        observaciones: form.observaciones || null,
      })
      .select()
      .single()

    setLoading(false)
    if (error) { toast.error('Error al crear el lote'); return }
    toast.success(`Lote "${data.nombre}" creado`)
    onCreated(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🐷 Nuevo Lote de Cerdos</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre del lote *</Label>
              <Input placeholder="Ej: Lote Ceba 01 - Corral A" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Línea genética</Label>
              <Select value={form.linea_genetica} onValueChange={v => set('linea_genetica', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{LINEAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Etapa de ingreso</Label>
              <Select value={form.etapa_actual} onValueChange={v => set('etapa_actual', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ETAPAS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>N° animales *</Label>
              <Input type="number" min="1" placeholder="Ej: 100" value={form.numero_animales} onChange={e => set('numero_animales', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso prom. inicial (kg)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 8.5" value={form.peso_promedio_inicial} onChange={e => set('peso_promedio_inicial', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Corral / Instalación</Label>
              <Input placeholder="Ej: Corral A-3" value={form.corral} onChange={e => set('corral', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Origen</Label>
              <Input placeholder="Ej: Granja La Esperanza" value={form.origen_animales} onChange={e => set('origen_animales', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Creando...' : 'Crear Lote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
