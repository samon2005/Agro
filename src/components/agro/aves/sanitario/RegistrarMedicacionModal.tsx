'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { calcularFechaLiberacion } from '@/lib/sanitario'
import type { Database } from '@/types/database'

type Medicacion = Database['public']['Tables']['medicaciones_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  eventoClinicoId?: string | null
  medicacionExistente?: Medicacion | null
  onCreated: () => void
}

const VIAS = ['Agua de bebida', 'Alimento', 'Inyectable SC', 'Inyectable IM', 'Tópico', 'Spray']

const UNIDAD_POR_VIA: Record<string, string> = {
  'Agua de bebida': 'mL / L de agua',
  'Alimento': 'g / kg de alimento',
  'Inyectable SC': 'mL / ave',
  'Inyectable IM': 'mL / ave',
  'Tópico': 'mL / ave',
  'Spray': 'mL / L',
}

function defaultForm(med?: Medicacion | null) {
  const [dosisValor, dosisUnidad] = med?.dosis ? splitDosis(med.dosis) : ['', '']
  return {
    fecha_inicio: med?.fecha_inicio ?? new Date().toISOString().split('T')[0],
    fecha_fin: med?.fecha_fin ?? '',
    medicamento: med?.medicamento ?? '',
    principio_activo: med?.principio_activo ?? '',
    via_administracion: med?.via_administracion ?? '',
    dosis_valor: dosisValor,
    dosis_unidad: dosisUnidad,
    periodo_retiro_dias: med?.periodo_retiro_dias != null ? String(med.periodo_retiro_dias) : '',
    motivo: med?.motivo ?? '',
    costo: med?.costo != null ? String(med.costo) : '',
    encargado: med?.veterinario ?? '',
    frecuencia_dias: '',
    hora_aplicacion: '',
    observaciones: med?.observaciones ?? '',
  }
}

function splitDosis(dosis: string): [string, string] {
  const match = dosis.match(/^(\S+)\s*(.*)$/)
  return match ? [match[1], match[2]] : ['', dosis]
}

