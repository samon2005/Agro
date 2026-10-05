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
import { TAMANOS_HUEVO, cop, type PreciosHuevo } from '@/lib/huevos'
import { preciosParaCliente, type ClienteHuevos, type PorTamano } from '@/lib/huevosFinca'
import ClienteSelect, { asegurarCliente, type ValorCliente } from './ClienteSelect'

type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  /** Precios de la finca: la venta se registra con ellos (o con los del cliente) */
  precios: PreciosHuevo
  /** Huevos en bodega de toda la finca, por tamaño */
  disponible: PorTamano
  clientes: ClienteHuevos[]
  /** Nombre del galpón de las ventas de antes, que sí lo tenían */
  nombreGalpon?: (loteId: string) => string
  ventaExistente?: Venta | null
  onCreated: () => void
}

function defaultForm(v?: Venta | null) {
  return {
    fecha: v?.fecha ?? hoyLocal(),
    cantidad_b: v ? String(v.cantidad_b) : '',
    cantidad_a: v ? String(v.cantidad_a) : '',
    cantidad_aa: v ? String(v.cantidad_aa) : '',
    cantidad_aaa: v ? String(v.cantidad_aaa) : '',
    cantidad_jumbo: v ? String(v.cantidad_jumbo) : '',
    observaciones: v?.observaciones ?? '',
  }
}

/**
 * Registra el huevo el día que sale de bodega. Sale del huevo de toda la finca,
 * no de un galpón. El precio es el del cliente si tiene uno propio, si no el de
 * la finca. El dinero se registra aparte, cuando entra, como pago de la venta.
 */
