'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dbGenerico, type ConfigEspecie } from '@/lib/especiesConfig'
import type { TipoAlimentoGenerico } from './CrearTipoAlimentoGenericoModal'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  config: ConfigEspecie
  tiposAlimento: TipoAlimentoGenerico[]
  onCreated: () => void
}

function defaultForm() {
  return {
    fecha: new Date().toISOString().split('T')[0],
    tipo_alimento_id: '',
    alimento_kg: '',
  }
}

export default function RegistrarConsumoGenericoModal({ open, onClose, loteId, fincaId, config, tiposAlimento, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => { if (open) setForm(defaultForm()) }, [open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo_alimento_id) { toast.error('Selecciona el tipo de alimento'); return }
    if (!form.alimento_kg || Number(form.alimento_kg) <= 0) { toast.error('Ingresa los kilos consumidos'); return }

    setLoading(true)
    const db = dbGenerico(supabase)
    const { data: existente } = await db.from(config.tablas.registroDiario)
      .select('id').eq('lote_id', loteId).eq('fecha', form.fecha).maybeSingle()

    const payload = {
      alimento_kg: Number(form.alimento_kg),
      tipo_alimento_id: form.tipo_alimento_id,
    }
    const { error } = existente
      ? await db.from(config.tablas.registroDiario).update(payload).eq('id', existente.id)
      : await db.from(config.tablas.registroDiario).insert({ ...payload, lote_id: loteId, finca_id: fincaId, fecha: form.fecha })

    // El alimento activo del lote es lo que alimenta el balance nutricional del día
    if (!error) {
      await db.from(config.tablas.lotes).update({
        alimento_activo_id: form.tipo_alimento_id,
        consumo_activo_kg: Number(form.alimento_kg),
      }).eq('id', loteId)
    }

    setLoading(false)
    if (error) { toast.error('Error al registrar el consumo'); return }
    toast.success('Consumo registrado')
    onCreated()
    onClose()
  }

  const items = Object.fromEntries(tiposAlimento.map(t => [t.id, t.nombre]))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🌾 Registrar Consumo de Alimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Tipo de alimento *</Label>
            <Select value={form.tipo_alimento_id} onValueChange={v => set('tipo_alimento_id', v)} items={items}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {tiposAlimento.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            {tiposAlimento.length === 0 && (
              <p className="text-xs text-amber-600">Primero registra un tipo de alimento en la pestaña Alimento.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Kilos consumidos *</Label>
            <Input type="number" min="0" step="0.1" placeholder="Ej: 120" value={form.alimento_kg} onChange={e => set('alimento_kg', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className={config.botonClase}>
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
