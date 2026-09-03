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

type TipoAlimento = Database['public']['Tables']['tipos_alimento_aves']['Row']
type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']
type Requerimientos = Database['public']['Tables']['requerimientos_nutricionales_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  tiposAlimento: TipoAlimento[]
  /** Consumo que se está editando; si no viene, se registra uno nuevo */
  consumoExistente?: ProduccionDiaria | null
  /** Requerimientos vigentes del lote, para mostrar lo que pide la postura */
  requerimientos?: Requerimientos | null
  /** El lote ya está poniendo huevos */
  enPostura?: boolean
  /** Aves del lote, para calcular el requerimiento del galpón completo */
  avesActuales?: number
  /** % de postura del último día registrado, para el requerimiento de producción */
  posturaFraccion?: number
  onCreated: () => void
}

function defaultForm(c?: ProduccionDiaria | null) {
  return {
    fecha: c?.fecha ?? hoyLocal(),
    tipo_alimento_id: c?.tipo_alimento_id ?? '',
    alimento_kg: c ? String(c.alimento_kg) : '',
  }
}

export default function RegistrarConsumoAlimentoModal({
  open, onClose, loteId, fincaId, tiposAlimento, consumoExistente,
  requerimientos, enPostura, avesActuales = 0, posturaFraccion = 0, onCreated,
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(consumoExistente))

  useEffect(() => { if (open) setForm(defaultForm(consumoExistente)) }, [open, consumoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo_alimento_id) { toast.error('Selecciona el alimento consumido'); return }
    if (!form.alimento_kg || Number(form.alimento_kg) <= 0) { toast.error('Ingresa el consumo en kg'); return }

    setLoading(true)
    const { data: existing } = await supabase
      .from('produccion_diaria_aves')
      .select('id')
      .eq('lote_id', loteId)
      .eq('fecha', form.fecha)
      .maybeSingle()

    const payload = {
      alimento_kg: Number(form.alimento_kg),
      tipo_alimento_id: form.tipo_alimento_id,
    }

    const { error } = existing
      ? await supabase.from('produccion_diaria_aves').update(payload).eq('id', existing.id)
      : await supabase.from('produccion_diaria_aves').insert({ ...payload, lote_id: loteId, finca_id: fincaId, fecha: form.fecha })

    // Este consumo queda como el activo del galpón: rige hasta que se registre otro,
    // y es el que limita cuántos kg se pueden repartir en los horarios.
    if (!error) {
      await supabase.from('lotes_aves').update({
        alimento_activo_id: form.tipo_alimento_id,
        consumo_activo_kg: Number(form.alimento_kg),
      }).eq('id', loteId)
    }

    setLoading(false)
    if (error) { toast.error('Error al registrar el consumo'); return }
    toast.success(consumoExistente ? 'Consumo actualizado' : 'Consumo de alimento registrado')
    onCreated()
    onClose()
  }

  // Lo que el lote necesita hoy: mantenimiento por ave + producción según el % de postura
  const requerimientoProduccion = requerimientos && enPostura
    ? [
        { label: 'Proteína', mant: requerimientos.mant_proteina_g, prod: requerimientos.prod_proteina_g },
        { label: 'Calcio', mant: requerimientos.mant_calcio_g, prod: requerimientos.prod_calcio_g },
        { label: 'Fósforo', mant: requerimientos.mant_fosforo_g, prod: requerimientos.prod_fosforo_g },
        { label: 'Grasa', mant: requerimientos.mant_grasa_g, prod: requerimientos.prod_grasa_g },
      ].map(n => ({ ...n, total: Number(n.mant) + Number(n.prod) * posturaFraccion }))
    : null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{consumoExistente ? '✏️ Editar Consumo de Alimento' : '🌾 Registrar Consumo de Alimento'}</DialogTitle>
          <p className="text-sm text-gray-500">
            Este consumo queda fijo para el galpón hasta que registres uno nuevo. No hay que registrarlo todos los días.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Alimento *</Label>
            <Select
              value={form.tipo_alimento_id}
              onValueChange={v => set('tipo_alimento_id', v)}
              items={Object.fromEntries(tiposAlimento.map(t => [t.id, t.nombre]))}
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {tiposAlimento.length === 0
                  ? <div className="px-2 py-1.5 text-xs text-gray-400">Créalo primero en la pestaña Alimento</div>
                  : tiposAlimento.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Consumo del día (kg) *</Label>
            <Input type="number" min="0" step="0.1" placeholder="0.0" value={form.alimento_kg} onChange={e => set('alimento_kg', e.target.value)} />
            <p className="text-xs text-gray-400">
              Es el total del galpón por día. En Horarios de alimentación decides cómo se raciona.
            </p>
          </div>

          {requerimientoProduccion && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-1.5">
              <p className="text-xs font-semibold text-purple-800">🥚 Requerimiento con postura</p>
              <p className="text-xs text-purple-600">
                Lo que necesita cada ave hoy: mantenimiento más lo que pide poner huevo
                {posturaFraccion > 0 ? ` (postura al ${(posturaFraccion * 100).toFixed(0)}%)` : ''}.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                {requerimientoProduccion.map(n => (
                  <div key={n.label} className="flex items-center justify-between text-xs">
                    <span className="text-purple-700">{n.label}</span>
                    <span className="font-semibold text-purple-900">{n.total.toFixed(2)} g/ave</span>
                  </div>
                ))}
              </div>
              {avesActuales > 0 && (
                <p className="text-xs text-purple-500 pt-1">
                  Para las {avesActuales.toLocaleString('es-CO')} aves del galpón.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : consumoExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
