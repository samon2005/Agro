'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import type { Database } from '@/types/database'

type Tarea = Database['public']['Tables']['tareas_operarios']['Row']
type Galpon = { id: string; nombre: string }
export type OperarioTarea = { id: string; full_name: string | null }

type Filtro = 'hoy' | 'proximas' | 'hechas' | 'todas'
const SIN = '__sin__'
const REPETIR = { no: 'No se repite', diaria: 'Todos los días', semanal: 'Cada semana' } as const
const VACIO = { descripcion: '', operario_id: SIN, fecha: hoyLocal(), hora_inicio: '', instalacion_id: SIN, prioridad: 'normal' as Tarea['prioridad'], repetir: 'no' as Tarea['repetir'], notas: '' }

const fechaLarga = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * Las tareas del equipo: el administrador las crea, asigna y edita; cada operario
 * ve las suyas y las marca hechas. Las que se repiten vuelven a aparecer solas
 * al completarlas.
 */
export default function TareasEquipo({ fincaId, operarios, soloDe, puedeEditar }: {
  fincaId: string
  operarios: OperarioTarea[]
  /** Solo las tareas de este operario (su propia vista) */
  soloDe?: string
  puedeEditar: boolean
}) {
  const supabase = createClient()
  const hoy = hoyLocal()
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [galpones, setGalpones] = useState<Galpon[]>([])
  const [filtro, setFiltro] = useState<Filtro>('hoy')
  const [editando, setEditando] = useState<Tarea | 'nueva' | null>(null)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    let q = supabase.from('tareas_operarios').select('*').eq('finca_id', fincaId).order('fecha').order('created_at')
    if (soloDe) q = q.eq('operario_id', soloDe)
    const [t, g] = await Promise.all([q.limit(500), supabase.from('instalaciones').select('id, nombre').eq('finca_id', fincaId).order('nombre')])
    setTareas(t.data ?? [])
    setGalpones(g.data ?? [])
  }, [supabase, fincaId, soloDe])

  useEffect(() => { cargar() }, [cargar])

  const nombre = (id: string | null) => (id ? operarios.find(o => o.id === id)?.full_name ?? 'Operario' : 'Sin asignar')
  const galpon = (id: string | null) => (id ? galpones.find(g => g.id === id)?.nombre ?? null : null)

  function abrir(t: Tarea | 'nueva') {
    setEditando(t)
    setForm(t === 'nueva' ? { ...VACIO, fecha: hoy } : {
      descripcion: t.descripcion, operario_id: t.operario_id ?? SIN, fecha: t.fecha, hora_inicio: t.hora_inicio?.slice(0, 5) ?? '',
      instalacion_id: t.instalacion_id ?? SIN, prioridad: t.prioridad, repetir: t.repetir, notas: t.notas ?? '',
    })
  }

  async function guardar() {
    const descripcion = form.descripcion.trim()
    if (!descripcion) { toast.error('Escribe qué hay que hacer'); return }
    if (!form.fecha) { toast.error('Indica el día'); return }
    const payload = {
      descripcion,
      operario_id: form.operario_id === SIN ? null : form.operario_id,
      fecha: form.fecha,
      hora_inicio: form.hora_inicio || null,
      instalacion_id: form.instalacion_id === SIN ? null : form.instalacion_id,
      prioridad: form.prioridad,
      repetir: form.repetir,
      notas: form.notas.trim() || null,
    }
    setGuardando(true)
    const { error } = editando === 'nueva'
      ? await supabase.from('tareas_operarios').insert({ ...payload, finca_id: fincaId })
      : await supabase.from('tareas_operarios').update(payload).eq('id', editando!.id)
    setGuardando(false)
    if (error) { toast.error('No se pudo guardar la tarea'); return }
    toast.success(editando === 'nueva' ? 'Tarea creada' : 'Tarea actualizada')
    setEditando(null)
    cargar()
  }

  async function marcar(t: Tarea, hecha: boolean) {
    const { error } = await supabase.from('tareas_operarios').update({ estado: hecha ? 'completada' : 'pendiente' }).eq('id', t.id)
    if (error) { toast.error('No se pudo cambiar la tarea'); return }
    if (hecha && t.repetir !== 'no') toast.success(`Hecha. La siguiente quedó para ${t.repetir === 'diaria' ? 'mañana' : 'dentro de una semana'}.`)
    cargar()
  }

  async function borrar(t: Tarea) {
    if (confirmando !== t.id) { setConfirmando(t.id); return }
    setConfirmando(null)
    const { error } = await supabase.from('tareas_operarios').delete().eq('id', t.id)
    if (error) { toast.error('No se pudo borrar la tarea'); return }
    cargar()
  }

  if (tareas == null) return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  const pendientes = tareas.filter(t => t.estado !== 'completada')
  const lista = filtro === 'hoy' ? pendientes.filter(t => t.fecha <= hoy)
    : filtro === 'proximas' ? pendientes.filter(t => t.fecha > hoy)
    : filtro === 'hechas' ? [...tareas.filter(t => t.estado === 'completada')].reverse()
    : tareas
  const atrasadas = pendientes.filter(t => t.fecha < hoy).length
  const conteo: Record<Filtro, number> = {
    hoy: pendientes.filter(t => t.fecha <= hoy).length,
    proximas: pendientes.filter(t => t.fecha > hoy).length,
    hechas: tareas.length - pendientes.length,
    todas: tareas.length,
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {([['hoy', 'Hoy y atrasadas'], ['proximas', 'Próximas'], ['hechas', 'Hechas'], ['todas', 'Todas']] as const).map(([v, t]) => (
            <button key={v} onClick={() => setFiltro(v)}
              className={cn('h-8 rounded-lg px-3 text-sm font-medium', filtro === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
              {t}{conteo[v] > 0 && <span className="ml-1 text-xs text-gray-400">{conteo[v]}</span>}
            </button>
          ))}
        </div>
        {puedeEditar && <Button size="sm" onClick={() => abrir('nueva')}><Ic n="mas" /> Nueva tarea</Button>}
      </div>
      {filtro === 'hoy' && atrasadas > 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><Ic n="reloj" /> {atrasadas} tarea{atrasadas === 1 ? '' : 's'} atrasada{atrasadas === 1 ? '' : 's'}</p>
      )}

      <Card>
        <CardContent className="p-0">
          {lista.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              <Ic n="listo" /> {filtro === 'hoy' ? 'Nada pendiente para hoy' : 'Sin tareas aquí'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {lista.map((t, i) => {
                const hecha = t.estado === 'completada'
                const atrasada = !hecha && t.fecha < hoy
                const nuevoDia = i === 0 || lista[i - 1].fecha !== t.fecha
                return (
                  <li key={t.id}>
                    {nuevoDia && filtro !== 'hechas' && (
                      <p className={cn('bg-gray-50 px-4 py-1 text-[0.6875rem] font-medium first-letter:uppercase', atrasada ? 'text-red-600' : t.fecha === hoy ? 'text-green-700' : 'text-gray-500')}>
                        {t.fecha === hoy ? 'Hoy' : fechaLarga(t.fecha)}{atrasada ? ' · atrasada' : ''}
                      </p>
                    )}
                    <div className="flex items-start gap-3 px-4 py-2.5">
                      <input
                        type="checkbox" className="mt-1 size-4 accent-green-700" checked={hecha}
                        onChange={e => marcar(t, e.target.checked)}
                        aria-label={hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm', hecha ? 'text-gray-400 line-through' : 'text-gray-800')}>
                          {t.prioridad === 'alta' && !hecha && <span className="mr-1 rounded bg-red-100 px-1 text-[0.625rem] font-semibold text-red-700">URGENTE</span>}
                          {t.descripcion}
                        </p>
                        <p className="text-xs text-gray-500">
                          {!soloDe && `${nombre(t.operario_id)} · `}
                          {galpon(t.instalacion_id) && `${galpon(t.instalacion_id)} · `}
                          {t.hora_inicio && `${t.hora_inicio.slice(0, 5)} · `}
                          {t.repetir !== 'no' && <><Ic n="repetir" className="size-3" /> {REPETIR[t.repetir].toLowerCase()} · </>}
                          {hecha && t.completada_en
                            ? `hecha el ${new Date(t.completada_en).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${t.completada_por && !soloDe ? ` por ${nombre(t.completada_por)}` : ''}`
                            : t.estado === 'en_progreso' ? 'en progreso' : ''}
                        </p>
                        {t.notas && <p className="text-xs text-gray-400">{t.notas}</p>}
                      </div>
                      {puedeEditar && (
                        <div className="flex shrink-0 gap-1">
                          <button onClick={() => abrir(t)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Editar"><Ic n="editar" className="size-4" /></button>
                          <button onClick={() => borrar(t)} onBlur={() => setConfirmando(null)}
                            className={cn('rounded-md p-1.5 text-xs', confirmando === t.id ? 'bg-red-600 px-2 text-white' : 'text-gray-400 hover:bg-red-50 hover:text-red-600')} title="Borrar">
                            {confirmando === t.id ? '¿Borrar?' : <Ic n="borrar" className="size-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editando != null} onOpenChange={o => !o && !guardando && setEditando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editando === 'nueva' ? 'Nueva tarea' : 'Editar tarea'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Qué hay que hacer *</Label><Input placeholder="Ej: Lavar bebederos" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Asignar a</Label>
              <Select value={form.operario_id} onValueChange={v => setForm(p => ({ ...p, operario_id: v ?? SIN }))}
                items={{ [SIN]: 'Sin asignar', ...Object.fromEntries(operarios.map(o => [o.id, o.full_name ?? 'Operario'])) }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value={SIN}>Sin asignar</SelectItem>
                  {operarios.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name ?? 'Operario'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Galpón o lugar</Label>
              <Select value={form.instalacion_id} onValueChange={v => setForm(p => ({ ...p, instalacion_id: v ?? SIN }))}
                items={{ [SIN]: 'Toda la finca', ...Object.fromEntries(galpones.map(g => [g.id, g.nombre])) }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value={SIN}>Toda la finca</SelectItem>
                  {galpones.map(g => <SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Día</Label><Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Hora</Label><Input type="time" value={form.hora_inicio} onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Se repite</Label>
              <Select value={form.repetir} onValueChange={v => v && setForm(p => ({ ...p, repetir: v as Tarea['repetir'] }))} items={REPETIR}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {Object.entries(REPETIR).map(([v, t]) => <SelectItem key={v} value={v}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
              <input type="checkbox" className="accent-red-600" checked={form.prioridad === 'alta'} onChange={e => setForm(p => ({ ...p, prioridad: e.target.checked ? 'alta' : 'normal' }))} />
              Urgente
            </label>
            <div className="col-span-2 space-y-1"><Label>Notas</Label><Input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={guardando} onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
