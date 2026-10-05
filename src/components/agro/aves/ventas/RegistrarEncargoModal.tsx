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
import { TAMANOS_HUEVO } from '@/lib/huevos'
import { totalTamanos, type ClienteHuevos, type PorTamano } from '@/lib/huevosFinca'
import ClienteSelect, { asegurarCliente, type ValorCliente } from './ClienteSelect'

type Encargo = Database['public']['Tables']['encargos_huevos_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  encargoExistente?: Encargo | null
  /** Huevos en bodega de toda la finca hoy, por tamaño */
  disponible: PorTamano
  /** Huevo ya comprometido en encargos pendientes, por tamaño */
  comprometido: PorTamano
  clientes: ClienteHuevos[]
  onCreated: () => void
}

function defaultForm(e?: Encargo | null) {
  return {
    fecha_pedido: e?.fecha_pedido ?? hoyLocal(),
    fecha_entrega: e?.fecha_entrega ?? '',
    cantidad_b: e ? String(e.cantidad_b) : '',
    cantidad_a: e ? String(e.cantidad_a) : '',
    cantidad_aa: e ? String(e.cantidad_aa) : '',
    cantidad_aaa: e ? String(e.cantidad_aaa) : '',
    cantidad_jumbo: e ? String(e.cantidad_jumbo) : '',
    observaciones: e?.observaciones ?? '',
  }
}

export default function RegistrarEncargoModal({ open, onClose, fincaId, encargoExistente, disponible, comprometido, clientes, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(encargoExistente))
  const [cliente, setCliente] = useState<ValorCliente>({ id: null, nombre: '' })

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(encargoExistente))
    setCliente({ id: encargoExistente?.cliente_id ?? null, nombre: encargoExistente?.cliente ?? '' })
  }, [open, encargoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const cantidad = (k: keyof PorTamano) => Number(form[`cantidad_${k}` as keyof typeof form]) || 0
  const totalHuevos = TAMANOS_HUEVO.reduce((s, t) => s + cantidad(t.key), 0)
  // Lo libre de cada tamaño: lo que hay menos lo comprometido en otros encargos (sin contar este si se edita)
  const libre = (k: keyof PorTamano) => Math.max(0, disponible[k] - Math.max(0, comprometido[k]
    - (encargoExistente && encargoExistente.estado !== 'entregado' ? Number(encargoExistente[`cantidad_${k}` as keyof Encargo] ?? 0) : 0)))
  const faltan = TAMANOS_HUEVO.filter(t => cantidad(t.key) > libre(t.key))
  const noAlcanza = totalHuevos > 0 && faltan.length > 0
  const libreTotal = totalTamanos(Object.fromEntries(TAMANOS_HUEVO.map(t => [t.key, libre(t.key)])) as PorTamano)

  function fmtLargo(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha_entrega) { toast.error('Ingresa la fecha de entrega del encargo'); return }
    if (form.fecha_pedido && form.fecha_entrega < form.fecha_pedido) { toast.error('La entrega no puede ser antes del pedido'); return }
    if (totalHuevos <= 0) { toast.error('Ingresa cuántos huevos se encargaron'); return }

    setLoading(true)
    const c = await asegurarCliente(supabase, fincaId, cliente, clientes)
    if (c.error) { setLoading(false); toast.error(c.error); return }
    const payload = {
      fecha_pedido: form.fecha_pedido,
      fecha_entrega: form.fecha_entrega,
      cliente: c.nombre,
      cliente_id: c.id,
      cantidad_b: Number(form.cantidad_b) || 0,
      cantidad_a: Number(form.cantidad_a) || 0,
      cantidad_aa: Number(form.cantidad_aa) || 0,
      cantidad_aaa: Number(form.cantidad_aaa) || 0,
      cantidad_jumbo: Number(form.cantidad_jumbo) || 0,
      observaciones: form.observaciones || null,
    }
    const { error } = encargoExistente
      ? await supabase.from('encargos_huevos_aves').update(payload).eq('id', encargoExistente.id)
      : await supabase.from('encargos_huevos_aves').insert({ ...payload, finca_id: fincaId, lote_id: null })

    setLoading(false)
    if (error) { toast.error(encargoExistente ? 'Error al actualizar el encargo' : 'Error al registrar el encargo'); return }
    // Se deja registrar aunque hoy no alcance, pero queda claro lo que hay que tener ese día
    if (noAlcanza) {
      toast.warning(
        `Encargo registrado. Para el ${fmtLargo(form.fecha_entrega)} la finca debe tener ese huevo: hoy falta ${faltan.map(t => t.label).join(', ')}.`,
        { duration: 10000 }
      )
    } else {
      toast.success(encargoExistente ? 'Encargo actualizado' : 'Encargo registrado')
    }
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{encargoExistente ? 'Editar encargo' : 'Registrar encargo futuro'}</DialogTitle>
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
              <ClienteSelect clientes={clientes} value={cliente} onChange={setCliente} />
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Huevos encargados por tamaño</p>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
              {TAMANOS_HUEVO.map(t => (
                <div key={t.key} className="space-y-1">
                  <Label className="text-xs">{t.label}</Label>
                  <Input
                    type="number" min="0" placeholder="0" className="bg-white"
                    value={form[`cantidad_${t.key}` as keyof typeof form]}
                    onChange={e => set(`cantidad_${t.key}`, e.target.value)}
                  />
                  <p className={`text-[0.6875rem] ${cantidad(t.key) > libre(t.key) ? 'font-medium text-amber-700' : 'text-gray-400'}`}>
                    libres {libre(t.key).toLocaleString('es-CO')}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              Total encargado: <span className="font-semibold">{totalHuevos.toLocaleString('es-CO')}</span>
              {` · la finca tiene ${libreTotal.toLocaleString('es-CO')} huevos libres (en bodega y sin comprometer)`}
            </p>
          </div>

          {noAlcanza && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200/70">
              <p className="font-semibold">Hoy no alcanza, pero puedes registrarlo.</p>
              <p className="mt-0.5">
                {`Hoy no hay suficiente ${faltan.map(t => `${t.label} (libres ${libre(t.key).toLocaleString('es-CO')})`).join(', ')}.`}
                {form.fecha_entrega && ` Para el ${fmtLargo(form.fecha_entrega)} la finca debe tenerlo para cumplir.`}
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas del encargo..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : encargoExistente ? 'Guardar cambios' : 'Registrar encargo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
