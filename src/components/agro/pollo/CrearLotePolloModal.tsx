'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { Ic } from '@/components/ui/icon'
import { DIAS_CICLO_POR_SEXO } from '@/lib/pollo'

type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  onCreated: (lote: LotePollo) => void
}

const LINEAS = ['Ross 308', 'Ross 708', 'Cobb 500', 'Cobb 700', 'Arbor Acres', 'Hubbard Flex', 'Hubbard Classic', 'Otra']

function formVacio() {
  return {
    nombre: '', codigo_lote: '', linea_genetica: '', proveedor: '',
    fecha_ingreso: hoyLocal(), hora_llegada: '',
    pollos_iniciales: '', peso_promedio_inicial: '', costo_pollito: '',
    galpone: '', observaciones: '',
    // 'mixto' entra en un solo lote; 'separar' arma uno de machos y otro de hembras
    manejo_sexo: 'mixto',
    machos: '', hembras: '',
  }
}

/**
 * La llegada del pollito es el punto de partida del ciclo: de dónde vino, a qué
 * hora llegó, cuánto costó y con qué peso entró. Si se sexa al llegar, entran
 * como dos lotes, porque machos y hembras no se venden el mismo día.
 */
export default function CrearLotePolloModal({ open, onClose, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(formVacio)

  const separa = form.manejo_sexo === 'separar'
  const machos = Number(form.machos) || 0
  const hembras = Number(form.hembras) || 0
  const total = separa ? machos + hembras : Number(form.pollos_iniciales) || 0

  function set(campo: string, valor: string) {
    setForm(p => ({ ...p, [campo]: valor }))
  }

  /** Los datos que comparten los lotes que entran en esta misma llegada. */
  function datosComunes() {
    return {
      finca_id: fincaId,
      codigo_lote: form.codigo_lote || null,
      linea_genetica: form.linea_genetica || null,
      proveedor: form.proveedor || null,
      fecha_ingreso: form.fecha_ingreso,
      hora_llegada: form.hora_llegada || null,
      peso_promedio_inicial: form.peso_promedio_inicial ? Number(form.peso_promedio_inicial) : null,
      costo_pollito: form.costo_pollito ? Number(form.costo_pollito) : null,
      origen_pollos: form.proveedor || null,
      galpone: form.galpone || null,
      observaciones: form.observaciones || null,
      estado: 'activo',
    }
  }

  /** El pollito comprado es el primer costo del lote. */
  async function registrarCosto(loteId: string, cantidad: number) {
    const costo = Number(form.costo_pollito) || 0
    if (costo <= 0) return
    await supabase.from('costos_lote_pollo').insert({
      lote_id: loteId,
      finca_id: fincaId,
      fecha: form.fecha_ingreso,
      categoria: 'pollitos',
      descripcion: `Compra de ${cantidad.toLocaleString('es-CO')} pollitos`,
      monto: costo * cantidad,
      proveedor: form.proveedor || null,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre) { toast.error('Ponle nombre al lote'); return }
    if (total <= 0) { toast.error(separa ? 'Ingresa cuántos machos y cuántas hembras llegaron' : 'Ingresa cuántos pollitos llegaron'); return }

    setSaving(true)
    const comunes = datosComunes()

    if (separa) {
      // Machos y hembras van en lotes aparte: cada sexo tiene su propio ciclo
      const grupos = [
        { sexo: 'machos' as const, cantidad: machos },
        { sexo: 'hembras' as const, cantidad: hembras },
      ].filter(g => g.cantidad > 0)

      const creados: LotePollo[] = []
      for (const g of grupos) {
        const { data, error } = await supabase.from('lotes_pollo').insert({
          ...comunes,
          nombre: `${form.nombre} · ${g.sexo === 'machos' ? 'Machos' : 'Hembras'}`,
          sexo: g.sexo,
          pollos_iniciales: g.cantidad,
          pollos_actuales: g.cantidad,
          dias_ciclo: DIAS_CICLO_POR_SEXO[g.sexo],
        }).select().single()
        if (error || !data) { setSaving(false); toast.error(`Error al crear el lote de ${g.sexo}`); return }
        await registrarCosto(data.id, g.cantidad)
        creados.push(data)
      }
      setSaving(false)
      toast.success(`${creados.length} lotes creados: cada sexo con su ciclo (${DIAS_CICLO_POR_SEXO.machos} y ${DIAS_CICLO_POR_SEXO.hembras} días)`)
      onCreated(creados[0])
      onClose()
      setForm(formVacio())
      return
    }

    const { data, error } = await supabase.from('lotes_pollo').insert({
      ...comunes,
      nombre: form.nombre,
      sexo: 'mixto',
      pollos_iniciales: total,
      pollos_actuales: total,
      dias_ciclo: DIAS_CICLO_POR_SEXO.mixto,
    }).select().single()
    if (!error && data) await registrarCosto(data.id, total)
    setSaving(false)
    if (error || !data) { toast.error('Error al crear lote'); return }
    toast.success('Lote creado')
    onCreated(data)
    onClose()
    setForm(formVacio())
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="pollo" /> Llegada de pollitos</DialogTitle>
          <p className="text-sm text-gray-500">
            El pollo entra de un día y ahí arranca todo: de dónde vino, cuándo llegó, cuánto costó
            y con qué peso entró.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del lote *</Label>
              <Input placeholder="Ej: Lote Engorde Jun-2026" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código del lote</Label>
              <Input placeholder="El que trae la incubadora" value={form.codigo_lote} onChange={e => set('codigo_lote', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Línea genética</Label>
              <Select
                value={form.linea_genetica}
                onValueChange={v => set('linea_genetica', v ?? '')}
                items={Object.fromEntries(LINEAS.map(l => [l, l]))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{LINEAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proveedor / incubadora</Label>
              <Input placeholder="¿Quién los trajo?" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha de llegada *</Label>
              <Input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora de llegada</Label>
              <Input type="time" value={form.hora_llegada} onChange={e => set('hora_llegada', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Peso promedio al llegar (g)</Label>
              <Input type="number" step="0.1" placeholder="Ej: 42" value={form.peso_promedio_inicial} onChange={e => set('peso_promedio_inicial', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Costo por pollito</Label>
              <CurrencyInput placeholder="0" value={form.costo_pollito} onValueChange={v => set('costo_pollito', v ?? '')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Galpón asignado</Label>
              <Input placeholder="Ej: Galpón Norte" value={form.galpone} onChange={e => set('galpone', e.target.value)} />
            </div>
          </div>

          {/* Sexaje: cada sexo tiene su ciclo, así que entran como lotes aparte */}
          <div className="space-y-3 rounded-xl bg-gray-50 p-3">
            <div>
              <p className="text-xs font-semibold text-gray-700">¿Se sexaron al llegar?</p>
              <p className="text-[0.6875rem] text-gray-500">
                Los machos se venden hacia los {DIAS_CICLO_POR_SEXO.machos} días y las hembras hacia los {DIAS_CICLO_POR_SEXO.hembras}.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set('manejo_sexo', 'mixto')}
                className={`rounded-lg border p-3 text-left transition-colors ${!separa ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 bg-white hover:border-yellow-300'}`}
              >
                <p className="text-sm font-semibold text-gray-800">No, entran mixtos</p>
                <p className="mt-0.5 text-[0.6875rem] text-gray-500">Un solo lote con todos.</p>
              </button>
              <button
                type="button"
                onClick={() => set('manejo_sexo', 'separar')}
                className={`rounded-lg border p-3 text-left transition-colors ${separa ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 bg-white hover:border-yellow-300'}`}
              >
                <p className="text-sm font-semibold text-gray-800">Sí, separar por sexo</p>
                <p className="mt-0.5 text-[0.6875rem] text-gray-500">Se crean dos lotes, cada uno con su ciclo.</p>
              </button>
            </div>

            {separa ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Machos</Label>
                  <Input type="number" min="0" className="bg-white" placeholder="0" value={form.machos} onChange={e => set('machos', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hembras</Label>
                  <Input type="number" min="0" className="bg-white" placeholder="0" value={form.hembras} onChange={e => set('hembras', e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="max-w-xs space-y-1">
                <Label className="text-xs">Cantidad de pollitos *</Label>
                <Input type="number" min="1" className="bg-white" placeholder="Ej: 10000" value={form.pollos_iniciales} onChange={e => set('pollos_iniciales', e.target.value)} />
              </div>
            )}

            {total > 0 && (
              <p className="text-xs text-gray-600">
                Entran <strong>{total.toLocaleString('es-CO')}</strong> pollitos
                {Number(form.costo_pollito) > 0 && ` · costo de ${(total * Number(form.costo_pollito)).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}, que queda en Finanzas`}
                {separa && machos > 0 && hembras > 0 && ` · dos lotes: ${machos.toLocaleString('es-CO')} machos y ${hembras.toLocaleString('es-CO')} hembras`}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observaciones</Label>
            <Input value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-yellow-600 text-white hover:bg-yellow-700">
              {saving ? 'Creando...' : separa ? 'Crear los dos lotes' : 'Crear lote'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
