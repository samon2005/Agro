'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'
import { hoyLocal, aFechaLocal, desdeFechaLocal } from '@/lib/fechas'
import { Ic } from '@/components/ui/icon'
import { usoCorralLabel } from '@/lib/instalaciones'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  /** El corral al que entra el lote: ya está definido desde la finca */
  corral: Instalacion | null
  onCreated: (lote: LoteCerdos) => void
}

const LINEAS = ['Landrace', 'Yorkshire (Large White)', 'Duroc', 'Pietrain', 'Hampshire', 'PIC', 'Topigs', 'Otra']

function formVacio() {
  return {
    nombre: '',
    linea_genetica: '',
    fecha_ingreso: hoyLocal(),
    numero_animales: '',
    edad_valor: '',
    edad_unidad: 'semanas',
    peso_promedio_inicial: '',
    origen_animales: '',
    observaciones: '',
  }
}

/**
 * El lote que entra a un corral. El corral y su tipo ya están definidos: un corral
 * de cría recibe cerdas (que luego se reparten en naves) y uno de precebo recibe
 * lechones. El alimento no se pide aquí: se registra en Alimento de la finca y el
 * consumo en el corral, como en las aves.
 */
export default function CrearLoteCerdosModal({ open, onClose, fincaId, corral, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(formVacio)

  useEffect(() => { if (open) setForm(formVacio()) }, [open])

  function set(field: keyof ReturnType<typeof formVacio>, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const esCria = corral?.uso === 'cria'
  const etapa = esCria ? 'cria' : (corral?.uso ?? 'precebo')

  /** La edad se guarda como fecha de nacimiento para que no quede congelada. */
  function fechaNacimientoDesdeEdad(): string | null {
    if (!form.edad_valor || Number(form.edad_valor) <= 0) return null
    const dias = form.edad_unidad === 'semanas'
      ? Number(form.edad_valor) * 7
      : form.edad_unidad === 'meses'
        ? Number(form.edad_valor) * 30
        : Number(form.edad_valor)
    const ingreso = desdeFechaLocal(form.fecha_ingreso)
    return aFechaLocal(new Date(ingreso.getTime() - dias * 24 * 60 * 60 * 1000))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!corral) { toast.error('Elige el corral'); return }
    if (!form.nombre.trim()) { toast.error('El nombre del lote es requerido'); return }
    const cant = Number(form.numero_animales)
    if (!(cant > 0) || !Number.isInteger(cant)) {
      toast.error(esCria ? 'Ingresa cuántas hembras entran' : 'Ingresa cuántos animales entran'); return
    }
    if (form.fecha_ingreso > hoyLocal()) { toast.error('La fecha de ingreso no puede ser futura'); return }

    setLoading(true)
    const { data, error } = await supabase
      .from('lotes_cerdos')
      .insert({
        finca_id: fincaId,
        instalacion_id: corral.id,
        corral: corral.nombre,
        area_corral_m2: corral.area_m2,
        nombre: form.nombre.trim(),
        sistema: esCria ? 'cria' : 'ceba',
        linea_genetica: form.linea_genetica || null,
        fecha_ingreso: form.fecha_ingreso,
        fecha_nacimiento: fechaNacimientoDesdeEdad(),
        etapa_actual: etapa,
        numero_animales: cant,
        animales_actuales: cant,
        peso_promedio_inicial: form.peso_promedio_inicial ? Number(form.peso_promedio_inicial) : null,
        origen_animales: form.origen_animales || null,
        observaciones: form.observaciones || null,
      })
      .select()
      .single()

    setLoading(false)
    if (error) {
      toast.error(error.code === '23505' ? `${corral.nombre} ya tiene un lote activo` : 'Error al crear el lote')
      return
    }
    toast.success(`Lote "${data.nombre}" en ${corral.nombre}. Ahora registra su alimento y su consumo.`)
    onCreated(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !loading && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="cerdo" /> Agregar lote a {corral?.nombre ?? 'el corral'}</DialogTitle>
          <p className="text-sm text-gray-500">
            {corral && <>Corral de <strong>{usoCorralLabel(corral.uso)?.toLowerCase() ?? 'cerdos'}</strong>{corral.area_m2 ? ` · ${Number(corral.area_m2).toLocaleString('es-CO')} m²` : ''}. </>}
            El alimento se registra después, en Alimento.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`rounded-lg border p-3 text-xs ${esCria ? 'border-pink-200 bg-pink-50 text-pink-800' : 'border-orange-200 bg-orange-50 text-orange-800'}`}>
            <p className="text-sm font-semibold"><Ic n="cerdo" /> {esCria ? 'Cría / Reproducción' : 'Precebo'}</p>
            {esCria
              ? 'Las cerdas se reparten en naves y cada nave lleva sus hembras, servicios (monta o inseminación), gestación de 114 días, partos, lechones y destetes.'
              : 'Lechones destetados: entran de los destetes de la finca o de afuera.'}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre del lote *</Label>
              <Input
                placeholder={esCria ? 'Ej: Cerdas 2026' : 'Ej: Precebo octubre'}
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Línea genética</Label>
              <Select value={form.linea_genetica} onValueChange={v => set('linea_genetica', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{LINEAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de ingreso</Label>
              <Input type="date" max={hoyLocal()} value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{esCria ? 'N° de hembras *' : 'N° de animales *'}</Label>
              <Input type="number" min="1" step="1" placeholder="Ej: 10" value={form.numero_animales} onChange={e => set('numero_animales', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso prom. inicial (kg)</Label>
              <Input type="number" min="0" step="0.1" placeholder={esCria ? 'Ej: 180' : 'Ej: 7'} value={form.peso_promedio_inicial} onChange={e => set('peso_promedio_inicial', e.target.value)} />
            </div>

            <div className="col-span-2 space-y-1">
              <Label>Edad del lote al ingresar</Label>
              <div className="flex gap-2">
                <Input
                  type="number" min="0" className="w-28" placeholder="Ej: 8"
                  value={form.edad_valor} onChange={e => set('edad_valor', e.target.value)}
                />
                <Select value={form.edad_unidad} onValueChange={v => set('edad_unidad', v)}
                  items={{ dias: 'días', semanas: 'semanas', meses: 'meses' }}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dias">días</SelectItem>
                    <SelectItem value="semanas">semanas</SelectItem>
                    <SelectItem value="meses">meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-400">Se guarda como fecha de nacimiento, así la edad se actualiza sola cada día.</p>
            </div>

            <div className="space-y-1">
              <Label>Corral</Label>
              <p className="flex h-9 items-center rounded-md bg-gray-50 px-3 text-sm text-gray-700">{corral?.nombre ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <Label>Origen</Label>
              <Input placeholder="Ej: Granja La Esperanza" value={form.origen_animales} onChange={e => set('origen_animales', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={loading} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !corral} className="bg-orange-600 text-white hover:bg-orange-700">
              {loading ? 'Guardando...' : 'Agregar lote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
