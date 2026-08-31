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
import EncargadoSelect from '@/components/agro/EncargadoSelect'
import type { Database } from '@/types/database'

type Vacunacion = Database['public']['Tables']['vacunaciones_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  avesActuales?: number
  vacunacionExistente?: Vacunacion | null
  onCreated: () => void
}

const VACUNAS_COMUNES = ['Newcastle', 'Bronquitis infecciosa', 'Marek', 'Gumboro', 'Viruela aviar', 'Laringotraqueítis', 'Salmonelosis', 'Encefalomielitis', 'Otra']
const VIAS = ['Agua de bebida', 'Ocular', 'Spray', 'Inyectable SC', 'Inyectable IM', 'Ala-web', 'Intranasal']

const UNIDAD_POR_VIA: Record<string, string> = {
  'Agua de bebida': 'mL / L de agua',
  'Ocular': 'gota / ave',
  'Spray': 'mL / ave',
  'Inyectable SC': 'mL / ave',
  'Inyectable IM': 'mL / ave',
  'Ala-web': 'punción / ave',
  'Intranasal': 'gota / ave',
}

function defaultForm(vac?: Vacunacion | null) {
  const esComun = vac ? VACUNAS_COMUNES.includes(vac.vacuna) : true
  const [dosisValor, dosisUnidad] = vac?.dosis ? splitDosis(vac.dosis) : ['', '']
  return {
    fecha_aplicacion: vac?.fecha_aplicacion ?? new Date().toISOString().split('T')[0],
    vacuna: vac ? (esComun ? vac.vacuna : 'Otra') : '',
    vacuna_otra: vac && !esComun ? vac.vacuna : '',
    lote_vacuna: vac?.lote_vacuna ?? '',
    via_administracion: vac?.via_administracion ?? '',
    dosis_valor: dosisValor,
    dosis_unidad: dosisUnidad,
    laboratorio: vac?.laboratorio ?? '',
    proveedor: vac?.proveedor ?? '',
    numero_aves: vac?.numero_aves != null ? String(vac.numero_aves) : '',
    costo: vac?.costo != null ? String(vac.costo) : '',
    proxima_dosis: vac?.proxima_dosis ?? '',
    sin_proxima: false,
    encargado: vac?.veterinario ?? '',
    observaciones: vac?.observaciones ?? '',
  }
}

function splitDosis(dosis: string): [string, string] {
  const match = dosis.match(/^(\S+)\s*(.*)$/)
  return match ? [match[1], match[2]] : ['', dosis]
}

export default function RegistrarVacunacionModal({ open, onClose, loteId, fincaId, avesActuales, vacunacionExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(vacunacionExistente))

  useEffect(() => { if (open) setForm(defaultForm(vacunacionExistente)) }, [open, vacunacionExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  function setSinProxima(checked: boolean) {
    setForm(prev => ({ ...prev, sin_proxima: checked, proxima_dosis: checked ? '' : prev.proxima_dosis }))
  }

  function setVia(via: string | null) {
    setForm(prev => ({ ...prev, via_administracion: via ?? '', dosis_unidad: (via && UNIDAD_POR_VIA[via]) ?? prev.dosis_unidad }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const vacunaFinal = form.vacuna === 'Otra' ? form.vacuna_otra : form.vacuna
    if (!vacunaFinal.trim()) { toast.error('Selecciona o escribe la vacuna'); return }

    setLoading(true)
    const dosis = [form.dosis_valor, form.dosis_unidad].filter(Boolean).join(' ') || null
    const payload = {
      fecha_aplicacion: form.fecha_aplicacion,
      vacuna: vacunaFinal.trim(),
      lote_vacuna: form.lote_vacuna || null,
      via_administracion: form.via_administracion || null,
      dosis,
      laboratorio: form.laboratorio || null,
      proveedor: form.proveedor || null,
      numero_aves: form.numero_aves ? Number(form.numero_aves) : null,
      costo: form.costo ? Number(form.costo) : null,
      proxima_dosis: form.proxima_dosis || null,
      veterinario: form.encargado || null,
      observaciones: form.observaciones || null,
    }
    const { data: vacunacion, error } = vacunacionExistente
      ? await supabase.from('vacunaciones_aves').update(payload).eq('id', vacunacionExistente.id).select().single()
      : await supabase.from('vacunaciones_aves').insert({ ...payload, lote_id: loteId, finca_id: fincaId }).select().single()

    if (!error && !vacunacionExistente && vacunacion && form.costo && Number(form.costo) > 0) {
      await supabase.from('costos_lote_aves').insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha_aplicacion,
        categoria: 'sanitario',
        descripcion: `Vacuna: ${vacunaFinal.trim()}`,
        monto: Number(form.costo),
        vacunacion_id: vacunacion.id,
      })
    }

    setLoading(false)
    if (error) { toast.error(vacunacionExistente ? 'Error al actualizar vacunación' : 'Error al registrar vacunación'); return }
    toast.success(vacunacionExistente ? 'Vacunación actualizada' : 'Vacunación registrada')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vacunacionExistente ? '✏️ Editar Vacunación' : '💉 Registrar Vacunación'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha de aplicación</Label>
              <Input type="date" value={form.fecha_aplicacion} onChange={e => set('fecha_aplicacion', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vacuna *</Label>
              <Select value={form.vacuna} onValueChange={v => set('vacuna', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{VACUNAS_COMUNES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.vacuna === 'Otra' && (
              <div className="col-span-2 space-y-1">
                <Label>Nombre de la vacuna *</Label>
                <Input placeholder="Nombre de la vacuna" value={form.vacuna_otra} onChange={e => set('vacuna_otra', e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Lote de la vacuna</Label>
              <Input placeholder="Número de lote" value={form.lote_vacuna} onChange={e => set('lote_vacuna', e.target.value)} />
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
                <Input type="number" min="0" step="0.01" className="w-20" placeholder="1" value={form.dosis_valor} onChange={e => set('dosis_valor', e.target.value)} />
                <Input placeholder="Unidad (dosis/ave...)" value={form.dosis_unidad} onChange={e => set('dosis_unidad', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Laboratorio</Label>
              <Input placeholder="Fabricante" value={form.laboratorio} onChange={e => set('laboratorio', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Proveedor</Label>
              <Input placeholder="¿Dónde se compró?" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>N° aves vacunadas</Label>
              <Input type="number" min="0" placeholder={avesActuales != null ? String(avesActuales) : undefined} value={form.numero_aves} onChange={e => set('numero_aves', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Costo</Label>
              <CurrencyInput placeholder="0" value={form.costo} onValueChange={v => set('costo', v)} />
            </div>
            <div className="space-y-1">
              <Label>Próxima vacunación</Label>
              <Input type="date" disabled={form.sin_proxima} value={form.proxima_dosis} onChange={e => set('proxima_dosis', e.target.value)} />
              <label className="flex items-center gap-1.5 text-xs text-gray-500 pt-0.5 cursor-pointer">
                <input type="checkbox" checked={form.sin_proxima} onChange={e => setSinProxima(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 text-green-600" />
                No hay próxima vacunación programada
              </label>
            </div>
            <div className="space-y-1">
              <Label>Encargado</Label>
              <EncargadoSelect fincaId={fincaId} value={form.encargado} onChange={v => set('encargado', v)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : vacunacionExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
