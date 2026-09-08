'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hoyLocal } from '@/lib/fechas'
import type { Database } from '@/types/database'

type PesoLote = Database['public']['Tables']['pesos_lote_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  animalesActuales: number
  /** Pesaje que se está editando; si no viene, se registra uno nuevo */
  pesoExistente?: PesoLote | null
  onCreated: () => void
}

function defaultForm(animalesActuales: number, p?: PesoLote | null) {
  return {
    fecha: p?.fecha ?? hoyLocal(),
    peso_promedio: p ? String(p.peso_promedio) : '',
    peso_minimo: p?.peso_minimo != null ? String(p.peso_minimo) : '',
    peso_maximo: p?.peso_maximo != null ? String(p.peso_maximo) : '',
    numero_pesados: p?.numero_pesados != null ? String(p.numero_pesados) : String(animalesActuales),
    metodo: p?.metodo ?? 'manual',
    observaciones: p?.observaciones ?? '',
  }
}

export default function RegistrarPesoModal({ open, onClose, loteId, fincaId, animalesActuales, pesoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(animalesActuales, pesoExistente))

  useEffect(() => {
    if (open) setForm(defaultForm(animalesActuales, pesoExistente))
  }, [open, animalesActuales, pesoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const uniformidad = form.peso_minimo && form.peso_maximo && form.peso_promedio
    ? (() => {
        const rango = Number(form.peso_maximo) - Number(form.peso_minimo)
        const pct = (rango / Number(form.peso_promedio)) * 100
        return pct.toFixed(1)
      })()
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.peso_promedio) { toast.error('Ingresa el peso promedio'); return }

    setLoading(true)
    const payload = {
      fecha: form.fecha,
      peso_promedio: Number(form.peso_promedio),
      peso_minimo: form.peso_minimo ? Number(form.peso_minimo) : null,
      peso_maximo: form.peso_maximo ? Number(form.peso_maximo) : null,
      numero_pesados: form.numero_pesados ? Number(form.numero_pesados) : null,
      metodo: form.metodo,
      observaciones: form.observaciones || null,
    }
    const { error } = pesoExistente
      ? await supabase.from('pesos_lote_cerdos').update(payload).eq('id', pesoExistente.id)
      : await supabase.from('pesos_lote_cerdos').insert({ ...payload, lote_id: loteId, finca_id: fincaId })
    setLoading(false)
    if (error) { toast.error(pesoExistente ? 'Error al actualizar el pesaje' : 'Error al registrar pesaje'); return }
    toast.success(pesoExistente ? 'Pesaje actualizado' : 'Pesaje registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pesoExistente ? '✏️ Editar Pesaje' : '⚖️ Registrar Pesaje del Lote'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Método</Label>
              <Select value={form.metodo} onValueChange={v => set('metodo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">✍️ Manual / Balanza</SelectItem>
                  <SelectItem value="bascula_dinamica">⚙️ Báscula dinámica (IoT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Peso promedio (kg) *</Label>
              <Input type="number" min="0" step="0.01" placeholder="Ej: 45.5" value={form.peso_promedio} onChange={e => set('peso_promedio', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso mínimo (kg)</Label>
              <Input type="number" min="0" step="0.01" placeholder="Min" value={form.peso_minimo} onChange={e => set('peso_minimo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso máximo (kg)</Label>
              <Input type="number" min="0" step="0.01" placeholder="Max" value={form.peso_maximo} onChange={e => set('peso_maximo', e.target.value)} />
            </div>
            {uniformidad && (
              <div className="col-span-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                📊 Variación del lote: <strong>{uniformidad}%</strong> — {Number(uniformidad) < 20 ? '✅ Lote uniforme' : '⚠️ Lote heterogéneo'}
              </div>
            )}
            <div className="space-y-1">
              <Label>N° animales pesados</Label>
              <Input type="number" min="0" value={form.numero_pesados} onChange={e => set('numero_pesados', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : pesoExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
