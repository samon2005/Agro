'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hoyLocal } from '@/lib/fechas'
import { cop } from '@/lib/huevos'
import type { VentaAvesLote } from '@/lib/finanzas'

type Tipo = VentaAvesLote['tipo']

const TIPOS: { value: Tipo; label: string; unidad: string; porUnidad: string }[] = [
  { value: 'descarte', label: 'Gallinas de descarte', unidad: 'aves', porUnidad: 'por ave' },
  { value: 'pollas', label: 'Pollas de levante', unidad: 'aves', porUnidad: 'por polla' },
  { value: 'gallinaza', label: 'Gallinaza', unidad: 'bultos', porUnidad: 'por bulto' },
  { value: 'otro', label: 'Otro', unidad: 'unidades', porUnidad: 'por unidad' },
]

const FINCA = 'finca'

interface LoteVivo { id: string; nombre: string; estado: string; aves_actuales: number }

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  /** La venta que se edita; sin ella se registra una nueva */
  ventaExistente?: VentaAvesLote | null
  /** Nombre de cualquier lote (también cerrados), para mostrar el de una venta vieja */
  nombreLote: (id: string) => string
  onGuardado: () => void
}

function esAves(t: Tipo) {
  return t === 'descarte' || t === 'pollas'
}

function formVacio(v?: VentaAvesLote | null) {
  return {
    tipo: (v?.tipo ?? 'descarte') as Tipo,
    lote_id: v ? (v.lote_id ?? FINCA) : '',
    fecha: v?.fecha ?? hoyLocal(),
    cantidad: v ? String(v.cantidad) : '',
    unidad: v?.unidad ?? 'aves',
    precio_unitario: v ? String(v.precio_unitario) : '',
    descripcion: v?.descripcion ?? '',
    cliente: v?.cliente ?? '',
    observaciones: v?.observaciones ?? '',
  }
}

/**
 * Lo que vende la finca además del huevo. Las gallinas de descarte salen de un
 * galpón en postura y las pollas de uno en levante (se suelen vender hacia las
 * 14–15 semanas): las dos bajan las aves del galpón. Si el galpón queda vacío
 * se ofrece cerrar el lote para que quede libre para otras aves.
 */
