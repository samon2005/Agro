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
import { Ic } from '@/components/ui/icon'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Parto = Database['public']['Tables']['partos_cerdos']['Row']
type Destete = Database['public']['Tables']['destetes_cerdos']['Row']
type Lechon = Database['public']['Tables']['lechones_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  hembras: Reproductora[]
  /** Camadas todavía sin destetar */
  partos: Parto[]
  partoPreseleccionado?: Parto | null
  /** Destete que se está corrigiendo; sin él, se registra uno nuevo */
  desteteExistente?: Destete | null
  onCreated: () => void
}

function defaultForm(p?: Parto | null, destete?: Destete | null) {
  if (destete) {
    return {
      parto_id: destete.parto_id ?? '',
      fecha_destete: destete.fecha_destete,
      lechones_destetados: String(destete.lechones_destetados),
      peso_promedio_kg: destete.peso_promedio_kg != null ? String(destete.peso_promedio_kg) : '',
      observaciones: destete.observaciones ?? '',
    }
  }
  return {
    parto_id: p?.id ?? '',
    fecha_destete: hoyLocal(),
    lechones_destetados: p ? String(p.nacidos_vivos) : '',
    peso_promedio_kg: '',
    observaciones: '',
  }
}

export default function RegistrarDesteteModal({ open, onClose, lote, hembras, partos, partoPreseleccionado, desteteExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(partoPreseleccionado, desteteExistente))
  // Los lechones de la camada: se marca cuáles salen y con qué peso
  const [lechones, setLechones] = useState<Lechon[]>([])
  const [salen, setSalen] = useState<Record<string, boolean>>({})
  const [pesosLechon, setPesosLechon] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) setForm(defaultForm(partoPreseleccionado, desteteExistente))
  }, [open, partoPreseleccionado, desteteExistente])

  // Al elegir la camada se traen sus lechones, cada uno con su código
  useEffect(() => {
    if (!open || !form.parto_id) { setLechones([]); return }
    supabase.from('lechones_cerdos').select('*').eq('parto_id', form.parto_id).order('numero')
      .then(({ data }) => {
        const lista = data ?? []
        setLechones(lista)
        setSalen(Object.fromEntries(lista.map(l => [l.id, l.estado !== 'muerto'])))
        setPesosLechon(Object.fromEntries(lista.map(l => [
          l.id, l.peso_destete_kg != null ? String(l.peso_destete_kg) : '',
        ])))
      })
  }, [open, form.parto_id, supabase])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const parto = partos.find(p => p.id === form.parto_id) ?? partoPreseleccionado ?? null
  const hembra = parto ? hembras.find(h => h.id === parto.reproductora_id) : null
  const diasLactancia = parto ? diasDesde(parto.fecha_parto, form.fecha_destete) : null
  const marcados = lechones.filter(l => salen[l.id]).length
  const destetados = lechones.length > 0 ? marcados : (Number(form.lechones_destetados) || 0)
  const pesosMarcados = lechones.filter(l => salen[l.id] && pesosLechon[l.id]).map(l => Number(pesosLechon[l.id]))
  const promedioLechones = pesosMarcados.length > 0
    ? pesosMarcados.reduce((s, x) => s + x, 0) / pesosMarcados.length
    : null
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
    const datos = {
      parto_id: parto.id,
      reproductora_id: parto.reproductora_id,
      fecha_destete: form.fecha_destete,
      lechones_destetados: destetados,
      peso_promedio_kg: promedioLechones ?? (form.peso_promedio_kg ? Number(form.peso_promedio_kg) : null),
      observaciones: form.observaciones || null,
    }
    const { error } = desteteExistente
      ? await supabase.from('destetes_cerdos').update(datos).eq('id', desteteExistente.id)
      : await supabase.from('destetes_cerdos').insert({ ...datos, lote_id: lote.id, finca_id: lote.finca_id })

    // Destetada la camada, la cerda queda vacía y lista para volver a servicio
    if (!error) {
      await supabase.from('reproductoras_cerdos').update({ estado: 'vacia' }).eq('id', parto.reproductora_id)

      // Cada lechón queda como destetado con su peso, o marcado como muerto en
      // lactancia: así el código deja de aparecer en el ciclo.
      for (const l of lechones) {
        const sale = salen[l.id]
        await supabase.from('lechones_cerdos').update(
          sale
            ? {
                estado: 'destetado',
                peso_destete_kg: pesosLechon[l.id] ? Number(pesosLechon[l.id]) : null,
                fecha_salida: null,
                causa_salida: null,
              }
            : {
                estado: 'muerto',
                fecha_salida: form.fecha_destete,
                causa_salida: l.causa_salida ?? 'Murió en lactancia',
              },
        ).eq('id', l.id)
      }
    }

    setLoading(false)
    if (error) { toast.error(desteteExistente ? 'Error al guardar el destete' : 'Error al registrar el destete'); return }
    toast.success(desteteExistente ? 'Destete actualizado' : `Destete registrado: ${destetados} lechones`)
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="cerdo" /> {desteteExistente ? 'Editar destete' : 'Registrar Destete'}</DialogTitle>
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
              <p><Ic n="cerdo" /> Hembra <strong>{hembra?.codigo ?? '—'}</strong> · nacieron {parto.nacidos_vivos} vivos</p>
              {diasLactancia != null && (
                <p>
                  <Ic n="calendario" /> Lactancia de <strong>{diasLactancia} días</strong>
                  {diasLactancia < DIAS_LACTANCIA_MIN && ' — más corta de lo normal, el lechón puede llegar débil al precebo'}
                  {diasLactancia > DIAS_LACTANCIA_MAX && ' — más larga de lo normal, alarga el intervalo entre partos'}
                </p>
              )}
              {sobrevivencia && <p><Ic n="grafica" /> Sobrevivencia de la camada: <strong>{sobrevivencia}%</strong></p>}
              <p><Ic n="repetir" /> La cerda debería volver a celo unos {DIAS_DESTETE_SERVICIO} días después del destete.</p>
            </div>
          )}

          {lechones.length > 0 && (
            <div className="space-y-2 rounded-xl bg-gray-50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-gray-700">Lechones de la camada</p>
                <p className="text-[0.6875rem] text-gray-500">
                  Desmarca el que no llegó al destete · {marcados} de {lechones.length} salen
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {lechones.map(l => (
                  <div key={l.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-gray-200">
                    <input
                      type="checkbox"
                      className="size-4 accent-pink-600"
                      checked={salen[l.id] ?? true}
                      onChange={e => setSalen(prev => ({ ...prev, [l.id]: e.target.checked }))}
                    />
                    <span className={`w-16 shrink-0 text-xs font-medium ${salen[l.id] ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                      {l.codigo}
                    </span>
                    <div className="relative flex-1">
                      <Input
                        type="number" min="0" step="0.01" placeholder="Peso"
                        className="h-8 w-full pr-8 text-sm"
                        disabled={!salen[l.id]}
                        value={pesosLechon[l.id] ?? ''}
                        onChange={e => setPesosLechon(prev => ({ ...prev, [l.id]: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.6875rem] text-gray-400">kg</span>
                    </div>
                  </div>
                ))}
              </div>
              {promedioLechones != null && (
                <p className="text-[0.6875rem] text-gray-600">
                  Peso promedio al destete: <strong>{promedioLechones.toFixed(2)} kg</strong>
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas del destete..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-pink-600 hover:bg-pink-700 text-white">
              {loading ? 'Guardando...' : desteteExistente ? 'Guardar cambios' : 'Registrar destete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