export default function RegistrarMedicacionModal({ open, onClose, loteId, fincaId, eventoClinicoId, medicacionExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(medicacionExistente))

  useEffect(() => { if (open) setForm(defaultForm(medicacionExistente)) }, [open, medicacionExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  function setVia(via: string | null) {
    setForm(prev => ({ ...prev, via_administracion: via ?? '', dosis_unidad: (via && UNIDAD_POR_VIA[via]) ?? prev.dosis_unidad }))
  }

  const retiro = form.fecha_fin && form.periodo_retiro_dias && Number(form.periodo_retiro_dias) > 0
    ? calcularFechaLiberacion(form.fecha_fin, Number(form.periodo_retiro_dias)).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  const sinRetiro = form.periodo_retiro_dias !== '' && Number(form.periodo_retiro_dias) === 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.medicamento.trim()) { toast.error('El medicamento es requerido'); return }

    setLoading(true)
    const dosis = [form.dosis_valor, form.dosis_unidad].filter(Boolean).join(' ') || null
    const payload = {
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin || null,
      medicamento: form.medicamento.trim(),
      principio_activo: form.principio_activo || null,
      via_administracion: form.via_administracion || null,
      dosis,
      periodo_retiro_dias: form.periodo_retiro_dias !== '' ? Number(form.periodo_retiro_dias) : null,
      motivo: form.motivo || null,
      costo: form.costo ? Number(form.costo) : null,
      veterinario: form.encargado || null,
      observaciones: form.observaciones || null,
    }
    const { data: medicacion, error } = medicacionExistente
      ? await supabase.from('medicaciones_aves').update(payload).eq('id', medicacionExistente.id).select().single()
      : await supabase.from('medicaciones_aves').insert({ ...payload, lote_id: loteId, finca_id: fincaId, evento_clinico_id: eventoClinicoId || null }).select().single()

    if (!error && !medicacionExistente && form.costo && Number(form.costo) > 0) {
      await supabase.from('costos_lote_aves').insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha_inicio,
        categoria: 'sanitario',
        descripcion: `Tratamiento: ${form.medicamento.trim()}`,
        monto: Number(form.costo),
      })
    }

    if (!error && !medicacionExistente && medicacion && form.frecuencia_dias && Number(form.frecuencia_dias) > 0) {
      const inicio = new Date(form.fecha_inicio)
      const fin = form.fecha_fin ? new Date(form.fecha_fin) : inicio
      const paso = Number(form.frecuencia_dias)
      const fechas: string[] = []
      for (let d = new Date(inicio); d <= fin && fechas.length < 60; d.setDate(d.getDate() + paso)) {
        fechas.push(d.toISOString().split('T')[0])
      }
      if (fechas.length > 0) {
        await supabase.from('recordatorios_medicacion_aves').insert(
          fechas.map(fecha => ({
            medicacion_id: medicacion.id,
            lote_id: loteId,
            finca_id: fincaId,
            fecha,
            hora: form.hora_aplicacion || null,
          }))
        )
      }
    }

    setLoading(false)
    if (error) { toast.error(medicacionExistente ? 'Error al actualizar el tratamiento' : 'Error al registrar el tratamiento'); return }
    toast.success(medicacionExistente ? 'Tratamiento actualizado' : form.frecuencia_dias ? 'Tratamiento registrado con recordatorios' : 'Tratamiento registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{medicacionExistente ? '✏️ Editar Tratamiento' : '💊 Registrar Tratamiento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha inicio *</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha fin</Label>
              <Input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Medicamento *</Label>
              <Input placeholder="Nombre del medicamento" value={form.medicamento} onChange={e => set('medicamento', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Principio activo</Label>
              <Input placeholder="Ej: Enrofloxacina" value={form.principio_activo} onChange={e => set('principio_activo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vía de administración</Label>
              <Select value={form.via_administracion} onValueChange={setVia}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{VIAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Dosis</Label>
              <div className="flex gap-1.5">
                <Input type="number" min="0" step="0.01" className="w-20" placeholder="10" value={form.dosis_valor} onChange={e => set('dosis_valor', e.target.value)} />
                <Input placeholder="Unidad (mL/ave...)" value={form.dosis_unidad} onChange={e => set('dosis_unidad', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Período de retiro (días)</Label>
              <Input type="number" min="0" placeholder="0" value={form.periodo_retiro_dias} onChange={e => set('periodo_retiro_dias', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Frecuencia de aplicación (cada cuántos días)</Label>
              <Input type="number" min="1" placeholder="Ej: 1 (diario)" value={form.frecuencia_dias} onChange={e => set('frecuencia_dias', e.target.value)} />
            </div>
            {form.frecuencia_dias && (
              <div className="space-y-1">
                <Label>Hora de aplicación</Label>
                <Input type="time" value={form.hora_aplicacion} onChange={e => set('hora_aplicacion', e.target.value)} />
              </div>
            )}
            {form.frecuencia_dias && form.fecha_fin && (
              <div className="col-span-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                🔔 Se crearán recordatorios en la app cada {form.frecuencia_dias} día(s) hasta el fin del tratamiento para no olvidar seguir aplicándolo.
              </div>
            )}
            {sinRetiro && (
              <div className="col-span-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                ✓ Sin período de retiro — los huevos se pueden comercializar normalmente
              </div>
            )}
            {retiro && !sinRetiro && (
              <div className="col-span-2 p-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-800">
                ⚠️ Huevos no comercializables hasta: <strong>{retiro}</strong>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label>Motivo / Diagnóstico</Label>
              <Input placeholder="¿Por qué se aplica?" value={form.motivo} onChange={e => set('motivo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Costo</Label>
              <CurrencyInput placeholder="0" value={form.costo} onValueChange={v => set('costo', v)} />
            </div>
            <div className="space-y-1">
              <Label>Encargado</Label>
              <Input placeholder="Nombre del encargado" value={form.encargado} onChange={e => set('encargado', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : medicacionExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
