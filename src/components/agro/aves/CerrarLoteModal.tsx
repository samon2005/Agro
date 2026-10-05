'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ic } from '@/components/ui/icon'
import { useFinca } from '@/components/agro/FincaProvider'
import { dbGenerico } from '@/lib/especiesConfig'
import { hoyLocal } from '@/lib/fechas'
import { cop } from '@/lib/huevos'
import { MOTIVOS_CIERRE, motivoSegunProposito, type MotivoCierre } from '@/lib/lotesAves'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteAves
  /** El lote se cerró: el galpón queda libre */
  onCerrado: () => void
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Sacar las aves del galpón sin borrar nada: las que quedan salen como venta
 * (con su precio, o en 0 si se regalan), el lote queda cerrado con todo su
 * historial y el galpón entra en vacío sanitario antes de recibir aves nuevas.
 */
export default function CerrarLoteModal({ open, onClose, lote, onCerrado }: Props) {
  const supabase = createClient()
  const { fincaActual, refetch } = useFinca()
  const diasFinca = fincaActual?.dias_vacio_sanitario ?? 21
  const [guardando, setGuardando] = useState(false)
  // Se monta cada vez que se abre (ver ConfigurarGalponModal): arranca limpio
  const [form, setForm] = useState({
    fecha: hoyLocal(),
    motivo: motivoSegunProposito(lote.proposito, lote.estado),
    precio: '',
    cliente: '',
    dias: String(diasFinca),
    recordarDias: false,
  })

  const quedan = lote.aves_actuales
  const precio = Number(form.precio || 0)
  const dias = form.dias.trim() === '' ? NaN : Number(form.dias)
  const tipoVenta = form.motivo === 'venta_pollas' ? 'pollas' : 'descarte'

  async function cerrar() {
    if (!form.fecha) { toast.error('Indica la fecha de salida'); return }
    if (form.fecha < lote.fecha_inicio) { toast.error('La salida no puede ser antes de la entrada'); return }
    if (form.fecha > hoyLocal()) { toast.error('La salida no puede ser una fecha futura'); return }
    if (!Number.isInteger(dias) || dias < 0 || dias > 180) { toast.error('Los días de vacío sanitario van de 0 a 180'); return }

    setGuardando(true)
    const { error } = await dbGenerico(supabase).rpc('cerrar_lote_aves', {
      p_lote: lote.id,
      p_fecha: form.fecha,
      p_motivo: form.motivo,
      p_tipo_venta: tipoVenta,
      p_precio: precio,
      p_cliente: form.cliente.trim() || null,
      p_dias_vacio: dias,
    })
    if (!error && form.recordarDias && fincaActual && dias !== diasFinca) {
      await supabase.from('fincas').update({ dias_vacio_sanitario: dias }).eq('id', fincaActual.id)
      refetch()
    }
    setGuardando(false)
    if (error) {
      toast.error(['lote_cerrado', 'fecha', 'motivo', 'precio', 'sin_lote'].includes(error.hint ?? '') ? error.message : 'No se pudo cerrar el lote')
      return
    }
    toast.success(`${lote.nombre} quedó libre: vacío sanitario hasta el ${sumarDias(form.fecha, dias)}`)
    onCerrado()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !guardando && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="salir" /> Sacar las aves de {lote.nombre}</DialogTitle>
          <p className="text-sm text-gray-500">
            El lote se cierra pero no se borra: su producción, sanidad, costos y ventas quedan en el historial
            y en Finanzas. El galpón queda libre para las próximas aves.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Fecha de salida</Label>
            <Input type="date" value={form.fecha} min={lote.fecha_inicio} max={hoyLocal()} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Select
              value={form.motivo}
              onValueChange={v => v && setForm(p => ({ ...p, motivo: v as MotivoCierre }))}
              items={Object.fromEntries(MOTIVOS_CIERRE.map(m => [m.v, m.t]))}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {MOTIVOS_CIERRE.map(m => <SelectItem key={m.v} value={m.v}>{m.t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {quedan > 0 ? (
            <>
              <div className="col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Quedan <strong>{quedan.toLocaleString('es-CO')} aves</strong>: salen como venta de {tipoVenta === 'pollas' ? 'pollas' : 'gallinas de descarte'}.
                Si se regalan o se sacrifican en la finca, deja el precio en 0. Las que murieron se registran antes como mortalidad.
              </div>
              <div className="space-y-1">
                <Label>Precio por ave</Label>
                <CurrencyInput placeholder="Ej: 12000" value={form.precio} onValueChange={v => setForm(p => ({ ...p, precio: v }))} />
                <p className="text-xs text-gray-400">Total: {cop(precio * quedan)}</p>
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input placeholder="Opcional" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} />
              </div>
            </>
          ) : (
            <p className="col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              El galpón ya no tiene aves: solo falta cerrar el lote.
            </p>
          )}

          <div className="space-y-1">
            <Label>Días de vacío sanitario</Label>
            <Input type="number" min="0" max="180" step="1" value={form.dias} onChange={e => setForm(p => ({ ...p, dias: e.target.value }))} />
            <p className="text-xs text-gray-400">
              Limpieza y desinfección{Number.isInteger(dias) && dias >= 0 && form.fecha ? `: hasta el ${sumarDias(form.fecha, dias)}` : ''}
            </p>
          </div>
          <label className="flex items-center gap-2 self-center text-xs text-gray-600">
            <input
              type="checkbox" className="accent-green-700"
              checked={form.recordarDias}
              disabled={!Number.isInteger(dias) || dias === diasFinca}
              onChange={e => setForm(p => ({ ...p, recordarDias: e.target.checked }))}
            />
            Usar estos días para los próximos lotes (hoy: {diasFinca})
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={guardando} onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={guardando} onClick={cerrar} className="bg-green-700 text-white hover:bg-green-800">
            {guardando ? 'Cerrando...' : quedan > 0 ? `Sacar ${quedan.toLocaleString('es-CO')} aves y cerrar` : 'Cerrar el lote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
