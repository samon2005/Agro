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
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState({ hora: '', descripcion: '', cantidad_kg: '' })
  const [saving, setSaving] = useState(false)

  const fetchHorarios = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('horarios_alimentacion_aves')
      .select('*')
      .eq('lote_id', loteId)
      .eq('activo', true)
      .order('hora', { ascending: true })
    setHorarios(data ?? [])
    setLoading(false)
  }, [loteId, supabase])

  useEffect(() => { fetchHorarios() }, [fetchHorarios])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevo.hora) { toast.error('Ingresa la hora de alimentación'); return }
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
    fetchHorarios()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('horarios_alimentacion_aves').update({ activo: false }).eq('id', id)
    if (error) { toast.error('Error al eliminar el horario'); return }
    setHorarios(prev => prev.filter(h => h.id !== id))
  }

  function fmtHora(h: string) {
    const [hh, mm] = h.split(':')
    const hour = Number(hh)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    return `${hour12}:${mm} ${ampm}`
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">🕐 Horarios de Alimentación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : horarios.length === 0 ? (
          <p className="text-sm text-gray-400">Sin horarios configurados. Ej: 8:00 am, 1:00 pm, 5:00 pm</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {horarios.map(h => (
              <div key={h.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full pl-3 pr-1.5 py-1 text-sm">
                <span className="font-semibold text-amber-800">{fmtHora(h.hora)}</span>
                {h.descripcion && <span className="text-amber-600 text-xs">{h.descripcion}</span>}
                {h.cantidad_kg && <span className="text-amber-600 text-xs">· {h.cantidad_kg} kg</span>}
                <button
                  type="button"
                  onClick={() => handleDelete(h.id)}
                  className="text-amber-400 hover:text-red-600 rounded-full w-5 h-5 flex items-center justify-center"
                  aria-label="Eliminar horario"
                >
                  ×
                </button>
              </div>
            ))}
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
            <Label className="text-xs">Cant. (kg)</Label>
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
