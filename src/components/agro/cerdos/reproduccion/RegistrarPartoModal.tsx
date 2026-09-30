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
import { Ic } from '@/components/ui/icon'
import { codigoLechon } from '@/lib/cerdos'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Servicio = Database['public']['Tables']['servicios_cerdos']['Row']
type Parto = Database['public']['Tables']['partos_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  hembras: Reproductora[]
  servicios: Servicio[]
  servicioPreseleccionado?: Servicio | null
  /** Parto que se está corrigiendo; sin él, se registra uno nuevo */
  partoExistente?: Parto | null
  onCreated: () => void
}

const SIN_SERVICIO = '__sin_servicio__'

function defaultForm(s?: Servicio | null, parto?: Parto | null) {
  if (parto) {
    return {
      reproductora_id: parto.reproductora_id,
      servicio_id: parto.servicio_id ?? '',
      fecha_parto: parto.fecha_parto,
      nacidos_vivos: String(parto.nacidos_vivos),
      nacidos_muertos: String(parto.nacidos_muertos),
      momificados: String(parto.momificados),
      muertos_postparto: String(parto.muertos_postparto),
      peso_camada_kg: parto.peso_camada_kg != null ? String(parto.peso_camada_kg) : '',
      observaciones: parto.observaciones ?? '',
    }
  }
  return {
    reproductora_id: s?.reproductora_id ?? '',
    servicio_id: s?.id ?? '',
    fecha_parto: hoyLocal(),
    nacidos_vivos: '',
    nacidos_muertos: '0',
    momificados: '0',
    muertos_postparto: '0',
    peso_camada_kg: '',
    observaciones: '',
  }
}

