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

type TipoAlimento = Database['public']['Tables']['tipos_alimento_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  avesActuales: number
  onCreated: () => void
}

const CAUSAS_MUERTE = [
  'Marek', 'Newcastle', 'Bronquitis', 'Gumboro', 'Laringotraqueitis',
  'Coccidiosis', 'Micoplasmosis', 'Accidente', 'Estrés calórico', 'Otra'
]

export default function RegistrarProduccionModal({ open, onClose, loteId, fincaId, avesActuales, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [tiposAlimento, setTiposAlimento] = useState<TipoAlimento[]>([])
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    aves_en_dia: String(avesActuales),
    huevos_totales: '',
    huevos_rotos: '0',
    huevos_sucios: '0',
    huevos_deformes: '0',
    alimento_kg: '',
    tipo_alimento_id: '',
    muertes: '0',
    causa_muerte: '',
    observaciones: '',
  })

  useEffect(() => {
    setForm(prev => ({ ...prev, aves_en_dia: String(avesActuales) }))
  }, [avesActuales])

  useEffect(() => {
    if (!open) return
    supabase.from('tipos_alimento_aves').select('*').eq('finca_id', fincaId).eq('activo', true).order('nombre')
      .then(({ data }) => setTiposAlimento(data ?? []))
  }, [open, fincaId, supabase])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const postura = form.aves_en_dia && form.huevos_totales && Number(form.aves_en_dia) > 0
    ? ((Number(form.huevos_totales) / Number(form.aves_en_dia)) * 100).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.huevos_totales) { toast.error('Ingresa los huevos producidos'); return }

    setLoading(true)
    const { data: existing } = await supabase
      .from('produccion_diaria_aves')
      .select('id')
      .eq('lote_id', loteId)
      .eq('fecha', form.fecha)
      .maybeSingle()

    const payload = {
      lote_id: loteId,
      finca_id: fincaId,
      fecha: form.fecha,
      huevos_totales: Number(form.huevos_totales),
      huevos_rotos: Number(form.huevos_rotos) || 0,
      huevos_sucios: Number(form.huevos_sucios) || 0,
      huevos_deformes: Number(form.huevos_deformes) || 0,
      aves_en_dia: Number(form.aves_en_dia) || null,
      alimento_kg: Number(form.alimento_kg) || 0,
      tipo_alimento_id: form.tipo_alimento_id || null,
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

    if (!error && Number(form.muertes) > 0) {
      await supabase
        .from('lotes_aves')
        .update({ aves_actuales: Math.max(0, avesActuales - Number(form.muertes)) })
        .eq('id', loteId)
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
          <DialogTitle>🥚 Registrar Producción Diaria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Aves en producción</Label>
              <Input type="number" min="0" value={form.aves_en_dia} onChange={e => set('aves_en_dia', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <Label>Huevos producidos *</Label>
                {postura && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${Number(postura) >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    Postura: {postura}%
                  </span>
                )}
              </div>
              <Input type="number" min="0" placeholder="Total de huevos" value={form.huevos_totales} onChange={e => set('huevos_totales', e.target.value)} />
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Alimento consumido (kg)</Label>
              <Input type="number" min="0" step="0.1" placeholder="0.0" value={form.alimento_kg} onChange={e => set('alimento_kg', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo de alimento</Label>
              <Select value={form.tipo_alimento_id} onValueChange={v => set('tipo_alimento_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {tiposAlimento.length === 0
                    ? <div className="px-2 py-1.5 text-xs text-gray-400">Regístralos en Alimento</div>
                    : tiposAlimento.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Muertes</Label>
              <Input type="number" min="0" value={form.muertes} onChange={e => set('muertes', e.target.value)} />
            </div>
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
