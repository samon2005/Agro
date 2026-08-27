'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  onCreated: () => void
}

const TIPOS = [
  { value: 'ventilador', label: '💨 Ventilador' },
  { value: 'banda_recoleccion', label: '🔄 Banda de recolección' },
  { value: 'lampara', label: '💡 Lámpara / Iluminación' },
  { value: 'calefactor', label: '🔥 Calefactor' },
  { value: 'cuenta_huevos', label: '🥚 Máquina cuenta huevos' },
  { value: 'otro', label: '⚙️ Otro' },
]

const ESTADOS = [
  { value: 'operativo', label: '✅ Operativo' },
  { value: 'mantenimiento', label: '🔧 En mantenimiento' },
  { value: 'falla', label: '❌ Con falla' },
  { value: 'inactivo', label: '⏸️ Inactivo' },
]

function defaultForm() {
  return {
    tipo: '',
    marca: '',
    numero_serie: '',
    apodo: '',
    estado: 'operativo',
    ultima_revision: '',
    proximo_mantenimiento: '',
    observaciones: '',
  }
}

export default function CrearEquipoModal({ open, onClose, loteId, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => { if (open) setForm(defaultForm()) }, [open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo) { toast.error('Selecciona el tipo de equipo'); return }
    if (!form.numero_serie.trim()) { toast.error('Ingresa el N° de serie o un diferenciador del equipo'); return }

    setLoading(true)
    const tipoLabel = TIPOS.find(t => t.value === form.tipo)?.label.replace(/^\S+\s/, '') ?? form.tipo
    const { error } = await supabase.from('equipos_aves').insert({
      lote_id: loteId,
      finca_id: fincaId,
      nombre: form.apodo.trim() || `${tipoLabel} ${form.numero_serie.trim()}`,
      tipo: form.tipo,
      marca: form.marca || null,
      numero_serie: form.numero_serie.trim(),
      estado: form.estado,
      ultima_revision: form.ultima_revision || null,
      proximo_mantenimiento: form.proximo_mantenimiento || null,
      observaciones: form.observaciones || null,
    })
    setLoading(false)
    if (error) { toast.error('Error al crear equipo'); return }
    toast.success('Equipo registrado')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>⚙️ Registrar Equipo</DialogTitle>
          <p className="text-sm text-gray-500">Comederos y bebederos se manejan desde Inventario, no como equipo con mantenimiento</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>N° de serie / diferenciador *</Label>
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
              <Select value={form.estado} onValueChange={v => set('estado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Última revisión</Label>
              <Input type="date" value={form.ultima_revision} onChange={e => set('ultima_revision', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Próximo mantenimiento</Label>
              <Input type="date" value={form.proximo_mantenimiento} onChange={e => set('proximo_mantenimiento', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas del equipo..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