export default function RegistrarVentaModal({ open, onClose, fincaId, precios, disponible, clientes, nombreGalpon, ventaExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(ventaExistente))
  const [cliente, setCliente] = useState<ValorCliente>({ id: null, nombre: '' })

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(ventaExistente))
    setCliente({ id: ventaExistente?.cliente_id ?? null, nombre: ventaExistente?.cliente ?? '' })
  }, [open, ventaExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const clienteSel = clientes.find(c => c.id === cliente.id) ?? null
  // Al editar, la venta conserva los precios con los que se registró
  const preciosVenta: PreciosHuevo = ventaExistente
    ? {
        b: ventaExistente.precio_b, a: ventaExistente.precio_a, aa: ventaExistente.precio_aa,
        aaa: ventaExistente.precio_aaa, jumbo: ventaExistente.precio_jumbo,
      }
    : preciosParaCliente(precios, clienteSel, form.fecha)
  const conPrecioPropio = !ventaExistente && clienteSel && TAMANOS_HUEVO.some(t => preciosVenta[t.key] !== precios[t.key])

  const cantidad = (k: string) => Number(form[`cantidad_${k}` as keyof typeof form]) || 0
  const totalHuevos = TAMANOS_HUEVO.reduce((s, t) => s + cantidad(t.key), 0)
  const totalVenta = TAMANOS_HUEVO.reduce((s, t) => s + cantidad(t.key) * Number(preciosVenta[t.key] ?? 0), 0)
  // Lo que hay de cada tamaño (al editar, lo de esta venta vuelve a estar disponible)
  const hay = (k: keyof PorTamano) => disponible[k] + (ventaExistente ? Number(ventaExistente[`cantidad_${k}` as keyof Venta] ?? 0) : 0)
  const sinPrecio = TAMANOS_HUEVO.filter(t => cantidad(t.key) > 0 && !(Number(preciosVenta[t.key] ?? 0) > 0))
  const sinHuevo = TAMANOS_HUEVO.filter(t => cantidad(t.key) > Math.max(0, hay(t.key)))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha || form.fecha > hoyLocal()) { toast.error('Indica una fecha de venta que no sea futura'); return }
    if (totalHuevos <= 0) { toast.error('Ingresa la cantidad de huevos vendidos'); return }
    if (TAMANOS_HUEVO.some(t => !Number.isInteger(cantidad(t.key)) || cantidad(t.key) < 0)) { toast.error('Las cantidades son huevos enteros'); return }
    if (sinPrecio.length > 0) {
      toast.error(`El tamaño ${sinPrecio.map(t => t.label).join(', ')} no tiene precio: defínelo arriba antes de vender`)
      return
    }
    if (sinHuevo.length > 0) {
      toast.error(`No hay suficiente huevo ${sinHuevo.map(t => `${t.label} (hay ${Math.max(0, hay(t.key)).toLocaleString('es-CO')})`).join(', ')} en la finca. Registra la producción antes de venderlo.`, { duration: 8000 })
      return
    }

    setLoading(true)
    const c = await asegurarCliente(supabase, fincaId, cliente, clientes)
    if (c.error) { setLoading(false); toast.error(c.error); return }
    const payload = {
      fecha: form.fecha,
      cantidad_b: cantidad('b'),
      cantidad_a: cantidad('a'),
      cantidad_aa: cantidad('aa'),
      cantidad_aaa: cantidad('aaa'),
      cantidad_jumbo: cantidad('jumbo'),
      precio_b: preciosVenta.b, precio_a: preciosVenta.a, precio_aa: preciosVenta.aa,
      precio_aaa: preciosVenta.aaa, precio_jumbo: preciosVenta.jumbo,
      cliente: c.nombre,
      cliente_id: c.id,
      observaciones: form.observaciones || null,
    }
    // La venta nueva es de la finca (sin galpón); una de antes conserva el suyo
    const { error } = ventaExistente
      ? await supabase.from('ventas_huevos_aves').update(payload).eq('id', ventaExistente.id)
      : await supabase.from('ventas_huevos_aves').insert({ ...payload, finca_id: fincaId, lote_id: null })

    setLoading(false)
    if (error) { toast.error(ventaExistente ? 'Error al actualizar la venta' : 'Error al registrar la venta'); return }
    toast.success(ventaExistente ? 'Venta actualizada' : 'Venta registrada: el huevo salió de la bodega de la finca')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ventaExistente ? 'Editar venta' : 'Registrar venta de huevo'}</DialogTitle>
          <p className="text-sm text-gray-500">
            Sale del huevo de toda la finca, el día que sale de bodega. El dinero se anota después, cuando entre.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha de salida</Label>
              <Input type="date" max={hoyLocal()} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <ClienteSelect clientes={clientes} value={cliente} onChange={setCliente} />
            </div>
            {ventaExistente?.lote_id && nombreGalpon && (
              <p className="col-span-2 text-xs text-gray-500">
                Venta de antes, registrada del galpón {nombreGalpon(ventaExistente.lote_id)}: lo conserva.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">
              Huevos vendidos por tamaño
              {conPrecioPropio && <span className="ml-1 font-normal text-green-700">· con el precio de {clienteSel!.nombre}</span>}
            </p>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
              {TAMANOS_HUEVO.map(t => (
                <div key={t.key} className="space-y-1">
                  <Label className="text-xs">{t.label} · {preciosVenta[t.key] ? cop(Number(preciosVenta[t.key])) : 'sin precio'}</Label>
                  <Input
                    type="number" min="0" step="1" placeholder="0" className="bg-white"
                    value={form[`cantidad_${t.key}` as keyof typeof form]}
                    onChange={e => set(`cantidad_${t.key}`, e.target.value)}
                  />
                  <p className={`text-[0.6875rem] ${cantidad(t.key) > Math.max(0, hay(t.key)) ? 'font-medium text-red-600' : 'text-gray-400'}`}>
                    hay {Math.max(0, hay(t.key)).toLocaleString('es-CO')}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              {totalHuevos.toLocaleString('es-CO')} huevos · <span className="font-semibold">{cop(totalVenta)}</span>
            </p>
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas de la venta..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : ventaExistente ? 'Guardar cambios' : 'Registrar venta'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
