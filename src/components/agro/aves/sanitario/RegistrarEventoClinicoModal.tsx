'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toSelectItems } from '@/lib/utils'
import EncargadoSelect from '@/components/agro/EncargadoSelect'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type EventoClinico = Database['public']['Tables']['eventos_clinicos_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  eventoExistente?: EventoClinico | null
  onCreated: (eventoId: string) => void
}

const TIPOS = [
  { value: 'respiratorio', label: '🫁 Respiratorio' },
  { value: 'locomotor', label: '🦴 Locomotor' },
  { value: 'digestivo', label: '🫃 Digestivo' },
  { value: 'reproductivo', label: '🥚 Reproductivo' },
  { value: 'nervioso', label: '🧠 Nervioso' },
  { value: 'piel', label: '🐾 Piel / Plumas' },
  { value: 'otro', label: '❓ Otro' },
]

function defaultForm(evento?: EventoClinico | null) {
  return {
    fecha: evento?.fecha ?? hoyLocal(),
    tipo_evento: evento?.tipo_evento ?? '',
    descripcion: evento?.descripcion ?? '',
    aves_afectadas: evento?.aves_afectadas != null ? String(evento.aves_afectadas) : '',
    aves_muertas: evento?.aves_muertas != null ? String(evento.aves_muertas) : '0',
    accion_tomada: evento?.accion_tomada ?? '',
    encargado: evento?.veterinario ?? '',
    observaciones: evento?.observaciones ?? '',
    requiere_medicamento: evento ? evento.requiere_medicamento : true,
  }
}

export default function RegistrarEventoClinicoModal({ open, onClose, loteId, fincaId, eventoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(eventoExistente))

  useEffect(() => { if (open) setForm(defaultForm(eventoExistente)) }, [open, eventoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo_evento) { toast.error('Selecciona el tipo de evento'); return }
    if (!form.descripcion.trim()) { toast.error('Describe el evento clínico'); return }

    setLoading(true)
    const payload = {
      fecha: form.fecha,
      tipo_evento: form.tipo_evento,
      descripcion: form.descripcion.trim(),
      aves_afectadas: form.aves_afectadas ? Number(form.aves_afectadas) : null,
      aves_muertas: Number(form.aves_muertas) || 0,
      accion_tomada: form.accion_tomada || null,
      veterinario: form.encargado || null,
      observaciones: form.observaciones || null,
      requiere_medicamento: form.requiere_medicamento,
    }
    const { data, error } = eventoExistente
      ? await supabase.from('eventos_clinicos_aves').update(payload).eq('id', eventoExistente.id).select('id').single()
      : await supabase.from('eventos_clinicos_aves').insert({ ...payload, lote_id: loteId, finca_id: fincaId }).select('id').single()
    setLoading(false)
    if (error || !data) { toast.error(eventoExistente ? 'Error al actualizar evento' : 'Error al registrar evento'); return }
    toast.success(eventoExistente ? 'Evento actualizado' : 'Evento clínico registrado')
    onCreated(data.id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{eventoExistente ? '✏️ Editar Evento Clínico' : '🏥 Registrar Evento Clínico'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo de signo *</Label>
              <Select value={form.tipo_evento} onValueChange={v => set('tipo_evento', v)} items={toSelectItems(TIPOS)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Descripción de signos clínicos *</Label>
              <Input placeholder="Describe los síntomas observados..." value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Aves afectadas</Label>
              <Input type="number" min="0" value={form.aves_afectadas} onChange={e => set('aves_afectadas', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Aves muertas</Label>
              <Input type="number" min="0" value={form.aves_muertas} onChange={e => set('aves_muertas', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Acción tomada</Label>
              <Input placeholder="Tratamiento o manejo aplicado" value={form.accion_tomada} onChange={e => set('accion_tomada', e.target.value)} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="requiere_medicamento"
                checked={form.requiere_medicamento}
                onChange={e => setForm(prev => ({ ...prev, requiere_medicamento: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="requiere_medicamento" className="text-sm font-normal">
                Requiere medicamento (desmárcalo para causas como estrés calórico o accidentes)
              </Label>
            </div>
            <div className="space-y-1">
              <Label>Encargado</Label>
              <EncargadoSelect fincaId={fincaId} value={form.encargado} onChange={v => set('encargado', v)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : eventoExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
