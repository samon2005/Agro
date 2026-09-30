'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import type { Database } from '@/types/database'
import type { EspecieFinca } from '@/lib/especies'

type PlanVacuna = Database['public']['Tables']['plan_vacunacion']['Row']

interface Props {
  fincaId: string
  especie: EspecieFinca
  /** Lote al que se le aplican: dice qué día de vida lleva */
  loteId: string
  fechaIngreso: string
  /** Vacunas ya aplicadas a este lote, para marcar las que faltan */
  vacunasAplicadas: { vacuna: string; plan_id?: string | null; fecha_aplicacion: string }[]
  /** Tabla donde se guardan las vacunaciones de la especie */
  tablaVacunaciones: string
  animalesActuales: number
  onAplicada: () => void
}

function diasDeVida(fechaIngreso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(fechaIngreso + 'T00:00:00').getTime()) / 86400000))
}

function fechaDelDia(fechaIngreso: string, dia: number): string {
  const d = new Date(fechaIngreso + 'T00:00:00')
  d.setDate(d.getDate() + dia)
  return d.toISOString().slice(0, 10)
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

/**
 * El plan de vacunación de la granja: qué vacuna va a qué día de vida. Se
 * escribe una vez por especie y todos los lotes lo siguen, avisando cuál toca y
 * cuál se pasó. Las vacunas de granja son obligatorias, no opcionales.
 */
export default function PlanVacunacion({
  fincaId, especie, loteId, fechaIngreso, vacunasAplicadas, tablaVacunaciones, animalesActuales, onAplicada,
}: Props) {
  const supabase = createClient()
  const [plan, setPlan] = useState<PlanVacuna[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editar, setEditar] = useState<PlanVacuna | null>(null)
  const [form, setForm] = useState({ vacuna: '', dia_vida: '', via: '', dosis: '' })
  const [guardando, setGuardando] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [aplicando, setAplicando] = useState<string | null>(null)

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('plan_vacunacion')
      .select('*')
      .eq('finca_id', fincaId)
      .eq('especie', especie)
      .order('dia_vida')
    setPlan(data ?? [])
    setLoading(false)
  }, [fincaId, especie, supabase])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  const dia = diasDeVida(fechaIngreso)
  const aplicadaPorPlan = new Map(
    vacunasAplicadas.filter(v => v.plan_id).map(v => [v.plan_id as string, v]),
  )
  // Cuando no se aplicó desde el plan, se reconoce por el nombre de la vacuna
  const aplicadaPorNombre = new Map(vacunasAplicadas.map(v => [v.vacuna.trim().toLowerCase(), v]))

  function aplicacionDe(renglon: PlanVacuna) {
    return aplicadaPorPlan.get(renglon.id) ?? aplicadaPorNombre.get(renglon.vacuna.trim().toLowerCase()) ?? null
  }

  const pendientesVencidas = plan.filter(r => !aplicacionDe(r) && r.dia_vida < dia)
  const paraHoy = plan.filter(r => !aplicacionDe(r) && r.dia_vida === dia)

  function abrir(renglon: PlanVacuna | null) {
    setEditar(renglon)
    setForm(renglon
      ? { vacuna: renglon.vacuna, dia_vida: String(renglon.dia_vida), via: renglon.via ?? '', dosis: renglon.dosis ?? '' }
      : { vacuna: '', dia_vida: '', via: '', dosis: '' })
    setModal(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vacuna.trim()) { toast.error('Escribe el nombre de la vacuna'); return }
    if (form.dia_vida === '' || Number(form.dia_vida) < 0) { toast.error('Indica a qué día de vida va'); return }

    setGuardando(true)
    const datos = {
      vacuna: form.vacuna.trim(),
      dia_vida: Number(form.dia_vida),
      via: form.via || null,
      dosis: form.dosis || null,
    }
    const { error } = editar
      ? await supabase.from('plan_vacunacion').update(datos).eq('id', editar.id)
      : await supabase.from('plan_vacunacion').insert({ ...datos, finca_id: fincaId, especie })
    setGuardando(false)
    if (error) { toast.error('Error al guardar el plan'); return }
    toast.success(editar ? 'Plan actualizado' : 'Vacuna agregada al plan de la granja')
    setModal(false)
    setEditar(null)
    fetchPlan()
  }

  async function eliminar(renglon: PlanVacuna) {
    if (confirmando !== renglon.id) { setConfirmando(renglon.id); return }
    setConfirmando(null)
    const { error } = await supabase.from('plan_vacunacion').delete().eq('id', renglon.id)
    if (error) { toast.error('Error al eliminar del plan'); return }
    toast.success('Vacuna quitada del plan')
    fetchPlan()
  }

  /** Marcar la vacuna como puesta deja el registro en la sanidad del lote. */
  async function aplicar(renglon: PlanVacuna) {
    setAplicando(renglon.id)
    // La tabla de vacunaciones cambia con la especie, así que va sin tipar
    const { error } = await (supabase as unknown as SupabaseClient)
      .from(tablaVacunaciones)
      .insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha_aplicacion: hoyLocal(),
        vacuna: renglon.vacuna,
        via_administracion: renglon.via,
        dosis: renglon.dosis,
        numero_aves: animalesActuales,
        plan_id: renglon.id,
      })
    setAplicando(null)
    if (error) { toast.error('Error al registrar la vacunación'); return }
    toast.success(`${renglon.vacuna} registrada para este lote`)
    onAplicada()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Plan de vacunación de la granja</CardTitle>
          <p className="text-xs text-gray-500">
            Las vacunas de la granja van a un día de vida fijo y son obligatorias. El lote va en el día {dia}.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => abrir(null)}><Ic n="mas" /> Agregar vacuna</Button>
      </CardHeader>
      <CardContent className="p-0">
        {(pendientesVencidas.length > 0 || paraHoy.length > 0) && (
          <div className={`mx-4 mb-3 rounded-lg px-3 py-2 text-xs ring-1 ${
            pendientesVencidas.length > 0 ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-amber-50 text-amber-800 ring-amber-200'
          }`}>
            {pendientesVencidas.length > 0 && (
              <p><Ic n="sirena" /> <strong>{pendientesVencidas.length}</strong> vacuna(s) del plan sin poner: {pendientesVencidas.map(r => `${r.vacuna} (día ${r.dia_vida})`).join(', ')}</p>
            )}
            {paraHoy.length > 0 && (
              <p><Ic n="vacuna" /> Hoy toca: {paraHoy.map(r => r.vacuna).join(', ')}</p>
            )}
          </div>
        )}

        {loading ? (
          <p className="p-4 text-sm text-gray-400">Cargando…</p>
        ) : plan.length === 0 ? (
          <div className="py-8 text-center">
            <Ic n="vacuna" className="mx-auto mb-2 size-8 text-gray-300" />
            <p className="font-medium text-gray-700">Sin plan de vacunación</p>
            <p className="text-sm text-gray-500">Escribe las vacunas de la granja y a qué día de vida van; los lotes las seguirán solos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Día de vida</TableHead>
                  <TableHead>Vacuna</TableHead>
                  <TableHead>Vía y dosis</TableHead>
                  <TableHead>En este lote</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.map(r => {
                  const aplicada = aplicacionDe(r)
                  const vencida = !aplicada && r.dia_vida < dia
                  return (
                    <TableRow key={r.id} className={vencida ? 'bg-red-50' : undefined}>
                      <TableCell className="py-2 text-sm">
                        Día {r.dia_vida}
                        <span className="block text-[0.6875rem] text-gray-400">{fmt(fechaDelDia(fechaIngreso, r.dia_vida))}</span>
                      </TableCell>
                      <TableCell className="py-2 text-sm font-medium">{r.vacuna}</TableCell>
                      <TableCell className="py-2 text-sm text-gray-600">
                        {[r.via, r.dosis].filter(Boolean).join(' · ') || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {aplicada
                          ? <Badge className="bg-green-100 text-[10px] text-green-700">Puesta el {fmt(aplicada.fecha_aplicacion)}</Badge>
                          : vencida
                            ? <Badge className="bg-red-100 text-[10px] text-red-700">Atrasada</Badge>
                            : r.dia_vida === dia
                              ? <Badge className="bg-amber-100 text-[10px] text-amber-700">Toca hoy</Badge>
                              : <span className="text-gray-400">En {r.dia_vida - dia} día(s)</span>}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          {!aplicada && (
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs"
                              disabled={aplicando === r.id}
                              onClick={() => aplicar(r)}
                            >
                              Marcar puesta
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => abrir(r)}>
                            <Ic n="editar" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className={confirmando === r.id ? 'h-7 bg-red-600 px-2 text-xs text-white hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                            onClick={() => eliminar(r)}
                          >
                            {confirmando === r.id ? '¿Confirmar?' : <Ic n="borrar" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={modal} onOpenChange={v => !v && setModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editar ? 'Editar vacuna del plan' : 'Agregar vacuna al plan'}</DialogTitle>
            <p className="text-sm text-gray-500">El plan es de la granja: lo siguen todos los lotes de esta especie.</p>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-1">
              <Label>Vacuna *</Label>
              <Input placeholder="Ej: Newcastle, Gumboro..." value={form.vacuna} onChange={e => setForm(p => ({ ...p, vacuna: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Día de vida *</Label>
                <Input type="number" min="0" placeholder="Ej: 7" value={form.dia_vida} onChange={e => setForm(p => ({ ...p, dia_vida: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Vía</Label>
                <Input placeholder="Ocular, agua..." value={form.via} onChange={e => setForm(p => ({ ...p, via: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Dosis</Label>
                <Input placeholder="Ej: 0,5 ml" value={form.dosis} onChange={e => setForm(p => ({ ...p, dosis: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
