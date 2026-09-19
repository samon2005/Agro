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
import { TAMANOS_HUEVO } from '@/lib/huevos'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Encargo = Database['public']['Tables']['encargos_huevos_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  /** Galpones de la finca: el encargo dice de cuál saldrá el huevo */
  lotes: LoteAves[]
  encargoExistente?: Encargo | null
  /** Huevos en bodega de cada galpón hoy, por id de lote */
  stockPorLote: Record<string, number>
  /** Huevo ya comprometido en otros encargos pendientes, por id de lote */
  comprometidoPorLote: Record<string, number>
  onCreated: () => void
}

function defaultForm(lotes: LoteAves[], e?: Encargo | null) {
  return {
    lote_id: e?.lote_id ?? lotes[0]?.id ?? '',
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

export default function RegistrarEncargoModal({ open, onClose, fincaId, lotes, encargoExistente, stockPorLote, comprometidoPorLote, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(lotes, encargoExistente))

  useEffect(() => { if (open) setForm(defaultForm(lotes, encargoExistente)) }, [open, lotes, encargoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const totalHuevos = TAMANOS_HUEVO.reduce((s, t) => s + (Number(form[`cantidad_${t.key}` as keyof typeof form]) || 0), 0)
  const lote = lotes.find(l => l.id === form.lote_id) ?? null
  const enBodega = stockPorLote[form.lote_id] ?? 0
  // Lo ya comprometido en otros encargos del mismo galpón (sin contar este si se edita)
  const yaComprometido = Math.max(0, (comprometidoPorLote[form.lote_id] ?? 0)
    - (encargoExistente && encargoExistente.lote_id === form.lote_id
      ? TAMANOS_HUEVO.reduce((s, t) => s + Number(encargoExistente[`cantidad_${t.key}` as keyof Encargo] ?? 0), 0)
      : 0))
  const libre = Math.max(0, enBodega - yaComprometido)
  const noAlcanza = totalHuevos > 0 && totalHuevos > libre

  function fmtLargo(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.lote_id || !lote) { toast.error('Elige de qué galpón saldrá el huevo'); return }
    if (!form.fecha_entrega) { toast.error('Ingresa la fecha de entrega del encargo'); return }
    if (totalHuevos <= 0) { toast.error('Ingresa cuántos huevos se encargaron'); return }

    setLoading(true)
    const payload = {
      lote_id: form.lote_id,
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
      : await supabase.from('encargos_huevos_aves').insert({ ...payload, finca_id: fincaId })

    setLoading(false)
    if (error) { toast.error(encargoExistente ? 'Error al actualizar el encargo' : 'Error al registrar el encargo'); return }
    // Se deja registrar aunque hoy no alcance, pero queda claro lo que hay que tener ese día
    if (noAlcanza) {
      toast.warning(
        `Encargo registrado. Para el ${fmtLargo(form.fecha_entrega)} ${lote.nombre} debe tener ${totalHuevos.toLocaleString('es-CO')} huevos disponibles; hoy tiene ${libre.toLocaleString('es-CO')} libres.`,
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
            <div className="col-span-2 space-y-1">
              <Label>Galpón del que saldrá *</Label>
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
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              Total encargado: <span className="font-semibold">{totalHuevos.toLocaleString('es-CO')}</span>
              {lote && ` · ${lote.nombre} tiene ${enBodega.toLocaleString('es-CO')} en bodega${yaComprometido > 0 ? `, ${yaComprometido.toLocaleString('es-CO')} ya comprometidos` : ''}`}
            </p>
          </div>

          {noAlcanza && lote && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200/70">
              <p className="font-semibold">Hoy no alcanza, pero puedes registrarlo.</p>
              <p className="mt-0.5">
                {form.fecha_entrega
                  ? `Para el ${fmtLargo(form.fecha_entrega)} ${lote.nombre} debe tener ${totalHuevos.toLocaleString('es-CO')} huevos disponibles para cumplir. Hoy tiene ${libre.toLocaleString('es-CO')} libres.`
                  : `El encargo supera los ${libre.toLocaleString('es-CO')} huevos libres que tiene hoy ${lote.nombre}.`}
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
