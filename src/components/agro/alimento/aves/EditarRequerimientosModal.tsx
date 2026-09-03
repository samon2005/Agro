'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { semanaDePostura } from '@/lib/postura'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type Requerimientos = Database['public']['Tables']['requerimientos_nutricionales_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  actual: Requerimientos | null
  historial: Requerimientos[]
  fechaInicioPostura: string | null
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
  prod_proteina_g: 0, prod_calcio_g: 0, prod_fosforo_g: 0, prod_grasa_g: 0,
}

export default function EditarRequerimientosModal({ open, onClose, loteId, fincaId, actual, historial, fechaInicioPostura, onUpdated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [vigenteDesde, setVigenteDesde] = useState(hoyLocal())

  useEffect(() => {
    const base = actual ?? DEFAULTS
    setForm(Object.fromEntries(CAMPOS.map(c => [c.key, String(base[c.key])])))
    setVigenteDesde(hoyLocal())
  }, [actual, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const valores = Object.fromEntries(CAMPOS.map(c => [c.key, Number(form[c.key] || 0)]))
    const { error } = await supabase.from('requerimientos_nutricionales_aves')
      .insert({ lote_id: loteId, finca_id: fincaId, vigente_desde: vigenteDesde, ...valores })
    setLoading(false)
    if (error) { toast.error('Error al guardar los requerimientos'); return }
    toast.success('Nueva versión de requerimientos guardada')
    onUpdated()
    onClose()
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const grupos = ['Mantenimiento (g/ave/día)', 'Producción (g/huevo)'] as const

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎯 Requerimientos Nutricionales del Lote</DialogTitle>
          <p className="text-sm text-gray-500">Cada cambio queda guardado como una nueva versión — no se pierde el historial anterior</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Vigente desde</Label>
            <Input type="date" value={vigenteDesde} onChange={e => setVigenteDesde(e.target.value)} />
          </div>
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

          {historial.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase">Historial de cambios</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {historial.map(h => {
                  const semana = semanaDePostura(fechaInicioPostura, h.vigente_desde)
                  return (
                    <div key={h.id} className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-50 pb-1">
                      <span>Desde {fmt(h.vigente_desde)}{semana ? ` (semana ${semana} de postura)` : ''}</span>
                      <span>Prot. mant. {h.mant_proteina_g}g · prod. {h.prod_proteina_g}g</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Guardar nueva versión'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
