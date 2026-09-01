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

type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  avesActuales: number
  estadoLote?: string
  registroExistente?: ProduccionDiaria | null
  onCreated: () => void
}

const CAUSAS_MUERTE = [
  'Marek', 'Newcastle', 'Bronquitis', 'Gumboro', 'Laringotraqueitis',
  'Coccidiosis', 'Micoplasmosis', 'Accidente', 'Estrés calórico', 'Otra'
]

const CAUSAS_SIN_FARMACO = new Set(['Accidente', 'Estrés calórico'])

const CAUSA_A_TIPO_EVENTO: Record<string, string> = {
  'Marek': 'nervioso',
  'Newcastle': 'respiratorio',
  'Bronquitis': 'respiratorio',
  'Gumboro': 'digestivo',
  'Laringotraqueitis': 'respiratorio',
  'Coccidiosis': 'digestivo',
  'Micoplasmosis': 'respiratorio',
  'Accidente': 'otro',
  'Estrés calórico': 'otro',
  'Otra': 'otro',
}

const TIPOS_EVENTO_CLINICO = [
  { value: 'respiratorio', label: '🫁 Respiratorio' },
  { value: 'locomotor', label: '🦴 Locomotor' },
  { value: 'digestivo', label: '🫃 Digestivo' },
  { value: 'reproductivo', label: '🥚 Reproductivo' },
  { value: 'nervioso', label: '🧠 Nervioso' },
  { value: 'piel', label: '🐾 Piel / Plumas' },
  { value: 'otro', label: '❓ Otro' },
]

function defaultForm(avesActuales: number, r?: ProduccionDiaria | null) {
  return {
    fecha: r?.fecha ?? new Date().toISOString().split('T')[0],
    aves_en_dia: r ? String(r.aves_en_dia ?? '') : String(avesActuales),
    huevos_b: r ? String(r.huevos_b) : '',
    huevos_a: r ? String(r.huevos_a) : '',
    huevos_aa: r ? String(r.huevos_aa) : '',
    huevos_aaa: r ? String(r.huevos_aaa) : '',
    huevos_jumbo: r ? String(r.huevos_jumbo) : '',
    huevos_rotos: r ? String(r.huevos_rotos) : '0',
    huevos_sucios: r ? String(r.huevos_sucios) : '0',
    huevos_deformes: r ? String(r.huevos_deformes) : '0',
    muertes: r ? String(r.muertes) : '0',
    causa_muerte: r?.causa_muerte ?? '',
    observaciones: r?.observaciones ?? '',
    evento_tipo: '',
    evento_descripcion: '',
    evento_accion: '',
  }
}

