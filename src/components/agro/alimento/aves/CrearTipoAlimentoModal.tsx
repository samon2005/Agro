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
import type { Database } from '@/types/database'

type TipoAlimento = Database['public']['Tables']['tipos_alimento_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  tipoExistente?: TipoAlimento | null
  onCreated: () => void
}

const TIPOS_CATEGORIA = [
  { value: 'levante', label: 'Levante' },
  { value: 'pollitas_ponedoras', label: 'Pollitas ponedoras' },
  { value: 'otros', label: 'Otros' },
]

const CATEGORIA_LABEL: Record<string, string> = Object.fromEntries(TIPOS_CATEGORIA.map(t => [t.value, t.label]))

function nombreSugerido(marca: string, categoria: string) {
  return [marca.trim(), CATEGORIA_LABEL[categoria] ?? ''].filter(Boolean).join(' ')
}

/** El nombre se considera "manual" (no debe autoactualizarse) solo si no coincide con lo que la marca+tipo sugerirían. */
function esNombreManual(tipo?: TipoAlimento | null) {
  if (!tipo) return false
  return tipo.nombre !== nombreSugerido(tipo.marca ?? '', tipo.tipo_alimento_categoria ?? '')
}

function defaultForm(tipo?: TipoAlimento | null) {
  return {
    nombre: tipo?.nombre ?? '',
    marca: tipo?.marca ?? '',
    tipo_alimento_categoria: tipo?.tipo_alimento_categoria ?? '',
    proteina_bruta_pct: tipo?.proteina_bruta_pct != null ? String(tipo.proteina_bruta_pct) : '',
    grasa_pct: tipo?.grasa_pct != null ? String(tipo.grasa_pct) : '',
    calcio_pct: tipo?.calcio_pct != null ? String(tipo.calcio_pct) : '',
    fosforo_pct: tipo?.fosforo_pct != null ? String(tipo.fosforo_pct) : '',
    precio_bulto: tipo?.precio_bulto != null ? String(tipo.precio_bulto) : '',
    peso_bulto_kg: tipo?.peso_bulto_kg != null ? String(tipo.peso_bulto_kg) : '40',
  }
}

export default function CrearTipoAlimentoModal({ open, onClose, fincaId, tipoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(tipoExistente))
  const [nombreManual, setNombreManual] = useState(() => esNombreManual(tipoExistente))

  useEffect(() => { if (open) { setForm(defaultForm(tipoExistente)); setNombreManual(esNombreManual(tipoExistente)) } }, [open, tipoExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  function setMarca(value: string) {
    setForm(prev => ({ ...prev, marca: value, nombre: nombreManual ? prev.nombre : nombreSugerido(value, prev.tipo_alimento_categoria) }))
  }

  function setCategoria(value: string | null) {
    setForm(prev => ({ ...prev, tipo_alimento_categoria: value ?? '', nombre: nombreManual ? prev.nombre : nombreSugerido(prev.marca, value ?? '') }))
  }

  function setNombre(value: string) {
    setNombreManual(true)
    set('nombre', value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre del alimento es requerido'); return }

    setLoading(true)
    const payload = {
      nombre: form.nombre.trim(),
      marca: form.marca || null,
      tipo_alimento_categoria: form.tipo_alimento_categoria || null,
      proteina_bruta_pct: form.proteina_bruta_pct ? Number(form.proteina_bruta_pct) : null,
      grasa_pct: form.grasa_pct ? Number(form.grasa_pct) : null,
      calcio_pct: form.calcio_pct ? Number(form.calcio_pct) : null,
      fosforo_pct: form.fosforo_pct ? Number(form.fosforo_pct) : null,
      precio_bulto: form.precio_bulto ? Number(form.precio_bulto) : null,
      peso_bulto_kg: form.peso_bulto_kg ? Number(form.peso_bulto_kg) : 40,
    }
    const { data: tipo, error } = tipoExistente
      ? await supabase.from('tipos_alimento_aves').update(payload).eq('id', tipoExistente.id).select().single()
      : await supabase.from('tipos_alimento_aves').insert({ ...payload, finca_id: fincaId }).select().single()


    setLoading(false)
    if (error) { toast.error(tipoExistente ? 'Error al actualizar el alimento' : 'Error al registrar el alimento'); return }
    toast.success(tipoExistente ? 'Alimento actualizado' : `Alimento "${form.nombre}" registrado`)
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipoExistente ? '✏️ Editar Tipo de Alimento' : '🌾 Nuevo Tipo de Alimento'}</DialogTitle>
          <p className="text-sm text-gray-500">
            Composición nutricional según la ficha técnica del fabricante. Las entradas de bultos
            se registran en la pestaña Inventario.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Marca</Label>
              <Input placeholder="Ej: Italcol, Contegral..." value={form.marca} onChange={e => setMarca(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.tipo_alimento_categoria}
                onValueChange={setCategoria}
                items={Object.fromEntries(TIPOS_CATEGORIA.map(t => [t.value, t.label]))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CATEGORIA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Nombre del alimento *</Label>
              <Input placeholder="Se autocompleta con marca + tipo" value={form.nombre} onChange={e => setNombre(e.target.value)} />
              <p className="text-xs text-gray-400">Se arma solo con la marca y el tipo — puedes escribirlo distinto si lo prefieres</p>
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : tipoExistente ? 'Guardar cambios' : 'Registrar alimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
