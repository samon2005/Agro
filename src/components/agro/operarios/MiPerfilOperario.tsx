'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Perfil = { full_name: string | null; cargo: string | null; pago_monto: number | null; pago_periodo: string | null }
type Turno = { id: string; fecha: string; hora_inicio: string; hora_fin: string | null; area: string | null }
type Tarea = { id: string; descripcion: string; fecha: string; estado: string }

const PERIODO_LABEL: Record<string, string> = {
  mensual: 'mensual', quincenal: 'quincenal', semanal: 'semanal', diario: 'diario', por_tarea: 'por tarea',
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props { fincaId: string }

export default function MiPerfilOperario({ fincaId }: Props) {
  const supabase = createClient()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [perfilRes, turnosRes, tareasRes] = await Promise.all([
      supabase.from('profiles').select('full_name, cargo, pago_monto, pago_periodo').eq('id', user.id).single(),
      supabase.from('turnos_operarios').select('id, fecha, hora_inicio, hora_fin, area').eq('finca_id', fincaId).eq('operario_id', user.id).order('fecha', { ascending: false }).limit(30),
      supabase.from('tareas_operarios').select('id, descripcion, fecha, estado').eq('finca_id', fincaId).eq('operario_id', user.id).order('fecha', { ascending: false }).limit(30),
    ])
    setPerfil(perfilRes.data ?? null)
    setTurnos(turnosRes.data ?? [])
    setTareas(tareasRes.data ?? [])
    setLoading(false)
  }, [fincaId, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function cambiarEstadoTarea(id: string, estado: string) {
    await supabase.from('tareas_operarios').update({ estado }).eq('id', id)
    setTareas(prev => prev.map(t => t.id === id ? { ...t, estado } : t))
  }

  if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><span>👷</span> Mi Perfil</h2>
        <p className="text-gray-500 mt-1">Tu función, calendario de turnos y tareas asignadas</p>
      </div>

      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><p className="text-xs text-green-700">Nombre</p><p className="font-semibold text-green-900">{perfil?.full_name ?? '—'}</p></div>
          <div><p className="text-xs text-green-700">Función / cargo</p><p className="font-semibold text-green-900">{perfil?.cargo ?? 'Sin asignar'}</p></div>
          <div>
            <p className="text-xs text-green-700">Pago</p>
            <p className="font-semibold text-green-900">
              {perfil?.pago_monto ? `${cop(perfil.pago_monto)} (${PERIODO_LABEL[perfil.pago_periodo ?? ''] ?? perfil?.pago_periodo})` : 'No definido'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">🕐 Mi calendario de turnos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {turnos.length === 0 ? (
            <div className="py-10 text-center text-gray-400"><p className="text-3xl mb-2">🕐</p><p>Sin turnos asignados</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Horario</TableHead><TableHead>Área</TableHead></TableRow></TableHeader>
              <TableBody>
                {turnos.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmt(t.fecha)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{t.hora_inicio}{t.hora_fin ? ` – ${t.hora_fin}` : ''}</TableCell>
                    <TableCell className="text-sm text-gray-500">{t.area ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">📋 Mis tareas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {tareas.length === 0 ? (
            <div className="py-10 text-center text-gray-400"><p className="text-3xl mb-2">📋</p><p>Sin tareas asignadas</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Descripción</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
              <TableBody>
                {tareas.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmt(t.fecha)}</TableCell>
                    <TableCell className="text-sm font-medium">{t.descripcion}</TableCell>
                    <TableCell>
                      <Select value={t.estado} onValueChange={v => v && cambiarEstadoTarea(t.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
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
        </CardContent>
      </Card>
    </div>
  )
}
