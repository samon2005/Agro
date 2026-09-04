'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'

type Horario = Database['public']['Tables']['horarios_recoleccion_aves']['Row']

interface Props {
  open: boolean
  loteId: string
  fincaId: string
  /** Se llama al terminar, con al menos un horario configurado */
  onListo: () => void
}

/**
 * Se abre al marcar el inicio de postura: no deja continuar hasta que el galpón
 * tenga al menos un horario de recolección, porque desde hoy ya hay huevos que recoger.
 */
export default function ConfigurarRecoleccionModal({ open, loteId, fincaId, onListo }: Props) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [nuevo, setNuevo] = useState({ hora: '', descripcion: '' })
  const [saving, setSaving] = useState(false)

  const fetchHorarios = useCallback(async () => {
    const { data } = await supabase
      .from('horarios_recoleccion_aves')
      .select('*')
      .eq('lote_id', loteId)
      .eq('activo', true)
      .order('hora', { ascending: true })
    setHorarios(data ?? [])
  }, [loteId, supabase])

  useEffect(() => { if (open) fetchHorarios() }, [open, fetchHorarios])

  async function agregar(e: React.FormEvent) {
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

  async function eliminar(id: string) {
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
    <Dialog open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🥚 Horarios de recolección</DialogTitle>
          <p className="text-sm text-gray-500">
            El galpón acaba de entrar en postura. Configura a qué horas se recogen los huevos —
            necesitas al menos uno para continuar.
          </p>
        </DialogHeader>

        <div className="space-y-2">
          {horarios.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay horarios. Agrega el primero abajo.</p>
          ) : (
            horarios.map(h => (
              <div key={h.id} className="flex items-center gap-2 border border-amber-200 bg-amber-50 rounded-lg pl-3 pr-1.5 py-1.5 text-sm">
                <span className="font-semibold text-amber-800">{fmtHora(h.hora)}</span>
                {h.descripcion && <span className="text-amber-600 text-xs">{h.descripcion}</span>}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => eliminar(h.id)}
                  className="text-amber-400 hover:text-red-600 rounded-full w-5 h-5 flex items-center justify-center"
                  aria-label="Eliminar horario"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={agregar} className="flex items-end gap-2 pt-2 border-t border-gray-100">
          <div className="space-y-1">
            <Label className="text-xs">Hora</Label>
            <Input type="time" value={nuevo.hora} onChange={e => setNuevo(p => ({ ...p, hora: e.target.value }))} className="w-32" />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Descripción</Label>
            <Input placeholder="Ej: Recolección mañana" value={nuevo.descripcion} onChange={e => setNuevo(p => ({ ...p, descripcion: e.target.value }))} />
          </div>
          <Button type="submit" disabled={saving} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
            + Agregar
          </Button>
        </form>

        <DialogFooter>
          <Button
            type="button"
            disabled={horarios.length === 0}
            title={horarios.length === 0 ? 'Agrega al menos un horario de recolección' : undefined}
            onClick={onListo}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            Continuar al registro del día
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
