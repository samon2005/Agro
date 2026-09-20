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
import { fechaProbableParto, fechaRepeticionCelo, DIAS_GESTACION } from '@/lib/cerdos'
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

const ESTADOS_SERVICIO = [
  { value: 'pendiente', label: 'Pendiente de confirmar' },
  { value: 'confirmado', label: 'Preñez confirmada' },
  { value: 'repetido', label: 'Repitió celo' },
  { value: 'fallido', label: 'Falló' },
]

function defaultForm(s?: Servicio | null) {
  return {
    reproductora_id: s?.reproductora_id ?? '',
    fecha_servicio: s?.fecha_servicio ?? hoyLocal(),
    tipo: s?.tipo ?? 'inseminacion',
    verraco: s?.verraco ?? '',
    codigo_semen: s?.codigo_semen ?? '',
    prenez_confirmada: s?.prenez_confirmada ?? false,
    fecha_confirmacion: s?.fecha_confirmacion ?? '',
    estado: s?.estado ?? 'pendiente',
    observaciones: s?.observaciones ?? '',
  }
}

export default function RegistrarServicioModal({ open, onClose, lote, hembras, servicioExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(servicioExistente))
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([{ fecha: hoyLocal(), hora: '', codigo_semen: '' }])

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(servicioExistente))
    if (!servicioExistente) {
      setAplicaciones([{ fecha: hoyLocal(), hora: '', codigo_semen: '' }])
      return
    }
    supabase.from('inseminaciones_cerdos').select('*').eq('servicio_id', servicioExistente.id).order('fecha')
      .then(({ data }) => setAplicaciones(
        (data ?? []).length > 0
          ? (data ?? []).map(a => ({ fecha: a.fecha, hora: a.hora?.slice(0, 5) ?? '', codigo_semen: a.codigo_semen ?? '' }))
          : [{ fecha: servicioExistente.fecha_servicio, hora: '', codigo_semen: servicioExistente.codigo_semen ?? '' }]
      ))
  }, [open, servicioExistente, supabase])

  function setAplicacion(i: number, campo: keyof Aplicacion, valor: string) {
    setAplicaciones(prev => prev.map((a, j) => j === i ? { ...a, [campo]: valor } : a))
  }

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  // El parto se cuenta desde la primera aplicacion
  const fechaBase = aplicaciones[0]?.fecha ?? form.fecha_servicio
  const parto = fechaBase ? fechaProbableParto(fechaBase) : null
  const celo = fechaBase ? fechaRepeticionCelo(fechaBase) : null

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.reproductora_id) { toast.error('Selecciona la hembra servida'); return }
    if (aplicaciones.length === 0) { toast.error('Registra al menos una aplicacion'); return }
    if (aplicaciones.some(a => !a.fecha)) { toast.error('Cada aplicacion necesita su fecha'); return }

    setLoading(true)
    const payload = {
      reproductora_id: form.reproductora_id,
      fecha_servicio: aplicaciones[0].fecha,
      tipo: form.tipo,
      verraco: form.verraco || null,
      codigo_semen: form.codigo_semen || null,
      numero_dosis: aplicaciones.length,
      fecha_probable_parto: parto,
      prenez_confirmada: form.estado === 'confirmado',
      fecha_confirmacion: form.estado === 'confirmado' ? (form.fecha_confirmacion || hoyLocal()) : null,
      estado: form.estado,
      observaciones: form.observaciones || null,
    }
    const { data: servicio, error } = servicioExistente
      ? await supabase.from('servicios_cerdos').update(payload).eq('id', servicioExistente.id).select('id').single()
      : await supabase.from('servicios_cerdos').insert({ ...payload, lote_id: lote.id, finca_id: lote.finca_id }).select('id').single()

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

    // El estado de la hembra sigue al del servicio: servida, gestante o vacía
    if (!error) {
      const estadoHembra = form.estado === 'confirmado' ? 'gestante'
        : form.estado === 'pendiente' ? 'servida'
        : 'vacia'
      await supabase.from('reproductoras_cerdos').update({ estado: estadoHembra }).eq('id', form.reproductora_id)
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
          <p className="text-sm text-gray-500">Monta natural o inseminación. La gestación dura {DIAS_GESTACION} días.</p>
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
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={v => set('tipo', v)}
                items={{ inseminacion: 'Inseminación artificial', monta_natural: 'Monta natural' }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inseminacion"><Ic n="vacuna" /> Inseminación artificial</SelectItem>
                  <SelectItem value="monta_natural"><Ic n="cerdo" /> Monta natural</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Verraco / origen del semen</Label>
              <Input placeholder="Ej: V-12 o Genética PIC" value={form.verraco} onChange={e => set('verraco', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Código del semen</Label>
              <Input placeholder="Ej: PIC-4408-25" value={form.codigo_semen} onChange={e => set('codigo_semen', e.target.value)} />
              <p className="text-xs text-gray-400">Cada pajilla trae su código; queda guardado en cada aplicación.</p>
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
              <Label>Estado del servicio</Label>
              <Select
                value={form.estado}
                onValueChange={v => set('estado', v)}
                items={Object.fromEntries(ESTADOS_SERVICIO.map(e => [e.value, e.label]))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_SERVICIO.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.estado === 'confirmado' && (
              <div className="col-span-2 space-y-1">
                <Label>Fecha de confirmación de preñez</Label>
                <Input type="date" value={form.fecha_confirmacion} onChange={e => set('fecha_confirmacion', e.target.value)} />
                <p className="text-xs text-gray-400">Se suele confirmar por ecografía a los 24–30 días del servicio.</p>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas del servicio..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>

          {parto && celo && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 space-y-1">
              <p><Ic n="tetero" /> <strong>Parto probable:</strong> {fmt(parto)} ({DIAS_GESTACION} días desde el servicio)</p>
              <p><Ic n="repetir" /> <strong>Si repite celo</strong>, sería alrededor del {fmt(celo)} — a los 21 días. Si vuelve a
                 entrar en celo, este servicio no prendió.</p>
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
