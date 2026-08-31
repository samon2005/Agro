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
  onDeleted: () => void
}

export default function ConfigurarGalponModal({ open, onClose, lote, onUpdated, onDeleted }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmarNombre, setConfirmarNombre] = useState('')
  const [form, setForm] = useState({
    area_galpon_m2: '',
    fecha_inicio_postura: '',
    semanas_ciclo_postura: '',
    meta_postura_pct: '',
    meta_huevos_diaria: '',
    precio_huevo_b: '',
    precio_huevo_a: '',
    precio_huevo_aa: '',
    precio_huevo_aaa: '',
    precio_huevo_jumbo: '',
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
      precio_huevo_b: lote.precio_huevo_b != null ? String(lote.precio_huevo_b) : '',
      precio_huevo_a: lote.precio_huevo_a != null ? String(lote.precio_huevo_a) : '',
      precio_huevo_aa: lote.precio_huevo_aa != null ? String(lote.precio_huevo_aa) : '',
      precio_huevo_aaa: lote.precio_huevo_aaa != null ? String(lote.precio_huevo_aaa) : '',
      precio_huevo_jumbo: lote.precio_huevo_jumbo != null ? String(lote.precio_huevo_jumbo) : '',
      precio_gramo_alimento: lote.precio_gramo_alimento != null ? String(lote.precio_gramo_alimento) : '',
      peso_bulto_alimento_kg: lote.peso_bulto_alimento_kg != null ? String(lote.peso_bulto_alimento_kg) : '40',
    })
    setConfirmarNombre('')
  }, [lote, open])

  async function handleDelete() {
    if (confirmarNombre.trim() !== lote.nombre) { toast.error('El nombre no coincide'); return }
    setDeleting(true)
    const { error } = await supabase.from('lotes_aves').delete().eq('id', lote.id)
    setDeleting(false)
    if (error) { toast.error('Error al eliminar el galpón'); return }
    toast.success(`Galpón "${lote.nombre}" eliminado`)
    onDeleted()
    onClose()
  }

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
      precio_huevo_b: form.precio_huevo_b ? Number(form.precio_huevo_b) : null,
      precio_huevo_a: form.precio_huevo_a ? Number(form.precio_huevo_a) : null,
      precio_huevo_aa: form.precio_huevo_aa ? Number(form.precio_huevo_aa) : null,
      precio_huevo_aaa: form.precio_huevo_aaa ? Number(form.precio_huevo_aaa) : null,
      precio_huevo_jumbo: form.precio_huevo_jumbo ? Number(form.precio_huevo_jumbo) : null,
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
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">Precio de venta por tamaño de huevo</p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">B</Label>
                <CurrencyInput placeholder="$" value={form.precio_huevo_b} onValueChange={v => set('precio_huevo_b', v)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">A</Label>
                <CurrencyInput placeholder="$" value={form.precio_huevo_a} onValueChange={v => set('precio_huevo_a', v)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">AA</Label>
                <CurrencyInput placeholder="$" value={form.precio_huevo_aa} onValueChange={v => set('precio_huevo_aa', v)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">AAA</Label>
                <CurrencyInput placeholder="$" value={form.precio_huevo_aaa} onValueChange={v => set('precio_huevo_aaa', v)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">JUMBO</Label>
                <CurrencyInput placeholder="$" value={form.precio_huevo_jumbo} onValueChange={v => set('precio_huevo_jumbo', v)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Precio por gramo de alimento ($)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 2.5" value={form.precio_gramo_alimento} onChange={e => set('precio_gramo_alimento', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso del bulto de alimento (kg)</Label>
              <Input type="number" min="0" step="1" placeholder="Ej: 40" value={form.peso_bulto_alimento_kg} onChange={e => set('peso_bulto_alimento_kg', e.target.value)} />
            </div>
          </div>
          <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-red-800">⚠️ Zona de peligro</p>
            <p className="text-xs text-red-600">
              Eliminar este galpón borra permanentemente todo su historial (producción, sanitario, costos, equipos). Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder={`Escribe "${lote.nombre}" para confirmar`}
                value={confirmarNombre}
                onChange={e => setConfirmarNombre(e.target.value)}
                className="bg-white"
              />
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || confirmarNombre.trim() !== lote.nombre}
                onClick={handleDelete}
              >
                {deleting ? 'Eliminando...' : 'Eliminar galpón'}
              </Button>
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
