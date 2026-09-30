'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/ui/currency-input'
import { toSelectItems } from '@/lib/utils'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type Equipo = Database['public']['Tables']['equipos_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  equipoExistente?: Equipo | null
  onCreated: () => void
}

const TIPOS = [
  { value: 'ventilador', label: 'Ventilador' },
  { value: 'banda_recoleccion', label: 'Banda de recolección' },
  { value: 'lampara', label: 'Lámpara / Iluminación' },
  { value: 'calefactor', label: 'Calefactor' },
  { value: 'cuenta_huevos', label: 'Máquina cuenta huevos' },
  { value: 'otro', label: 'Otro — escribir cuál' },
]

/** Un tipo que no está en la lista es uno escrito a mano. */
function esTipoPropio(tipo: string) {
  return tipo !== '' && !TIPOS.some(t => t.value === tipo)
}

const ESTADOS = [
  { value: 'operativo', label: 'Operativo' },
  { value: 'mantenimiento', label: 'En mantenimiento' },
  { value: 'falla', label: 'Con falla' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'planificado', label: 'Planificado (futuro)' },
]

function defaultForm(equipo?: Equipo | null) {
  const propio = esTipoPropio(equipo?.tipo ?? '')
  return {
    tipo: propio ? 'otro' : (equipo?.tipo ?? ''),
    tipo_otro: propio ? (equipo?.tipo ?? '') : '',
    marca: equipo?.marca ?? '',
    numero_serie: equipo?.numero_serie ?? '',
    apodo: equipo?.nombre ?? '',
    estado: equipo?.estado ?? 'operativo',
    ultima_revision: equipo?.ultima_revision ?? '',
    proximo_mantenimiento: equipo?.proximo_mantenimiento ?? '',
    costo_compra: equipo?.costo_compra != null ? String(equipo.costo_compra) : '',
    fecha_compra: equipo?.fecha_compra ?? '',
    observaciones: equipo?.observaciones ?? '',
  }
}

export default function CrearEquipoModal({ open, onClose, loteId, fincaId, equipoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(equipoExistente))

  useEffect(() => { if (open) setForm(defaultForm(equipoExistente)) }, [open, equipoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo) { toast.error('Selecciona el tipo de equipo'); return }
    if (form.tipo === 'otro' && !form.tipo_otro.trim()) { toast.error('Escribe qué equipo es'); return }

    setLoading(true)
    // "Otro" no se guarda como "otro": se guarda lo que el operario escribió
    const tipoGuardado = form.tipo === 'otro' ? form.tipo_otro.trim() : form.tipo
    const tipoLabel = form.tipo === 'otro'
      ? tipoGuardado
      : TIPOS.find(t => t.value === form.tipo)?.label.replace(/^\S+\s/, '') ?? tipoGuardado
    const payload = {
      nombre: form.apodo.trim() || (form.numero_serie.trim() ? `${tipoLabel} ${form.numero_serie.trim()}` : tipoLabel),
      tipo: tipoGuardado,
      marca: form.marca || null,
      numero_serie: form.numero_serie.trim() || null,
      estado: form.estado,
      ultima_revision: form.ultima_revision || null,
      proximo_mantenimiento: form.proximo_mantenimiento || null,
      costo_compra: form.costo_compra ? Number(form.costo_compra) : null,
      fecha_compra: form.fecha_compra || null,
      observaciones: form.observaciones || null,
    }
    const { data: equipo, error } = equipoExistente
      ? await supabase.from('equipos_aves').update(payload).eq('id', equipoExistente.id).select().single()
      : await supabase.from('equipos_aves').insert({ ...payload, lote_id: loteId, finca_id: fincaId }).select().single()

    if (!error && equipo && !equipoExistente && form.costo_compra && Number(form.costo_compra) > 0) {
      await supabase.from('costos_lote_aves').insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha_compra || hoyLocal(),
        categoria: 'equipos',
        descripcion: `Equipo: ${equipo.nombre}`,
        monto: Number(form.costo_compra),
        equipo_id: equipo.id,
      })
    }

    setLoading(false)
    if (error) { toast.error(equipoExistente ? 'Error al actualizar equipo' : 'Error al crear equipo'); return }
    toast.success(equipoExistente ? 'Equipo actualizado' : 'Equipo registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{equipoExistente ? 'Editar Equipo' : 'Registrar Equipo'}</DialogTitle>
          <p className="text-sm text-gray-500">Comederos y bebederos se manejan desde Inventario, no como equipo con mantenimiento</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => set('tipo', v)} items={toSelectItems(TIPOS)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.tipo === 'otro' && (
              <div className="col-span-2 space-y-1">
                <Label>¿Qué equipo es? *</Label>
                <Input
                  placeholder="Ej: Nebulizador, planta eléctrica..."
                  value={form.tipo_otro}
                  onChange={e => set('tipo_otro', e.target.value)}
                />
                <p className="text-xs text-gray-400">Queda guardado con ese nombre y se agrupa con los demás iguales.</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>N° de serie / diferenciador</Label>
              <Input placeholder="Ej: VN-2024-001" value={form.numero_serie} onChange={e => set('numero_serie', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Marca</Label>
              <Input placeholder="Ej: Big Dutchman" value={form.marca} onChange={e => set('marca', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Apodo (opcional)</Label>
              <Input placeholder="Ej: Ventilador Norte" value={form.apodo} onChange={e => set('apodo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Estado inicial</Label>
              <Select value={form.estado} onValueChange={v => set('estado', v)} items={toSelectItems(ESTADOS)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Costo de compra</Label>
              <CurrencyInput placeholder="Ej: 250000" value={form.costo_compra} onValueChange={v => set('costo_compra', v)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de compra</Label>
              <Input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)} />
              <p className="text-xs text-gray-400">Puede ser pasada (equipo antiguo) o futura (compra planificada)</p>
            </div>
            <div className="space-y-1">
              <Label>Próximo mantenimiento</Label>
              <Input type="date" value={form.proximo_mantenimiento} onChange={e => set('proximo_mantenimiento', e.target.value)} />
            </div>
            {equipoExistente && (
              <div className="space-y-1">
                <Label>Última revisión</Label>
                <Input type="date" value={form.ultima_revision} onChange={e => set('ultima_revision', e.target.value)} />
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas del equipo..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : equipoExistente ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
