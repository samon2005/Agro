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
import { fechaProbableParto, fechaRepeticionCelo } from '@/lib/cerdos'
import { useConfigCerdos } from '@/lib/useConfigCerdos'
import { actualizarEstadoCerda } from '@/lib/estadoCerda'
import { Ic } from '@/components/ui/icon'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Servicio = Database['public']['Tables']['servicios_cerdos']['Row']

/** Cada aplicacion del servicio: el semen se aplica 1, 2 o 3 veces, a distintas horas. */
interface Aplicacion { fecha: string; hora: string; codigo_semen: string }

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  hembras: Reproductora[]
  servicioExistente?: Servicio | null
  onCreated: () => void
}

function defaultForm(s?: Servicio | null) {
  return {
    reproductora_id: s?.reproductora_id ?? '',
    fecha_servicio: s?.fecha_servicio ?? hoyLocal(),
    tipo: s?.tipo ?? 'inseminacion',
    verraco: s?.verraco ?? '',
    codigo_semen: s?.codigo_semen ?? '',
    observaciones: s?.observaciones ?? '',
    // Fase 1 de cerdos (José): semen comprado o propio, quién inseminó, celo y grupo
    origen_semen: s?.origen_semen ?? (s?.tipo === 'monta_natural' ? 'monta' : 'comprado'),
    macho_id: s?.macho_id ?? '',
    fecha_recoleccion: s?.fecha_recoleccion ?? '',
    inseminador: s?.inseminador ?? '',
    calidad_celo: s?.calidad_celo != null ? String(s.calidad_celo) : '',
    grupo_sincronizado: s?.grupo_sincronizado ?? '',
  }
}

type Macho = { id: string; nombre: string; funcion: string }
const CALIDAD_CELO = [{ v: '3', t: 'Bueno (lordosis firme)' }, { v: '2', t: 'Regular' }, { v: '1', t: 'Débil' }]

