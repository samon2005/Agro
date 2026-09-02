'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dbGenerico, type ConfigEspecie, type VentaGenerica } from '@/lib/especiesConfig'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  config: ConfigEspecie
  /** Animales vivos en el lote, para no vender más de los que hay */
  animalesActuales: number
  /** Precio por kg configurado en el lote, como valor por defecto */
  precioKgObjetivo?: number | null
  ventaExistente?: VentaGenerica | null
  onCreated: () => void
}

const MODOS = { kg: 'Por kilo', animal: 'Por animal' }
const TIPOS = { pie: 'En pie (peso vivo)', canal: 'En canal' }

function defaultForm(v?: VentaGenerica | null, precioKgObjetivo?: number | null) {
  return {
    fecha: v?.fecha ?? new Date().toISOString().split('T')[0],
    cantidad: v ? String(v.cantidad) : '',
    peso_promedio_kg: v?.peso_promedio_kg != null ? String(v.peso_promedio_kg) : '',
    modo_precio: v?.modo_precio ?? 'kg',
    precio_kg: v?.precio_kg != null ? String(v.precio_kg) : (precioKgObjetivo != null ? String(precioKgObjetivo) : ''),
    precio_animal: v?.precio_animal != null ? String(v.precio_animal) : '',
    tipo_venta: v?.tipo_venta ?? 'pie',
    rendimiento_canal_pct: v?.rendimiento_canal_pct != null ? String(v.rendimiento_canal_pct) : '',
    cliente: v?.cliente ?? '',
    destino: v?.destino ?? '',
    observaciones: v?.observaciones ?? '',
  }
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

export default function RegistrarVentaGenericaModal({
  open, onClose, loteId, fincaId, config, animalesActuales, precioKgObjetivo, ventaExistente, onCreated,
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(ventaExistente, precioKgObjetivo))

  useEffect(() => { if (open) setForm(defaultForm(ventaExistente, precioKgObjetivo)) }, [open, ventaExistente, precioKgObjetivo])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const cantidad = Number(form.cantidad) || 0
  const pesoPromedio = Number(form.peso_promedio_kg) || 0
  const kgVivo = cantidad * pesoPromedio
  const rendimiento = Number(form.rendimiento_canal_pct) || 0
  const kgFacturables = form.tipo_venta === 'canal' && rendimiento > 0 ? kgVivo * (rendimiento / 100) : kgVivo
  const total = form.modo_precio === 'animal'
    ? cantidad * (Number(form.precio_animal) || 0)
    : kgFacturables * (Number(form.precio_kg) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cantidad <= 0) { toast.error(`Ingresa cuántos ${config.animalPlural} vendiste`); return }
    if (form.modo_precio === 'kg') {
      if (pesoPromedio <= 0) { toast.error('Ingresa el peso promedio para poder cobrar por kilo'); return }
      if (!form.precio_kg || Number(form.precio_kg) <= 0) { toast.error('Ingresa el precio por kilo'); return }
    } else if (!form.precio_animal || Number(form.precio_animal) <= 0) {
      toast.error(`Ingresa el precio por ${config.animalSingular}`); return
    }

    const cantidadAnterior = ventaExistente?.cantidad ?? 0
    const delta = cantidad - cantidadAnterior
    if (delta > animalesActuales) {
      toast.error(`El lote solo tiene ${animalesActuales} ${config.animalPlural}`)
      return
    }

    setLoading(true)
    const db = dbGenerico(supabase)
    const payload = {
      fecha: form.fecha,
      cantidad,
      peso_promedio_kg: pesoPromedio || null,
      modo_precio: form.modo_precio,
      precio_kg: form.precio_kg ? Number(form.precio_kg) : null,
      precio_animal: form.precio_animal ? Number(form.precio_animal) : null,
      tipo_venta: form.tipo_venta,
      rendimiento_canal_pct: form.tipo_venta === 'canal' && rendimiento > 0 ? rendimiento : null,
      cliente: form.cliente || null,
      destino: form.destino || null,
      observaciones: form.observaciones || null,
    }
    const { error } = ventaExistente
      ? await db.from(config.tablas.ventas).update(payload).eq('id', ventaExistente.id)
      : await db.from(config.tablas.ventas).insert({ ...payload, lote_id: loteId, finca_id: fincaId })

    // La venta descuenta animales del lote
    if (!error && delta !== 0) {
      await db.from(config.tablas.lotes)
        .update({ [config.campoActuales]: Math.max(0, animalesActuales - delta) })
        .eq('id', loteId)
    }

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
          <DialogTitle>{ventaExistente ? '✏️ Editar Venta' : '🧾 Registrar Venta'}</DialogTitle>
          <p className="text-sm text-gray-500">
            Disponibles en el {config.loteLabel}: {animalesActuales.toLocaleString('es-CO')} {config.animalPlural}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cantidad de {config.animalPlural} *</Label>
              <Input type="number" min="1" placeholder="Ej: 50" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo de venta</Label>
              <Select value={form.tipo_venta} onValueChange={v => set('tipo_venta', v)} items={TIPOS}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pie">En pie (peso vivo)</SelectItem>
                  <SelectItem value="canal">En canal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Peso promedio (kg)</Label>
              <Input type="number" min="0" step="0.01" placeholder="Ej: 105" value={form.peso_promedio_kg} onChange={e => set('peso_promedio_kg', e.target.value)} />
            </div>
            {form.tipo_venta === 'canal' && (
              <div className="col-span-2 space-y-1">
                <Label>Rendimiento en canal (%)</Label>
                <Input type="number" min="0" max="100" step="0.1" placeholder="Ej: 78" value={form.rendimiento_canal_pct} onChange={e => set('rendimiento_canal_pct', e.target.value)} />
                <p className="text-xs text-gray-400">Qué porcentaje del peso vivo queda como canal. Se usa para calcular los kilos que se cobran.</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Cobrar</Label>
              <Select value={form.modo_precio} onValueChange={v => set('modo_precio', v)} items={MODOS}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Por kilo</SelectItem>
                  <SelectItem value="animal">Por animal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.modo_precio === 'kg' ? (
              <div className="space-y-1">
                <Label>Precio por kg *</Label>
                <CurrencyInput placeholder="0" value={form.precio_kg} onValueChange={v => set('precio_kg', v)} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Precio por {config.animalSingular} *</Label>
                <CurrencyInput placeholder="0" value={form.precio_animal} onValueChange={v => set('precio_animal', v)} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input placeholder="¿A quién se le vendió?" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Destino</Label>
              <Input placeholder="Planta, plaza, finca..." value={form.destino} onChange={e => set('destino', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas de la venta..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
            {form.modo_precio === 'kg' && (
              <p className="text-xs text-emerald-700">
                {kgVivo.toLocaleString('es-CO')} kg vivos
                {form.tipo_venta === 'canal' && rendimiento > 0 && ` · ${kgFacturables.toLocaleString('es-CO')} kg en canal`}
              </p>
            )}
            <p className="text-sm font-semibold text-emerald-800">Total de la venta: {cop(total)}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className={config.botonClase}>
              {loading ? 'Guardando...' : ventaExistente ? 'Guardar cambios' : 'Registrar venta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
