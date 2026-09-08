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

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Servicio = Database['public']['Tables']['servicios_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  hembras: Reproductora[]
  servicios: Servicio[]
  servicioPreseleccionado?: Servicio | null
  onCreated: () => void
}

const SIN_SERVICIO = '__sin_servicio__'

function defaultForm(s?: Servicio | null) {
  return {
    reproductora_id: s?.reproductora_id ?? '',
    servicio_id: s?.id ?? '',
    fecha_parto: hoyLocal(),
    nacidos_vivos: '',
    nacidos_muertos: '0',
    momificados: '0',
    peso_camada_kg: '',
    observaciones: '',
  }
}

export default function RegistrarPartoModal({ open, onClose, lote, hembras, servicios, servicioPreseleccionado, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(servicioPreseleccionado))

  useEffect(() => { if (open) setForm(defaultForm(servicioPreseleccionado)) }, [open, servicioPreseleccionado])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const vivos = Number(form.nacidos_vivos) || 0
  const muertos = Number(form.nacidos_muertos) || 0
  const momias = Number(form.momificados) || 0
  const totales = vivos + muertos + momias
  const pesoPromedio = form.peso_camada_kg && vivos > 0
    ? (Number(form.peso_camada_kg) / vivos).toFixed(2)
    : null

  // Servicios abiertos de la hembra elegida, para vincular el parto con el que corresponde
  const serviciosDeHembra = servicios.filter(s => s.reproductora_id === form.reproductora_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.reproductora_id) { toast.error('Selecciona la hembra que parió'); return }
    if (!form.nacidos_vivos) { toast.error('Ingresa cuántos lechones nacieron vivos'); return }

    setLoading(true)
    const servicioId = form.servicio_id && form.servicio_id !== SIN_SERVICIO ? form.servicio_id : null
    const { error } = await supabase.from('partos_cerdos').insert({
      lote_id: lote.id,
      finca_id: lote.finca_id,
      reproductora_id: form.reproductora_id,
      servicio_id: servicioId,
      fecha_parto: form.fecha_parto,
      nacidos_vivos: vivos,
      nacidos_muertos: muertos,
      momificados: momias,
      peso_camada_kg: form.peso_camada_kg ? Number(form.peso_camada_kg) : null,
      observaciones: form.observaciones || null,
    })

    if (!error) {
      // La hembra pasa a lactante y suma un parto a su historial
      const hembra = hembras.find(h => h.id === form.reproductora_id)
      await supabase.from('reproductoras_cerdos').update({
        estado: 'lactante',
        numero_partos: (hembra?.numero_partos ?? 0) + 1,
      }).eq('id', form.reproductora_id)

      if (servicioId) {
        await supabase.from('servicios_cerdos').update({ estado: 'parido' }).eq('id', servicioId)
      }
    }

    setLoading(false)
    if (error) { toast.error('Error al registrar el parto'); return }
    toast.success(`Parto registrado: ${vivos} nacidos vivos`)
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🍼 Registrar Parto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Hembra *</Label>
              <Select
                value={form.reproductora_id}
                onValueChange={v => setForm(p => ({ ...p, reproductora_id: v ?? '', servicio_id: '' }))}
                items={Object.fromEntries(hembras.map(h => [h.id, `${h.codigo}${h.nombre ? ` — ${h.nombre}` : ''}`]))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar hembra..." /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="max-h-64">
                  {hembras.map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.codigo}{h.nombre ? ` — ${h.nombre}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.reproductora_id && serviciosDeHembra.length > 0 && (
              <div className="col-span-2 space-y-1">
                <Label>Servicio que originó el parto</Label>
                <Select
                  value={form.servicio_id}
                  onValueChange={v => set('servicio_id', v)}
                  items={{
                    [SIN_SERVICIO]: 'Sin vincular a un servicio',
                    ...Object.fromEntries(serviciosDeHembra.map(s => [
                      s.id,
                      `${new Date(s.fecha_servicio + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} — ${s.tipo === 'monta_natural' ? 'Monta' : 'Inseminación'}`,
                    ])),
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar servicio..." /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-64">
                    <SelectItem value={SIN_SERVICIO}>Sin vincular a un servicio</SelectItem>
                    {serviciosDeHembra.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {new Date(s.fecha_servicio + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} — {s.tipo === 'monta_natural' ? 'Monta' : 'Inseminación'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label>Fecha del parto</Label>
              <Input type="date" value={form.fecha_parto} onChange={e => set('fecha_parto', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-pink-50 rounded-lg border border-pink-200 space-y-2">
            <p className="text-xs font-semibold text-pink-700">Camada</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nacidos vivos *</Label>
                <Input type="number" min="0" className="bg-white" value={form.nacidos_vivos} onChange={e => set('nacidos_vivos', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nacidos muertos</Label>
                <Input type="number" min="0" className="bg-white" value={form.nacidos_muertos} onChange={e => set('nacidos_muertos', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Momificados</Label>
                <Input type="number" min="0" className="bg-white" value={form.momificados} onChange={e => set('momificados', e.target.value)} />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Peso total de la camada (kg)</Label>
                <Input type="number" min="0" step="0.01" className="bg-white" placeholder="Ej: 18.5" value={form.peso_camada_kg} onChange={e => set('peso_camada_kg', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-pink-700">
              Nacidos totales: <strong>{totales}</strong>
              {pesoPromedio && ` · peso promedio por lechón: ${pesoPromedio} kg`}
            </p>
            {pesoPromedio && Number(pesoPromedio) < 1 && (
              <p className="text-xs text-amber-700">
                ⚠️ Un lechón por debajo de 1 kg al nacer tiene mucho menos chance de llegar al destete.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas del parto..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-pink-600 hover:bg-pink-700 text-white">
              {loading ? 'Guardando...' : 'Registrar parto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