export default function RegistrarPartoModal({ open, onClose, lote, hembras, servicios, servicioPreseleccionado, partoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(servicioPreseleccionado, partoExistente))
  // Un peso por lechón nacido vivo: la lista crece y se recorta con la cantidad
  const [pesos, setPesos] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(servicioPreseleccionado, partoExistente))
    // Al corregir un parto se traen los pesos que ya tenía
    setPesos((partoExistente?.pesos_nacimiento_kg ?? []).map(x => String(x)))
  }, [open, servicioPreseleccionado, partoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const vivos = Number(form.nacidos_vivos) || 0
  const muertos = Number(form.nacidos_muertos) || 0
  const momias = Number(form.momificados) || 0
  const muertosPostparto = Number(form.muertos_postparto) || 0
  const totales = vivos + muertos + momias

  // La lista de pesos sigue a los nacidos vivos
  useEffect(() => {
    setPesos(prev => {
      if (vivos === prev.length) return prev
      if (vivos < prev.length) return prev.slice(0, vivos)
      return [...prev, ...Array(Math.min(vivos, 40) - prev.length).fill('')]
    })
  }, [vivos])

  const pesosLlenos = pesos.filter(x => x !== '' && Number(x) > 0).map(Number)
  // Si se pesó lechón por lechón, la camada es la suma; si no, vale lo que se escriba
  const pesoCamada = pesosLlenos.length > 0
    ? pesosLlenos.reduce((s, x) => s + x, 0)
    : (form.peso_camada_kg ? Number(form.peso_camada_kg) : null)
  const pesoPromedio = pesoCamada != null && vivos > 0
    ? (pesoCamada / vivos).toFixed(2)
    : null

  // Los códigos que llevarán los lechones de esta camada, para avisarlo antes
  const madreElegida = hembras.find(h => h.id === form.reproductora_id) ?? null
  const primerNumero = (madreElegida?.numero_partos ?? 0) > 0 ? null : 1
  const codigosPrevistos = madreElegida && vivos > 0
    ? primerNumero != null
      ? `${codigoLechon(madreElegida.codigo, 1)} a ${codigoLechon(madreElegida.codigo, vivos)}`
      : `${madreElegida.codigo}-… (siguen la numeración de sus camadas anteriores)`
    : null

  // Servicios abiertos de la hembra elegida, para vincular el parto con el que corresponde
  const serviciosDeHembra = servicios.filter(s => s.reproductora_id === form.reproductora_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.reproductora_id) { toast.error('Selecciona la hembra que parió'); return }
    if (!form.nacidos_vivos) { toast.error('Ingresa cuántos lechones nacieron vivos'); return }

    setLoading(true)
    const servicioId = form.servicio_id && form.servicio_id !== SIN_SERVICIO ? form.servicio_id : null
    const datos = {
      reproductora_id: form.reproductora_id,
      servicio_id: servicioId,
      fecha_parto: form.fecha_parto,
      nacidos_vivos: vivos,
      nacidos_muertos: muertos,
      momificados: momias,
      muertos_postparto: muertosPostparto,
      pesos_nacimiento_kg: pesosLlenos.length > 0 ? pesosLlenos : null,
      peso_camada_kg: pesoCamada,
      observaciones: form.observaciones || null,
    }

    const { data: parto, error } = partoExistente
      ? await supabase.from('partos_cerdos').update(datos).eq('id', partoExistente.id).select('id').single()
      : await supabase.from('partos_cerdos').insert({ ...datos, lote_id: lote.id, finca_id: lote.finca_id }).select('id').single()

    // Cada lechón nacido vivo queda identificado con su código (205-01) para
    // poder seguirle el peso y la salud durante todo el ciclo.
    if (!error && parto) await sincronizarLechones(parto.id)

    // Al corregir un parto no se vuelve a contar: la hembra ya quedó lactante
    if (!error && !partoExistente) {
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
    if (error) { toast.error(partoExistente ? 'Error al guardar el parto' : 'Error al registrar el parto'); return }
    toast.success(partoExistente ? 'Parto actualizado' : `Parto registrado: ${vivos} nacidos vivos`)
    onCreated()
    onClose()
  }

  /**
   * Deja la camada con un lechón por nacido vivo. Los que ya existen conservan su
   * código; si el parto se corrige hacia abajo, se quitan los últimos que no
   * tengan nada registrado todavía.
   */
  async function sincronizarLechones(partoId: string) {
    const madre = hembras.find(h => h.id === form.reproductora_id)
    if (!madre) return

    const [{ data: existentes }, { data: deLaMadre }] = await Promise.all([
      supabase.from('lechones_cerdos').select('*').eq('parto_id', partoId).order('numero'),
      supabase.from('lechones_cerdos').select('numero').eq('madre_id', madre.id).order('numero', { ascending: false }).limit(1),
    ])
    const lechones = existentes ?? []

    // Los pesos que se escribieron se guardan en el lechón que corresponde
    for (let i = 0; i < Math.min(lechones.length, vivos); i++) {
      const peso = pesos[i] ? Number(pesos[i]) : null
      if (peso !== (lechones[i].peso_nacimiento_kg != null ? Number(lechones[i].peso_nacimiento_kg) : null)) {
        await supabase.from('lechones_cerdos')
          .update({ peso_nacimiento_kg: peso, fecha_nacimiento: form.fecha_parto })
          .eq('id', lechones[i].id)
      }
    }

    if (vivos > lechones.length) {
      let siguiente = Math.max(deLaMadre?.[0]?.numero ?? 0, ...lechones.map(l => l.numero), 0) + 1
      const nuevos = []
      for (let i = lechones.length; i < vivos; i++) {
        nuevos.push({
          finca_id: lote.finca_id,
          lote_id: lote.id,
          parto_id: partoId,
          madre_id: madre.id,
          codigo: codigoLechon(madre.codigo, siguiente),
          numero: siguiente,
          peso_nacimiento_kg: pesos[i] ? Number(pesos[i]) : null,
          fecha_nacimiento: form.fecha_parto,
          estado: 'lactante',
        })
        siguiente += 1
      }
      await supabase.from('lechones_cerdos').insert(nuevos)
    } else if (vivos < lechones.length) {
      // Solo se quitan los últimos, y únicamente si no tienen historia propia
      const sobran = lechones.slice(vivos).filter(l => l.estado === 'lactante' && l.peso_destete_kg == null)
      if (sobran.length > 0) {
        await supabase.from('lechones_cerdos').delete().in('id', sobran.map(l => l.id))
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl sm:max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="tetero" /> {partoExistente ? 'Editar parto' : 'Registrar Parto'}</DialogTitle>
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

          <div className="space-y-3 rounded-xl border border-pink-200 bg-pink-50 p-4">
            <p className="text-sm font-semibold text-pink-800">Camada</p>
            {/* Las cuatro cuentas, del mismo alto y alineadas */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {([
                { campo: 'nacidos_vivos', label: 'Nacidos vivos *', ayuda: 'Los que nacen con vida' },
                { campo: 'nacidos_muertos', label: 'Nacidos muertos', ayuda: 'Muertos al nacer' },
                { campo: 'momificados', label: 'Momias', ayuda: 'Nacidos muertos momificados' },
                { campo: 'muertos_postparto', label: 'Muertos en posparto', ayuda: 'Nacieron vivos y murieron después' },
              ] as const).map(c => (
                <div key={c.campo} className="flex flex-col">
                  <Label className="text-xs">{c.label}</Label>
                  <Input
                    type="number" min="0" className="mt-1 h-10 bg-white text-base"
                    value={form[c.campo]}
                    onChange={e => set(c.campo, e.target.value)}
                  />
                  <p className="mt-1 text-[0.6875rem] leading-snug text-gray-500">{c.ayuda}</p>
                </div>
              ))}
            </div>

            {pesos.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Label className="text-xs">Peso de cada lechón al nacer (kg)</Label>
                  <span className="text-[0.6875rem] text-gray-500">
                    {pesosLlenos.length > 0
                      ? `${pesosLlenos.length} de ${pesos.length} pesados · la camada suma sola`
                      : 'Déjalos en blanco si solo tienes el peso total'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {pesos.map((peso, i) => (
                    <div key={i} className="space-y-1">
                      <Label className="text-[0.6875rem] text-gray-500">Lechón #{i + 1}</Label>
                      <div className="relative">
                        <Input
                          type="number" min="0" step="0.01" placeholder="0,00"
                          className="h-10 w-full bg-white pr-9 text-base"
                          value={peso}
                          onChange={e => setPesos(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pesosLlenos.length === 0 && (
              <div className="max-w-xs space-y-1">
                <Label className="text-xs">Peso total de la camada (kg)</Label>
                <Input
                  type="number" min="0" step="0.01" className="h-10 bg-white text-base" placeholder="Ej: 18,5"
                  value={form.peso_camada_kg}
                  onChange={e => set('peso_camada_kg', e.target.value)}
                />
              </div>
            )}

            {vivos > 0 && codigosPrevistos && (
              <p className="rounded-lg bg-white px-3 py-2 text-xs text-gray-600 ring-1 ring-pink-200">
                <Ic n="cerdo" /> Cada lechón queda identificado: <strong>{codigosPrevistos}</strong>.
                Con ese código se le sigue el peso y la salud durante todo el ciclo.
              </p>
            )}
            <p className="border-t border-pink-200 pt-2 text-xs text-pink-800">
              Nacidos totales: <strong>{totales}</strong>
              {pesoCamada != null && ` · camada de ${pesoCamada.toFixed(2)} kg`}
              {pesoPromedio && ` · promedio por lechón ${pesoPromedio} kg`}
              {muertosPostparto > 0 && ` · quedan ${Math.max(0, vivos - muertosPostparto)} vivos`}
            </p>
            {pesoPromedio && Number(pesoPromedio) < 1 && (
              <p className="text-xs text-amber-700">
                <Ic n="alerta" /> Un lechón por debajo de 1 kg al nacer tiene mucho menos chance de llegar al destete.
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
              {loading ? 'Guardando...' : partoExistente ? 'Guardar cambios' : 'Registrar parto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
