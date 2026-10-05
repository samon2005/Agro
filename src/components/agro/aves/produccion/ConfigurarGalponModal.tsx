'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'
import { Ic } from '@/components/ui/icon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LINEAS_PONEDORAS, nacimientoDesdeEdad, semanaDeVida } from '@/lib/referencias'
import { hoyLocal } from '@/lib/fechas'
import SelectorReferencia from '../referencias/SelectorReferencia'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteAves
  onUpdated: (lote: LoteAves) => void
  onDeleted: () => void
}

/** Semanas cumplidas con que llegaron, a partir de la fecha de nacimiento guardada */
function edadAlLlegar(lote: LoteAves): string {
  if (!lote.fecha_nacimiento) return ''
  const dias = (new Date(lote.fecha_inicio + 'T00:00:00').getTime() - new Date(lote.fecha_nacimiento + 'T00:00:00').getTime()) / 86_400_000
  return String(Math.round((dias / 7) * 10) / 10)
}

export default function ConfigurarGalponModal({ open, onClose, lote, onUpdated, onDeleted }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmarNombre, setConfirmarNombre] = useState('')
  const [form, setForm] = useState({
    area_galpon_m2: '',
    fecha_inicio: '',
    linea_genetica: '',
    referencia_id: '',
    edad_llegada: '',
    fecha_inicio_postura: '',
    fecha_salida_programada: '',
    semanas_ciclo_postura: '',
    meta_postura_pct: '',
    meta_huevos_diaria: '',
    precio_gramo_alimento: '',
    peso_bulto_alimento_kg: '',
  })

  useEffect(() => {
    setForm({
      area_galpon_m2: lote.area_galpon_m2 != null ? String(lote.area_galpon_m2) : '',
      fecha_inicio: lote.fecha_inicio ?? '',
      linea_genetica: lote.linea_genetica ?? '',
      referencia_id: lote.referencia_id ?? '',
      edad_llegada: edadAlLlegar(lote),
      fecha_inicio_postura: lote.fecha_inicio_postura ?? '',
      fecha_salida_programada: lote.fecha_salida_programada ?? '',
      semanas_ciclo_postura: lote.semanas_ciclo_postura != null ? String(lote.semanas_ciclo_postura) : '60',
      meta_postura_pct: lote.meta_postura_pct != null ? String(lote.meta_postura_pct) : '90',
      meta_huevos_diaria: lote.meta_huevos_diaria != null ? String(lote.meta_huevos_diaria) : '',
      precio_gramo_alimento: lote.precio_gramo_alimento != null ? String(lote.precio_gramo_alimento) : '',
      peso_bulto_alimento_kg: lote.peso_bulto_alimento_kg != null ? String(lote.peso_bulto_alimento_kg) : '40',
    })
    setConfirmarNombre('')
  }, [lote, open])

  async function handleDelete() {
    if (confirmarNombre.trim() !== lote.nombre) { toast.error('El nombre no coincide'); return }
    setDeleting(true)
    const { error } = await supabase.from('lotes_aves').delete().eq('id', lote.id)
    setDeleting(false)
    if (error) { toast.error('Error al eliminar el galpón'); return }
    toast.success(`Galpón "${lote.nombre}" eliminado`)
    onDeleted()
    onClose()
  }

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  // En levante la postura todavía no existe: sus campos se configuran al marcar el inicio
  const enLevante = lote.estado === 'preparacion'

  // La línea guardada se muestra aunque no esté en la lista (lotes viejos con otro nombre)
  const lineas = form.linea_genetica && !LINEAS_PONEDORAS.includes(form.linea_genetica)
    ? [form.linea_genetica, ...LINEAS_PONEDORAS]
    : LINEAS_PONEDORAS
  const edadHoy = form.edad_llegada.trim() !== '' && Number(form.edad_llegada) >= 0
    ? semanaDeVida(nacimientoDesdeEdad(form.fecha_inicio || lote.fecha_inicio, Number(form.edad_llegada)), hoyLocal())
    : null

  const densidad = form.area_galpon_m2 && Number(form.area_galpon_m2) > 0
    ? (lote.aves_actuales / Number(form.area_galpon_m2)).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const edad = form.edad_llegada.trim()
    if (edad !== '' && (!Number.isFinite(Number(edad)) || Number(edad) < 0 || Number(edad) > 120)) {
      toast.error('La edad al llegar debe estar entre 0 y 120 semanas'); return
    }
    // La fecha de nacimiento solo se recalcula si cambió la edad o la entrada: si no, se respeta la guardada
    const fechaInicio = form.fecha_inicio || lote.fecha_inicio
    const fecha_nacimiento = edad === ''
      ? null
      : edad === edadAlLlegar(lote) && fechaInicio === lote.fecha_inicio
        ? lote.fecha_nacimiento
        : nacimientoDesdeEdad(fechaInicio, Number(edad))
    setLoading(true)
    const payload = {
      linea_genetica: form.linea_genetica || null,
      referencia_id: form.referencia_id || null,
      fecha_nacimiento,
      area_galpon_m2: form.area_galpon_m2 ? Number(form.area_galpon_m2) : null,
      // La fecha de entrada se puede corregir: de ella cuelgan la edad y las semanas
      ...(form.fecha_inicio ? { fecha_inicio: form.fecha_inicio } : {}),
      fecha_inicio_postura: form.fecha_inicio_postura || null,
      fecha_salida_programada: form.fecha_salida_programada || null,
      semanas_ciclo_postura: form.semanas_ciclo_postura ? Number(form.semanas_ciclo_postura) : null,
      meta_postura_pct: form.meta_postura_pct ? Number(form.meta_postura_pct) : null,
      meta_huevos_diaria: form.meta_huevos_diaria ? Number(form.meta_huevos_diaria) : null,
      precio_gramo_alimento: form.precio_gramo_alimento ? Number(form.precio_gramo_alimento) : null,
      peso_bulto_alimento_kg: form.peso_bulto_alimento_kg ? Number(form.peso_bulto_alimento_kg) : null,
    }
    const { data, error } = await supabase
      .from('lotes_aves')
      .update(payload)
      .eq('id', lote.id)
      .select()
      .single()

    // La medida es del galpón (el lugar), no solo del lote que lo ocupa
    if (!error && lote.instalacion_id && payload.area_galpon_m2 != null) {
      await supabase.from('instalaciones').update({ area_m2: payload.area_galpon_m2 }).eq('id', lote.instalacion_id)
    }

    setLoading(false)
    if (error) { toast.error('Error al guardar la configuración'); return }
    toast.success('Configuración del galpón actualizada')
    onUpdated(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="ajustes" /> Configuración del Galpón</DialogTitle>
          <p className="text-sm text-gray-500">
            {enLevante
              ? 'El galpón está en levante: la postura se configura al marcar su inicio.'
              : 'Define el tamaño, la meta de postura y los costos de referencia para calcular indicadores'}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Área del galpón (m²)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 300" value={form.area_galpon_m2} onChange={e => set('area_galpon_m2', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Densidad estimada</Label>
              <Input disabled value={densidad ? `${densidad} aves/m²` : '—'} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de entrada al galpón</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
              <p className="text-xs text-gray-400">
                De esta fecha salen la edad del lote y las semanas de preparación: corrígela si se digitó mal.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Edad al llegar (semanas)</Label>
              <Input type="number" min="0" max="120" step="0.1" placeholder="Ej: 0" value={form.edad_llegada} onChange={e => set('edad_llegada', e.target.value)} />
              <p className="text-xs text-gray-400">
                {edadHoy != null ? `Hoy van en la semana ${edadHoy} de vida.` : 'Sin la edad no se puede comparar con la guía de la línea.'}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Línea genética</Label>
              <Select value={form.linea_genetica} onValueChange={v => set('linea_genetica', v)} items={Object.fromEntries(lineas.map(l => [l, l]))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{lineas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <SelectorReferencia
              fincaId={lote.finca_id}
              lineaGenetica={form.linea_genetica}
              value={form.referencia_id}
              onChange={v => set('referencia_id', v)}
              seguirLinea={false}
            />
            {enLevante ? (
              <div className="space-y-1">
                <Label>¿Cuándo se espera que pongan?</Label>
                <Input type="date" value={form.fecha_inicio_postura} onChange={e => set('fecha_inicio_postura', e.target.value)} />
                <p className="text-xs text-gray-400">Estimado: si pasa la fecha sin postura, avisa que va atrasada</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Fecha de inicio real de postura</Label>
                <Input type="date" value={form.fecha_inicio_postura} onChange={e => set('fecha_inicio_postura', e.target.value)} />
                <p className="text-xs text-gray-400">Se usa para contar la semana de postura del lote</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Salida programada del lote</Label>
              <Input type="date" value={form.fecha_salida_programada} onChange={e => set('fecha_salida_programada', e.target.value)} />
              <p className="text-xs text-gray-400">
                {enLevante ? 'Si las pollas se van a vender (hacia las 14–15 semanas)' : 'Cuándo se piensa sacar el lote'}
              </p>
            </div>
            {!enLevante && (
              <>
                <div className="space-y-1">
                  <Label>Duración del ciclo (semanas)</Label>
                  <Input type="number" min="1" placeholder="Ej: 60" value={form.semanas_ciclo_postura} onChange={e => set('semanas_ciclo_postura', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Meta de postura / pico (%)</Label>
                  <Input type="number" min="0" max="100" step="0.1" placeholder="Ej: 90" value={form.meta_postura_pct} onChange={e => set('meta_postura_pct', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Meta de huevos puestos por día</Label>
                  <Input type="number" min="0" placeholder="Ej: 4500" value={form.meta_huevos_diaria} onChange={e => set('meta_huevos_diaria', e.target.value)} />
                </div>
              </>
            )}
          </div>

          {!enLevante && (
            <p className="text-xs text-gray-400">El precio de venta por tamaño de huevo se define en Ventas de la finca.</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Precio por gramo de alimento ($)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 2.5" value={form.precio_gramo_alimento} onChange={e => set('precio_gramo_alimento', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso del bulto de alimento (kg)</Label>
              <Input type="number" min="0" step="1" placeholder="Ej: 40" value={form.peso_bulto_alimento_kg} onChange={e => set('peso_bulto_alimento_kg', e.target.value)} />
            </div>
          </div>
          <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-red-800"><Ic n="alerta" /> Zona de peligro</p>
            <p className="text-xs text-red-600">
              Eliminar este lote borra para siempre sus aves y todo su historial (producción, sanidad, costos, equipos).
              El galpón sigue en la finca, vacío. No se puede deshacer.
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
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
