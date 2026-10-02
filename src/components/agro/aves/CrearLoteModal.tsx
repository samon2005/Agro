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
import { hoyLocal, aFechaLocal } from '@/lib/fechas'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  /** Galpones de la finca: las aves entran a uno que esté vacío */
  galpones: Instalacion[]
  /** Galpones que ya tienen aves, por id */
  ocupados: Set<string>
  /** Galpón con el que abre, si se llegó desde uno vacío */
  galponInicialId?: string | null
  onCreated: (lote: LoteAves) => void
}

const LINEAS = ['Lohmann Brown', 'Isa Brown', 'Hy-Line Brown', 'Bovans Brown', 'Babcock B-380', 'Otra']
const SEMANAS_INICIO_POSTURA = 20

function sumarSemanas(fechaStr: string, semanas: number) {
  const d = new Date(fechaStr + 'T00:00:00')
  d.setDate(d.getDate() + semanas * 7)
  return aFechaLocal(d)
}

function defaultForm(galponId: string) {
  const fechaInicio = hoyLocal()
  return {
    instalacion_id: galponId,
    linea_genetica: '',
    fecha_inicio: fechaInicio,
    aves_iniciales: '',
    costo_pollitas: '',
    // preparacion = pollas de levante · activo = ya están en postura
    estado: 'preparacion',
    observaciones: '',
    fecha_inicio_postura: sumarSemanas(fechaInicio, SEMANAS_INICIO_POSTURA),
    fecha_salida_programada: '',
    // Solo si entran ya en postura: si no, se configura al marcar el inicio
    meta_postura_pct: '90',
    meta_huevos_diaria: '',
    semanas_ciclo_postura: '60',
  }
}

/**
 * Registrar las aves que entran a un galpón. El galpón ya existe en la finca con
 * su nombre y su medida: aquí solo va lo de las aves (cuántas, cuándo, cuánto
 * costaron y si llegan de levante o ya en postura). La configuración de postura
 * se hace al marcar su inicio, salvo que entren poniendo.
 */
