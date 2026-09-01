'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'

type Horario = Database['public']['Tables']['horarios_alimentacion_aves']['Row']

interface Props {
  loteId: string
  fincaId: string
}

export default function HorariosAlimentacion({ loteId, fincaId }: Props) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [completadosHoy, setCompletadosHoy] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState({ hora: '', descripcion: '', cantidad_kg: '' })
  const [saving, setSaving] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formEditar, setFormEditar] = useState({ hora: '', descripcion: '', cantidad_kg: '' })
  const [estimadoKgDia, setEstimadoKgDia] = useState('')
  const [editandoEstimado, setEditandoEstimado] = useState(false)
  const [permitirExceder, setPermitirExceder] = useState(false)

  const hoyStr = new Date().toISOString().split('T')[0]

  const fetchHorarios = useCallback(async () => {
    setLoading(true)
    const [horariosRes, completadosRes, loteRes] = await Promise.all([
      supabase.from('horarios_alimentacion_aves').select('*').eq('lote_id', loteId).eq('activo', true).order('hora', { ascending: true }),
      supabase.from('horarios_alimentacion_completados').select('horario_id').eq('lote_id', loteId).eq('fecha', hoyStr),
      supabase.from('lotes_aves').select('consumo_estimado_kg_dia').eq('id', loteId).maybeSingle(),
    ])
    setHorarios(horariosRes.data ?? [])
    setCompletadosHoy(new Set((completadosRes.data ?? []).map(c => c.horario_id)))
    setEstimadoKgDia(loteRes.data?.consumo_estimado_kg_dia != null ? String(loteRes.data.consumo_estimado_kg_dia) : '')
    setLoading(false)
  }, [loteId, supabase, hoyStr])

  useEffect(() => { fetchHorarios() }, [fetchHorarios])

  async function guardarEstimado() {
    const { error } = await supabase.from('lotes_aves').update({
      consumo_estimado_kg_dia: estimadoKgDia ? Number(estimadoKgDia) : null,
    }).eq('id', loteId)
    if (error) { toast.error('Error al guardar el estimado'); return }
    setEditandoEstimado(false)
    setPermitirExceder(false)
    toast.success('Consumo estimado actualizado')
  }

  function excedeLimite(totalConCambio: number) {
    const estimado = Number(estimadoKgDia) || 0
    return estimado > 0 && !permitirExceder && totalConCambio > estimado
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevo.hora) { toast.error('Ingresa la hora de alimentación'); return }
    const kgNuevo = nuevo.cantidad_kg ? Number(nuevo.cantidad_kg) : 0
    if (excedeLimite(totalProgramadoKg + kgNuevo)) {
      toast.error(`Superarías el consumo estimado (${estimadoKgDia} kg/día). Usa "Cambiar límites" si es intencional.`)
      return
    }
    setSaving(true)
    const { error } = await supabase.from('horarios_alimentacion_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      hora: nuevo.hora,
      descripcion: nuevo.descripcion || null,
      cantidad_kg: nuevo.cantidad_kg ? Number(nuevo.cantidad_kg) : null,
    })
    setSaving(false)
    if (error) { toast.error('Error al agregar el horario'); return }
    setNuevo({ hora: '', descripcion: '', cantidad_kg: '' })
    setPermitirExceder(false)
    fetchHorarios()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('horarios_alimentacion_aves').update({ activo: false }).eq('id', id)
    if (error) { toast.error('Error al eliminar el horario'); return }
    setHorarios(prev => prev.filter(h => h.id !== id))
  }

  function empezarEdicion(h: Horario) {
    setEditandoId(h.id)
    setFormEditar({ hora: h.hora.slice(0, 5), descripcion: h.descripcion ?? '', cantidad_kg: h.cantidad_kg != null ? String(h.cantidad_kg) : '' })
  }

  async function guardarEdicion(id: string) {
    const kgAnterior = horarios.find(h => h.id === id)?.cantidad_kg ?? 0
    const kgNuevo = formEditar.cantidad_kg ? Number(formEditar.cantidad_kg) : 0
    if (excedeLimite(totalProgramadoKg - kgAnterior + kgNuevo)) {
      toast.error(`Superarías el consumo estimado (${estimadoKgDia} kg/día). Usa "Cambiar límites" si es intencional.`)
      return
    }
    const { error } = await supabase.from('horarios_alimentacion_aves').update({
      hora: formEditar.hora,
      descripcion: formEditar.descripcion || null,
      cantidad_kg: formEditar.cantidad_kg ? Number(formEditar.cantidad_kg) : null,
    }).eq('id', id)
    if (error) { toast.error('Error al guardar el horario'); return }
    setEditandoId(null)
    setPermitirExceder(false)
    toast.success('Horario actualizado')
    fetchHorarios()
  }

  async function marcarHecho(h: Horario) {
    const yaHecho = completadosHoy.has(h.id)
    const kg = h.cantidad_kg ?? 0

    if (yaHecho) {
      const { error } = await supabase.from('horarios_alimentacion_completados').delete().eq('horario_id', h.id).eq('fecha', hoyStr)
      if (error) { toast.error('Error al desmarcar'); return }
    } else {
      const { error } = await supabase.from('horarios_alimentacion_completados').insert({ horario_id: h.id, lote_id: loteId, finca_id: fincaId, fecha: hoyStr })
      if (error) { toast.error('Error al marcar como hecho'); return }
    }

    if (kg > 0) {
      const delta = yaHecho ? -kg : kg
      const { data: existente } = await supabase.from('produccion_diaria_aves').select('id, alimento_kg').eq('lote_id', loteId).eq('fecha', hoyStr).maybeSingle()
      const nuevoTotal = Math.max(0, Number(existente?.alimento_kg ?? 0) + delta)
      if (existente) {
        await supabase.from('produccion_diaria_aves').update({ alimento_kg: nuevoTotal }).eq('id', existente.id)
      } else {
        await supabase.from('produccion_diaria_aves').insert({ lote_id: loteId, finca_id: fincaId, fecha: hoyStr, alimento_kg: nuevoTotal })
      }
      await supabase.from('lotes_aves').update({ consumo_activo_kg: nuevoTotal }).eq('id', loteId)
    }

    setCompletadosHoy(prev => {
      const next = new Set(prev)
      if (yaHecho) next.delete(h.id); else next.add(h.id)
      return next
    })
  }

  function fmtHora(h: string) {
    const [hh, mm] = h.split(':')
    const hour = Number(hh)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    return `${hour12}:${mm} ${ampm}`
  }

  const totalProgramadoKg = horarios.reduce((s, h) => s + (h.cantidad_kg ?? 0), 0)
  const totalParcialKg = horarios.filter(h => completadosHoy.has(h.id)).reduce((s, h) => s + (h.cantidad_kg ?? 0), 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-gray-700">🕐 Horarios de Alimentación</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              Alimento parcial (hoy): {totalParcialKg.toFixed(1)} kg
            </span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              Total del día (fijo): {totalProgramadoKg.toFixed(1)} kg
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {editandoEstimado ? (
            <>
              <Label className="text-xs">Consumo estimado (kg/día)</Label>
              <Input type="number" min="0" step="0.1" className="w-28 h-7" value={estimadoKgDia} onChange={e => setEstimadoKgDia(e.target.value)} />
              <Button size="sm" className="h-7 text-xs bg-green-700 hover:bg-green-800 text-white" onClick={guardarEstimado}>Guardar</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditandoEstimado(false)}>Cancelar</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400">
                {estimadoKgDia ? `Límite: ${estimadoKgDia} kg/día` : 'Sin límite de consumo estimado configurado'}
              </p>
              <button type="button" onClick={() => setEditandoEstimado(true)} className="text-xs text-amber-600 hover:underline">Configurar límite</button>
              {estimadoKgDia && (
                <button
                  type="button"
                  onClick={() => setPermitirExceder(v => !v)}
                  className={`text-xs rounded-full px-2 py-0.5 border ${permitirExceder ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  {permitirExceder ? '🔓 Cambiar límites: activo' : '🔒 Cambiar límites'}
                </button>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : horarios.length === 0 ? (
          <p className="text-sm text-gray-400">Sin horarios configurados. Ej: 8:00 am, 1:00 pm, 5:00 pm</p>
        ) : (
          <div className="space-y-2">
            {horarios.map(h => {
              const hecho = completadosHoy.has(h.id)
              if (editandoId === h.id) {
                return (
                  <div key={h.id} className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Hora</Label>
                      <Input type="time" value={formEditar.hora} onChange={e => setFormEditar(p => ({ ...p, hora: e.target.value }))} className="w-32" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Descripción</Label>
                      <Input value={formEditar.descripcion} onChange={e => setFormEditar(p => ({ ...p, descripcion: e.target.value }))} />
                    </div>
                    <div className="space-y-1 w-28">
                      <Label className="text-xs">Porción (kg)</Label>
                      <Input type="number" min="0" step="0.1" value={formEditar.cantidad_kg} onChange={e => setFormEditar(p => ({ ...p, cantidad_kg: e.target.value }))} />
                    </div>
                    <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={() => guardarEdicion(h.id)}>Guardar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditandoId(null)}>Cancelar</Button>
                  </div>
                )
              }
              return (
                <div key={h.id} className={`flex items-center gap-2 border rounded-lg pl-3 pr-1.5 py-1.5 text-sm ${hecho ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                  <span className="font-semibold text-amber-800">{fmtHora(h.hora)}</span>
                  {h.descripcion && <span className="text-amber-600 text-xs">{h.descripcion}</span>}
                  {h.cantidad_kg != null && <span className="text-amber-600 text-xs">· porción: {h.cantidad_kg} kg</span>}
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant={hecho ? 'default' : 'outline'}
                    className={hecho ? 'h-7 text-xs bg-green-600 hover:bg-green-700 text-white' : 'h-7 text-xs'}
                    onClick={() => marcarHecho(h)}
                  >
                    {hecho ? '✓ Hecho' : 'Marcar hecho'}
                  </Button>
                  <button type="button" onClick={() => empezarEdicion(h)} className="text-amber-500 hover:text-amber-700 w-6 h-6 flex items-center justify-center" aria-label="Editar horario">
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(h.id)}
                    className="text-amber-400 hover:text-red-600 rounded-full w-5 h-5 flex items-center justify-center"
                    aria-label="Eliminar horario"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex items-end gap-2 pt-2 border-t border-gray-100">
          <div className="space-y-1">
            <Label className="text-xs">Hora</Label>
            <Input type="time" value={nuevo.hora} onChange={e => setNuevo(p => ({ ...p, hora: e.target.value }))} className="w-32" />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Descripción</Label>
            <Input placeholder="Ej: Comida mañana" value={nuevo.descripcion} onChange={e => setNuevo(p => ({ ...p, descripcion: e.target.value }))} />
          </div>
          <div className="space-y-1 w-28">
            <Label className="text-xs">Porción (kg)</Label>
            <Input type="number" min="0" step="0.1" value={nuevo.cantidad_kg} onChange={e => setNuevo(p => ({ ...p, cantidad_kg: e.target.value }))} />
          </div>
          <Button type="submit" disabled={saving} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
            + Agregar
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
