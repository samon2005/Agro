'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import type { Database } from '@/types/database'
import { edadTexto } from '@/lib/cerdos'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  onUpdated: (lote: LoteCerdos) => void
  onDeleted: () => void
}

export default function ConfigurarLoteCerdosModal({ open, onClose, lote, onUpdated, onDeleted }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmarNombre, setConfirmarNombre] = useState('')
  const [form, setForm] = useState({
    nombre: '',
    corral: '',
    area_corral_m2: '',
    fecha_nacimiento: '',
    peso_objetivo_kg: '',
    fecha_salida_estimada: '',
    precio_kg_objetivo: '',
    consumo_estimado_kg_dia: '',
    observaciones: '',
  })

  useEffect(() => {
    setForm({
      nombre: lote.nombre,
      corral: lote.corral ?? '',
      area_corral_m2: lote.area_corral_m2 != null ? String(lote.area_corral_m2) : '',
      fecha_nacimiento: lote.fecha_nacimiento ?? '',
      peso_objetivo_kg: lote.peso_objetivo_kg != null ? String(lote.peso_objetivo_kg) : '',
      fecha_salida_estimada: lote.fecha_salida_estimada ?? '',
      precio_kg_objetivo: lote.precio_kg_objetivo != null ? String(lote.precio_kg_objetivo) : '',
      consumo_estimado_kg_dia: lote.consumo_estimado_kg_dia != null ? String(lote.consumo_estimado_kg_dia) : '',
      observaciones: lote.observaciones ?? '',
    })
    setConfirmarNombre('')
  }, [lote, open])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const esCria = lote.sistema === 'cria'

  const densidad = form.area_corral_m2 && Number(form.area_corral_m2) > 0
    ? (lote.animales_actuales / Number(form.area_corral_m2)).toFixed(2)
    : null

  async function handleDelete() {
    if (confirmarNombre.trim() !== lote.nombre) { toast.error('El nombre no coincide'); return }
    setDeleting(true)
    const { error } = await supabase.from('lotes_cerdos').delete().eq('id', lote.id)
    setDeleting(false)
    if (error) { toast.error('Error al eliminar el lote'); return }
    toast.success(`Lote "${lote.nombre}" eliminado`)
    onDeleted()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre del lote es requerido'); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('lotes_cerdos')
      .update({
        nombre: form.nombre.trim(),
        corral: form.corral || null,
        area_corral_m2: form.area_corral_m2 ? Number(form.area_corral_m2) : null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        peso_objetivo_kg: form.peso_objetivo_kg ? Number(form.peso_objetivo_kg) : null,
        fecha_salida_estimada: form.fecha_salida_estimada || null,
        precio_kg_objetivo: form.precio_kg_objetivo ? Number(form.precio_kg_objetivo) : null,
        consumo_estimado_kg_dia: form.consumo_estimado_kg_dia ? Number(form.consumo_estimado_kg_dia) : null,
        observaciones: form.observaciones || null,
      })
      .eq('id', lote.id)
      .select()
      .single()

    setLoading(false)
    if (error) { toast.error('Error al guardar la configuración'); return }
    toast.success('Configuración del lote actualizada')
    onUpdated(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚙️ Configuración del Lote</DialogTitle>
          <p className="text-sm text-gray-500">
            {esCria
              ? 'Datos del núcleo de cría: instalación, edad de las hembras y costos de referencia.'
              : 'Tamaño del corral, meta de peso y costos de referencia para calcular indicadores.'}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre del lote</Label>
              <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Corral / Instalación</Label>
              <Input placeholder="Ej: Corral A-3" value={form.corral} onChange={e => set('corral', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Área del corral (m²)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 120" value={form.area_corral_m2} onChange={e => set('area_corral_m2', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Densidad estimada</Label>
              <Input disabled value={densidad ? `${densidad} animales/m²` : '—'} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de ingreso</Label>
              <Input disabled value={new Date(lote.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })} />
              <p className="text-xs text-gray-400">Se registró al crear el lote</p>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Fecha de nacimiento del lote</Label>
              <Input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
              <p className="text-xs text-gray-400">
                De aquí sale la edad{form.fecha_nacimiento ? `: hoy el lote tiene ${edadTexto(form.fecha_nacimiento)}` : ''}
              </p>
            </div>
            {!esCria && (
              <>
                <div className="space-y-1">
                  <Label>Peso objetivo de salida (kg)</Label>
                  <Input type="number" min="0" step="0.1" placeholder="Ej: 110" value={form.peso_objetivo_kg} onChange={e => set('peso_objetivo_kg', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Fecha estimada de salida</Label>
                  <Input type="date" value={form.fecha_salida_estimada} onChange={e => set('fecha_salida_estimada', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Precio objetivo por kg</Label>
                  <CurrencyInput placeholder="0" value={form.precio_kg_objetivo} onValueChange={v => set('precio_kg_objetivo', v)} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Consumo estimado (kg/animal/día)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 2.5" value={form.consumo_estimado_kg_dia} onChange={e => set('consumo_estimado_kg_dia', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas del lote..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>

          <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-red-800">⚠️ Zona de peligro</p>
            <p className="text-xs text-red-600">
              Eliminar este lote borra permanentemente todo su historial: pesajes, mortalidad,
              nutrición, sanidad, costos, ventas y equipos{esCria ? ', además de las hembras, servicios, partos y destetes' : ''}.
              Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder={`Escribe "${lote.nombre}" para confirmar`}
                value={confirmarNombre}
                onChange={e => setConfirmarNombre(e.target.value)}
                className="bg-white"
              />
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || confirmarNombre.trim() !== lote.nombre}
                onClick={handleDelete}
              >
                {deleting ? 'Eliminando...' : 'Eliminar lote'}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white">
              {loading ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
