'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import { PROPOSITOS, PROPOSITO_LABEL, type Proposito } from '@/lib/lotesAves'
import { DESCRIPCION_PROPOSITO } from '@/lib/registroAves'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']

/**
 * Dos acciones sobre un lote que pidió José (19 nov 2026):
 * - Cambiar el propósito en cualquier momento y en las dos direcciones (entran
 *   para ciclo completo y se venden en el levante, o al revés). Queda el historial.
 * - Trasladar a otro galpón (del de levante al de postura): sigue siendo el mismo
 *   lote, con sus datos y su historia; solo cambia el galpón.
 */
export default function AccionesLoteModal({ accion, lote, galpones, ocupados, onClose, onCambio }: {
  accion: 'proposito' | 'traslado'
  lote: LoteAves
  galpones: Instalacion[]
  ocupados: Set<string>
  onClose: () => void
  onCambio: (lote: LoteAves) => void
}) {
  const [proposito, setProposito] = useState<Proposito>(lote.proposito as Proposito)
  const [destino, setDestino] = useState('')
  const [fecha, setFecha] = useState(hoyLocal())
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [historial, setHistorial] = useState<{ fecha: string; texto: string }[]>([])
  const nombreGalpon = (id: string | null) => galpones.find(g => g.id === id)?.nombre ?? '—'

  useEffect(() => {
    let vigente = true
    const s = createClient()
    const q = accion === 'proposito'
      ? s.from('cambios_proposito_lote').select('fecha, anterior, nuevo, motivo').eq('lote_id', lote.id).order('fecha', { ascending: false })
      : s.from('traslados_lote_aves').select('fecha, desde_instalacion_id, hacia_instalacion_id, motivo').eq('lote_id', lote.id).order('fecha', { ascending: false })
    q.then(({ data }) => {
      if (!vigente) return
      setHistorial((data ?? []).map((x: Record<string, string | null>) => ({
        fecha: x.fecha!,
        texto: accion === 'proposito'
          ? `${PROPOSITO_LABEL[x.anterior as Proposito] ?? '—'} → ${PROPOSITO_LABEL[x.nuevo as Proposito]}${x.motivo ? ` · ${x.motivo}` : ''}`
          : `${nombreGalpon(x.desde_instalacion_id)} → ${nombreGalpon(x.hacia_instalacion_id)}${x.motivo ? ` · ${x.motivo}` : ''}`,
      })))
    })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accion, lote.id])

  async function guardar() {
    const s = createClient()
    setGuardando(true)
    if (accion === 'proposito') {
      if (proposito === lote.proposito) { setGuardando(false); onClose(); return }
      const { data, error } = await s.from('lotes_aves').update({
        proposito,
        // En levante y venta no hay postura esperada
        ...(proposito === 'venta_levante' && lote.estado !== 'activo' ? { fecha_inicio_postura: null } : {}),
      }).eq('id', lote.id).select().single()
      if (!error) await s.from('cambios_proposito_lote').insert({ finca_id: lote.finca_id, lote_id: lote.id, fecha, anterior: lote.proposito, nuevo: proposito, motivo: motivo.trim() || null })
      setGuardando(false)
      if (error || !data) { toast.error('No se pudo cambiar el propósito'); return }
      toast.success(`Ahora es ${PROPOSITO_LABEL[proposito]}. Revisa la salida programada.`)
      onCambio(data)
    } else {
      const g = galpones.find(x => x.id === destino)
      if (!g) { setGuardando(false); toast.error('Elige el galpón al que pasan'); return }
      const { data, error } = await s.from('lotes_aves').update({
        instalacion_id: g.id, nombre: g.nombre, area_galpon_m2: g.area_m2 != null ? Number(g.area_m2) : null,
      }).eq('id', lote.id).select().single()
      if (!error) await s.from('traslados_lote_aves').insert({
        finca_id: lote.finca_id, lote_id: lote.id, fecha, desde_instalacion_id: lote.instalacion_id, hacia_instalacion_id: g.id,
        aves: lote.aves_actuales, motivo: motivo.trim() || null,
      })
      setGuardando(false)
      if (error || !data) { toast.error(error?.code === '23505' ? `${g.nombre} ya tiene aves` : 'No se pudo trasladar'); return }
      toast.success(`El lote pasó a ${g.nombre}. Recuerda el vacío sanitario de ${lote.nombre}.`)
      onCambio(data)
    }
    onClose()
  }

  const libres = galpones.filter(g => g.id !== lote.instalacion_id && !ocupados.has(g.id))
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ic n={accion === 'proposito' ? 'ciclo' : 'flecha'} /> {accion === 'proposito' ? `Para qué están · ${lote.nombre}` : `Trasladar el lote de ${lote.nombre}`}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {accion === 'proposito' ? 'Los planes cambian en el camino: se puede cambiar en las dos direcciones.' : 'Sigue siendo el mismo lote, con su historia. Solo cambia el galpón.'}
          </p>
        </DialogHeader>
        <div className="space-y-3">
          {accion === 'proposito' ? (
            <div className="grid gap-2">
              {PROPOSITOS.map(o => (
                <button key={o.v} type="button" disabled={o.v === 'venta_levante' && lote.estado === 'activo'} onClick={() => setProposito(o.v)}
                  className={cn('rounded-lg border p-2.5 text-left disabled:opacity-40', proposito === o.v ? 'border-green-600 bg-green-50' : 'border-gray-200')}>
                  <p className="text-sm font-semibold text-gray-800">{o.t}</p>
                  <p className="text-xs text-gray-500">{DESCRIPCION_PROPOSITO[o.v]}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Pasan al galpón</Label>
              <select value={destino} onChange={e => setDestino(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                <option value="">{libres.length ? 'Elegir…' : 'No hay galpones vacíos'}</option>
                {libres.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.area_m2 != null ? ` · ${Number(g.area_m2).toLocaleString('es-CO')} m²` : ''}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Fecha</Label><Input type="date" max={hoyLocal()} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div className="space-y-1"><Label>Motivo</Label><Input placeholder="Opcional" value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
          </div>
          {historial.length > 0 && (
            <ul className="space-y-0.5 text-xs text-gray-500">
              {historial.map((h, i) => <li key={i}>{h.fecha} · {h.texto}</li>)}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : accion === 'proposito' ? 'Cambiar' : 'Trasladar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
