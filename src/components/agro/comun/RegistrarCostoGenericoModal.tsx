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
import { categoriasCosto, categoriasCostoItems } from '@/lib/costos'
import { dbGenerico, type ConfigEspecie, type CostoGenerico } from '@/lib/especiesConfig'
import { hoyLocal } from '@/lib/fechas'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  config: ConfigEspecie
  costoExistente?: CostoGenerico | null
  onCreated: () => void
}

function defaultForm(costo?: CostoGenerico | null) {
  return {
    fecha: costo?.fecha ?? hoyLocal(),
    categoria: costo?.categoria ?? '',
    descripcion: costo?.descripcion ?? '',
    monto: costo ? String(costo.monto) : '',
    proveedor: costo?.proveedor ?? '',
    observaciones: costo?.observaciones ?? '',
  }
}

export default function RegistrarCostoGenericoModal({ open, onClose, loteId, fincaId, config, costoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(costoExistente))

  const categorias = categoriasCosto(config.categoriaCria)

  useEffect(() => { if (open) setForm(defaultForm(costoExistente)) }, [open, costoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.categoria) { toast.error('Selecciona una categoría'); return }
    if (!form.descripcion.trim()) { toast.error('La descripción es requerida'); return }
    if (!form.monto || Number(form.monto) <= 0) { toast.error('Ingresa el monto'); return }

    setLoading(true)
    const db = dbGenerico(supabase)
    const payload = {
      fecha: form.fecha,
      categoria: form.categoria,
      descripcion: form.descripcion.trim(),
      monto: Number(form.monto),
      proveedor: form.proveedor || null,
      observaciones: form.observaciones || null,
    }
    const { error } = costoExistente
      ? await db.from(config.tablas.costos).update(payload).eq('id', costoExistente.id)
      : await db.from(config.tablas.costos).insert({ ...payload, lote_id: loteId, finca_id: fincaId })
    setLoading(false)
    if (error) { toast.error(costoExistente ? 'Error al actualizar costo' : 'Error al registrar costo'); return }
    toast.success(costoExistente ? 'Costo actualizado' : 'Costo registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{costoExistente ? '✏️ Editar Costo' : '💰 Registrar Costo Operativo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Categoría *</Label>
              <Select value={form.categoria} onValueChange={v => set('categoria', v)} items={categoriasCostoItems(config.categoriaCria)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
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
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className={config.botonClase}>
              {loading ? 'Guardando...' : costoExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
