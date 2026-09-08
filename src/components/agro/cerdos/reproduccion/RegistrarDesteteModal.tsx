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
import { diasDesde, DIAS_LACTANCIA_MIN, DIAS_LACTANCIA_MAX, DIAS_DESTETE_SERVICIO } from '@/lib/cerdos'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Parto = Database['public']['Tables']['partos_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  hembras: Reproductora[]
  /** Camadas todavía sin destetar */
  partos: Parto[]
  partoPreseleccionado?: Parto | null
  onCreated: () => void
}

function defaultForm(p?: Parto | null) {
  return {
    parto_id: p?.id ?? '',
    fecha_destete: hoyLocal(),
    lechones_destetados: p ? String(p.nacidos_vivos) : '',
    peso_promedio_kg: '',
    observaciones: '',
  }
}

export default function RegistrarDesteteModal({ open, onClose, lote, hembras, partos, partoPreseleccionado, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(partoPreseleccionado))

  useEffect(() => { if (open) setForm(defaultForm(partoPreseleccionado)) }, [open, partoPreseleccionado])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const parto = partos.find(p => p.id === form.parto_id) ?? null
  const hembra = parto ? hembras.find(h => h.id === parto.reproductora_id) : null
  const diasLactancia = parto ? diasDesde(parto.fecha_parto, form.fecha_destete) : null
  const destetados = Number(form.lechones_destetados) || 0
  // Sobrevivencia de la camada: de los que nacieron vivos, cuántos llegaron al destete
  const sobrevivencia = parto && parto.nacidos_vivos > 0
    ? ((destetados / parto.nacidos_vivos) * 100).toFixed(1)
    : null

  function etiquetaParto(p: Parto) {
    const h = hembras.find(x => x.id === p.reproductora_id)
    const fecha = new Date(p.fecha_parto + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    return `${h?.codigo ?? '—'} — parto del ${fecha} (${p.nacidos_vivos} vivos)`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.parto_id || !parto) { toast.error('Selecciona la camada que se desteta'); return }
    if (!form.lechones_destetados) { toast.error('Ingresa cuántos lechones se destetaron'); return }
    if (destetados > parto.nacidos_vivos) {
      toast.error('No se pueden destetar más lechones de los que nacieron vivos'); return
    }

    setLoading(true)
    const { error } = await supabase.from('destetes_cerdos').insert({
      lote_id: lote.id,
      finca_id: lote.finca_id,
      parto_id: parto.id,
      reproductora_id: parto.reproductora_id,
      fecha_destete: form.fecha_destete,
      lechones_destetados: destetados,
      peso_promedio_kg: form.peso_promedio_kg ? Number(form.peso_promedio_kg) : null,
      observaciones: form.observaciones || null,
    })

    // Destetada la camada, la cerda queda vacía y lista para volver a servicio
    if (!error) {
      await supabase.from('reproductoras_cerdos').update({ estado: 'vacia' }).eq('id', parto.reproductora_id)
    }

    setLoading(false)
    if (error) { toast.error('Error al registrar el destete'); return }
    toast.success(`Destete registrado: ${destetados} lechones`)
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🐽 Registrar Destete</DialogTitle>
          <p className="text-sm text-gray-500">
            El destete normal va entre los {DIAS_LACTANCIA_MIN} y los {DIAS_LACTANCIA_MAX} días de nacidos.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Camada *</Label>
            <Select
              value={form.parto_id}
              onValueChange={v => {
                const p = partos.find(x => x.id === v)
                setForm(prev => ({ ...prev, parto_id: v ?? '', lechones_destetados: p ? String(p.nacidos_vivos) : prev.lechones_destetados }))
              }}
              items={Object.fromEntries(partos.map(p => [p.id, etiquetaParto(p)]))}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar camada..." /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="max-h-64">
                {partos.length === 0
                  ? <div className="px-2 py-1.5 text-xs text-gray-400">No hay camadas lactando</div>
                  : partos.map(p => <SelectItem key={p.id} value={p.id}>{etiquetaParto(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha del destete</Label>
              <Input type="date" value={form.fecha_destete} onChange={e => set('fecha_destete', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Lechones destetados *</Label>
              <Input type="number" min="0" value={form.lechones_destetados} onChange={e => set('lechones_destetados', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Peso promedio al destete (kg)</Label>
              <Input type="number" min="0" step="0.01" placeholder="Ej: 6.5" value={form.peso_promedio_kg} onChange={e => set('peso_promedio_kg', e.target.value)} />
            </div>
          </div>

          {parto && (
            <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg text-xs text-pink-800 space-y-1">
              <p>🐖 Hembra <strong>{hembra?.codigo ?? '—'}</strong> · nacieron {parto.nacidos_vivos} vivos</p>
              {diasLactancia != null && (
                <p>
                  📅 Lactancia de <strong>{diasLactancia} días</strong>
                  {diasLactancia < DIAS_LACTANCIA_MIN && ' — más corta de lo normal, el lechón puede llegar débil al precebo'}
                  {diasLactancia > DIAS_LACTANCIA_MAX && ' — más larga de lo normal, alarga el intervalo entre partos'}
                </p>
              )}
              {sobrevivencia && <p>📊 Sobrevivencia de la camada: <strong>{sobrevivencia}%</strong></p>}
              <p>🔁 La cerda debería volver a celo unos {DIAS_DESTETE_SERVICIO} días después del destete.</p>
            </div>
          )}

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas del destete..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-pink-600 hover:bg-pink-700 text-white">
              {loading ? 'Guardando...' : 'Registrar destete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
