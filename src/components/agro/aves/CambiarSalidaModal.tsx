'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Cambio = Database['public']['Tables']['cambios_salida_lote']['Row']

const fecha = (f: string | null) => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin fecha'
const cuando = (f: string) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Cambiar la salida programada de un lote cuando pasan cosas (se adelanta la
 * venta, se alarga el ciclo). La base guarda cada cambio sola (migración 082);
 * aquí se le pone el motivo y se ven los cambios anteriores.
 */
export default function CambiarSalidaModal({ open, onClose, lote, onCambiada }: {
  open: boolean
  onClose: () => void
  lote: LoteAves
  onCambiada: (lote: LoteAves) => void
}) {
  const [nueva, setNueva] = useState(lote.fecha_salida_programada ?? '')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [historial, setHistorial] = useState<Cambio[]>([])

  // Se monta al abrir (ver la página de Galpones): la fecha y el motivo arrancan de nuevo cada vez
  useEffect(() => {
    if (!open) return
    let vigente = true
    createClient().from('cambios_salida_lote').select('*').eq('lote_id', lote.id).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { if (vigente) setHistorial(data ?? []) })
    return () => { vigente = false }
  }, [open, lote.id, lote.fecha_salida_programada])

  async function guardar() {
    if ((nueva || null) === lote.fecha_salida_programada) { toast.error('La fecha es la misma'); return }
    if (nueva && nueva <= lote.fecha_inicio) { toast.error('La salida debe ser después de la entrada'); return }
    setGuardando(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('lotes_aves').update({ fecha_salida_programada: nueva || null }).eq('id', lote.id).select().single()
    if (error || !data) { setGuardando(false); toast.error('No se pudo cambiar la salida'); return }
    // El cambio lo anotó la base; aquí se le agrega el motivo
    if (motivo.trim()) {
      const { data: ultimo } = await supabase.from('cambios_salida_lote').select('id').eq('lote_id', lote.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (ultimo) await supabase.from('cambios_salida_lote').update({ motivo: motivo.trim() }).eq('id', ultimo.id)
    }
    setGuardando(false)
    toast.success(nueva ? `Salida cambiada al ${fecha(nueva)}` : 'Salida programada quitada')
    onCambiada(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle><Ic n="calendario" /> Salida programada · {lote.nombre}</DialogTitle>
          <p className="text-sm text-gray-500">Si algo cambió, mueve la fecha. Queda guardada la anterior, con el motivo.</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nueva fecha de salida</Label>
            <Input type="date" value={nueva} min={lote.fecha_inicio} onChange={e => setNueva(e.target.value)} />
            <p className="text-xs text-gray-400">Ahora: {fecha(lote.fecha_salida_programada)}. Déjala vacía para quitarla.</p>
          </div>
          <div className="space-y-1">
            <Label>Motivo (opcional)</Label>
            <Input placeholder="Ej: se adelantó la venta, buena postura y se alarga el ciclo" value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
          {historial.length > 0 && (
            <div className="space-y-1 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500">Cambios anteriores</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-600">
                {historial.map(c => (
                  <li key={c.id}>
                    <span className="text-gray-400">{cuando(c.created_at)}:</span> {fecha(c.fecha_anterior)} → <strong>{fecha(c.fecha_nueva)}</strong>
                    {c.motivo ? <span className="text-gray-500"> · {c.motivo}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
