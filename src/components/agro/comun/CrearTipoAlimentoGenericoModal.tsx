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
import { dbGenerico, type ConfigEspecie } from '@/lib/especiesConfig'

export interface TipoAlimentoGenerico {
  id: string
  finca_id: string
  nombre: string
  marca: string | null
  tipo_alimento_categoria: string | null
  proteina_bruta_pct: number | null
  grasa_pct: number | null
  calcio_pct: number | null
  fosforo_pct: number | null
  lisina_pct: number | null
  energia_kcal_kg: number | null
  precio_bulto: number | null
  peso_bulto_kg: number
  cantidad_entrada: number | null
  fecha_entrada: string | null
  activo: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  loteId: string
  config: ConfigEspecie
  tipoExistente?: TipoAlimentoGenerico | null
  onCreated: () => void
}

function defaultForm(tipo?: TipoAlimentoGenerico | null) {
  return {
    nombre: tipo?.nombre ?? '',
    marca: tipo?.marca ?? '',
    tipo_alimento_categoria: tipo?.tipo_alimento_categoria ?? '',
    proteina_bruta_pct: tipo?.proteina_bruta_pct != null ? String(tipo.proteina_bruta_pct) : '',
    grasa_pct: tipo?.grasa_pct != null ? String(tipo.grasa_pct) : '',
    calcio_pct: tipo?.calcio_pct != null ? String(tipo.calcio_pct) : '',
    fosforo_pct: tipo?.fosforo_pct != null ? String(tipo.fosforo_pct) : '',
    lisina_pct: tipo?.lisina_pct != null ? String(tipo.lisina_pct) : '',
    energia_kcal_kg: tipo?.energia_kcal_kg != null ? String(tipo.energia_kcal_kg) : '',
    precio_bulto: tipo?.precio_bulto != null ? String(tipo.precio_bulto) : '',
    peso_bulto_kg: tipo?.peso_bulto_kg != null ? String(tipo.peso_bulto_kg) : '40',
    cantidad_entrada: '',
    fecha_entrada: new Date().toISOString().split('T')[0],
  }
}

export default function CrearTipoAlimentoGenericoModal({ open, onClose, fincaId, loteId, config, tipoExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(tipoExistente))
  const categorias = config.nutricion.categoriasAlimento
  const categoriaLabel = Object.fromEntries(categorias.map(c => [c.value, c.label]))

  function nombreSugerido(marca: string, categoria: string) {
    return [marca.trim(), categoriaLabel[categoria] ?? ''].filter(Boolean).join(' ')
  }

  // El nombre solo se considera manual si no coincide con lo que marca+tipo
  // sugerirían: así sigue autoactualizándose al cambiar marca o tipo.
  const esManual = (t?: TipoAlimentoGenerico | null) =>
    !!t && t.nombre !== nombreSugerido(t.marca ?? '', t.tipo_alimento_categoria ?? '')

  const [nombreManual, setNombreManual] = useState(() => esManual(tipoExistente))

  useEffect(() => {
    if (open) { setForm(defaultForm(tipoExistente)); setNombreManual(esManual(tipoExistente)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipoExistente])

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

  const costoTotal = form.precio_bulto && form.cantidad_entrada
    ? Number(form.precio_bulto) * Number(form.cantidad_entrada)
    : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre del alimento es requerido'); return }

    setLoading(true)
    const db = dbGenerico(supabase)
    const payload = {
      nombre: form.nombre.trim(),
      marca: form.marca || null,
      tipo_alimento_categoria: form.tipo_alimento_categoria || null,
      proteina_bruta_pct: form.proteina_bruta_pct ? Number(form.proteina_bruta_pct) : null,
      grasa_pct: form.grasa_pct ? Number(form.grasa_pct) : null,
      calcio_pct: form.calcio_pct ? Number(form.calcio_pct) : null,
      fosforo_pct: form.fosforo_pct ? Number(form.fosforo_pct) : null,
      lisina_pct: form.lisina_pct ? Number(form.lisina_pct) : null,
      energia_kcal_kg: form.energia_kcal_kg ? Number(form.energia_kcal_kg) : null,
      precio_bulto: form.precio_bulto ? Number(form.precio_bulto) : null,
      peso_bulto_kg: form.peso_bulto_kg ? Number(form.peso_bulto_kg) : 40,
    }
    const { data: tipo, error } = tipoExistente
      ? await db.from(config.tablas.tiposAlimento).update(payload).eq('id', tipoExistente.id).select().single()
      : await db.from(config.tablas.tiposAlimento).insert({
          ...payload,
          finca_id: fincaId,
          cantidad_entrada: form.cantidad_entrada ? Number(form.cantidad_entrada) : null,
          fecha_entrada: form.cantidad_entrada ? form.fecha_entrada : null,
        }).select().single()

    // La entrada de alimento se registra como costo del lote
    if (!error && !tipoExistente && tipo && costoTotal > 0 && loteId) {
      await db.from(config.tablas.costos).insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha_entrada,
        categoria: 'alimento',
        descripcion: `Compra de alimento: ${form.marca ? form.marca + ' - ' : ''}${form.nombre.trim()} (${form.cantidad_entrada} bultos)`,
        monto: costoTotal,
        tipo_alimento_id: tipo.id,
      })
    }

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
          <p className="text-sm text-gray-500">Composición nutricional según la ficha técnica del fabricante</p>
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
                items={Object.fromEntries(categorias.map(c => [c.value, c.label]))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
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
              <Label>Lisina (%)</Label>
              <Input type="number" step="0.01" min="0" placeholder="Ej: 1.15" value={form.lisina_pct} onChange={e => set('lisina_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Grasa (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ej: 3.5" value={form.grasa_pct} onChange={e => set('grasa_pct', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Energía (kcal/kg)</Label>
              <Input type="number" step="1" min="0" placeholder="Ej: 3100" value={form.energia_kcal_kg} onChange={e => set('energia_kcal_kg', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Calcio (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ej: 0.9" value={form.calcio_pct} onChange={e => set('calcio_pct', e.target.value)} />
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
            {!tipoExistente && (
              <>
                <div className="space-y-1">
                  <Label>Cantidad de entrada (bultos)</Label>
                  <Input type="number" min="0" step="0.1" placeholder="Ej: 20" value={form.cantidad_entrada} onChange={e => set('cantidad_entrada', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Fecha de entrada</Label>
                  <Input type="date" value={form.fecha_entrada} onChange={e => set('fecha_entrada', e.target.value)} />
                </div>
              </>
            )}
          </div>
          {!tipoExistente && costoTotal > 0 && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2">
              Esta entrada se registrará en Finanzas por <span className="font-semibold">{costoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> ({form.cantidad_entrada} bultos × precio por bulto)
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className={config.botonClase}>
              {loading ? 'Guardando...' : tipoExistente ? 'Guardar cambios' : 'Registrar alimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
