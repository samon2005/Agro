'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Encargo = Database['public']['Tables']['encargos_huevos_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteAves
  encargoExistente?: Encargo | null
  /** Huevos disponibles hoy en el inventario del galpón, para avisar si no alcanzan */
  huevosEnInventario?: number
  onCreated: () => void
}

const TAMANOS: { key: 'b' | 'a' | 'aa' | 'aaa' | 'jumbo'; label: string }[] = [
  { key: 'b', label: 'B' },
  { key: 'a', label: 'A' },
  { key: 'aa', label: 'AA' },
  { key: 'aaa', label: 'AAA' },
  { key: 'jumbo', label: 'JUMBO' },
]

function defaultForm(e?: Encargo | null) {
  return {
    fecha_pedido: e?.fecha_pedido ?? hoyLocal(),
    fecha_entrega: e?.fecha_entrega ?? '',
    cliente: e?.cliente ?? '',
    cantidad_b: e ? String(e.cantidad_b) : '',
    cantidad_a: e ? String(e.cantidad_a) : '',
    cantidad_aa: e ? String(e.cantidad_aa) : '',
    cantidad_aaa: e ? String(e.cantidad_aaa) : '',
    cantidad_jumbo: e ? String(e.cantidad_jumbo) : '',
    observaciones: e?.observaciones ?? '',
  }
}

export default function RegistrarEncargoModal({ open, onClose, lote, encargoExistente, huevosEnInventario = 0, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(encargoExistente))

  useEffect(() => { if (open) setForm(defaultForm(encargoExistente)) }, [open, encargoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const totalHuevos = TAMANOS.reduce((s, t) => s + (Number(form[`cantidad_${t.key}` as keyof typeof form]) || 0), 0)
  const noAlcanza = huevosEnInventario > 0 && totalHuevos > huevosEnInventario

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha_entrega) { toast.error('Ingresa la fecha de entrega del encargo'); return }
    if (totalHuevos <= 0) { toast.error('Ingresa cuántos huevos se encargaron'); return }

    setLoading(true)
    const payload = {
      fecha_pedido: form.fecha_pedido,
      fecha_entrega: form.fecha_entrega,
      cliente: form.cliente || null,
      cantidad_b: Number(form.cantidad_b) || 0,
      cantidad_a: Number(form.cantidad_a) || 0,
      cantidad_aa: Number(form.cantidad_aa) || 0,
      cantidad_aaa: Number(form.cantidad_aaa) || 0,
      cantidad_jumbo: Number(form.cantidad_jumbo) || 0,
      observaciones: form.observaciones || null,
    }
    const { error } = encargoExistente
      ? await supabase.from('encargos_huevos_aves').update(payload).eq('id', encargoExistente.id)
      : await supabase.from('encargos_huevos_aves').insert({ ...payload, lote_id: lote.id, finca_id: lote.finca_id })

    setLoading(false)
    if (error) { toast.error(encargoExistente ? 'Error al actualizar el encargo' : 'Error al registrar el encargo'); return }
    toast.success(encargoExistente ? 'Encargo actualizado' : 'Encargo registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{encargoExistente ? '✏️ Editar Encargo' : '📋 Registrar Encargo Futuro'}</DialogTitle>
          <p className="text-sm text-gray-500">
            Huevo comprometido que todavía no se ha entregado. Al marcarlo como entregado se
            convierte en venta y sale del inventario.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha del pedido</Label>
              <Input type="date" value={form.fecha_pedido} onChange={e => set('fecha_pedido', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de entrega *</Label>
              <Input type="date" value={form.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Cliente</Label>
              <Input placeholder="¿Quién lo encargó?" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 space-y-2">
            <p className="text-xs font-semibold text-yellow-700">Huevos encargados por tamaño</p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {TAMANOS.map(t => (
                <div key={t.key} className="space-y-1">
                  <Label className="text-xs">{t.label}</Label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={form[`cantidad_${t.key}` as keyof typeof form]}
                    onChange={e => set(`cantidad_${t.key}`, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-yellow-700">
              Total encargado: <span className="font-semibold">{totalHuevos.toLocaleString('es-CO')}</span>
              {huevosEnInventario > 0 && ` · en inventario hay ${huevosEnInventario.toLocaleString('es-CO')}`}
            </p>
          </div>

          {noAlcanza && (
            <div className="p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-800">
              ⚠️ El encargo supera lo que hay hoy en inventario. Puedes registrarlo igual: para la
              fecha de entrega el galpón habrá puesto más huevo.
            </div>
          )}

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas del encargo..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : encargoExistente ? 'Guardar cambios' : 'Registrar encargo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
