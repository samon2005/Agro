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
import { CONFIG_ESPECIES, dbGenerico, type CostoGenerico } from '@/lib/especiesConfig'
import type { EspecieFinca } from '@/lib/especies'
import { hoyLocal } from '@/lib/fechas'

export interface LoteFinanzas {
  id: string
  nombre: string
  especie: EspecieFinca
}

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  lotes: LoteFinanzas[]
  /** Lote que viene elegido desde el filtro de la página */
  loteInicial?: string | null
  /** Al editar: el costo y la especie a la que pertenece */
  costoExistente?: (CostoGenerico & { especie: EspecieFinca }) | null
  onCreated: () => void
}

function defaultForm(lotes: LoteFinanzas[], loteInicial?: string | null, costo?: CostoGenerico | null) {
  return {
    lote_id: costo?.lote_id ?? loteInicial ?? lotes[0]?.id ?? '',
    fecha: costo?.fecha ?? hoyLocal(),
    categoria: costo?.categoria ?? '',
    descripcion: costo?.descripcion ?? '',
    monto: costo ? String(costo.monto) : '',
    proveedor: costo?.proveedor ?? '',
    observaciones: costo?.observaciones ?? '',
  }
}

/** Costo de la finca: siempre se carga a un galpón o corral, de cualquier especie. */
export default function RegistrarCostoFincaModal({ open, onClose, fincaId, lotes, loteInicial, costoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(lotes, loteInicial, costoExistente))

  useEffect(() => {
    if (open) setForm(defaultForm(lotes, loteInicial, costoExistente))
  }, [open, lotes, loteInicial, costoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const lote = lotes.find(l => l.id === form.lote_id) ?? null
  const config = CONFIG_ESPECIES[lote?.especie ?? costoExistente?.especie ?? 'aves_ponedoras']
  const categorias = categoriasCosto(config.categoriaCria)
  const nombreLote = (l: LoteFinanzas) => `${l.nombre} · ${CONFIG_ESPECIES[l.especie].label}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lote) { toast.error('Elige a qué galpón o corral va el costo'); return }
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
      lote_id: lote.id,
    }
    let error
    if (costoExistente && costoExistente.especie === lote.especie) {
      ({ error } = await db.from(config.tablas.costos).update(payload).eq('id', costoExistente.id))
    } else {
      // Nuevo, o se movió a un lote de otra especie: vive en otra tabla
      ({ error } = await db.from(config.tablas.costos).insert({ ...payload, finca_id: fincaId }))
      if (!error && costoExistente) {
        await db.from(CONFIG_ESPECIES[costoExistente.especie].tablas.costos).delete().eq('id', costoExistente.id)
      }
    }
    setLoading(false)
    if (error) { toast.error(costoExistente ? 'Error al actualizar el costo' : 'Error al registrar el costo'); return }
    toast.success(costoExistente ? 'Costo actualizado' : 'Costo registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{costoExistente ? 'Editar costo' : 'Registrar costo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Galpón o corral *</Label>
              <Select
                value={form.lote_id}
                onValueChange={v => set('lote_id', v)}
                items={Object.fromEntries(lotes.map(l => [l.id, nombreLote(l)]))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {lotes.map(l => <SelectItem key={l.id} value={l.id}>{nombreLote(l)}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : costoExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