export default function RegistrarProduccionModal({ open, onClose, loteId, fincaId, avesActuales, estadoLote, registroExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(avesActuales, registroExistente))
  const enPreparacion = estadoLote === 'preparacion'

  useEffect(() => {
    if (open) setForm(defaultForm(avesActuales, registroExistente))
  }, [open, avesActuales, registroExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const totalHuevos = (Number(form.huevos_b) || 0) + (Number(form.huevos_a) || 0) + (Number(form.huevos_aa) || 0) + (Number(form.huevos_aaa) || 0) + (Number(form.huevos_jumbo) || 0)

  const postura = form.aves_en_dia && totalHuevos > 0 && Number(form.aves_en_dia) > 0
    ? ((totalHuevos / Number(form.aves_en_dia)) * 100).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const defectuosos = (Number(form.huevos_rotos) || 0) + (Number(form.huevos_sucios) || 0) + (Number(form.huevos_deformes) || 0)
    if (!enPreparacion && defectuosos > totalHuevos) {
      toast.error('Rotos + sucios + deformes no puede superar el total de huevos puestos')
      return
    }

    setLoading(true)
    const { data: existing } = await supabase
      .from('produccion_diaria_aves')
      .select('id, muertes, causa_muerte')
      .eq('lote_id', loteId)
      .eq('fecha', form.fecha)
      .maybeSingle()

    const payload = {
      lote_id: loteId,
      finca_id: fincaId,
      fecha: form.fecha,
      huevos_totales: enPreparacion ? 0 : totalHuevos,
      huevos_b: enPreparacion ? 0 : Number(form.huevos_b) || 0,
      huevos_a: enPreparacion ? 0 : Number(form.huevos_a) || 0,
      huevos_aa: enPreparacion ? 0 : Number(form.huevos_aa) || 0,
      huevos_aaa: enPreparacion ? 0 : Number(form.huevos_aaa) || 0,
      huevos_jumbo: enPreparacion ? 0 : Number(form.huevos_jumbo) || 0,
      huevos_rotos: enPreparacion ? 0 : Number(form.huevos_rotos) || 0,
      huevos_sucios: enPreparacion ? 0 : Number(form.huevos_sucios) || 0,
      huevos_deformes: enPreparacion ? 0 : Number(form.huevos_deformes) || 0,
      aves_en_dia: enPreparacion ? null : Number(form.aves_en_dia) || null,
      muertes: Number(form.muertes) || 0,
      causa_muerte: Number(form.muertes) > 0 ? (form.causa_muerte || null) : null,
      observaciones: form.observaciones || null,
    }

    let error
    if (existing) {
      const res = await supabase.from('produccion_diaria_aves').update(payload).eq('id', existing.id)
      error = res.error
    } else {
      const res = await supabase.from('produccion_diaria_aves').insert(payload)
      error = res.error
    }

    const muertesDelta = (Number(form.muertes) || 0) - (existing?.muertes ?? 0)
    if (!error && muertesDelta !== 0) {
      await supabase
        .from('lotes_aves')
        .update({ aves_actuales: Math.max(0, avesActuales - muertesDelta) })
        .eq('id', loteId)
    }

    const causaNueva = Number(form.muertes) > 0 && form.causa_muerte && form.causa_muerte !== (existing?.causa_muerte ?? '')
    if (!error && causaNueva) {
      await supabase.from('eventos_clinicos_aves').insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha,
        tipo_evento: CAUSA_A_TIPO_EVENTO[form.causa_muerte] ?? 'otro',
        descripcion: `Mortalidad reportada: ${form.causa_muerte}`,
        aves_muertas: Number(form.muertes),
        requiere_medicamento: !CAUSAS_SIN_FARMACO.has(form.causa_muerte),
      })
      toast.warning(`⚠️ ¡Cuidado! Muertes por ${form.causa_muerte}`)
    }

    if (!error && form.evento_descripcion.trim()) {
      await supabase.from('eventos_clinicos_aves').insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha,
        tipo_evento: form.evento_tipo || 'otro',
        descripcion: form.evento_descripcion.trim(),
        accion_tomada: form.evento_accion || null,
      })
    }

    setLoading(false)
    if (error) { toast.error('Error al guardar el registro'); return }
    toast.success(existing ? 'Registro actualizado' : 'Producción registrada')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{registroExistente ? '✏️ Editar Registro del Día' : enPreparacion ? '📋 Registrar Día (preparación)' : '🥚 Registrar Producción Diaria'}</DialogTitle>
          {enPreparacion && (
            <p className="text-sm text-blue-600">El lote sigue en preparación — aún no se registran huevos. Usa &quot;Marcar inicio de postura&quot; cuando comience.</p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={enPreparacion ? '' : 'grid grid-cols-2 gap-4'}>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            {!enPreparacion && (
              <div className="space-y-1">
                <Label>Aves en producción</Label>
                <Input type="number" min="0" value={form.aves_en_dia} onChange={e => set('aves_en_dia', e.target.value)} />
              </div>
            )}
          </div>

          {!enPreparacion && (
          <>
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-yellow-700">Huevos puestos por tamaño</p>
              {postura && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${Number(postura) >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  Postura: {postura}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">B</Label>
                <Input type="number" min="0" placeholder="0" value={form.huevos_b} onChange={e => set('huevos_b', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">A</Label>
                <Input type="number" min="0" placeholder="0" value={form.huevos_a} onChange={e => set('huevos_a', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">AA</Label>
                <Input type="number" min="0" placeholder="0" value={form.huevos_aa} onChange={e => set('huevos_aa', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">AAA</Label>
                <Input type="number" min="0" placeholder="0" value={form.huevos_aaa} onChange={e => set('huevos_aaa', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">JUMBO</Label>
                <Input type="number" min="0" placeholder="0" value={form.huevos_jumbo} onChange={e => set('huevos_jumbo', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-yellow-700">Total del día: <span className="font-semibold">{totalHuevos.toLocaleString('es-CO')}</span></p>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs font-semibold text-amber-700 mb-2">Calidad del huevo</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Rotos</Label>
                <Input type="number" min="0" value={form.huevos_rotos} onChange={e => set('huevos_rotos', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sucios</Label>
                <Input type="number" min="0" value={form.huevos_sucios} onChange={e => set('huevos_sucios', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deformes</Label>
                <Input type="number" min="0" value={form.huevos_deformes} onChange={e => set('huevos_deformes', e.target.value)} />
              </div>
            </div>
          </div>
          </>
          )}

          <div className="space-y-1">
            <Label>Muertes</Label>
            <Input type="number" min="0" value={form.muertes} onChange={e => set('muertes', e.target.value)} />
          </div>

          {Number(form.muertes) > 0 && (
            <div className="space-y-1">
              <Label>Causa probable de muerte</Label>
              <Select value={form.causa_muerte} onValueChange={v => set('causa_muerte', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar causa..." /></SelectTrigger>
                <SelectContent>
                  {CAUSAS_MUERTE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-2">
            <p className="text-xs font-semibold text-red-700">🩺 Evento clínico (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.evento_tipo} onValueChange={v => set('evento_tipo', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_EVENTO_CLINICO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Acción tomada</Label>
                <Input placeholder="Ej: Se aisló el lote..." value={form.evento_accion} onChange={e => set('evento_accion', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input placeholder="Ej: Se observaron aves con letargo..." value={form.evento_descripcion} onChange={e => set('evento_descripcion', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas del día..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
