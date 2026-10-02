'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import { hoyLocal, aFechaLocal } from '@/lib/fechas'

export interface ConfigPostura {
  fecha_inicio_postura: string
  semanas_ciclo_postura: number
  meta_postura_pct: number
  meta_huevos_diaria: number | null
  fecha_salida_programada: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  nombreGalpon: string
  avesActuales: number
  /** Lo que ya tuviera configurado el lote, para no empezar de cero */
  inicial?: Partial<ConfigPostura>
  onConfirmar: (config: ConfigPostura) => Promise<void> | void
}

function sumarSemanas(fecha: string, semanas: number) {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + semanas * 7)
  return aFechaLocal(d)
}

/**
 * La postura se configura cuando empieza, no al registrar las pollas: la duración
 * del ciclo, la meta de pico, la meta de huevos al día y cuándo se piensa sacar
 * el lote. Hasta entonces el galpón es levante y nada de esto aplica.
 */
export default function IniciarPosturaModal({ open, onClose, nombreGalpon, avesActuales, inicial, onConfirmar }: Props) {
  const [guardando, setGuardando] = useState(false)
  const [salidaManual, setSalidaManual] = useState(false)
  const [form, setForm] = useState({
    fecha_inicio_postura: hoyLocal(),
    semanas_ciclo_postura: '60',
    meta_postura_pct: '90',
    meta_huevos_diaria: '',
    fecha_salida_programada: '',
  })

  useEffect(() => {
    if (!open) return
    const inicio = hoyLocal()
    const ciclo = inicial?.semanas_ciclo_postura ?? 60
    setForm({
      fecha_inicio_postura: inicio,
      semanas_ciclo_postura: String(ciclo),
      meta_postura_pct: String(inicial?.meta_postura_pct ?? 90),
      meta_huevos_diaria: inicial?.meta_huevos_diaria != null ? String(inicial.meta_huevos_diaria) : '',
      fecha_salida_programada: inicial?.fecha_salida_programada ?? sumarSemanas(inicio, ciclo),
    })
    setSalidaManual(Boolean(inicial?.fecha_salida_programada))
    // Solo al abrir: si dependiera de `inicial`, cada render del padre borraría lo escrito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function set(campo: keyof typeof form, valor: string) {
    setForm(prev => {
      const next = { ...prev, [campo]: valor }
      // La salida sigue al ciclo mientras no se haya puesto a mano
      if (!salidaManual && (campo === 'fecha_inicio_postura' || campo === 'semanas_ciclo_postura')) {
        const semanas = Number(next.semanas_ciclo_postura) || 0
        if (next.fecha_inicio_postura && semanas > 0) next.fecha_salida_programada = sumarSemanas(next.fecha_inicio_postura, semanas)
      }
      return next
    })
  }

  // La meta de huevos sale de la de pico si no se escribe: aves × % de pico
  const metaSugerida = avesActuales > 0 && Number(form.meta_postura_pct) > 0
    ? Math.round(avesActuales * Number(form.meta_postura_pct) / 100)
    : null

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    const semanas = Number(form.semanas_ciclo_postura)
    const pico = Number(form.meta_postura_pct)
    if (!form.fecha_inicio_postura) { toast.error('Indica desde qué día están poniendo'); return }
    if (!(semanas > 0)) { toast.error('Indica cuántas semanas dura el ciclo de postura'); return }
    if (!(pico > 0 && pico <= 100)) { toast.error('La meta de pico va entre 1 y 100 %'); return }

    setGuardando(true)
    await onConfirmar({
      fecha_inicio_postura: form.fecha_inicio_postura,
      semanas_ciclo_postura: semanas,
      meta_postura_pct: pico,
      meta_huevos_diaria: form.meta_huevos_diaria ? Number(form.meta_huevos_diaria) : metaSugerida,
      fecha_salida_programada: form.fecha_salida_programada || null,
    })
    setGuardando(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !guardando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle><Ic n="huevo" /> Inicio de postura · {nombreGalpon}</DialogTitle>
          <p className="text-sm text-gray-500">
            Las pollas pasan a producción. Configura la postura del lote; después se piden los horarios de recolección.
          </p>
        </DialogHeader>
        <form onSubmit={confirmar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>¿Desde qué día están poniendo?</Label>
              <Input type="date" max={hoyLocal()} value={form.fecha_inicio_postura} onChange={e => set('fecha_inicio_postura', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Duración del ciclo (semanas) *</Label>
              <Input type="number" min="1" value={form.semanas_ciclo_postura} onChange={e => set('semanas_ciclo_postura', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Meta de postura / pico (%) *</Label>
              <Input type="number" min="1" max="100" step="0.1" value={form.meta_postura_pct} onChange={e => set('meta_postura_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Meta de huevos puestos por día</Label>
              <Input
                type="number" min="0"
                placeholder={metaSugerida ? String(metaSugerida) : 'Ej: 4600'}
                value={form.meta_huevos_diaria}
                onChange={e => set('meta_huevos_diaria', e.target.value)}
              />
              {metaSugerida && !form.meta_huevos_diaria && (
                <p className="text-[0.6875rem] text-gray-400">Si la dejas vacía: {metaSugerida.toLocaleString('es-CO')} (aves × pico)</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Salida programada del lote</Label>
              <Input
                type="date"
                value={form.fecha_salida_programada}
                onChange={e => { setSalidaManual(true); set('fecha_salida_programada', e.target.value) }}
              />
              <p className="text-[0.6875rem] text-gray-400">Sale sola al final del ciclo; cámbiala si hace falta.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={guardando} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Iniciar postura'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
