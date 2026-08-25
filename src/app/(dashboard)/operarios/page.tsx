'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import { getOperarios, actualizarEstadoOperario } from '@/lib/supabase/actions'
import InvitarOperarioModal from '@/components/agro/operarios/InvitarOperarioModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Operario = { id: string; full_name: string | null; cargo: string | null; activo: boolean; email: string | null }
type Turno = { id: string; operario_id: string; fecha: string; hora_inicio: string; hora_fin: string | null; area: string | null }
type Tarea = { id: string; operario_id: string | null; descripcion: string; fecha: string; estado: string }

type Tab = 'turnos' | 'tareas'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function OperariosPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const rol = useRol()
  const supabase = createClient()

  const [operarios, setOperarios] = useState<Operario[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('turnos')
  const [modalOperario, setModalOperario] = useState(false)

  const [formTurno, setFormTurno] = useState({ operario_id: '', fecha: new Date().toISOString().split('T')[0], hora_inicio: '', hora_fin: '', area: '' })
  const [formTarea, setFormTarea] = useState({ operario_id: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
  const [showFormTurno, setShowFormTurno] = useState(false)
  const [showFormTarea, setShowFormTarea] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!fincaActual) return
    setLoading(true)
    const [ops, t, ta] = await Promise.all([
      getOperarios(fincaActual.id),
      supabase.from('turnos_operarios').select('*').eq('finca_id', fincaActual.id).order('fecha', { ascending: false }).limit(50),
      supabase.from('tareas_operarios').select('*').eq('finca_id', fincaActual.id).order('fecha', { ascending: false }).limit(50),
    ])
    setOperarios(ops)
    setTurnos(t.data ?? [])
    setTareas(ta.data ?? [])
    setLoading(false)
  }, [fincaActual, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleActivo(op: Operario) {
    if (!fincaActual) return
    await actualizarEstadoOperario(fincaActual.id, op.id, !op.activo)
    setOperarios(prev => prev.map(o => o.id === op.id ? { ...o, activo: !o.activo } : o))
  }

  async function guardarTurno(e: React.FormEvent) {
    e.preventDefault()
    if (!fincaActual || !formTurno.operario_id || !formTurno.hora_inicio) { return }
    setSaving(true)
    await supabase.from('turnos_operarios').insert({
      finca_id: fincaActual.id,
      operario_id: formTurno.operario_id,
      fecha: formTurno.fecha,
      hora_inicio: formTurno.hora_inicio,
      hora_fin: formTurno.hora_fin || null,
      area: formTurno.area || null,
    })
    setSaving(false)
    setShowFormTurno(false)
    setFormTurno({ operario_id: '', fecha: new Date().toISOString().split('T')[0], hora_inicio: '', hora_fin: '', area: '' })
    fetchAll()
  }

  async function guardarTarea(e: React.FormEvent) {
    e.preventDefault()
    if (!fincaActual || !formTarea.descripcion.trim()) return
    setSaving(true)
    await supabase.from('tareas_operarios').insert({
      finca_id: fincaActual.id,
      operario_id: formTarea.operario_id || null,
      descripcion: formTarea.descripcion.trim(),
      fecha: formTarea.fecha,
    })
    setSaving(false)
    setShowFormTarea(false)
    setFormTarea({ operario_id: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
    fetchAll()
  }

  async function cambiarEstadoTarea(id: string, estado: string) {
    await supabase.from('tareas_operarios').update({ estado }).eq('id', id)
    setTareas(prev => prev.map(t => t.id === id ? { ...t, estado } : t))
  }

  function nombreOperario(id: string | null) {
    if (!id) return 'Sin asignar'
    return operarios.find(o => o.id === id)?.full_name ?? 'Operario'
  }

  if (fincaLoading) return <div className="p-8"><Skeleton className="h-8 w-64 mb-6" /><Skeleton className="h-64 rounded-xl" /></div>

  if (rol === 'trabajador') {
    return (
      <div className="p-8">
        <Card className="border-dashed border-gray-300">
          <CardContent className="py-16 text-center">
            <p className="text-4xl mb-2">🔒</p>
            <p className="text-gray-600 font-medium">No tienes permiso para ver esta sección</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><span>👷</span> Operarios</h2>
        <p className="text-gray-500 mt-1">Equipo de trabajo, turnos y tareas de la finca</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Equipo</CardTitle>
          <Button className="bg-green-700 hover:bg-green-800 text-white text-sm" onClick={() => setModalOperario(true)}>+ Nuevo operario</Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : operarios.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <p className="text-3xl mb-2">👷</p>
              <p>Sin operarios registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Nombre</TableHead><TableHead>Cargo</TableHead><TableHead>Correo</TableHead><TableHead>Estado</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {operarios.map(op => (
                  <TableRow key={op.id}>
                    <TableCell className="font-medium text-sm">{op.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{op.cargo ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500 font-mono">{op.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={op.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {op.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => toggleActivo(op)}>
                        {op.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b border-gray-200">
        {([{ id: 'turnos' as const, label: '🕐 Turnos' }, { id: 'tareas' as const, label: '📋 Tareas' }]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors', tab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'turnos' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" className="text-sm" onClick={() => setShowFormTurno(v => !v)}>+ Registrar turno</Button>
          </div>
          {showFormTurno && (
            <Card className="border-green-200"><CardContent className="p-4">
              <form onSubmit={guardarTurno} className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Operario *</Label>
                  <Select value={formTurno.operario_id} onValueChange={v => setFormTurno(p => ({ ...p, operario_id: v ?? '' }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>{operarios.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={formTurno.fecha} onChange={e => setFormTurno(p => ({ ...p, fecha: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Hora inicio *</Label><Input type="time" value={formTurno.hora_inicio} onChange={e => setFormTurno(p => ({ ...p, hora_inicio: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Hora fin</Label><Input type="time" value={formTurno.hora_fin} onChange={e => setFormTurno(p => ({ ...p, hora_fin: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Área</Label><Input placeholder="Ej: Aves" value={formTurno.area} onChange={e => setFormTurno(p => ({ ...p, area: e.target.value }))} /></div>
                <div className="col-span-2 md:col-span-5 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowFormTurno(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800 text-white">{saving ? 'Guardando...' : 'Guardar'}</Button>
                </div>
              </form>
            </CardContent></Card>
          )}
          <Card><CardContent className="p-0">
            {turnos.length === 0 ? (
              <div className="py-10 text-center text-gray-400"><p className="text-3xl mb-2">🕐</p><p>Sin turnos registrados</p></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Operario</TableHead><TableHead>Horario</TableHead><TableHead>Área</TableHead></TableRow></TableHeader>
                <TableBody>
                  {turnos.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{fmt(t.fecha)}</TableCell>
                      <TableCell className="text-sm font-medium">{nombreOperario(t.operario_id)}</TableCell>
                      <TableCell className="text-sm text-gray-500">{t.hora_inicio}{t.hora_fin ? ` – ${t.hora_fin}` : ''}</TableCell>
                      <TableCell className="text-sm text-gray-500">{t.area ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" className="text-sm" onClick={() => setShowFormTarea(v => !v)}>+ Registrar tarea</Button>
          </div>
          {showFormTarea && (
            <Card className="border-green-200"><CardContent className="p-4">
              <form onSubmit={guardarTarea} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1"><Label className="text-xs">Descripción *</Label><Input placeholder="Ej: Limpiar galpón 1" value={formTarea.descripcion} onChange={e => setFormTarea(p => ({ ...p, descripcion: e.target.value }))} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Asignar a</Label>
                  <Select value={formTarea.operario_id} onValueChange={v => setFormTarea(p => ({ ...p, operario_id: v ?? '' }))}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>{operarios.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={formTarea.fecha} onChange={e => setFormTarea(p => ({ ...p, fecha: e.target.value }))} /></div>
                <div className="col-span-2 md:col-span-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowFormTarea(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800 text-white">{saving ? 'Guardando...' : 'Guardar'}</Button>
                </div>
              </form>
            </CardContent></Card>
          )}
          <Card><CardContent className="p-0">
            {tareas.length === 0 ? (
              <div className="py-10 text-center text-gray-400"><p className="text-3xl mb-2">📋</p><p>Sin tareas registradas</p></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Descripción</TableHead><TableHead>Operario</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {tareas.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{fmt(t.fecha)}</TableCell>
                      <TableCell className="text-sm font-medium">{t.descripcion}</TableCell>
                      <TableCell className="text-sm text-gray-500">{nombreOperario(t.operario_id)}</TableCell>
                      <TableCell>
                        <Select value={t.estado} onValueChange={v => v && cambiarEstadoTarea(t.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="en_progreso">En progreso</SelectItem>
                            <SelectItem value="completada">Completada</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </div>
      )}

      {fincaActual && (
        <InvitarOperarioModal open={modalOperario} onClose={() => setModalOperario(false)} fincaId={fincaActual.id} onCreated={fetchAll} />
      )}
    </div>
  )
}
