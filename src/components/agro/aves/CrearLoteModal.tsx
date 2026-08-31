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
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  onCreated: (lote: LoteAves) => void
}

const LINEAS = ['Lohmann Brown', 'Isa Brown', 'Hy-Line Brown', 'Bovans Brown', 'Babcock B-380', 'Otra']

function defaultForm() {
  return {
    nombre: '',
    linea_genetica: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    aves_iniciales: '',
    area_galpon_m2: '',
    estado: 'preparacion',
    costo_pollitas: '',
    observaciones: '',
  }
}

export default function CrearLoteModal({ open, onClose, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    if (open) setForm(defaultForm())
  }, [open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const densidad = form.area_galpon_m2 && Number(form.area_galpon_m2) > 0 && form.aves_iniciales
    ? (Number(form.aves_iniciales) / Number(form.area_galpon_m2)).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre del lote es requerido'); return }
    if (!form.aves_iniciales || Number(form.aves_iniciales) <= 0) { toast.error('Ingresa la cantidad de aves'); return }

    setLoading(true)
    const aves = Number(form.aves_iniciales)
    const { data, error } = await supabase
      .from('lotes_aves')
      .insert({
        finca_id: fincaId,
        nombre: form.nombre.trim(),
        linea_genetica: form.linea_genetica || null,
        fecha_inicio: form.fecha_inicio,
        aves_iniciales: aves,
        aves_actuales: aves,
        area_galpon_m2: form.area_galpon_m2 ? Number(form.area_galpon_m2) : null,
        estado: form.estado,
        observaciones: form.observaciones || null,
      })
      .select()
      .single()

    if (!error && data && form.costo_pollitas && Number(form.costo_pollitas) > 0) {
      await supabase.from('costos_lote_aves').insert({
        lote_id: data.id,
        finca_id: fincaId,
        fecha: form.fecha_inicio,
        categoria: 'pollitas',
        descripcion: `Compra de pollitas - ${data.nombre}`,
        monto: Number(form.costo_pollitas),
      })
    }

    setLoading(false)
    if (error) { toast.error('Error al crear el lote'); return }
    toast.success(`Lote "${data.nombre}" creado`)
    onCreated(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🐔 Nuevo Galpón</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre del lote / galpón *</Label>
              <Input placeholder="Ej: Lote A - Galpón 1" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Línea genética</Label>
              <Select value={form.linea_genetica} onValueChange={v => set('linea_genetica', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {LINEAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de entrada al galpón</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Número de aves iniciales *</Label>
              <Input type="number" min="1" placeholder="Ej: 5000" value={form.aves_iniciales} onChange={e => set('aves_iniciales', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Área del galpón (m²)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 300" value={form.area_galpon_m2} onChange={e => set('area_galpon_m2', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Costo de las pollitas</Label>
              <CurrencyInput placeholder="Ej: 15000000" value={form.costo_pollitas} onValueChange={v => set('costo_pollitas', v)} />
              <p className="text-xs text-gray-400">Se registra como costo en Finanzas</p>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Densidad estimada</Label>
              <Input disabled value={densidad ? `${densidad} aves/m²` : '—'} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Estado inicial</Label>
              <Select
                value={form.estado}
                onValueChange={v => set('estado', v)}
                items={{ preparacion: 'En preparación (levante, aún sin postura)', activo: 'Activo (ya está en producción de huevo)' }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preparacion">En preparación (levante, aún sin postura)</SelectItem>
                  <SelectItem value="activo">Activo (ya está en producción de huevo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Creando...' : 'Crear Lote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
