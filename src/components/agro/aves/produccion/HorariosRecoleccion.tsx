'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'

type Horario = Database['public']['Tables']['horarios_recoleccion_aves']['Row']

interface Props {
  loteId: string
  fincaId: string
}

export default function HorariosRecoleccion({ loteId, fincaId }: Props) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState({ hora: '', descripcion: '' })
  const [saving, setSaving] = useState(false)

  const fetchHorarios = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('horarios_recoleccion_aves')
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
    if (!nuevo.hora) { toast.error('Ingresa la hora de recolección'); return }
    setSaving(true)
    const { error } = await supabase.from('horarios_recoleccion_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      hora: nuevo.hora,
      descripcion: nuevo.descripcion || null,
    })
    setSaving(false)
    if (error) { toast.error('Error al agregar el horario'); return }
    setNuevo({ hora: '', descripcion: '' })
    fetchHorarios()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('horarios_recoleccion_aves').update({ activo: false }).eq('id', id)
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
        <CardTitle className="text-sm font-semibold text-gray-700">🥚 Horarios de Recolección</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : horarios.length === 0 ? (
          <p className="text-sm text-gray-400">Sin horarios configurados. Ej: 7:00 am, 12:00 pm, 4:00 pm</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {horarios.map(h => (
              <div key={h.id} className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-full pl-3 pr-1.5 py-1 text-sm">
                <span className="font-semibold text-sky-800">{fmtHora(h.hora)}</span>
                {h.descripcion && <span className="text-sky-600 text-xs">{h.descripcion}</span>}
                <button
                  type="button"
                  onClick={() => handleDelete(h.id)}
                  className="text-sky-400 hover:text-red-600 rounded-full w-5 h-5 flex items-center justify-center"
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
            <Input placeholder="Ej: Recolección de la tarde" value={nuevo.descripcion} onChange={e => setNuevo(p => ({ ...p, descripcion: e.target.value }))} />
          </div>
          <Button type="submit" disabled={saving} size="sm" className="bg-sky-600 hover:bg-sky-700 text-white">
            + Agregar
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
