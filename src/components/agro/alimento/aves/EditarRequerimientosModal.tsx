'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'

type Requerimientos = Database['public']['Tables']['requerimientos_nutricionales_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  actual: Requerimientos | null
  onUpdated: () => void
}

const CAMPOS: { key: keyof typeof DEFAULTS; label: string; grupo: 'Mantenimiento (g/ave/día)' | 'Producción (g/huevo)' }[] = [
  { key: 'mant_proteina_g', label: 'Proteína', grupo: 'Mantenimiento (g/ave/día)' },
  { key: 'mant_grasa_g', label: 'Grasa', grupo: 'Mantenimiento (g/ave/día)' },
  { key: 'mant_calcio_g', label: 'Calcio', grupo: 'Mantenimiento (g/ave/día)' },
  { key: 'mant_fosforo_g', label: 'Fósforo', grupo: 'Mantenimiento (g/ave/día)' },
  { key: 'prod_proteina_g', label: 'Proteína', grupo: 'Producción (g/huevo)' },
  { key: 'prod_grasa_g', label: 'Grasa', grupo: 'Producción (g/huevo)' },
  { key: 'prod_calcio_g', label: 'Calcio', grupo: 'Producción (g/huevo)' },
  { key: 'prod_fosforo_g', label: 'Fósforo', grupo: 'Producción (g/huevo)' },
]

const DEFAULTS = {
  mant_proteina_g: 9, mant_calcio_g: 0.3, mant_fosforo_g: 0.25, mant_grasa_g: 1.5,
  prod_proteina_g: 4.2, prod_calcio_g: 3.8, prod_fosforo_g: 0.45, prod_grasa_g: 1.0,
}

export default function EditarRequerimientosModal({ open, onClose, loteId, fincaId, actual, onUpdated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    const base = actual ?? DEFAULTS
    setForm(Object.fromEntries(CAMPOS.map(c => [c.key, String(base[c.key])])))
  }, [actual, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const valores = Object.fromEntries(CAMPOS.map(c => [c.key, Number(form[c.key] || 0)]))
    const { error } = await supabase.from('requerimientos_nutricionales_aves')
      .upsert({ lote_id: loteId, finca_id: fincaId, ...valores }, { onConflict: 'lote_id' })
    setLoading(false)
    if (error) { toast.error('Error al guardar los requerimientos'); return }
    toast.success('Requerimientos actualizados')
    onUpdated()
    onClose()
  }

  const grupos = ['Mantenimiento (g/ave/día)', 'Producción (g/huevo)'] as const

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🎯 Requerimientos Nutricionales del Lote</DialogTitle>
          <p className="text-sm text-gray-500">Valores de referencia editables — ajústalos según la ficha técnica de tu línea genética</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {grupos.map(grupo => (
            <div key={grupo} className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">{grupo}</p>
              <div className="grid grid-cols-4 gap-3">
                {CAMPOS.filter(c => c.grupo === grupo).map(c => (
                  <div key={c.key} className="space-y-1">
                    <Label className="text-xs">{c.label}</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={form[c.key] ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, [c.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
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
