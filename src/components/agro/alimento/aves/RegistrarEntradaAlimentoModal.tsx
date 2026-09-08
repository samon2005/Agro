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
import { hoyLocal } from '@/lib/fechas'

type TipoAlimento = Database['public']['Tables']['tipos_alimento_aves']['Row']
type Entrada = Database['public']['Tables']['entradas_alimento_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  tiposAlimento: TipoAlimento[]
  entradaExistente?: Entrada | null
  onCreated: () => void
}

function defaultForm(e?: Entrada | null, tipos: TipoAlimento[] = []) {
  return {
    tipo_alimento_id: e?.tipo_alimento_id ?? (tipos.length === 1 ? tipos[0].id : ''),
    fecha: e?.fecha ?? hoyLocal(),
    cantidad_bultos: e ? String(e.cantidad_bultos) : '',
    precio_bulto: e?.precio_bulto != null ? String(e.precio_bulto) : '',
    proveedor: e?.proveedor ?? '',
    observaciones: e?.observaciones ?? '',
  }
}

export default function RegistrarEntradaAlimentoModal({ open, onClose, loteId, fincaId, tiposAlimento, entradaExistente, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => defaultForm(entradaExistente, tiposAlimento))

  useEffect(() => {
    if (open) setForm(defaultForm(entradaExistente, tiposAlimento))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entradaExistente])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const tipo = tiposAlimento.find(t => t.id === form.tipo_alimento_id) ?? null
  const bultos = Number(form.cantidad_bultos) || 0
  // Si no se escribe precio, se usa el del catálogo del alimento
  const precio = form.precio_bulto ? Number(form.precio_bulto) : (tipo?.precio_bulto ?? 0)
  const costoTotal = bultos * precio
  const kgTotales = bultos * (tipo?.peso_bulto_kg ?? 40)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo_alimento_id) { toast.error('Selecciona el tipo de alimento'); return }
    if (bultos <= 0) { toast.error('Ingresa cuántos bultos entraron'); return }

    setLoading(true)
    const payload = {
      tipo_alimento_id: form.tipo_alimento_id,
      fecha: form.fecha,
      cantidad_bultos: bultos,
      precio_bulto: form.precio_bulto ? Number(form.precio_bulto) : null,
      proveedor: form.proveedor || null,
      observaciones: form.observaciones || null,
    }

    const { data: entrada, error } = entradaExistente
      ? await supabase.from('entradas_alimento_aves').update(payload).eq('id', entradaExistente.id).select().single()
      : await supabase.from('entradas_alimento_aves').insert({ ...payload, finca_id: fincaId, lote_id: loteId }).select().single()

    if (!error && entrada && !entradaExistente) {
      // Queda como costo del lote, igual que antes se hacía desde el catálogo
      if (costoTotal > 0) {
        await supabase.from('costos_lote_aves').insert({
          lote_id: loteId,
          finca_id: fincaId,
          fecha: form.fecha,
          categoria: 'alimento',
          descripcion: `Entrada de alimento: ${tipo?.nombre ?? ''} (${bultos} bultos)`,
          monto: costoTotal,
          proveedor: form.proveedor || null,
          entrada_alimento_id: entrada.id,
        })
      }

      // Y suma al inventario general de la finca, bajo la categoría Alimento
      await sumarAInventario()
    }

    setLoading(false)
    if (error) { toast.error('Error al registrar la entrada'); return }
    toast.success(entradaExistente ? 'Entrada actualizada' : `${bultos} bultos agregados al inventario`)
    onCreated()
    onClose()
  }

  /** Mantiene sincronizado el ítem de inventario general con lo que entra de alimento. */
  async function sumarAInventario() {
    if (!tipo) return
    const { data: categoria } = await supabase
      .from('inventario_categorias')
      .select('id')
      .eq('finca_id', fincaId)
      .ilike('nombre', 'alimento')
      .maybeSingle()

    let categoriaId = categoria?.id ?? null
    if (!categoriaId) {
      const { data: nueva } = await supabase
        .from('inventario_categorias')
        .insert({ finca_id: fincaId, nombre: 'Alimento', color: '#F59E0B' })
        .select('id').single()
      categoriaId = nueva?.id ?? null
    }

    const { data: item } = await supabase
      .from('inventario')
      .select('id, cantidad_actual')
      .eq('finca_id', fincaId)
      .eq('nombre', tipo.nombre)
      .maybeSingle()

    if (item) {
      await supabase.from('inventario')
        .update({ cantidad_actual: Number(item.cantidad_actual) + bultos })
        .eq('id', item.id)
    } else {
      await supabase.from('inventario').insert({
        finca_id: fincaId,
        categoria_id: categoriaId,
        nombre: tipo.nombre,
        unidad_medida: 'bultos',
        cantidad_actual: bultos,
        cantidad_minima: 0,
        precio_unitario: precio || null,
        proveedor: form.proveedor || null,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entradaExistente ? '✏️ Editar Entrada' : '📦 Registrar Entrada de Alimento'}</DialogTitle>
          <p className="text-sm text-gray-500">Lo que entra al galpón. Suma al inventario y queda registrado como costo.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Tipo de alimento *</Label>
            <Select
              value={form.tipo_alimento_id}
              onValueChange={v => set('tipo_alimento_id', v)}
              items={Object.fromEntries(tiposAlimento.map(t => [t.id, t.nombre]))}
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {tiposAlimento.length === 0
                  ? <div className="px-2 py-1.5 text-xs text-gray-400">Créalo primero en la pestaña Alimento</div>
                  : tiposAlimento.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Cantidad (bultos) *</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 20" value={form.cantidad_bultos} onChange={e => set('cantidad_bultos', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de entrada</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Precio por bulto</Label>
              <CurrencyInput placeholder={tipo?.precio_bulto ? String(tipo.precio_bulto) : '0'} value={form.precio_bulto} onValueChange={v => set('precio_bulto', v)} />
              <p className="text-xs text-gray-400">Si lo dejas vacío se usa el del catálogo</p>
            </div>
            <div className="space-y-1">
              <Label>Proveedor</Label>
              <Input placeholder="¿Dónde se compró?" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas de la entrada..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>

          {bultos > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-0.5">
              <p className="text-xs text-amber-700">Entran {kgTotales.toLocaleString('es-CO')} kg ({bultos} bultos de {tipo?.peso_bulto_kg ?? 40} kg)</p>
              {costoTotal > 0 && (
                <p className="text-sm font-semibold text-amber-800">
                  Se registra en Finanzas por {costoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || tiposAlimento.length === 0} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : entradaExistente ? 'Guardar cambios' : 'Registrar entrada'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
