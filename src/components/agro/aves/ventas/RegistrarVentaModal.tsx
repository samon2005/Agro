'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { ajustarHuevos } from '@/lib/inventario'
import { TAMANOS_HUEVO, cop, type PreciosHuevo } from '@/lib/huevos'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  /** Galpones de la finca: la venta dice de cuál sale el huevo */
  lotes: LoteAves[]
  /** Precios de la finca: la venta se registra con ellos */
  precios: PreciosHuevo
  /** Huevos disponibles en el inventario de cada galpón, por id de lote */
  stockPorLote: Record<string, number>
  ventaExistente?: Venta | null
  onCreated: () => void
}

function defaultForm(lotes: LoteAves[], v?: Venta | null) {
  return {
    lote_id: v?.lote_id ?? lotes[0]?.id ?? '',
    fecha: v?.fecha ?? hoyLocal(),
    cantidad_b: v ? String(v.cantidad_b) : '',
    cantidad_a: v ? String(v.cantidad_a) : '',
    cantidad_aa: v ? String(v.cantidad_aa) : '',
    cantidad_aaa: v ? String(v.cantidad_aaa) : '',
    cantidad_jumbo: v ? String(v.cantidad_jumbo) : '',
    cliente: v?.cliente ?? '',
    observaciones: v?.observaciones ?? '',
  }
}

/**
 * Registra el huevo el día que sale de bodega: baja el inventario del galpón del
 * que sale. El dinero se registra aparte, cuando entra, como pago de la venta.
 */
export default function RegistrarVentaModal({ open, onClose, fincaId, lotes, precios, stockPorLote, ventaExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(lotes, ventaExistente))

  useEffect(() => { if (open) setForm(defaultForm(lotes, ventaExistente)) }, [open, lotes, ventaExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  // Al editar, la venta conserva los precios con los que se registró
  const preciosVenta: PreciosHuevo = ventaExistente
    ? {
        b: ventaExistente.precio_b, a: ventaExistente.precio_a, aa: ventaExistente.precio_aa,
        aaa: ventaExistente.precio_aaa, jumbo: ventaExistente.precio_jumbo,
      }
    : precios

  const cantidad = (k: string) => Number(form[`cantidad_${k}` as keyof typeof form]) || 0
  const totalHuevos = TAMANOS_HUEVO.reduce((s, t) => s + cantidad(t.key), 0)
  const totalVenta = TAMANOS_HUEVO.reduce((s, t) => s + cantidad(t.key) * Number(preciosVenta[t.key] ?? 0), 0)
  const lote = lotes.find(l => l.id === form.lote_id) ?? null
  const vendidosAntes = ventaExistente
    ? TAMANOS_HUEVO.reduce((s, t) => s + Number(ventaExistente[`cantidad_${t.key}` as keyof Venta] ?? 0), 0)
    : 0
  const disponible = (stockPorLote[form.lote_id] ?? 0) + (ventaExistente?.lote_id === form.lote_id ? vendidosAntes : 0)
  const sinPrecio = TAMANOS_HUEVO.filter(t => cantidad(t.key) > 0 && !(Number(preciosVenta[t.key] ?? 0) > 0))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.lote_id || !lote) { toast.error('Elige de qué galpón sale el huevo'); return }
    if (totalHuevos <= 0) { toast.error('Ingresa la cantidad de huevos vendidos'); return }
    if (sinPrecio.length > 0) {
      toast.error(`El tamaño ${sinPrecio.map(t => t.label).join(', ')} no tiene precio: defínelo arriba antes de vender`)
      return
    }

    setLoading(true)
    const payload = {
      lote_id: form.lote_id,
      fecha: form.fecha,
      cantidad_b: cantidad('b'),
      cantidad_a: cantidad('a'),
      cantidad_aa: cantidad('aa'),
      cantidad_aaa: cantidad('aaa'),
      cantidad_jumbo: cantidad('jumbo'),
      precio_b: preciosVenta.b, precio_a: preciosVenta.a, precio_aa: preciosVenta.aa,
      precio_aaa: preciosVenta.aaa, precio_jumbo: preciosVenta.jumbo,
      cliente: form.cliente || null,
      observaciones: form.observaciones || null,
    }
    const { error } = ventaExistente
      ? await supabase.from('ventas_huevos_aves').update(payload).eq('id', ventaExistente.id)
      : await supabase.from('ventas_huevos_aves').insert({ ...payload, finca_id: fincaId })

    // El huevo sale del inventario del galpón. Al editar solo se mueve la diferencia;
    // si cambió de galpón, se devuelve al anterior y se descuenta del nuevo.
    if (!error) {
      if (ventaExistente && ventaExistente.lote_id !== form.lote_id) {
        const anterior = lotes.find(l => l.id === ventaExistente.lote_id)
        if (anterior) await ajustarHuevos(supabase, fincaId, anterior.nombre, vendidosAntes)
        await ajustarHuevos(supabase, fincaId, lote.nombre, -totalHuevos)
      } else if (totalHuevos - vendidosAntes !== 0) {
        await ajustarHuevos(supabase, fincaId, lote.nombre, -(totalHuevos - vendidosAntes))
      }
    }

    setLoading(false)
    if (error) { toast.error(ventaExistente ? 'Error al actualizar la venta' : 'Error al registrar la venta'); return }
    toast.success(ventaExistente ? 'Venta actualizada' : 'Venta registrada: el huevo salió de bodega')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ventaExistente ? 'Editar venta' : 'Registrar venta de huevo'}</DialogTitle>
          <p className="text-sm text-gray-500">
            Se registra el día que el huevo sale de bodega. El dinero se anota después, cuando entre.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Galpón del que sale *</Label>
              <Select
                value={form.lote_id}
                onValueChange={v => set('lote_id', v)}
                items={Object.fromEntries(lotes.map(l => [l.id, l.nombre]))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar galpón..." /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {lotes.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre} · {(stockPorLote[l.id] ?? 0).toLocaleString('es-CO')} huevos en bodega
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de salida</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input placeholder="Nombre del cliente" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Cantidad por tamaño</p>
            <div className="grid grid-cols-5 gap-2">
              {TAMANOS_HUEVO.map(t => (
                <div key={t.key} className="space-y-1">
                  <Label className="text-xs">{t.label}</Label>
                  <Input
                    type="number" min="0" placeholder="0" className="bg-white"
                    value={form[`cantidad_${t.key}` as keyof typeof form]}
                    onChange={e => set(`cantidad_${t.key}`, e.target.value)}
                  />
                  <p className="text-[0.6875rem] text-gray-500 tabular-nums">
                    {Number(preciosVenta[t.key] ?? 0) > 0 ? cop(Number(preciosVenta[t.key])) : 'sin precio'}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-2">
              <p className="text-xs text-gray-600">Total: <span className="font-semibold">{totalHuevos.toLocaleString('es-CO')} huevos</span></p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">{cop(totalVenta)}</p>
            </div>
            <p className="text-[0.6875rem] text-gray-500">
              {ventaExistente ? 'Conserva los precios con los que se registró.' : 'Con los precios definidos para la finca.'}
            </p>
          </div>

          {lote && totalHuevos > disponible && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              En bodega de {lote.nombre} hay {disponible.toLocaleString('es-CO')} huevos y estás sacando {totalHuevos.toLocaleString('es-CO')}.
              Revisa que la producción de esos días esté registrada.
            </p>
          )}

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : ventaExistente ? 'Guardar cambios' : 'Registrar venta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
