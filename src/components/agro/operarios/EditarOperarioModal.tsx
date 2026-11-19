'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { actualizarOperario } from '@/lib/supabase/actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ic } from '@/components/ui/icon'
import { PERIODOS_PAGO, CONTRATOS } from '@/lib/desempeno'

type Operario = { id: string; full_name: string | null; cargo: string | null; pago_monto: number | null; pago_periodo: string | null; tipo_contrato?: string | null }

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  operario: Operario | null
  onUpdated: () => void
}

const PERIODOS = PERIODOS_PAGO.map(p => ({ value: p.v, label: p.t }))

export default function EditarOperarioModal({ open, onClose, fincaId, operario, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ cargo: '', pago_monto: '', pago_periodo: 'mensual', tipo_contrato: '' })

  useEffect(() => {
    if (!open || !operario) return
    setForm({
      cargo: operario.cargo ?? '',
      pago_monto: operario.pago_monto != null ? String(operario.pago_monto) : '',
      pago_periodo: operario.pago_periodo ?? 'mensual',
      tipo_contrato: operario.tipo_contrato ?? '',
    })
  }, [open, operario])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!operario) return
    setLoading(true)
    try {
      await actualizarOperario(fincaId, operario.id, { cargo: form.cargo, pagoMonto: form.pago_monto, pagoPeriodo: form.pago_periodo, tipoContrato: form.tipo_contrato })
      toast.success('Operario actualizado')
      onUpdated()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el operario')
    }
    setLoading(false)
  }

  if (!operario) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle><Ic n="editar" /> Editar — {operario.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Cargo / función</Label>
            <Input placeholder="Ej: Encargado de alimentación" value={form.cargo} onChange={e => setForm(p => ({ ...p, cargo: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Tipo de contrato</Label>
            <select value={form.tipo_contrato} onChange={e => setForm(p => ({ ...p, tipo_contrato: e.target.value }))}
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
              <option value="">Sin anotar</option>
              {CONTRATOS.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Pago</Label>
              <CurrencyInput placeholder="Ej: 1200000" value={form.pago_monto} onValueChange={v => setForm(p => ({ ...p, pago_monto: v }))} />
            </div>
            <div className="space-y-1">
              <Label>Periodicidad</Label>
              <Select value={form.pago_periodo} onValueChange={v => setForm(p => ({ ...p, pago_periodo: v ?? 'mensual' }))}>
                <SelectTrigger><SelectValue>{(v: string) => PERIODOS.find(x => x.value === v)?.label ?? v}</SelectValue></SelectTrigger>
                <SelectContent>{PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
