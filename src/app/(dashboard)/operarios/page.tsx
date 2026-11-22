'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRolFinca } from '@/components/agro/RolProvider'
import { permisos, ROLES_ASIGNABLES, NOMBRE_ROL, type RolFinca } from '@/lib/roles'
import { dbGenerico } from '@/lib/especiesConfig'
import { toast } from 'sonner'
import CodigosFinca from '@/components/agro/operarios/CodigosFinca'
import DesempenoEquipo from '@/components/agro/operarios/DesempenoEquipo'
import { getOperarios, actualizarEstadoOperario } from '@/lib/supabase/actions'
import InvitarOperarioModal from '@/components/agro/operarios/InvitarOperarioModal'
import EditarOperarioModal from '@/components/agro/operarios/EditarOperarioModal'
import MiPerfilOperario from '@/components/agro/operarios/MiPerfilOperario'
import TareasEquipo from '@/components/agro/operarios/TareasEquipo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import { Ic } from '@/components/ui/icon'

type Operario = { id: string; full_name: string | null; cargo: string | null; activo: boolean; email: string | null; pago_monto: number | null; pago_periodo: string | null; rol: RolFinca; tipo_contrato?: string | null }

const PERIODO_LABEL: Record<string, string> = {
  mensual: 'mensual', quincenal: 'quincenal', semanal: 'semanal', diario: 'diario', por_hora: 'hora', por_tarea: 'por tarea',
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}
type Turno = { id: string; operario_id: string; fecha: string; hora_inicio: string; hora_fin: string | null; area: string | null }

type Tab = 'turnos' | 'tareas' | 'desempeno'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function OperariosPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const { manejarEquipo, verNomina } = permisos(useRolFinca())
  const supabase = createClient()

  const [operarios, setOperarios] = useState<Operario[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('turnos')
  const [modalOperario, setModalOperario] = useState(false)
  const [operarioEditar, setOperarioEditar] = useState<Operario | null>(null)

  const [formTurno, setFormTurno] = useState({ operario_id: '', fecha: hoyLocal(), hora_inicio: '', hora_fin: '', area: '' })
  const [showFormTurno, setShowFormTurno] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!fincaActual) return
    setLoading(true)
    const [ops, t] = await Promise.all([
      getOperarios(fincaActual.id),
      supabase.from('turnos_operarios').select('*').eq('finca_id', fincaActual.id).order('fecha', { ascending: false }).limit(50),
    ])
    setOperarios(ops)
    setTurnos(t.data ?? [])
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
    setFormTurno({ operario_id: '', fecha: hoyLocal(), hora_inicio: '', hora_fin: '', area: '' })
    fetchAll()
  }

  function nombreOperario(id: string | null) {
    if (!id) return 'Sin asignar'
    return operarios.find(o => o.id === id)?.full_name ?? 'Operario'
  }

  if (fincaLoading) return <div className="p-4 md:p-8"><Skeleton className="h-8 w-64 mb-6" /><Skeleton className="h-64 rounded-xl" /></div>

  async function cambiarRol(op: Operario, rol: string) {
    if (!fincaActual) return
    const { error } = await dbGenerico(supabase).rpc('cambiar_rol_miembro', { p_finca: fincaActual.id, p_perfil: op.id, p_rol: rol })
    if (error) { toast.error(error.message); return }
    setOperarios(prev => prev.map(o => o.id === op.id ? { ...o, rol: rol as RolFinca } : o))
    toast.success(`${op.full_name ?? 'La persona'} ahora es ${NOMBRE_ROL[rol as RolFinca]}`)
  }

  // Contabilidad y nómina: solo el desempeño y el pago del equipo
  if (!manejarEquipo && verNomina) {
    if (!fincaActual) return null
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div>
          <h2 className="font-heading text-2xl md:text-3xl font-medium text-gray-900">Nómina</h2>
          <p className="mt-1 text-gray-500">Lo que trabajó cada persona del equipo y lo que le toca por eso</p>
        </div>
        {loading ? <Skeleton className="h-64 rounded-xl" /> : (
          <>
            <DesempenoEquipo fincaId={fincaActual.id} fincaNombre={fincaActual.nombre} operarios={operarios} />
            <div className="superficie rounded-2xl p-4">
              <p className="mb-3 text-sm font-medium text-gray-800">Contrato y pago de cada persona</p>
              <ul className="divide-y divide-gray-100">
                {operarios.map(op => (
                  <li key={op.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span><span className="font-medium text-gray-900">{op.full_name ?? '—'}</span> <span className="text-gray-500">· {NOMBRE_ROL[op.rol]}</span></span>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setOperarioEditar(op)}>Contrato y pago</Button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <EditarOperarioModal open={!!operarioEditar} onClose={() => setOperarioEditar(null)} fincaId={fincaActual.id} operario={operarioEditar} onUpdated={fetchAll} />
      </div>
    )
  }

  if (!manejarEquipo) {
    if (!fincaActual) return null
    return <MiPerfilOperario fincaId={fincaActual.id} />
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h2 className="font-heading text-2xl md:text-3xl font-medium text-gray-900">Operarios</h2>
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
              <p className="text-3xl mb-2"><Ic n="operario" /></p>
              <p>Sin operarios registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Nombre</TableHead><TableHead>Rol</TableHead><TableHead>Cargo</TableHead><TableHead>Correo</TableHead><TableHead>Pago</TableHead><TableHead>Estado</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {operarios.map(op => (
                  <TableRow key={op.id}>
                    <TableCell className="font-medium text-sm">{op.full_name ?? '—'}</TableCell>
                    <TableCell>
                      <select value={op.rol === 'trabajador' ? 'operario' : op.rol} onChange={e => cambiarRol(op, e.target.value)}
                        aria-label={`Rol de ${op.full_name ?? 'la persona'}`}
                        className="h-8 rounded-md border border-gray-200 bg-white px-1.5 text-sm">
                        {ROLES_ASIGNABLES.map(r => <option key={r.v} value={r.v}>{r.t}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{op.cargo ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500 font-mono">{op.email ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {op.pago_monto ? `${cop(op.pago_monto)} / ${PERIODO_LABEL[op.pago_periodo ?? ''] ?? op.pago_periodo}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={op.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {op.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setOperarioEditar(op)}>
                        Editar
                      </Button>
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

      {fincaActual && <CodigosFinca fincaId={fincaActual.id} />}

      <div className="flex flex-wrap gap-x-2 border-b border-gray-200">
        {([{ id: 'turnos' as const, label: 'Turnos' }, { id: 'tareas' as const, label: 'Tareas' }, { id: 'desempeno' as const, label: 'Desempeño y pago' }]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors', tab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'desempeno' ? (
        fincaActual && <DesempenoEquipo fincaId={fincaActual.id} fincaNombre={fincaActual.nombre} operarios={operarios} />
      ) : tab === 'turnos' ? (
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
              <div className="py-10 text-center text-gray-400"><p className="text-3xl mb-2"><Ic n="reloj" /></p><p>Sin turnos registrados</p></div>
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
      ) : fincaActual ? (
        <TareasEquipo fincaId={fincaActual.id} operarios={operarios} puedeEditar />
      ) : null}

      {fincaActual && (
        <>
          <InvitarOperarioModal open={modalOperario} onClose={() => setModalOperario(false)} fincaId={fincaActual.id} onCreated={fetchAll} />
          <EditarOperarioModal
            open={!!operarioEditar}
            onClose={() => setOperarioEditar(null)}
            fincaId={fincaActual.id}
            operario={operarioEditar}
            onUpdated={fetchAll}
          />
        </>
      )}
    </div>
  )
}
