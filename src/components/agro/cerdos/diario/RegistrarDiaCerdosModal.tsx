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
import { CAUSAS_MUERTE_CERDOS } from '@/lib/cerdos'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type NutricionDiaria = Database['public']['Tables']['nutricion_diaria_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  /** Registro del día que se está editando; si no viene, se registra uno nuevo */
  registroExistente?: NutricionDiaria | null
  onCreated: () => void
}

const AGREGAR_CAUSA = '__agregar_causa__'

function defaultForm(lote: LoteCerdos, r?: NutricionDiaria | null) {
  const consumoSugerido = lote.consumo_activo_kg != null
    ? String(lote.consumo_activo_kg)
    : lote.consumo_estimado_kg_dia != null
      ? String(Number(lote.consumo_estimado_kg_dia) * lote.animales_actuales)
      : ''
  return {
    fecha: r?.fecha ?? hoyLocal(),
    alimento_kg: r ? String(r.alimento_kg) : consumoSugerido,
    agua_litros: r?.agua_litros != null ? String(r.agua_litros) : '',
    observaciones: r?.observaciones ?? '',
    // La mortalidad del día se registra aquí: conteo, causa y peso
    muertes: '0',
    causa_muerte: '',
    peso_muerte: '',
  }
}

export default function RegistrarDiaCerdosModal({ open, onClose, lote, registroExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(lote, registroExistente))
  const [causaNueva, setCausaNueva] = useState(false)
  const [causaNuevaTexto, setCausaNuevaTexto] = useState('')

  useEffect(() => {
    if (open) { setForm(defaultForm(lote, registroExistente)); setCausaNueva(false); setCausaNuevaTexto('') }
  }, [open, lote, registroExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const muertes = Number(form.muertes) || 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.alimento_kg || Number(form.alimento_kg) < 0) { toast.error('Ingresa el alimento consumido'); return }
    if (muertes > 0 && !form.causa_muerte) { toast.error('Indica la causa de la muerte'); return }

    setLoading(true)
    const { data: existing } = await supabase
      .from('nutricion_diaria_cerdos')
      .select('id')
      .eq('lote_id', lote.id)
      .eq('fecha', form.fecha)
      .maybeSingle()

    const payload = {
      fecha: form.fecha,
      alimento_kg: Number(form.alimento_kg) || 0,
      tipo_alimento_id: lote.alimento_activo_id,
      agua_litros: form.agua_litros ? Number(form.agua_litros) : null,
      observaciones: form.observaciones || null,
    }

    const { error } = existing
      ? await supabase.from('nutricion_diaria_cerdos').update(payload).eq('id', existing.id)
      : await supabase.from('nutricion_diaria_cerdos').insert({ ...payload, lote_id: lote.id, finca_id: lote.finca_id })

    // La mortalidad del día va a su propia tabla: conteo, causa y peso
    if (!error && muertes > 0) {
      const { error: errMort } = await supabase.from('mortalidad_cerdos').insert({
        lote_id: lote.id,
        finca_id: lote.finca_id,
        fecha: form.fecha,
        cantidad: muertes,
        causa: form.causa_muerte || null,
        peso_estimado: form.peso_muerte ? Number(form.peso_muerte) : null,
      })
      if (errMort) {
        toast.error('El día se guardó, pero la mortalidad no')
      } else {
        await supabase.from('lotes_cerdos')
          .update({ animales_actuales: Math.max(0, lote.animales_actuales - muertes) })
          .eq('id', lote.id)
        toast.warning(`⚠️ ${muertes} ${muertes === 1 ? 'muerte registrada' : 'muertes registradas'} por ${form.causa_muerte}`)
      }
    }

    setLoading(false)
    if (error) { toast.error('Error al guardar el registro del día'); return }
    toast.success(existing ? 'Registro del día actualizado' : 'Día registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{registroExistente ? '✏️ Editar Registro del Día' : '📋 Registrar Día'}</DialogTitle>
          <p className="text-sm text-gray-500">Lo que se anota todos los días del lote: alimento, agua y mortalidad.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Agua (litros)</Label>
              <Input type="number" min="0" step="0.1" placeholder="0" value={form.agua_litros} onChange={e => set('agua_litros', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Alimento consumido (kg) *</Label>
              <Input type="number" min="0" step="0.1" value={form.alimento_kg} onChange={e => set('alimento_kg', e.target.value)} />
              <p className="text-xs text-gray-400">
                Es el total del lote en el día. Viene sugerido del consumo configurado del lote.
              </p>
            </div>
          </div>

          <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-3">
            <p className="text-xs font-semibold text-red-700">💀 Mortalidad del día</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <Input type="number" min="0" className="bg-white" value={form.muertes} onChange={e => set('muertes', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Peso de la muerte (kg)</Label>
                <Input
                  type="number" min="0" step="0.1" className="bg-white" placeholder="0"
                  value={form.peso_muerte} onChange={e => set('peso_muerte', e.target.value)}
                  disabled={muertes === 0}
                />
              </div>
              {muertes > 0 && (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Causa *</Label>
                  <Select
                    value={form.causa_muerte}
                    onValueChange={v => { if (v === AGREGAR_CAUSA) setCausaNueva(true); else set('causa_muerte', v) }}
                    items={{ ...Object.fromEntries(CAUSAS_MUERTE_CERDOS.map(c => [c, c])), [AGREGAR_CAUSA]: '+ Añadir causa...' }}
                  >
                    <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Seleccionar causa..." /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} className="max-h-64">
                      {CAUSAS_MUERTE_CERDOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      <SelectItem value={AGREGAR_CAUSA}>+ Añadir causa...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {causaNueva && (
                <div className="col-span-2 flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nueva causa</Label>
                    <Input
                      autoFocus className="bg-white" placeholder="Ej: Golpe de calor"
                      value={causaNuevaTexto} onChange={e => setCausaNuevaTexto(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button" size="sm" className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      const nombre = causaNuevaTexto.trim()
                      if (!nombre) return
                      set('causa_muerte', nombre)
                      setCausaNueva(false)
                      setCausaNuevaTexto('')
                    }}
                  >
                    Usar
                  </Button>
                </div>
              )}
            </div>
            {muertes > 0 && (
              <p className="text-xs text-red-600">
                Se descontarán {muertes} de los {lote.animales_actuales.toLocaleString('es-CO')} animales del lote.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas del día..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
