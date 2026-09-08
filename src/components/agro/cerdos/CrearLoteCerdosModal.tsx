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
import { hoyLocal, aFechaLocal, desdeFechaLocal } from '@/lib/fechas'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type TipoAlimento = Database['public']['Tables']['tipos_alimento_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  onCreated: (lote: LoteCerdos) => void
}

const LINEAS = ['Landrace', 'Yorkshire (Large White)', 'Duroc', 'Pietrain', 'Hampshire', 'PIC', 'Topigs', 'Otra']

const ETAPAS_CEBA = [
  { value: 'precebo', label: '🐷 Precebo (lechones)' },
  { value: 'levante', label: '🐖 Levante' },
  { value: 'ceba', label: '🐗 Ceba / Engorde' },
]

const NUEVO_ALIMENTO = '__nuevo__'

/** Consumo de referencia por etapa, en kg por animal y día. */
const CONSUMO_SUGERIDO: Record<string, number> = {
  precebo: 0.9, levante: 1.8, ceba: 2.5, cria: 2.4,
}

export default function CrearLoteCerdosModal({ open, onClose, fincaId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [tipos, setTipos] = useState<TipoAlimento[]>([])
  const [form, setForm] = useState({
    sistema: 'ceba',
    nombre: '',
    linea_genetica: '',
    fecha_ingreso: hoyLocal(),
    etapa_actual: 'precebo',
    numero_animales: '',
    edad_valor: '',
    edad_unidad: 'semanas',
    peso_promedio_inicial: '',
    origen_animales: '',
    corral: '',
    observaciones: '',
    // Alimento: obligatorio al crear el lote
    tipo_alimento_id: '',
    alimento_nombre: '',
    alimento_precio_bulto: '',
    alimento_peso_bulto: '40',
    consumo_kg_dia: '',
  })

  useEffect(() => {
    if (!open) return
    supabase.from('tipos_alimento_cerdos').select('*').eq('finca_id', fincaId).eq('activo', true).order('nombre')
      .then(({ data }) => setTipos(data ?? []))
  }, [open, fincaId, supabase])

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  const esCria = form.sistema === 'cria'

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
    if (!form.nombre.trim()) { toast.error('El nombre del lote es requerido'); return }
    if (!form.numero_animales || Number(form.numero_animales) <= 0) {
      toast.error(esCria ? 'Ingresa cuántas hembras entran' : 'Ingresa la cantidad de animales'); return
    }
    // El alimento es obligatorio: sin él no se puede calcular consumo, costo ni conversión
    if (!form.tipo_alimento_id) { toast.error('Selecciona o crea el alimento del lote'); return }
    if (form.tipo_alimento_id === NUEVO_ALIMENTO && !form.alimento_nombre.trim()) {
      toast.error('Ponle nombre al alimento nuevo'); return
    }
    if (!form.consumo_kg_dia || Number(form.consumo_kg_dia) <= 0) {
      toast.error('Ingresa el consumo estimado por animal y día'); return
    }

    setLoading(true)

    // Si el alimento es nuevo, primero entra al catálogo de la finca
    let alimentoId = form.tipo_alimento_id
    if (alimentoId === NUEVO_ALIMENTO) {
      const { data: nuevo, error: errAlimento } = await supabase.from('tipos_alimento_cerdos').insert({
        finca_id: fincaId,
        nombre: form.alimento_nombre.trim(),
        tipo_alimento_categoria: esCria ? 'gestacion' : form.etapa_actual,
        precio_bulto: form.alimento_precio_bulto ? Number(form.alimento_precio_bulto) : null,
        peso_bulto_kg: form.alimento_peso_bulto ? Number(form.alimento_peso_bulto) : 40,
      }).select('id').single()
      if (errAlimento || !nuevo) { setLoading(false); toast.error('Error al crear el alimento'); return }
      alimentoId = nuevo.id
    }

    const cant = Number(form.numero_animales)
    const consumoPorAnimal = Number(form.consumo_kg_dia)
    const { data, error } = await supabase
      .from('lotes_cerdos')
      .insert({
        finca_id: fincaId,
        nombre: form.nombre.trim(),
        sistema: form.sistema,
        linea_genetica: form.linea_genetica || null,
        fecha_ingreso: form.fecha_ingreso,
        fecha_nacimiento: fechaNacimientoDesdeEdad(),
        etapa_actual: esCria ? 'cria' : form.etapa_actual,
        numero_animales: cant,
        animales_actuales: cant,
        peso_promedio_inicial: form.peso_promedio_inicial ? Number(form.peso_promedio_inicial) : null,
        origen_animales: form.origen_animales || null,
        corral: form.corral || null,
        observaciones: form.observaciones || null,
        alimento_activo_id: alimentoId,
        consumo_estimado_kg_dia: consumoPorAnimal,
        consumo_activo_kg: consumoPorAnimal * cant,
      })
      .select()
      .single()

    setLoading(false)
    if (error) { toast.error('Error al crear el lote'); return }
    toast.success(`Lote "${data.nombre}" creado con su alimento`)
    onCreated(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🐷 Nuevo Lote de Cerdos</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sistema: cambia de qué se trata el lote y qué herramientas trae */}
          <div className="space-y-1">
            <Label>Sistema del lote *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set('sistema', 'ceba')}
                className={`rounded-lg border p-3 text-left transition-colors ${!esCria ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}
              >
                <p className="text-sm font-semibold text-gray-800">🐗 Ceba / Engorde</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Se compra el lechón, se levanta y se vende por kilo.</p>
              </button>
              <button
                type="button"
                onClick={() => set('sistema', 'cria')}
                className={`rounded-lg border p-3 text-left transition-colors ${esCria ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-pink-300'}`}
              >
                <p className="text-sm font-semibold text-gray-800">🐖 Cría / Reproducción</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Hembras propias: servicios, gestación, partos y destetes.</p>
              </button>
            </div>
            {esCria && (
              <p className="text-xs text-pink-700 bg-pink-50 border border-pink-200 rounded p-2 mt-1">
                🐖 Este lote trabajará con la pestaña de Reproducción: registro de hembras, servicios
                (monta o inseminación), gestación de 114 días, partos y destetes. Las etapas de
                engorde no aplican.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre del lote *</Label>
              <Input
                placeholder={esCria ? 'Ej: Núcleo de cría - Sala 1' : 'Ej: Lote Ceba 01 - Corral A'}
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
            {!esCria && (
              <div className="space-y-1">
                <Label>Etapa de ingreso</Label>
                <Select value={form.etapa_actual} onValueChange={v => set('etapa_actual', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ETAPAS_CEBA.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{esCria ? 'N° de hembras *' : 'N° animales *'}</Label>
              <Input type="number" min="1" placeholder="Ej: 100" value={form.numero_animales} onChange={e => set('numero_animales', e.target.value)} />
            </div>

            {/* Edad del lote al entrar */}
            <div className="col-span-2 space-y-1">
              <Label>Edad del lote al ingresar</Label>
              <div className="flex gap-2">
                <Input
                  type="number" min="0" className="w-28" placeholder="Ej: 8"
                  value={form.edad_valor} onChange={e => set('edad_valor', e.target.value)}
                />
                <Select value={form.edad_unidad} onValueChange={v => set('edad_unidad', v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dias">días</SelectItem>
                    <SelectItem value="semanas">semanas</SelectItem>
                    <SelectItem value="meses">meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-400">
                Se guarda como fecha de nacimiento, así la edad se actualiza sola cada día.
              </p>
            </div>

            <div className="space-y-1">
              <Label>Peso prom. inicial (kg)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 8.5" value={form.peso_promedio_inicial} onChange={e => set('peso_promedio_inicial', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Corral / Instalación</Label>
              <Input placeholder="Ej: Corral A-3" value={form.corral} onChange={e => set('corral', e.target.value)} />
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

          {/* Alimento obligatorio: sin él no hay consumo, ni costo, ni conversión */}
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">🌾 Alimento del lote (obligatorio)</p>
              <p className="text-xs text-amber-700">
                Todo lote necesita su alimento desde el primer día: de ahí salen el costo, el
                consumo y la conversión alimenticia.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alimento *</Label>
              <Select
                value={form.tipo_alimento_id}
                onValueChange={v => set('tipo_alimento_id', v)}
                items={{ ...Object.fromEntries(tipos.map(t => [t.id, t.nombre])), [NUEVO_ALIMENTO]: '+ Crear alimento nuevo' }}
              >
                <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Seleccionar o crear..." /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="max-h-64">
                  {tipos.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                  <SelectItem value={NUEVO_ALIMENTO}>+ Crear alimento nuevo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo_alimento_id === NUEVO_ALIMENTO && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Nombre del alimento *</Label>
                  <Input className="bg-white" placeholder="Ej: Italcol Precebo" value={form.alimento_nombre} onChange={e => set('alimento_nombre', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio por bulto</Label>
                  <CurrencyInput className="bg-white" placeholder="0" value={form.alimento_precio_bulto} onValueChange={v => set('alimento_precio_bulto', v)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso del bulto (kg)</Label>
                  <Input className="bg-white" type="number" min="1" value={form.alimento_peso_bulto} onChange={e => set('alimento_peso_bulto', e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Consumo estimado por animal (kg/día) *</Label>
              <Input
                className="bg-white" type="number" min="0" step="0.1"
                placeholder={`Ej: ${CONSUMO_SUGERIDO[esCria ? 'cria' : form.etapa_actual] ?? 2}`}
                value={form.consumo_kg_dia}
                onChange={e => set('consumo_kg_dia', e.target.value)}
              />
              {form.numero_animales && form.consumo_kg_dia && (
                <p className="text-xs text-amber-700">
                  Total del lote: {(Number(form.numero_animales) * Number(form.consumo_kg_dia)).toFixed(1)} kg/día
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white">
              {loading ? 'Creando...' : 'Crear Lote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