export default function CrearLoteModal({ open, onClose, fincaId, galpones, ocupados, galponInicialId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const libres = galpones.filter(g => !ocupados.has(g.id))
  const [form, setForm] = useState(() => defaultForm(galponInicialId ?? libres[0]?.id ?? ''))
  const [posturaManual, setPosturaManual] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(galponInicialId ?? libres[0]?.id ?? ''))
    setPosturaManual(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, galponInicialId])

  function set(field: string, value: string | null) {
    setForm(prev => {
      const next = { ...prev, [field]: value ?? '' }
      if (field === 'fecha_inicio' && !posturaManual && value) {
        next.fecha_inicio_postura = sumarSemanas(value, SEMANAS_INICIO_POSTURA)
      }
      return next
    })
  }

  const galpon = galpones.find(g => g.id === form.instalacion_id) ?? null
  const enPostura = form.estado === 'activo'
  const area = galpon?.area_m2 != null ? Number(galpon.area_m2) : null
  const densidad = area && area > 0 && form.aves_iniciales
    ? (Number(form.aves_iniciales) / area).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!galpon) { toast.error('Elige el galpón al que entran las aves'); return }
    if (ocupados.has(galpon.id)) { toast.error(`${galpon.nombre} ya tiene aves: sácalas antes de registrar otras`); return }
    if (!form.aves_iniciales || Number(form.aves_iniciales) <= 0) { toast.error('Ingresa cuántas aves entraron'); return }
    if (enPostura && (!form.meta_postura_pct || !form.semanas_ciclo_postura)) {
      toast.error('Si entran en postura, completa la duración del ciclo y la meta de pico'); return
    }

    setLoading(true)
    const aves = Number(form.aves_iniciales)
    const { data, error } = await supabase
      .from('lotes_aves')
      .insert({
        finca_id: fincaId,
        instalacion_id: galpon.id,
        // El lote lleva el nombre y la medida de su galpón
        nombre: galpon.nombre,
        area_galpon_m2: area,
        linea_genetica: form.linea_genetica || null,
        fecha_inicio: form.fecha_inicio,
        aves_iniciales: aves,
        aves_actuales: aves,
        estado: form.estado,
        observaciones: form.observaciones || null,
        // Si entran poniendo, la postura empezó con su llegada
        fecha_inicio_postura: enPostura ? form.fecha_inicio : (form.fecha_inicio_postura || null),
        fecha_salida_programada: form.fecha_salida_programada || null,
        meta_postura_pct: enPostura && form.meta_postura_pct ? Number(form.meta_postura_pct) : null,
        meta_huevos_diaria: enPostura && form.meta_huevos_diaria ? Number(form.meta_huevos_diaria) : null,
        semanas_ciclo_postura: enPostura && form.semanas_ciclo_postura ? Number(form.semanas_ciclo_postura) : null,
      })
      .select()
      .single()

    if (!error && data && form.costo_pollitas && Number(form.costo_pollitas) > 0) {
      await supabase.from('costos_lote_aves').insert({
        lote_id: data.id,
        finca_id: fincaId,
        fecha: form.fecha_inicio,
        categoria: 'pollitas',
        descripcion: `Compra de aves - ${data.nombre}`,
        monto: Number(form.costo_pollitas),
      })
    }

    setLoading(false)
    if (error) {
      toast.error(error.code === '23505' ? `${galpon.nombre} ya tiene aves` : 'Error al registrar las aves')
      return
    }
    toast.success(`${aves.toLocaleString('es-CO')} aves registradas en ${data.nombre}`)
    onCreated(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="ave" /> Registrar aves en un galpón</DialogTitle>
          <p className="text-sm text-gray-500">El galpón ya está registrado con su medida: aquí solo va lo de las aves que entran.</p>
        </DialogHeader>

        {galpones.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            La finca todavía no tiene galpones. Regístralos en <strong>Datos de la finca</strong> y vuelve aquí.
          </p>
        ) : libres.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Todos los galpones tienen aves. Para registrar otras, saca primero las de un galpón o agrega uno nuevo en <strong>Datos de la finca</strong>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Galpón *</Label>
                <Select
                  value={form.instalacion_id}
                  onValueChange={v => set('instalacion_id', v)}
                  items={Object.fromEntries(galpones.map(g => [g.id, g.nombre]))}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar galpón..." /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {galpones.map(g => (
                      <SelectItem key={g.id} value={g.id} disabled={ocupados.has(g.id)}>
                        {g.nombre}
                        {g.area_m2 != null ? ` · ${Number(g.area_m2).toLocaleString('es-CO')} m²` : ''}
                        {ocupados.has(g.id) ? ' · con aves' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label>¿Cómo llegan las aves?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'preparacion', t: 'Pollas de levante', d: 'Todavía no ponen' },
                    { v: 'activo', t: 'En postura', d: 'Ya están poniendo' },
                  ] as const).map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => set('estado', o.v)}
                      aria-pressed={form.estado === o.v}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        form.estado === o.v ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <p className="text-sm font-semibold text-gray-800">{o.t}</p>
                      <p className="text-[0.6875rem] text-gray-500">{o.d}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Línea genética</Label>
                <Select value={form.linea_genetica} onValueChange={v => set('linea_genetica', v)} items={Object.fromEntries(LINEAS.map(l => [l, l]))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{LINEAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha de entrada</Label>
                <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Aves que entraron *</Label>
                <Input type="number" min="1" placeholder="Ej: 5000" value={form.aves_iniciales} onChange={e => set('aves_iniciales', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Costo de las aves</Label>
                <CurrencyInput placeholder="Ej: 15000000" value={form.costo_pollitas} onValueChange={v => set('costo_pollitas', v)} />
                <p className="text-xs text-gray-400">Queda como costo en Finanzas</p>
              </div>
              <div className="col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                {galpon?.area_m2 != null
                  ? <>Galpón de {Number(galpon.area_m2).toLocaleString('es-CO')} m²{densidad ? <> · densidad de <strong>{densidad} aves/m²</strong></> : ''}</>
                  : 'Este galpón no tiene medida registrada: agrégala en Datos de la finca.'}
              </div>

              {!enPostura ? (
                <>
                  <div className="space-y-1">
                    <Label>¿Cuándo se espera que pongan?</Label>
                    <Input
                      type="date" value={form.fecha_inicio_postura}
                      onChange={e => { setPosturaManual(true); setForm(p => ({ ...p, fecha_inicio_postura: e.target.value })) }}
                    />
                    <p className="text-xs text-gray-400">Estimado. La postura se configura al marcar su inicio.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Salida programada</Label>
                    <Input type="date" value={form.fecha_salida_programada} onChange={e => set('fecha_salida_programada', e.target.value)} />
                    <p className="text-xs text-gray-400">Si las pollas se van a vender (hacia las 14–15 semanas).</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2 border-t pt-3">
                    <p className="text-sm font-medium text-gray-700"><Ic n="huevo" /> Configuración de postura</p>
                    <p className="text-xs text-gray-400">Como entran poniendo, la postura empieza con su llegada.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Duración del ciclo (semanas) *</Label>
                    <Input type="number" min="1" value={form.semanas_ciclo_postura} onChange={e => set('semanas_ciclo_postura', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Meta de postura / pico (%) *</Label>
                    <Input type="number" min="0" max="100" step="0.1" value={form.meta_postura_pct} onChange={e => set('meta_postura_pct', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Meta de huevos puestos por día</Label>
                    <Input type="number" min="0" placeholder="Ej: 4600" value={form.meta_huevos_diaria} onChange={e => set('meta_huevos_diaria', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Salida programada del lote</Label>
                    <Input type="date" value={form.fecha_salida_programada} onChange={e => set('fecha_salida_programada', e.target.value)} />
                  </div>
                </>
              )}

              <div className="col-span-2 space-y-1">
                <Label>Observaciones</Label>
                <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Registrando...' : 'Registrar aves'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
