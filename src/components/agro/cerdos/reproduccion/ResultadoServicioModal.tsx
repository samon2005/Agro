'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { useConfigCerdos } from '@/lib/useConfigCerdos'
import { METODOS_CONFIRMACION, type MetodoConfirmacion } from '@/lib/configCerdos'
import {
  EVENTOS_GESTACION, ESTADOS_CERDA, RESULTADO_SERVICIO, actualizarEstadoCerda, type TipoEventoGestacion,
} from '@/lib/estadoCerda'
import { Ic } from '@/components/ui/icon'

type Servicio = Database['public']['Tables']['servicios_cerdos']['Row']

type Resultado = 'confirmada' | TipoEventoGestacion

const OPCIONES: { id: Resultado; label: string; detalle: string; tono: string }[] = [
  { id: 'confirmada', label: 'Preñez confirmada', detalle: 'Queda gestante', tono: 'border-purple-500 bg-purple-50 text-purple-900 ring-purple-500' },
  { id: 'repeticion', label: EVENTOS_GESTACION.repeticion.label, detalle: 'Queda repetidora: hay que volver a servirla', tono: 'border-amber-500 bg-amber-50 text-amber-900 ring-amber-500' },
  { id: 'vacia', label: EVENTOS_GESTACION.vacia.label, detalle: 'El diagnóstico dio vacía', tono: 'border-gray-600 bg-gray-100 text-gray-900 ring-gray-600' },
  { id: 'aborto', label: EVENTOS_GESTACION.aborto.label, detalle: 'Cuenta para el descarte', tono: 'border-red-500 bg-red-50 text-red-800 ring-red-500' },
]

interface Props {
  open: boolean
  onClose: () => void
  servicio: Servicio | null
  codigoCerda: string
  onGuardado: () => void
}

/**
 * Lo que pasó con un servicio: se confirmó la preñez, la cerda repitió celo,
 * salió vacía o abortó. Guarda el evento, marca el resultado en el servicio y
 * recalcula el estado de la cerda (lib/estadoCerda).
 */
export default function ResultadoServicioModal({ open, onClose, servicio, codigoCerda, onGuardado }: Props) {
  const cfg = useConfigCerdos()
  const supabase = createClient()
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [fecha, setFecha] = useState(hoyLocal())
  const [metodo, setMetodo] = useState<MetodoConfirmacion>(cfg.reproduccion.metodoConfirmacion)
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setResultado(null)
    setFecha(hoyLocal())
    setMetodo(cfg.reproduccion.metodoConfirmacion)
    setObservaciones('')
  }, [open, cfg.reproduccion.metodoConfirmacion])

  if (!servicio) return null
  const pideMetodo = resultado === 'confirmada' || resultado === 'vacia'

  async function guardar() {
    if (!servicio || !resultado) { toast.error('Elige qué pasó con el servicio'); return }
    if (!fecha) { toast.error('Falta la fecha'); return }
    if (fecha < servicio.fecha_servicio) { toast.error('La fecha no puede ser anterior al servicio'); return }
    if (fecha > hoyLocal()) { toast.error('La fecha no puede ser futura'); return }
    setGuardando(true)

    let error: unknown = null
    if (resultado === 'confirmada') {
      ;({ error } = await supabase.from('servicios_cerdos').update({
        estado: 'confirmado', prenez_confirmada: true, fecha_confirmacion: fecha, metodo_confirmacion: metodo,
      }).eq('id', servicio.id))
    } else {
      ;({ error } = await supabase.from('eventos_gestacion_cerdos').insert({
        finca_id: servicio.finca_id, lote_id: servicio.lote_id, reproductora_id: servicio.reproductora_id,
        servicio_id: servicio.id, fecha, tipo: resultado,
        metodo: resultado === 'vacia' ? metodo : null,
        observaciones: observaciones.trim() || null,
      }))
      if (!error) {
        ;({ error } = await supabase.from('servicios_cerdos').update({
          estado: RESULTADO_SERVICIO[resultado], prenez_confirmada: false,
        }).eq('id', servicio.id))
      }
    }
    const r = error ? null : await actualizarEstadoCerda(supabase, servicio.reproductora_id, cfg)
    setGuardando(false)
    if (error) { toast.error('No se pudo guardar'); return }
    toast.success(`${codigoCerda} queda ${r ? ESTADOS_CERDA[r.estado].label.toLowerCase() : 'actualizada'}`)
    onGuardado()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿Cómo va la cerda {codigoCerda}?</DialogTitle>
          <p className="text-sm text-gray-500">
            Servicio del {new Date(servicio.fecha_servicio + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}.
            La granja confirma la preñez a los {cfg.reproduccion.diaConfirmacion} días
            ({METODOS_CONFIRMACION.find(m => m.value === cfg.reproduccion.metodoConfirmacion)?.label.toLowerCase()}).
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {OPCIONES.map(o => (
            <button key={o.id} type="button" onClick={() => setResultado(o.id)}
              className={cn('rounded-xl border p-3 text-left transition-all',
                resultado === o.id ? cn(o.tono, 'ring-2 ring-offset-1') : 'border-gray-200 text-gray-800 hover:border-gray-300')}
              aria-pressed={resultado === o.id}>
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-[0.6875rem] opacity-75">{o.detalle}</span>
            </button>
          ))}
        </div>

        {resultado && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{resultado === 'confirmada' ? 'Fecha de la confirmación' : 'Fecha'}</Label>
              <Input type="date" value={fecha} min={servicio.fecha_servicio} max={hoyLocal()} onChange={e => setFecha(e.target.value)} />
            </div>
            {pideMetodo && (
              <div className="space-y-1">
                <Label>Cómo se supo</Label>
                <div className="flex flex-wrap gap-2">
                  {METODOS_CONFIRMACION.map(m => (
                    <button key={m.value} type="button" onClick={() => setMetodo(m.value)}
                      className={cn('rounded-lg border px-3 py-1.5 text-sm',
                        metodo === m.value ? 'border-green-700 bg-green-50 font-medium text-green-900' : 'border-gray-200 text-gray-600')}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {resultado !== 'confirmada' && (
              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Input placeholder={resultado === 'aborto' ? 'Ej: posible causa, cuántos fetos…' : 'Opcional'}
                  value={observaciones} onChange={e => setObservaciones(e.target.value)} />
              </div>
            )}
            {resultado !== 'confirmada' && (
              <p className="flex gap-1.5 text-xs text-gray-500">
                <Ic n="repetir" /> Cuando la vuelvas a servir, registra el servicio nuevo y ella pasa a servida.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={guardar} disabled={guardando || !resultado} className="bg-pink-600 text-white hover:bg-pink-700">
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
