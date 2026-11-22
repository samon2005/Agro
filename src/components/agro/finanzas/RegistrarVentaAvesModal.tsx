'use client'

import { useFinca } from '@/components/agro/FincaProvider'
import { leerConfigAves } from '@/lib/configAves'
import { checklistVenta } from '@/lib/registroAves'
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
import { dbGenerico } from '@/lib/especiesConfig'
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
  /** Si se abre desde un galpón: la venta sale de ese lote */
  loteInicialId?: string
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
    peso_promedio_g: v?.peso_promedio_g != null ? String(v.peso_promedio_g) : '',
    checklist: ((v?.checklist ?? {}) as Record<string, boolean>),
  }
}

/**
 * Lo que vende la finca además del huevo. Las gallinas de descarte salen de un
 * galpón en postura y las pollas de uno en levante (se suelen vender hacia las
 * 14–15 semanas): las dos bajan las aves del galpón. Si el galpón queda vacío
 * se ofrece cerrar el lote para que quede libre para otras aves.
 */
export default function RegistrarVentaAvesModal({ open, onClose, fincaId, ventaExistente, nombreLote, onGuardado, loteInicialId }: Props) {
  const { fincaActual } = useFinca()
  const listaChequeo = checklistVenta(leerConfigAves(fincaActual?.config_aves))
  // Lo que costó el lote, para la utilidad por ave (José)
  const [costoLote, setCostoLote] = useState<{ lote: string; costo: number; aves: number } | null>(null)
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
      .then(({ data }) => {
        setLotes(data ?? [])
        // Desde un galpón: ese lote y el tipo de venta que le toca (gallinas o pollas)
        const l = loteInicialId ? (data ?? []).find(x => x.id === loteInicialId) : null
        if (l && !ventaExistente) setForm(p => ({ ...p, lote_id: l.id, tipo: l.estado === 'activo' ? 'descarte' : 'pollas' }))
      })
    // Solo al abrir, para no borrar lo que se va escribiendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || !form.lote_id || form.lote_id === FINCA) return
    let vigente = true
    Promise.all([
      supabase.from('costos_lote_aves').select('monto').eq('lote_id', form.lote_id),
      supabase.from('lotes_aves').select('aves_iniciales').eq('id', form.lote_id).single(),
    ]).then(([c, l]) => {
      if (vigente) setCostoLote({ lote: form.lote_id, costo: (c.data ?? []).reduce((t, x) => t + Number(x.monto), 0), aves: l.data?.aves_iniciales ?? 0 })
    })
    return () => { vigente = false }
  }, [open, form.lote_id, supabase])

  function set(campo: Exclude<keyof ReturnType<typeof formVacio>, 'checklist'>, valor: string) {
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
      peso_promedio_g: esAves(form.tipo) && form.peso_promedio_g ? Number(form.peso_promedio_g) : null,
      checklist: esAves(form.tipo) && Object.keys(form.checklist).length ? form.checklist : null,
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
    // El mismo cierre que en el galpón: deja la fecha, el motivo y el vacío sanitario
    const { error } = await dbGenerico(supabase).rpc('cerrar_lote_aves', {
      p_lote: loteVacio.id,
      p_fecha: form.fecha > hoyLocal() ? hoyLocal() : form.fecha,
      p_motivo: form.tipo === 'pollas' ? 'venta_pollas' : loteVacio.estado === 'activo' && form.tipo === 'descarte' ? 'fin_ciclo' : 'otro',
    })
    setGuardando(false)
    if (error) { toast.error(error.hint === 'lote_cerrado' || error.hint === 'fecha' ? error.message : 'No se pudo cerrar el lote'); return }
    toast.success(`Lote cerrado: ${loteVacio.nombre} quedó libre y en vacío sanitario`)
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
            {esAves(form.tipo) && (
              <>
                <div className="space-y-1">
                  <Label>Peso promedio (g)</Label>
                  <Input type="number" min="0" placeholder="Ej: 1450" value={form.peso_promedio_g} onChange={e => set('peso_promedio_g', e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1 rounded-lg bg-gray-50 p-3">
                  <Label>Antes de vender</Label>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {listaChequeo.map(item => (
                      <label key={item} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <input type="checkbox" className="mt-0.5 accent-green-700" checked={!!form.checklist[item]}
                          onChange={e => setForm(p => ({ ...p, checklist: { ...p.checklist, [item]: e.target.checked } }))} />
                        {item}
                      </label>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-gray-400">Cada finca agrega sus propios puntos en Datos de la finca.</p>
                </div>
                {costoLote && costoLote.lote === form.lote_id && cantidad > 0 && precio > 0 && (() => {
                  const costoAve = costoLote.aves > 0 ? costoLote.costo / costoLote.aves : 0
                  const fmt = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
                  return (
                    <p className="col-span-2 text-xs text-gray-600">
                      El lote lleva {fmt(costoLote.costo)} en costos ({fmt(costoAve)} por ave alojada). Con esta venta: utilidad de <strong>{fmt(precio - costoAve)}</strong> por ave y <strong>{fmt((precio - costoAve) * cantidad)}</strong> en las {cantidad.toLocaleString('es-CO')} aves.
                    </p>
                  )
                })()}
              </>
            )}
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
