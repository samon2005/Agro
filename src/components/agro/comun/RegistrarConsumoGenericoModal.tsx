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
import { hoyLocal } from '@/lib/fechas'
import { Ic } from '@/components/ui/icon'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  config: ConfigEspecie
  tiposAlimento: TipoAlimentoGenerico[]
  /** Etapa en la que va el lote: el alimento debe ser el de esa etapa */
  etapaLote?: string | null
  onCreated: () => void
}

function defaultForm() {
  return {
    fecha: hoyLocal(),
    tipo_alimento_id: '',
    alimento_kg: '',
  }
}

export default function RegistrarConsumoGenericoModal({ open, onClose, loteId, fincaId, config, tiposAlimento, etapaLote, onCreated }: Props) {
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

  // Cada etapa come lo suyo: el alimento de la etapa del lote va primero y el
  // resto queda debajo, avisando que no corresponde.
  const etiquetaEtapa = (etapa: string | null | undefined) =>
    config.nutricion.categoriasAlimento.find(c => c.value === etapa)?.label ?? etapa ?? ''
  const deLaEtapa = etapaLote ? tiposAlimento.filter(t => t.tipo_alimento_categoria === etapaLote) : tiposAlimento
  const deOtraEtapa = etapaLote ? tiposAlimento.filter(t => t.tipo_alimento_categoria !== etapaLote) : []
  const elegido = tiposAlimento.find(t => t.id === form.tipo_alimento_id) ?? null
  const noCorresponde = Boolean(
    etapaLote && elegido && elegido.tipo_alimento_categoria && elegido.tipo_alimento_categoria !== etapaLote,
  )
  const items = Object.fromEntries(tiposAlimento.map(t => [t.id, t.nombre]))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle><Ic n="alimento" /> Registrar Consumo de Alimento</DialogTitle>
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
              <SelectContent alignItemWithTrigger={false} className="max-h-72">
                {deLaEtapa.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                {deOtraEtapa.length > 0 && (
                  <div className="px-2 pt-2 pb-1 text-[0.6875rem] text-gray-400">De otras etapas</div>
                )}
                {deOtraEtapa.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}{t.tipo_alimento_categoria ? ` · ${etiquetaEtapa(t.tipo_alimento_categoria)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {etapaLote && (
              <p className="text-xs text-gray-500">
                El lote va en <strong>{etiquetaEtapa(etapaLote)}</strong>: cada etapa lleva su propio alimento.
              </p>
            )}
            {noCorresponde && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Ic n="alerta" /> Ese alimento es de {etiquetaEtapa(elegido?.tipo_alimento_categoria)} y el lote va en {etiquetaEtapa(etapaLote)}.
                Puedes registrarlo, pero revisa que sea lo que realmente están comiendo.
              </p>
            )}
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
