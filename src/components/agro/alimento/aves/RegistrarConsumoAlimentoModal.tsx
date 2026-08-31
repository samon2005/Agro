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
  tiposAlimento: TipoAlimento[]
  onCreated: () => void
}

function defaultForm() {
  return {
    fecha: new Date().toISOString().split('T')[0],
    tipo_alimento_id: '',
    alimento_kg: '',
  }
}

export default function RegistrarConsumoAlimentoModal({ open, onClose, loteId, fincaId, tiposAlimento, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => { if (open) setForm(defaultForm()) }, [open])

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

    setLoading(false)
    if (error) { toast.error('Error al registrar el consumo'); return }
    toast.success('Consumo de alimento registrado')
    onCreated()
    onClose()
  }

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
            <Label>Alimento *</Label>
            <Select value={form.tipo_alimento_id} onValueChange={v => set('tipo_alimento_id', v)}>
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
