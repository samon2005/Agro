'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hoyLocal } from '@/lib/fechas'
import type { Database } from '@/types/database'

type Pesaje = Database['public']['Tables']['pesos_lote_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  /** Fecha en que entraron las aves: no se puede pesar antes */
  fechaEntrada: string
  avesActuales: number
  /** El pesaje que se edita; sin él se registra uno nuevo */
  pesajeExistente?: Pesaje | null
  onGuardado: () => void
}

function formVacio(p?: Pesaje | null) {
  return {
    fecha: p?.fecha ?? hoyLocal(),
    aves_pesadas: p ? String(p.aves_pesadas) : '',
    peso_promedio_g: p ? String(p.peso_promedio_g) : '',
    peso_minimo_g: p?.peso_minimo_g != null ? String(p.peso_minimo_g) : '',
    peso_maximo_g: p?.peso_maximo_g != null ? String(p.peso_maximo_g) : '',
    uniformidad_pct: p?.uniformidad_pct != null ? String(p.uniformidad_pct) : '',
    observaciones: p?.observaciones ?? '',
  }
}

/**
 * No se pesa todo el galpón: se toma una muestra de aves, se pesan y se anota el
 * promedio. Mínimo, máximo y uniformidad son opcionales, para quien los lleve.
 */
export default function RegistrarPesajeModal({
  open, onClose, loteId, fincaId, fechaEntrada, avesActuales, pesajeExistente, onGuardado,
}: Props) {
  const supabase = createClient()
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState(() => formVacio(pesajeExistente))

  useEffect(() => {
    if (open) setForm(formVacio(pesajeExistente))
    // Solo al abrir, para no borrar lo que se va escribiendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function set(campo: keyof ReturnType<typeof formVacio>, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  // Muestra sugerida: el 1 % del lote, sin bajar de 50 aves ni pasar del lote
  const muestraSugerida = Math.min(avesActuales, Math.max(50, Math.ceil(avesActuales * 0.01)))
  const pesadas = Number(form.aves_pesadas) || 0
  const pctMuestra = avesActuales > 0 && pesadas > 0 ? (pesadas / avesActuales) * 100 : null

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const promedio = Number(form.peso_promedio_g)
    const minimo = form.peso_minimo_g ? Number(form.peso_minimo_g) : null
    const maximo = form.peso_maximo_g ? Number(form.peso_maximo_g) : null
    const uniformidad = form.uniformidad_pct ? Number(form.uniformidad_pct) : null

    if (!form.fecha) { toast.error('Indica la fecha del pesaje'); return }
    if (form.fecha > hoyLocal()) { toast.error('No se puede registrar un pesaje en una fecha futura'); return }
    if (form.fecha < fechaEntrada) { toast.error('La fecha es anterior a la entrada de las aves al galpón'); return }
    if (!(pesadas > 0) || !Number.isInteger(pesadas)) { toast.error('Indica cuántas aves se pesaron'); return }
    if (pesadas > avesActuales) { toast.error(`En el galpón hay ${avesActuales.toLocaleString('es-CO')} aves: no se pueden pesar más`); return }
    if (!(promedio > 0)) { toast.error('Indica el peso promedio en gramos'); return }
    if (minimo != null && minimo > promedio) { toast.error('El peso mínimo no puede ser mayor que el promedio'); return }
    if (maximo != null && maximo < promedio) { toast.error('El peso máximo no puede ser menor que el promedio'); return }
    if (uniformidad != null && (uniformidad < 0 || uniformidad > 100)) { toast.error('La uniformidad va de 0 a 100 %'); return }

    setGuardando(true)
    const payload = {
      fecha: form.fecha,
      aves_pesadas: pesadas,
      peso_promedio_g: promedio,
      peso_minimo_g: minimo,
      peso_maximo_g: maximo,
      uniformidad_pct: uniformidad,
      observaciones: form.observaciones.trim() || null,
    }
    const { error } = pesajeExistente
      ? await supabase.from('pesos_lote_aves').update(payload).eq('id', pesajeExistente.id)
      : await supabase.from('pesos_lote_aves').insert({ ...payload, lote_id: loteId, finca_id: fincaId })
    setGuardando(false)

    if (error) {
      toast.error(error.code === '23505'
        ? 'Ese día ya tiene un pesaje: edítalo en el historial'
        : 'No se pudo guardar el pesaje')
      return
    }
    toast.success(pesajeExistente ? 'Pesaje actualizado' : 'Pesaje registrado')
    onGuardado()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !guardando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pesajeExistente ? 'Editar pesaje' : 'Registrar pesaje'}</DialogTitle>
          <p className="text-sm text-gray-500">
            Pesa una muestra de aves de distintos puntos del galpón y anota el promedio.
          </p>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha *</Label>
              <Input type="date" min={fechaEntrada} max={hoyLocal()} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Aves pesadas *</Label>
              <Input
                type="number" min="1" step="1" max={avesActuales}
                placeholder={String(muestraSugerida)}
                value={form.aves_pesadas}
                onChange={e => set('aves_pesadas', e.target.value)}
              />
              <p className="text-[0.6875rem] text-gray-400">
                {pctMuestra != null
                  ? `${pctMuestra.toLocaleString('es-CO', { maximumFractionDigits: 1 })} % del galpón`
                  : `Sugerido: ${muestraSugerida.toLocaleString('es-CO')} (1 % del lote, mínimo 50)`}
              </p>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Peso promedio (g) *</Label>
              <Input type="number" min="1" step="0.1" placeholder="Ej: 1250" value={form.peso_promedio_g} onChange={e => set('peso_promedio_g', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso mínimo (g)</Label>
              <Input type="number" min="1" step="0.1" value={form.peso_minimo_g} onChange={e => set('peso_minimo_g', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso máximo (g)</Label>
              <Input type="number" min="1" step="0.1" value={form.peso_maximo_g} onChange={e => set('peso_maximo_g', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Uniformidad (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" placeholder="Ej: 85" value={form.uniformidad_pct} onChange={e => set('uniformidad_pct', e.target.value)} />
              <p className="text-[0.6875rem] text-gray-400">Porcentaje de la muestra que quedó dentro de ±10 % del promedio</p>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={guardando} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : pesajeExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
