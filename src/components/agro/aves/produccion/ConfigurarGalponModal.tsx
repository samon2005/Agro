'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteAves
  onUpdated: (lote: LoteAves) => void
}

export default function ConfigurarGalponModal({ open, onClose, lote, onUpdated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    area_galpon_m2: '',
    fecha_inicio_postura: '',
    semanas_ciclo_postura: '',
    meta_postura_pct: '',
    meta_huevos_diaria: '',
    precio_huevo: '',
    precio_gramo_alimento: '',
    peso_bulto_alimento_kg: '',
  })

  useEffect(() => {
    setForm({
      area_galpon_m2: lote.area_galpon_m2 != null ? String(lote.area_galpon_m2) : '',
      fecha_inicio_postura: lote.fecha_inicio_postura ?? '',
      semanas_ciclo_postura: lote.semanas_ciclo_postura != null ? String(lote.semanas_ciclo_postura) : '60',
      meta_postura_pct: lote.meta_postura_pct != null ? String(lote.meta_postura_pct) : '90',
      meta_huevos_diaria: lote.meta_huevos_diaria != null ? String(lote.meta_huevos_diaria) : '',
      precio_huevo: lote.precio_huevo != null ? String(lote.precio_huevo) : '',
      precio_gramo_alimento: lote.precio_gramo_alimento != null ? String(lote.precio_gramo_alimento) : '',
      peso_bulto_alimento_kg: lote.peso_bulto_alimento_kg != null ? String(lote.peso_bulto_alimento_kg) : '40',
    })
  }, [lote, open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const densidad = form.area_galpon_m2 && Number(form.area_galpon_m2) > 0
    ? (lote.aves_actuales / Number(form.area_galpon_m2)).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      area_galpon_m2: form.area_galpon_m2 ? Number(form.area_galpon_m2) : null,
      fecha_inicio_postura: form.fecha_inicio_postura || null,
      semanas_ciclo_postura: form.semanas_ciclo_postura ? Number(form.semanas_ciclo_postura) : null,
      meta_postura_pct: form.meta_postura_pct ? Number(form.meta_postura_pct) : null,
      meta_huevos_diaria: form.meta_huevos_diaria ? Number(form.meta_huevos_diaria) : null,
      precio_huevo: form.precio_huevo ? Number(form.precio_huevo) : null,
      precio_gramo_alimento: form.precio_gramo_alimento ? Number(form.precio_gramo_alimento) : null,
      peso_bulto_alimento_kg: form.peso_bulto_alimento_kg ? Number(form.peso_bulto_alimento_kg) : null,
    }
    const { data, error } = await supabase
      .from('lotes_aves')
      .update(payload)
      .eq('id', lote.id)
      .select()
      .single()

    setLoading(false)
    if (error) { toast.error('Error al guardar la configuración'); return }
    toast.success('Configuración del galpón actualizada')
    onUpdated(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚙️ Configuración del Galpón</DialogTitle>
          <p className="text-sm text-gray-500">Define el tamaño, la meta de postura y los costos de referencia para calcular indicadores</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Área del galpón (m²)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 300" value={form.area_galpon_m2} onChange={e => set('area_galpon_m2', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Densidad estimada</Label>
              <Input disabled value={densidad ? `${densidad} aves/m²` : '—'} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de inicio real de postura</Label>
              <Input type="date" value={form.fecha_inicio_postura} onChange={e => set('fecha_inicio_postura', e.target.value)} />
              <p className="text-xs text-gray-400">Se usa para contar la semana de postura del lote</p>
            </div>
            <div className="space-y-1">
              <Label>Duración del ciclo (semanas)</Label>
              <Input type="number" min="1" placeholder="Ej: 60" value={form.semanas_ciclo_postura} onChange={e => set('semanas_ciclo_postura', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Meta de postura / pico (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" placeholder="Ej: 90" value={form.meta_postura_pct} onChange={e => set('meta_postura_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Meta de huevos puestos por día</Label>
              <Input type="number" min="0" placeholder="Ej: 4500" value={form.meta_huevos_diaria} onChange={e => set('meta_huevos_diaria', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Precio de venta por huevo</Label>
              <CurrencyInput placeholder="Ej: 450" value={form.precio_huevo} onValueChange={v => set('precio_huevo', v)} />
            </div>
            <div className="space-y-1">
              <Label>Precio por gramo de alimento ($)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 2.5" value={form.precio_gramo_alimento} onChange={e => set('precio_gramo_alimento', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso del bulto de alimento (kg)</Label>
              <Input type="number" min="0" step="1" placeholder="Ej: 40" value={form.peso_bulto_alimento_kg} onChange={e => set('peso_bulto_alimento_kg', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
