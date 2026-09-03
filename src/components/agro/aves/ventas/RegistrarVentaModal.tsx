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
import { hoyLocal } from '@/lib/fechas'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteAves
  ventaExistente?: Venta | null
  onCreated: () => void
}

const TAMANOS: { key: 'b' | 'a' | 'aa' | 'aaa' | 'jumbo'; label: string; precioLote: 'precio_huevo_b' | 'precio_huevo_a' | 'precio_huevo_aa' | 'precio_huevo_aaa' | 'precio_huevo_jumbo' }[] = [
  { key: 'b', label: 'B', precioLote: 'precio_huevo_b' },
  { key: 'a', label: 'A', precioLote: 'precio_huevo_a' },
  { key: 'aa', label: 'AA', precioLote: 'precio_huevo_aa' },
  { key: 'aaa', label: 'AAA', precioLote: 'precio_huevo_aaa' },
  { key: 'jumbo', label: 'JUMBO', precioLote: 'precio_huevo_jumbo' },
]

function defaultForm(lote: LoteAves, v?: Venta | null) {
  const cantidad: Record<string, string> = {}
  const precio: Record<string, string> = {}
  for (const t of TAMANOS) {
    cantidad[t.key] = v ? String(v[`cantidad_${t.key}` as keyof Venta]) : ''
    precio[t.key] = v
      ? (v[`precio_${t.key}` as keyof Venta] != null ? String(v[`precio_${t.key}` as keyof Venta]) : '')
      : (lote[t.precioLote] != null ? String(lote[t.precioLote]) : '')
  }
  return {
    fecha: v?.fecha ?? hoyLocal(),
    cantidad_b: cantidad.b, cantidad_a: cantidad.a, cantidad_aa: cantidad.aa, cantidad_aaa: cantidad.aaa, cantidad_jumbo: cantidad.jumbo,
    precio_b: precio.b, precio_a: precio.a, precio_aa: precio.aa, precio_aaa: precio.aaa, precio_jumbo: precio.jumbo,
    cliente: v?.cliente ?? '',
    observaciones: v?.observaciones ?? '',
  }
}

export default function RegistrarVentaModal({ open, onClose, lote, ventaExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(lote, ventaExistente))

  useEffect(() => { if (open) setForm(defaultForm(lote, ventaExistente)) }, [open, lote, ventaExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const totalHuevos = TAMANOS.reduce((s, t) => s + (Number(form[`cantidad_${t.key}` as keyof typeof form]) || 0), 0)
  const totalVenta = TAMANOS.reduce((s, t) => {
    const cant = Number(form[`cantidad_${t.key}` as keyof typeof form]) || 0
    const precio = Number(form[`precio_${t.key}` as keyof typeof form]) || 0
    return s + cant * precio
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totalHuevos <= 0) { toast.error('Ingresa la cantidad de huevos vendidos'); return }

    setLoading(true)
    const payload = {
      fecha: form.fecha,
      cantidad_b: Number(form.cantidad_b) || 0,
      cantidad_a: Number(form.cantidad_a) || 0,
      cantidad_aa: Number(form.cantidad_aa) || 0,
      cantidad_aaa: Number(form.cantidad_aaa) || 0,
      cantidad_jumbo: Number(form.cantidad_jumbo) || 0,
      precio_b: form.precio_b ? Number(form.precio_b) : null,
      precio_a: form.precio_a ? Number(form.precio_a) : null,
      precio_aa: form.precio_aa ? Number(form.precio_aa) : null,
      precio_aaa: form.precio_aaa ? Number(form.precio_aaa) : null,
      precio_jumbo: form.precio_jumbo ? Number(form.precio_jumbo) : null,
      cliente: form.cliente || null,
      observaciones: form.observaciones || null,
    }
    const { error } = ventaExistente
      ? await supabase.from('ventas_huevos_aves').update(payload).eq('id', ventaExistente.id)
      : await supabase.from('ventas_huevos_aves').insert({ ...payload, lote_id: lote.id, finca_id: lote.finca_id })

    setLoading(false)
    if (error) { toast.error(ventaExistente ? 'Error al actualizar la venta' : 'Error al registrar la venta'); return }
    toast.success(ventaExistente ? 'Venta actualizada' : 'Venta registrada')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ventaExistente ? '✏️ Editar Venta' : '🧾 Registrar Venta de Huevo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input placeholder="Nombre del cliente" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
            <p className="text-xs font-semibold text-emerald-700">Cantidad y precio por tamaño</p>
            <div className="grid grid-cols-5 gap-2">
              {TAMANOS.map(t => (
                <div key={t.key} className="space-y-1">
                  <Label className="text-xs">{t.label}</Label>
                  <Input type="number" min="0" placeholder="0" value={form[`cantidad_${t.key}` as keyof typeof form]} onChange={e => set(`cantidad_${t.key}`, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {TAMANOS.map(t => (
                <div key={t.key} className="space-y-1">
                  <CurrencyInput placeholder="$" value={form[`precio_${t.key}` as keyof typeof form]} onValueChange={v => set(`precio_${t.key}`, v)} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-emerald-100">
              <p className="text-xs text-emerald-700">Total: <span className="font-semibold">{totalHuevos.toLocaleString('es-CO')} huevos</span></p>
              <p className="text-sm font-bold text-emerald-800">{totalVenta.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : ventaExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
