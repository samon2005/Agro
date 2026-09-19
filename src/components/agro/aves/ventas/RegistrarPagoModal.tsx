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
import { cop, valorVenta } from '@/lib/huevos'

type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']
type Pago = Database['public']['Tables']['pagos_ventas_huevos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  venta: Venta | null
  /** Pagos que ya tiene la venta */
  pagos: Pago[]
  onCreated: () => void
}

/**
 * Registra el dinero de una venta cuando entra. Una venta puede pagarse en varias
 * partes; mientras falte plata, sigue apareciendo lo que se debe.
 */
export default function RegistrarPagoModal({ open, onClose, venta, pagos, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const total = venta ? valorVenta(venta) : 0
  const pagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const saldo = Math.max(0, total - pagado)
  const [form, setForm] = useState({ fecha: hoyLocal(), titular: '', monto: '' })

  useEffect(() => {
    if (open) setForm({ fecha: hoyLocal(), titular: venta?.cliente ?? '', monto: saldo > 0 ? String(Math.round(saldo)) : '' })
  }, [open, venta, saldo])

  const monto = Number(form.monto) || 0
  const quedaDebiendo = monto > 0 && monto < saldo ? saldo - monto : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!venta) return
    if (!form.titular.trim()) { toast.error('Indica quién pagó'); return }
    if (monto <= 0) { toast.error('Ingresa cuánto pagaron'); return }
    if (monto > saldo + 0.5) { toast.error(`El pago supera lo que se debe (${cop(saldo)})`); return }

    setLoading(true)
    const { error } = await supabase.from('pagos_ventas_huevos').insert({
      venta_id: venta.id,
      finca_id: venta.finca_id,
      fecha: form.fecha,
      titular: form.titular.trim(),
      monto,
    })
    setLoading(false)
    if (error) { toast.error('Error al registrar el pago'); return }
    if (quedaDebiendo > 0) {
      toast.warning(`Pago registrado. ${form.titular.trim()} aún debe ${cop(quedaDebiendo)}`, { duration: 8000 })
    } else {
      toast.success('Venta pagada por completo')
    }
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <p className="text-sm text-gray-500">
            Cuando el dinero entra, se suma a los ingresos por ventas.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center">
            <div>
              <p className="text-[0.6875rem] text-gray-500">Total venta</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">{cop(total)}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] text-gray-500">Ya pagado</p>
              <p className="text-sm font-semibold text-green-700 tabular-nums">{cop(pagado)}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] text-gray-500">Se debe</p>
              <p className="text-sm font-semibold text-red-700 tabular-nums">{cop(saldo)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha del pago</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Cuánto pagó *</Label>
              <CurrencyInput placeholder="0" value={form.monto} onValueChange={v => setForm(p => ({ ...p, monto: v ?? '' }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Titular (quién pagó) *</Label>
              <Input placeholder="Nombre de quien pagó" value={form.titular} onChange={e => setForm(p => ({ ...p, titular: e.target.value }))} />
            </div>
          </div>

          {quedaDebiendo > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Pagó menos del total: después de este pago todavía deben {cop(quedaDebiendo)}.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || saldo <= 0}>
              {loading ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
