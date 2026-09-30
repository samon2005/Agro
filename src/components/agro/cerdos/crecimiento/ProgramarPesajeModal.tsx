'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import { proximoPesajeDesde } from '@/lib/crecimiento'

interface LoteProgramable {
  id: string
  nombre: string
  frecuencia_pesaje_dias: number | null
  proximo_pesaje: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteProgramable
  /** Tabla del lote: cada especie guarda los suyos en la suya */
  tabla: 'lotes_cerdos' | 'lotes_pollo'
  /** Fecha del último pesaje hecho, para proponer el siguiente */
  ultimoPesaje: string | null
  onGuardado: () => void
}

const FRECUENCIAS = [7, 14, 15, 21, 30]

/**
 * Los pesajes se hacen cada cierto tiempo, no cuando se acuerde: aquí se dice
 * cada cuántos días se pesa el lote y qué día toca el próximo. De esa cadencia
 * sale la ganancia diaria de peso.
 */
export default function ProgramarPesajeModal({ open, onClose, lote, tabla, ultimoPesaje, onGuardado }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [frecuencia, setFrecuencia] = useState('')
  const [proximo, setProximo] = useState('')

  useEffect(() => {
    if (!open) return
    setFrecuencia(lote.frecuencia_pesaje_dias != null ? String(lote.frecuencia_pesaje_dias) : '')
    setProximo(lote.proximo_pesaje ?? '')
  }, [open, lote])

  /** Al elegir la frecuencia se propone la fecha, contando desde el último pesaje. */
  function elegirFrecuencia(dias: number) {
    setFrecuencia(String(dias))
    const sugerida = proximoPesajeDesde(ultimoPesaje ?? hoyLocal(), dias)
    if (sugerida) setProximo(sugerida)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const dias = frecuencia ? Number(frecuencia) : null
    if (dias != null && dias <= 0) { toast.error('La frecuencia va en días, mayor que cero'); return }
    if (!dias && !proximo) { toast.error('Elige cada cuántos días se pesa, o la fecha del próximo pesaje'); return }

    setLoading(true)
    const { error } = await supabase.from(tabla).update({
      frecuencia_pesaje_dias: dias,
      proximo_pesaje: proximo || proximoPesajeDesde(ultimoPesaje ?? hoyLocal(), dias),
    }).eq('id', lote.id)
    setLoading(false)
    if (error) { toast.error('Error al programar los pesajes'); return }
    toast.success(`Pesajes programados para ${lote.nombre}`)
    onGuardado()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle><Ic n="bascula" /> Programar pesajes</DialogTitle>
          <p className="text-sm text-gray-500">
            Pesar cada cierto tiempo es lo que deja ver la ganancia diaria de peso y darse cuenta
            a tiempo si el lote se está quedando.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cada cuántos días se pesa</Label>
            <div className="flex flex-wrap gap-2">
              {FRECUENCIAS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => elegirFrecuencia(d)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    frecuencia === String(d)
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {d} días
                </button>
              ))}
            </div>
            <Input
              type="number" min="1" placeholder="Otra cantidad de días"
              value={FRECUENCIAS.includes(Number(frecuencia)) ? '' : frecuencia}
              onChange={e => setFrecuencia(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Próximo pesaje</Label>
            <Input type="date" value={proximo} onChange={e => setProximo(e.target.value)} />
            <p className="text-xs text-gray-400">
              {ultimoPesaje
                ? `El último pesaje fue el ${new Date(ultimoPesaje + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}.`
                : 'Todavía no hay pesajes registrados en este lote.'}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