export default function RegistrarServicioModal({ open, onClose, lote, hembras, servicioExistente, onCreated }: Props) {
  const cfg = useConfigCerdos()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(servicioExistente))
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([{ fecha: hoyLocal(), hora: '', codigo_semen: '' }])
  // Los machos de la finca (celadores y reproductores) y los grupos ya usados
  const [machos, setMachos] = useState<Macho[]>([])
  const [grupos, setGrupos] = useState<string[]>([])
  useEffect(() => {
    if (!open) return
    let vigente = true
    Promise.all([
      supabase.from('machos_cerdos').select('id, nombre, funcion').eq('finca_id', lote.finca_id).eq('activo', true).order('nombre'),
      supabase.from('servicios_cerdos').select('grupo_sincronizado').eq('finca_id', lote.finca_id).not('grupo_sincronizado', 'is', null).order('created_at', { ascending: false }).limit(200),
    ]).then(([m, g]) => {
      if (!vigente) return
      setMachos((m.data ?? []) as Macho[])
      setGrupos([...new Set((g.data ?? []).map(x => x.grupo_sincronizado as string))])
    })
    return () => { vigente = false }
  }, [open, lote.finca_id, supabase])
  // El parto sale solo con los días de gestación de la granja, pero se puede corregir
  const [partoManual, setPartoManual] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(servicioExistente))
    if (!servicioExistente) {
      setAplicaciones([{ fecha: hoyLocal(), hora: '', codigo_semen: '' }])
      setPartoManual(null)
      return
    }
    // Si la fecha guardada no es la que dan los días de gestación, es que la corrigieron
    const calculada = fechaProbableParto(servicioExistente.fecha_servicio, cfg)
    setPartoManual(
      servicioExistente.fecha_probable_parto && servicioExistente.fecha_probable_parto !== calculada
        ? servicioExistente.fecha_probable_parto
        : null,
    )
    supabase.from('inseminaciones_cerdos').select('*').eq('servicio_id', servicioExistente.id).order('fecha')
      .then(({ data }) => setAplicaciones(
        (data ?? []).length > 0
          ? (data ?? []).map(a => ({ fecha: a.fecha, hora: a.hora?.slice(0, 5) ?? '', codigo_semen: a.codigo_semen ?? '' }))
          : [{ fecha: servicioExistente.fecha_servicio, hora: '', codigo_semen: servicioExistente.codigo_semen ?? '' }]
      ))
  }, [open, servicioExistente, supabase, cfg])

  function setAplicacion(i: number, campo: keyof Aplicacion, valor: string) {
    setAplicaciones(prev => prev.map((a, j) => j === i ? { ...a, [campo]: valor } : a))
  }

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  // El parto se cuenta desde la primera aplicación, salvo que se haya corregido
  const fechaBase = aplicaciones[0]?.fecha ?? form.fecha_servicio
  const partoCalculado = fechaBase ? fechaProbableParto(fechaBase, cfg) : null
  const parto = partoManual ?? partoCalculado
  const celo = fechaBase ? fechaRepeticionCelo(fechaBase, cfg) : null
  const diasHastaParto = parto && fechaBase
    ? Math.round((new Date(parto + 'T00:00:00').getTime() - new Date(fechaBase + 'T00:00:00').getTime()) / 86400000)
    : null

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.reproductora_id) { toast.error('Selecciona la hembra servida'); return }
    if (aplicaciones.length === 0) { toast.error('Registra al menos una aplicacion'); return }
    if (aplicaciones.some(a => !a.fecha)) { toast.error('Cada aplicacion necesita su fecha'); return }

    setLoading(true)
    const macho = machos.find(m => m.id === form.macho_id)
    const conMacho = form.origen_semen !== 'comprado'
    const payload = {
      reproductora_id: form.reproductora_id,
      fecha_servicio: aplicaciones[0].fecha,
      tipo: form.origen_semen === 'monta' ? 'monta_natural' : 'inseminacion',
      // El nombre del macho también queda en "verraco", donde lo leen los reportes de antes
      verraco: conMacho ? (macho?.nombre ?? null) : (form.verraco || null),
      origen_semen: form.origen_semen,
      macho_id: conMacho ? (form.macho_id || null) : null,
      fecha_recoleccion: form.origen_semen === 'propio' ? (form.fecha_recoleccion || null) : null,
      inseminador: form.inseminador.trim() || null,
      calidad_celo: form.calidad_celo ? Number(form.calidad_celo) : null,
      grupo_sincronizado: form.grupo_sincronizado.trim() || null,
      codigo_semen: form.codigo_semen || null,
      numero_dosis: aplicaciones.length,
      fecha_probable_parto: parto,
      observaciones: form.observaciones || null,
    }
    const { data: servicio, error } = servicioExistente
      ? await supabase.from('servicios_cerdos').update(payload).eq('id', servicioExistente.id).select('id').single()
      : await supabase.from('servicios_cerdos').insert({ ...payload, estado: 'pendiente', lote_id: lote.id, finca_id: lote.finca_id }).select('id').single()

    // Las aplicaciones se reescriben completas: son pocas y asi quedan en orden
    if (!error && servicio) {
      await supabase.from('inseminaciones_cerdos').delete().eq('servicio_id', servicio.id)
      await supabase.from('inseminaciones_cerdos').insert(aplicaciones.map(a => ({
        servicio_id: servicio.id,
        finca_id: lote.finca_id,
        fecha: a.fecha,
        hora: a.hora || null,
        codigo_semen: a.codigo_semen || form.codigo_semen || null,
      })))
    }

    // El estado de la hembra sale de su historia (lib/estadoCerda); si el servicio
    // cambió de hembra, la anterior también se recalcula
    if (!error) {
      await actualizarEstadoCerda(supabase, form.reproductora_id, cfg)
      if (servicioExistente && servicioExistente.reproductora_id !== form.reproductora_id)
        await actualizarEstadoCerda(supabase, servicioExistente.reproductora_id, cfg)
    }

    setLoading(false)
    if (error) { toast.error('Error al guardar el servicio'); return }
    toast.success(servicioExistente ? 'Servicio actualizado' : 'Servicio registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{servicioExistente ? 'Editar Servicio' : 'Registrar Servicio'}</DialogTitle>
          <p className="text-sm text-gray-500">Monta natural o inseminación. La gestación dura {cfg.reproduccion.diasGestacion} días.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Hembra *</Label>
              <Select
                value={form.reproductora_id}
                onValueChange={v => set('reproductora_id', v)}
                items={Object.fromEntries(hembras.map(h => [h.id, `${h.codigo}${h.nombre ? ` — ${h.nombre}` : ''}`]))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar hembra..." /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="max-h-64">
                  {hembras.length === 0
                    ? <div className="px-2 py-1.5 text-xs text-gray-400">Registra primero una hembra</div>
                    : hembras.map(h => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.codigo}{h.nombre ? ` — ${h.nombre}` : ''}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Semen</Label>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
                {([['comprado', 'Comprado (pajilla)'], ['propio', 'Propio de la finca'], ['monta', 'Monta natural']] as const).map(([v, t]) => (
                  <button key={v} type="button" onClick={() => set('origen_semen', v)}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium ${form.origen_semen === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {form.origen_semen === 'comprado' ? (
              <>
                <div className="space-y-1">
                  <Label>Genética o proveedor</Label>
                  <Input placeholder="Ej: PIC" value={form.verraco} onChange={e => set('verraco', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Código del semen</Label>
                  <Input placeholder="Ej: PIC-4408-25" value={form.codigo_semen} onChange={e => set('codigo_semen', e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div className={form.origen_semen === 'propio' ? 'space-y-1' : 'col-span-2 space-y-1'}>
                  <Label>{form.origen_semen === 'propio' ? 'Macho del que se recogió' : 'Macho'}</Label>
                  <select value={form.macho_id} onChange={e => set('macho_id', e.target.value)}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                    <option value="">{machos.length ? 'Elegir…' : 'Registra los machos en "Machos y celadores"'}</option>
                    {machos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                {form.origen_semen === 'propio' && (
                  <div className="space-y-1">
                    <Label>Fecha de recolección</Label>
                    <Input type="date" value={form.fecha_recoleccion} onChange={e => set('fecha_recoleccion', e.target.value)} />
                  </div>
                )}
              </>
            )}
            <div className="space-y-1">
              <Label>Quién inseminó</Label>
              <Input placeholder="Ej: Andrés (practicante)" value={form.inseminador} onChange={e => set('inseminador', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Calidad del celo</Label>
              <select value={form.calidad_celo} onChange={e => set('calidad_celo', e.target.value)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                <option value="">Sin anotar</option>
                {CALIDAD_CELO.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Grupo sincronizado</Label>
              <Input list="grupos-sincronizados" placeholder="Ej: Grupo 12 (nov)" value={form.grupo_sincronizado} onChange={e => set('grupo_sincronizado', e.target.value)} />
              <datalist id="grupos-sincronizados">{grupos.map(g => <option key={g} value={g} />)}</datalist>
              <p className="text-xs text-gray-400">Las 4 o 5 cerdas que se sincronizan para parir juntas. Escribe el mismo nombre en todas.</p>
            </div>
            <div className="col-span-2 space-y-2 rounded-xl bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Aplicaciones del servicio</p>
                <p className="text-[0.6875rem] text-gray-500">Se aplica 1, 2 o 3 veces, a distintas horas</p>
              </div>
              {aplicaciones.map((ap, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Aplicación {i + 1}</Label>
                    <Input type="date" className="bg-white" value={ap.fecha} onChange={e => setAplicacion(i, 'fecha', e.target.value)} />
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">Hora</Label>
                    <Input type="time" className="bg-white" value={ap.hora} onChange={e => setAplicacion(i, 'hora', e.target.value)} />
                  </div>
                  {aplicaciones.length > 1 && (
                    <Button
                      type="button" size="sm" variant="ghost" className="h-9 px-2 text-red-600"
                      onClick={() => setAplicaciones(prev => prev.filter((_, j) => j !== i))}
                    >
                      <Ic n="borrar" />
                    </Button>
                  )}
                </div>
              ))}
              {aplicaciones.length < 3 && (
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => setAplicaciones(prev => [...prev, { fecha: prev[prev.length - 1]?.fecha ?? hoyLocal(), hora: '', codigo_semen: '' }])}
                >
                  <Ic n="mas" /> Agregar aplicación
                </Button>
              )}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas del servicio..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>

          {parto && celo && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="font-semibold"><Ic n="tetero" /> Parto probable</p>
                  <p className="mt-0.5">
                    {fmt(parto)}
                    {diasHastaParto != null && ` · ${diasHastaParto} días desde la primera aplicación`}
                    {partoManual && ' · ajustado a mano'}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <Input
                    type="date"
                    className="h-8 w-40 bg-white text-xs"
                    value={parto}
                    onChange={e => setPartoManual(e.target.value || null)}
                  />
                  {partoManual && (
                    <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPartoManual(null)}>
                      Volver a {cfg.reproduccion.diasGestacion} días
                    </Button>
                  )}
                </div>
              </div>
              <p><Ic n="repetir" /> <strong>Si repite celo</strong>, sería alrededor del {fmt(celo)}, a los {cfg.reproduccion.cicloEstral} días. Si vuelve a
                 entrar en celo, este servicio no prendió. Lo que pase después se anota en el servicio, con «¿Cómo va?».</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-pink-600 hover:bg-pink-700 text-white">
              {loading ? 'Guardando...' : servicioExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
