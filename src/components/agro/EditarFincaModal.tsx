'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Finca = {
  id: string
  altitud_msnm: number | null
  velocidad_viento_kmh: number | null
  clima_predominante: string | null
  temperatura_promedio_ext: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  finca: Finca
  onUpdated: () => void
}

const CLIMAS = [
  { value: 'calido', label: 'Cálido (0–1.000 msnm)' },
  { value: 'templado', label: 'Templado (1.000–2.000 msnm)' },
  { value: 'frio', label: 'Frío (2.000–3.000 msnm)' },
  { value: 'paramo', label: 'Páramo (> 3.000 msnm)' },
]

export default function EditarFincaModal({ open, onClose, finca, onUpdated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    altitud_msnm: '',
    velocidad_viento_kmh: '',
    clima_predominante: '',
    temperatura_promedio_ext: '',
  })

  useEffect(() => {
    setForm({
      altitud_msnm: finca.altitud_msnm != null ? String(finca.altitud_msnm) : '',
      velocidad_viento_kmh: finca.velocidad_viento_kmh != null ? String(finca.velocidad_viento_kmh) : '',
      clima_predominante: finca.clima_predominante ?? '',
      temperatura_promedio_ext: finca.temperatura_promedio_ext != null ? String(finca.temperatura_promedio_ext) : '',
    })
  }, [finca, open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase
      .from('fincas')
      .update({
        altitud_msnm: form.altitud_msnm ? Number(form.altitud_msnm) : null,
        velocidad_viento_kmh: form.velocidad_viento_kmh ? Number(form.velocidad_viento_kmh) : null,
        clima_predominante: form.clima_predominante || null,
        temperatura_promedio_ext: form.temperatura_promedio_ext ? Number(form.temperatura_promedio_ext) : null,
      })
      .eq('id', finca.id)

    setLoading(false)
    if (error) { toast.error('Error al guardar los datos de la finca'); return }
    toast.success('Datos geográficos actualizados')
    onUpdated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>📍 Información Geográfica y Ambiental</DialogTitle>
          <p className="text-sm text-gray-500">Datos de referencia de la finca — se usan para contextualizar las lecturas de cada galpón/corral</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Altitud (msnm)</Label>
              <Input type="number" min="0" step="1" placeholder="Ej: 1650" value={form.altitud_msnm} onChange={e => set('altitud_msnm', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Velocidad del viento (km/h)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 8.5" value={form.velocidad_viento_kmh} onChange={e => set('velocidad_viento_kmh', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Clima predominante</Label>
              <Select value={form.clima_predominante} onValueChange={v => set('clima_predominante', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {CLIMAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Temperatura ambiente promedio (°C)</Label>
              <Input type="number" step="0.1" placeholder="Ej: 24.0" value={form.temperatura_promedio_ext} onChange={e => set('temperatura_promedio_ext', e.target.value)} />
            </div>
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
