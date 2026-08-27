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

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  loteId: string
  onCreated: () => void
}

const TIPOS_CATEGORIA = [
  { value: 'levante', label: 'Levante' },
  { value: 'pollitas_ponedoras', label: 'Pollitas ponedoras' },
  { value: 'otros', label: 'Otros' },
]

function defaultForm() {
  return {
    nombre: '',
    marca: '',
    tipo_alimento_categoria: '',
    proteina_bruta_pct: '',
    grasa_pct: '',
    calcio_pct: '',
    fosforo_pct: '',
    precio_bulto: '',
    peso_bulto_kg: '40',
    cantidad_entrada: '',
    fecha_entrada: new Date().toISOString().split('T')[0],
  }
}

export default function CrearTipoAlimentoModal({ open, onClose, fincaId, loteId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => { if (open) setForm(defaultForm()) }, [open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const costoTotal = form.precio_bulto && form.cantidad_entrada
    ? Number(form.precio_bulto) * Number(form.cantidad_entrada)
    : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre del alimento es requerido'); return }

    setLoading(true)
    const { error } = await supabase.from('tipos_alimento_aves').insert({
      finca_id: fincaId,
      nombre: form.nombre.trim(),
      marca: form.marca || null,
      tipo_alimento_categoria: form.tipo_alimento_categoria || null,
      proteina_bruta_pct: form.proteina_bruta_pct ? Number(form.proteina_bruta_pct) : null,
      grasa_pct: form.grasa_pct ? Number(form.grasa_pct) : null,
      calcio_pct: form.calcio_pct ? Number(form.calcio_pct) : null,
      fosforo_pct: form.fosforo_pct ? Number(form.fosforo_pct) : null,
      precio_bulto: form.precio_bulto ? Number(form.precio_bulto) : null,
      peso_bulto_kg: form.peso_bulto_kg ? Number(form.peso_bulto_kg) : 40,
      cantidad_entrada: form.cantidad_entrada ? Number(form.cantidad_entrada) : null,
      fecha_entrada: form.cantidad_entrada ? form.fecha_entrada : null,
    })

    if (!error && costoTotal > 0 && loteId) {
      await supabase.from('costos_lote_aves').insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha_entrada,
        categoria: 'alimento',
        descripcion: `Compra de alimento: ${form.marca ? form.marca + ' - ' : ''}${form.nombre.trim()} (${form.cantidad_entrada} bultos)`,
        monto: costoTotal,
      })
    }

    setLoading(false)
    if (error) { toast.error('Error al registrar el alimento'); return }
    toast.success(`Alimento "${form.nombre}" registrado`)
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🌾 Nuevo Tipo de Alimento</DialogTitle>
          <p className="text-sm text-gray-500">Composición nutricional según la ficha técnica del fabricante</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre del alimento *</Label>
              <Input placeholder="Ej: Concentrado Postura 18%" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Marca</Label>
              <Input placeholder="Ej: Italcol, Contegral..." value={form.marca} onChange={e => set('marca', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.tipo_alimento_categoria} onValueChange={v => set('tipo_alimento_categoria', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CATEGORIA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Proteína bruta (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ej: 18" value={form.proteina_bruta_pct} onChange={e => set('proteina_bruta_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Grasa (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ej: 3.5" value={form.grasa_pct} onChange={e => set('grasa_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Calcio (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ej: 4.0" value={form.calcio_pct} onChange={e => set('calcio_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fósforo (%)</Label>
              <Input type="number" step="0.01" min="0" placeholder="Ej: 0.45" value={form.fosforo_pct} onChange={e => set('fosforo_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Precio por bulto</Label>
              <CurrencyInput placeholder="0" value={form.precio_bulto} onValueChange={v => set('precio_bulto', v)} />
            </div>
            <div className="space-y-1">
              <Label>Peso del bulto (kg)</Label>
              <Input type="number" min="1" value={form.peso_bulto_kg} onChange={e => set('peso_bulto_kg', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cantidad de entrada (bultos)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 20" value={form.cantidad_entrada} onChange={e => set('cantidad_entrada', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de entrada</Label>
              <Input type="date" value={form.fecha_entrada} onChange={e => set('fecha_entrada', e.target.value)} />
            </div>
          </div>
          {costoTotal > 0 && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2">
              Esta entrada se registrará en Costos por <span className="font-semibold">{costoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> ({form.cantidad_entrada} bultos × precio por bulto)
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Registrar alimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