export default function RegistrarVentaAvesModal({ open, onClose, fincaId, ventaExistente, nombreLote, onGuardado }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState(() => formVacio(ventaExistente))
  const [lotes, setLotes] = useState<LoteVivo[]>([])
  const [guardando, setGuardando] = useState(false)
  // Tras vender todas las aves de un galpón: ¿se cierra el lote?
  const [loteVacio, setLoteVacio] = useState<LoteVivo | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(formVacio(ventaExistente))
    setLoteVacio(null)
    supabase.from('lotes_aves').select('id, nombre, estado, aves_actuales')
      .eq('finca_id', fincaId).in('estado', ['activo', 'preparacion']).order('nombre')
      .then(({ data }) => setLotes(data ?? []))
    // Solo al abrir, para no borrar lo que se va escribiendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function set(campo: keyof ReturnType<typeof formVacio>, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function cambiarTipo(tipo: Tipo) {
    const info = TIPOS.find(t => t.value === tipo)!
    setForm(prev => ({
      ...prev,
      tipo,
      unidad: esAves(tipo) ? 'aves' : (esAves(prev.tipo) ? info.unidad : prev.unidad),
      // El galpón elegido puede no servir para el nuevo tipo
      lote_id: esAves(tipo) ? (lotesPara(tipo).some(l => l.id === prev.lote_id) ? prev.lote_id : '') : (prev.lote_id || FINCA),
    }))
  }

  // Descarte sale de galpones en postura; pollas, de galpones en levante
  function lotesPara(tipo: Tipo) {
    if (tipo === 'descarte') return lotes.filter(l => l.estado === 'activo')
    if (tipo === 'pollas') return lotes.filter(l => l.estado === 'preparacion')
    return lotes
  }

  const info = TIPOS.find(t => t.value === form.tipo)!
  const opciones = lotesPara(form.tipo)
  const lote = lotes.find(l => l.id === form.lote_id) ?? null
  const cantidad = Number(form.cantidad) || 0
  const precio = Number(form.precio_unitario) || 0
  // Al editar, las aves de esta misma venta vuelven antes de volver a salir
  const devueltas = ventaExistente && esAves(ventaExistente.tipo) && ventaExistente.lote_id === form.lote_id
    ? Number(ventaExistente.cantidad) : 0
  const disponibles = lote ? lote.aves_actuales + devueltas : 0
  // Una venta de un lote ya cerrado solo puede cambiar de precio, cliente o notas
  const loteCerrado = Boolean(ventaExistente?.lote_id && esAves(ventaExistente.tipo) && !lotes.some(l => l.id === ventaExistente.lote_id))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha || form.fecha > hoyLocal()) { toast.error('Indica una fecha de venta que no sea futura'); return }
    if (!(cantidad > 0)) { toast.error('Indica la cantidad vendida'); return }
    if (!(precio > 0)) { toast.error(`Indica el precio ${info.porUnidad}`); return }
    if (form.tipo === 'otro' && !form.descripcion.trim()) { toast.error('Describe qué se vendió'); return }
    if (esAves(form.tipo) && !loteCerrado) {
      if (!lote) { toast.error(form.tipo === 'pollas' ? 'Elige el galpón en levante del que salen las pollas' : 'Elige el galpón del que salen las gallinas'); return }
      if (!Number.isInteger(cantidad)) { toast.error('Las aves se venden enteras'); return }
      if (cantidad > disponibles) { toast.error(`En ${lote.nombre} hay ${disponibles.toLocaleString('es-CO')} aves: no se pueden vender ${cantidad.toLocaleString('es-CO')}`); return }
    }

    setGuardando(true)
    const payload = {
      tipo: form.tipo,
      lote_id: loteCerrado ? ventaExistente!.lote_id : (form.lote_id && form.lote_id !== FINCA ? form.lote_id : null),
      fecha: form.fecha,
      cantidad: loteCerrado ? Number(ventaExistente!.cantidad) : cantidad,
      unidad: esAves(form.tipo) ? 'aves' : (form.unidad.trim() || info.unidad),
      precio_unitario: precio,
      descripcion: form.descripcion.trim() || null,
      cliente: form.cliente.trim() || null,
      observaciones: form.observaciones.trim() || null,
    }
    const { error } = ventaExistente
      ? await supabase.from('ventas_aves_lote').update(payload).eq('id', ventaExistente.id)
      : await supabase.from('ventas_aves_lote').insert({ ...payload, finca_id: fincaId })
    setGuardando(false)

    if (error) {
      // La base no deja vender más aves de las que hay ni mover las de un lote cerrado
      toast.error(error.hint === 'sin_aves' || error.hint === 'lote_cerrado' ? error.message : 'No se pudo guardar la venta')
      return
    }
    toast.success(ventaExistente ? 'Venta actualizada' : 'Venta registrada')
    onGuardado()

    if (esAves(form.tipo) && lote && !loteCerrado && disponibles - cantidad === 0) {
      setLoteVacio(lote)
      return
    }
    onClose()
  }

  async function cerrarLote() {
    if (!loteVacio) return
    setGuardando(true)
    const { error } = await supabase.from('lotes_aves').update({ estado: 'vendido' }).eq('id', loteVacio.id)
    setGuardando(false)
    if (error) { toast.error('No se pudo cerrar el lote'); return }
    toast.success(`Lote cerrado: ${loteVacio.nombre} quedó libre para nuevas aves`)
    onGuardado()
    onClose()
  }

  if (loteVacio) {
    return (
      <Dialog open={open} onOpenChange={v => !v && !guardando && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{loteVacio.nombre} quedó sin aves</DialogTitle>
            <p className="text-sm text-gray-500">
              Se vendieron todas las aves del galpón. Al cerrar el lote, su historial se conserva
              y el galpón queda vacío para registrar las próximas aves.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={guardando} onClick={onClose}>Dejarlo abierto</Button>
            <Button disabled={guardando} onClick={cerrarLote}>{guardando ? 'Cerrando...' : 'Cerrar el lote'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !guardando && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ventaExistente ? 'Editar venta' : 'Registrar venta'}</DialogTitle>
          <p className="text-sm text-gray-500">
            Gallinas, pollas, gallinaza y otros. El huevo se vende en Ventas de la finca.
          </p>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>¿Qué se vendió? *</Label>
              <Select
                value={form.tipo}
                onValueChange={v => v && cambiarTipo(v as Tipo)}
                items={Object.fromEntries(TIPOS.map(t => [t.value, t.label]))}
                disabled={loteCerrado}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1">
              <Label>{esAves(form.tipo) ? 'Galpón del que salen *' : 'Galpón'}</Label>
              {loteCerrado ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {nombreLote(ventaExistente!.lote_id!)} · lote cerrado: las aves de esta venta ya no se pueden cambiar
                </p>
              ) : (
                <Select
                  value={form.lote_id}
                  onValueChange={v => set('lote_id', v ?? '')}
                  items={{
                    ...(esAves(form.tipo) ? {} : { [FINCA]: 'Toda la finca' }),
                    ...Object.fromEntries(opciones.map(l => [l.id, l.nombre])),
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar galpón..." /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {!esAves(form.tipo) && <SelectItem value={FINCA}>Toda la finca</SelectItem>}
                    {opciones.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nombre}{esAves(form.tipo) ? ` · ${l.aves_actuales.toLocaleString('es-CO')} aves` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {esAves(form.tipo) && !loteCerrado && opciones.length === 0 && (
                <p className="text-xs text-amber-700">
                  {form.tipo === 'pollas' ? 'No hay galpones en levante.' : 'No hay galpones en postura.'}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Fecha *</Label>
              <Input type="date" max={hoyLocal()} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cantidad *</Label>
              <div className="flex gap-2">
                <Input
                  type="number" min="0" step={esAves(form.tipo) ? '1' : '0.01'}
                  value={form.cantidad}
                  disabled={loteCerrado}
                  onChange={e => set('cantidad', e.target.value)}
                />
                {!esAves(form.tipo) && (
                  <Input className="w-28" value={form.unidad} onChange={e => set('unidad', e.target.value)} aria-label="Unidad" />
                )}
              </div>
              {esAves(form.tipo) && lote && !loteCerrado && (
                <p className="text-[0.6875rem] text-gray-400">Hay {disponibles.toLocaleString('es-CO')} aves en el galpón</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Precio {info.porUnidad} *</Label>
              <CurrencyInput placeholder="0" value={form.precio_unitario} onValueChange={v => set('precio_unitario', v)} />
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input placeholder="¿A quién se vendió?" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Descripción{form.tipo === 'otro' ? ' *' : ''}</Label>
              <Input placeholder={form.tipo === 'otro' ? '¿Qué se vendió?' : 'Opcional'} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3">
            <span className="text-sm text-green-800">Total de la venta</span>
            <span className="text-lg font-semibold text-green-900 tabular-nums">{cop((loteCerrado ? Number(ventaExistente!.cantidad) : cantidad) * precio)}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={guardando} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : ventaExistente ? 'Guardar cambios' : 'Registrar venta'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
