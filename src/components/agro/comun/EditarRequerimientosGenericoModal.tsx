'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dbGenerico, type ConfigEspecie } from '@/lib/especiesConfig'

export interface RequerimientoGenerico {
  id: string
  lote_id: string
  finca_id: string
  proteina_pct: number
  lisina_pct: number
  calcio_pct: number
  fosforo_pct: number
  energia_kcal_kg: number
  vigente_desde: string
  [campo: string]: string | number
}

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  config: ConfigEspecie
  actual: RequerimientoGenerico | null
  historial: RequerimientoGenerico[]
  onUpdated: () => void
}

const NUTRIENTES = [
  { key: 'proteina_pct', label: 'Proteína (%)' },
  { key: 'lisina_pct', label: 'Lisina (%)' },
  { key: 'calcio_pct', label: 'Calcio (%)' },
  { key: 'fosforo_pct', label: 'Fósforo (%)' },
  { key: 'energia_kcal_kg', label: 'Energía (kcal/kg)' },
]

export default function EditarRequerimientosGenericoModal({ open, onClose, loteId, fincaId, config, actual, historial, onUpdated }: Props) {
  const supabase = createClient()
  const nutri = config.nutricion
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [etapa, setEtapa] = useState(nutri.etapas[0]?.value ?? '')
  const [vigenteDesde, setVigenteDesde] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!open) return
    const base: Record<string, string> = {}
    for (const n of NUTRIENTES) base[n.key] = actual ? String(actual[n.key] ?? 0) : '0'
    base[nutri.campoConsumo] = actual ? String(actual[nutri.campoConsumo] ?? 0) : '0'
    setForm(base)
    setEtapa(actual ? String(actual[nutri.campoEtapa] ?? nutri.etapas[0]?.value ?? '') : (nutri.etapas[0]?.value ?? ''))
    setVigenteDesde(new Date().toISOString().split('T')[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const valores: Record<string, number> = {}
    for (const n of NUTRIENTES) valores[n.key] = Number(form[n.key] || 0)
    valores[nutri.campoConsumo] = Number(form[nutri.campoConsumo] || 0)

    const { error } = await dbGenerico(supabase).from(config.tablas.requerimientos).insert({
      lote_id: loteId,
      finca_id: fincaId,
      [nutri.campoEtapa]: etapa,
      vigente_desde: vigenteDesde,
      ...valores,
    })
    setLoading(false)
    if (error) { toast.error('Error al guardar los requerimientos'); return }
    toast.success('Nueva versión de requerimientos guardada')
    onUpdated()
    onClose()
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const etiquetaEtapa = Object.fromEntries(nutri.etapas.map(e => [e.value, e.label]))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎯 Requerimientos Nutricionales del Lote</DialogTitle>
          <p className="text-sm text-gray-500">Cada cambio queda guardado como una nueva versión — no se pierde el historial anterior</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">{nutri.etiquetaEtapa}</Label>
              <Select value={etapa} onValueChange={v => setEtapa(v ?? '')} items={etiquetaEtapa}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{nutri.etapas.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vigente desde</Label>
              <Input type="date" value={vigenteDesde} onChange={e => setVigenteDesde(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Consumo objetivo ({nutri.unidadConsumo} / {config.animalSingular} / día)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={form[nutri.campoConsumo] ?? ''}
                onChange={e => setForm(prev => ({ ...prev, [nutri.campoConsumo]: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Composición requerida de la dieta</p>
            <div className="grid grid-cols-3 gap-3">
              {NUTRIENTES.map(n => (
                <div key={n.key} className="space-y-1">
                  <Label className="text-xs">{n.label}</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={form[n.key] ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [n.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {historial.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase">Historial de cambios</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {historial.map(h => (
                  <div key={h.id} className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-50 pb-1">
                    <span>Desde {fmt(h.vigente_desde)} · {etiquetaEtapa[String(h[nutri.campoEtapa])] ?? h[nutri.campoEtapa]}</span>
                    <span>Prot. {h.proteina_pct}% · {h[nutri.campoConsumo]} {nutri.unidadConsumo}/día</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className={config.botonClase}>
              {loading ? 'Guardando...' : 'Guardar nueva versión'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
