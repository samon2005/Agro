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
import { categoriasCosto, categoriasCostoItems, categoriaInfo } from '@/lib/costos'
import { CONFIG_ESPECIES, dbGenerico } from '@/lib/especiesConfig'
import type { EspecieFinca } from '@/lib/especies'
import type { CostoFinca, LoteFinanzas } from '@/lib/finanzas'
import { hoyLocal } from '@/lib/fechas'

export type { LoteFinanzas }

const FINCA = 'finca'

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  especie: EspecieFinca
  /** Galpones o corrales de la finca (los cerrados solo se muestran si el costo ya era de ellos) */
  lotes: LoteFinanzas[]
  /** Galpón que viene elegido desde el filtro de la página ('finca' = toda la finca) */
  loteInicial?: string | null
  costoExistente?: CostoFinca | null
  onCreated: () => void
}

function defaultForm(loteInicial?: string | null, costo?: CostoFinca | null) {
  return {
    lote_id: costo ? (costo.lote_id ?? FINCA) : (loteInicial ?? FINCA),
    fecha: costo?.fecha ?? hoyLocal(),
    // Las categorías viejas (agua, energía) se muestran con la que las reemplazó
    categoria: costo ? (categoriaInfo(costo.categoria)?.value ?? costo.categoria) : '',
    descripcion: costo?.descripcion ?? '',
    monto: costo ? String(Math.round(Number(costo.monto))) : '',
    proveedor: costo?.proveedor ?? '',
    observaciones: costo?.observaciones ?? '',
  }
}

/**
 * Un gasto de la finca. Puede ser de un galpón (o corral) o de toda la finca:
 * la luz, la nómina o el transporte no son de un galpón en particular.
 */
export default function RegistrarCostoFincaModal({ open, onClose, fincaId, especie, lotes, loteInicial, costoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(loteInicial, costoExistente))

  useEffect(() => {
    if (open) setForm(defaultForm(loteInicial, costoExistente))
    // Solo al abrir, para no borrar lo que se va escribiendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const config = CONFIG_ESPECIES[especie]
  const lugar = config.loteLabel
  const categorias = categoriasCosto(config.categoriaCria)
  const opciones = lotes.filter(l => l.estado === 'activo' || l.estado === 'preparacion' || l.id === costoExistente?.lote_id)
  const etiquetaLote = (l: LoteFinanzas) => l.estado === 'activo' || l.estado === 'preparacion' ? l.nombre : `${l.nombre} · lote cerrado`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.categoria) { toast.error('Selecciona una categoría'); return }
    if (!form.descripcion.trim()) { toast.error('La descripción es requerida'); return }
    if (!form.monto || Number(form.monto) <= 0) { toast.error('Ingresa el monto'); return }
    if (!form.fecha) { toast.error('Indica la fecha'); return }

    setLoading(true)
    const db = dbGenerico(supabase)
    const payload = {
      fecha: form.fecha,
      categoria: form.categoria,
      descripcion: form.descripcion.trim(),
      monto: Number(form.monto),
      proveedor: form.proveedor.trim() || null,
      observaciones: form.observaciones.trim() || null,
      lote_id: form.lote_id === FINCA ? null : form.lote_id,
    }
    const { error } = costoExistente
      ? await db.from(config.tablas.costos).update(payload).eq('id', costoExistente.id)
      : await db.from(config.tablas.costos).insert({ ...payload, finca_id: fincaId })
    setLoading(false)
    if (error) { toast.error(costoExistente ? 'Error al actualizar el costo' : 'Error al registrar el costo'); return }
    toast.success(costoExistente ? 'Costo actualizado' : 'Costo registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !loading && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{costoExistente ? 'Editar costo' : 'Registrar costo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>¿De qué {lugar} es el gasto?</Label>
              <Select
                value={form.lote_id}
                onValueChange={v => set('lote_id', v)}
                items={{ [FINCA]: 'Toda la finca', ...Object.fromEntries(opciones.map(l => [l.id, etiquetaLote(l)])) }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value={FINCA}>Toda la finca</SelectItem>
                  {opciones.map(l => <SelectItem key={l.id} value={l.id}>{etiquetaLote(l)}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[0.6875rem] text-gray-400">Luz, nómina, transporte y lo que no es de un {lugar} van a toda la finca.</p>
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Categoría *</Label>
              <Select value={form.categoria} onValueChange={v => set('categoria', v)} items={categoriasCostoItems(config.categoriaCria)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Descripción *</Label>
              <Input placeholder="¿Qué se pagó?" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Monto *</Label>
              <CurrencyInput placeholder="0" value={form.monto} onValueChange={v => set('monto', v)} />
            </div>
            <div className="space-y-1">
              <Label>Proveedor</Label>
              <Input placeholder="Nombre del proveedor" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={loading} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : costoExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
