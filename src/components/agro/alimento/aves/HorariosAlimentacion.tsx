'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type Horario = Database['public']['Tables']['horarios_alimentacion_aves']['Row']

interface Props {
  loteId: string
  fincaId: string
  /**
   * Consumo registrado del galpón (kg/día). Es fijo hasta que se registre otro y
   * hace de límite para lo que se puede repartir entre los horarios.
   */
  consumoRegistradoKg?: number | null
}

export default function HorariosAlimentacion({ loteId, fincaId, consumoRegistradoKg }: Props) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [completadosHoy, setCompletadosHoy] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState({ hora: '', descripcion: '', cantidad_kg: '' })
  const [saving, setSaving] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formEditar, setFormEditar] = useState({ hora: '', descripcion: '', cantidad_kg: '' })
  const [permitirExceder, setPermitirExceder] = useState(false)

  const hoyStr = hoyLocal()
  const limiteKg = consumoRegistradoKg != null ? Number(consumoRegistradoKg) : 0

  const fetchHorarios = useCallback(async () => {
    setLoading(true)
    const [horariosRes, completadosRes] = await Promise.all([
      supabase.from('horarios_alimentacion_aves').select('*').eq('lote_id', loteId).eq('activo', true).order('hora', { ascending: true }),
      supabase.from('horarios_alimentacion_completados').select('horario_id').eq('lote_id', loteId).eq('fecha', hoyStr),
    ])
    setHorarios(horariosRes.data ?? [])
    setCompletadosHoy(new Set((completadosRes.data ?? []).map(c => c.horario_id)))
    setLoading(false)
  }, [loteId, supabase, hoyStr])

  useEffect(() => { fetchHorarios() }, [fetchHorarios])

  const totalProgramadoKg = horarios.reduce((s, h) => s + (h.cantidad_kg ?? 0), 0)
  const parcialKg = horarios.filter(h => completadosHoy.has(h.id)).reduce((s, h) => s + (h.cantidad_kg ?? 0), 0)
  const sinRepartir = Math.max(0, limiteKg - totalProgramadoKg)

  function excedeLimite(totalConCambio: number) {
    return limiteKg > 0 && !permitirExceder && totalConCambio > limiteKg
  }

  function avisarExceso(total: number) {
    const exceso = (total - limiteKg).toFixed(1)
    toast.error(
      `Estás dando ${exceso} kg más que el consumo registrado del galpón (${limiteKg} kg/día). ` +
      `Si es intencional, activa "Cambiar límites".`
    )
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevo.hora) { toast.error('Ingresa la hora de alimentación'); return }
    if (!nuevo.descripcion.trim()) { toast.error('Ponle una descripción al horario'); return }
    if (!nuevo.cantidad_kg || Number(nuevo.cantidad_kg) <= 0) { toast.error('Ingresa la porción en kg'); return }
    const kgNuevo = Number(nuevo.cantidad_kg)
    const total = totalProgramadoKg + kgNuevo
    if (excedeLimite(total)) { avisarExceso(total); return }

    setSaving(true)
    const { error } = await supabase.from('horarios_alimentacion_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      hora: nuevo.hora,
      descripcion: nuevo.descripcion || null,
      cantidad_kg: kgNuevo || null,
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
    if (!formEditar.hora) { toast.error('Ingresa la hora de alimentación'); return }
    if (!formEditar.descripcion.trim()) { toast.error('Ponle una descripción al horario'); return }
    if (!formEditar.cantidad_kg || Number(formEditar.cantidad_kg) <= 0) { toast.error('Ingresa la porción en kg'); return }
    const kgAnterior = horarios.find(h => h.id === id)?.cantidad_kg ?? 0
    const kgNuevo = Number(formEditar.cantidad_kg)
    const total = totalProgramadoKg - kgAnterior + kgNuevo
    if (excedeLimite(total)) { avisarExceso(total); return }

    const { error } = await supabase.from('horarios_alimentacion_aves').update({
      hora: formEditar.hora,
      descripcion: formEditar.descripcion || null,
      cantidad_kg: kgNuevo || null,
    }).eq('id', id)
    if (error) { toast.error('Error al guardar el horario'); return }
    setEditandoId(null)
    setPermitirExceder(false)
    toast.success('Horario actualizado')
    fetchHorarios()
  }

  /**
   * Marcar hecho solo registra que esa ración ya se entregó. No suma al consumo:
   * el consumo del galpón es el que se registró en "Registrar consumo" y los
   * horarios únicamente reparten ese total a lo largo del día.
   */
  async function marcarHecho(h: Horario) {
    const yaHecho = completadosHoy.has(h.id)

    if (yaHecho) {
      const { error } = await supabase.from('horarios_alimentacion_completados').delete().eq('horario_id', h.id).eq('fecha', hoyStr)
      if (error) { toast.error('Error al desmarcar'); return }
    } else {
      const { error } = await supabase.from('horarios_alimentacion_completados').insert({ horario_id: h.id, lote_id: loteId, finca_id: fincaId, fecha: hoyStr })
      if (error) { toast.error('Error al marcar como hecho'); return }
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

  const excedido = limiteKg > 0 && totalProgramadoKg > limiteKg
  const faltaPorRepartir = limiteKg > 0 && totalProgramadoKg > 0 && totalProgramadoKg < limiteKg

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-gray-700">🕐 Horarios de Alimentación</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              Parcial (hoy): {parcialKg.toFixed(1)} kg
            </span>
            <span className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${excedido ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
              Repartido: {totalProgramadoKg.toFixed(1)} kg
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {limiteKg > 0 ? (
            <>
              <p className="text-xs text-gray-500">
                Consumo del galpón: <span className="font-semibold text-gray-700">{limiteKg} kg/día</span>
                {sinRepartir > 0 && ` · quedan ${sinRepartir.toFixed(1)} kg por repartir`}
              </p>
              <button
                type="button"
                onClick={() => setPermitirExceder(v => !v)}
                className={`text-xs rounded-full px-2 py-0.5 border ${permitirExceder ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                {permitirExceder ? '🔓 Cambiar límites: activo' : '🔒 Cambiar límites'}
              </button>
            </>
          ) : (
            <p className="text-xs text-amber-600">
              Registra el consumo del galpón en &quot;+ Registrar consumo&quot; para poder repartirlo en horarios.
            </p>
          )}
        </div>
        {excedido && (
          <p className="text-xs text-red-600 pt-1">
            ⚠️ Estás repartiendo {(totalProgramadoKg - limiteKg).toFixed(1)} kg más que el consumo registrado del galpón.
          </p>
        )}
        {faltaPorRepartir && (
          <p className="text-xs text-amber-600 pt-1">
            ⚠️ Faltan {sinRepartir.toFixed(1)} kg para cumplir con el consumo registrado ({limiteKg} kg/día).
          </p>
        )}
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
