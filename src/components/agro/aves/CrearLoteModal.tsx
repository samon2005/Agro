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
import { LINEAS_PONEDORAS as LINEAS, fechaDeSemanaDeVida, nacimientoDesdeEdad, semanaInicioPostura } from '@/lib/referencias'
import { useReferencia } from '@/lib/useReferencia'
import { PROPOSITOS, type Proposito } from '@/lib/lotesAves'
import SelectorReferencia from './referencias/SelectorReferencia'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']
type Plantilla = Database['public']['Tables']['plantillas_lote_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  /** Galpones de la finca: las aves entran a uno que esté vacío */
  galpones: Instalacion[]
  /** Galpones que ya tienen aves, por id */
  ocupados: Set<string>
  /** Galpones vacíos todavía en vacío sanitario, con la fecha en que terminan */
  vacioSanitario?: Record<string, string>
  /** Galpón con el que abre, si se llegó desde uno vacío */
  galponInicialId?: string | null
  onCreated: (lote: LoteAves) => void
}

// Semana de vida en que suelen empezar a poner, si no hay guía de la línea
const SEMANAS_INICIO_POSTURA = 20
const SIN_PLANTILLA = 'ninguna'

function sumarSemanas(fechaStr: string, semanas: number) {
  const d = new Date(fechaStr + 'T00:00:00')
  d.setDate(d.getDate() + semanas * 7)
  return aFechaLocal(d)
}

function fechaLarga(f: string) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function defaultForm(galponId: string) {
  const fechaInicio = hoyLocal()
  return {
    instalacion_id: galponId,
    linea_genetica: '',
    referencia_id: '',
    proposito: 'ciclo_completo' as Proposito,
    fecha_inicio: fechaInicio,
    // Semanas cumplidas al llegar: de ahí sale la fecha de nacimiento y la semana de vida
    edad_semanas: '0',
    aves_iniciales: '',
    costo_pollitas: '',
    // preparacion = pollas de levante · activo = ya están en postura
    estado: 'preparacion',
    observaciones: '',
    fecha_inicio_postura: sumarSemanas(fechaInicio, SEMANAS_INICIO_POSTURA - 1),
    // Si se venden: la semana de vida en que salen (de ahí la fecha)
    semana_salida: '',
    fecha_salida_programada: '',
    // Solo si entran ya en postura: si no, se configura al marcar el inicio
    meta_postura_pct: '90',
    meta_huevos_diaria: '',
    semanas_ciclo_postura: '60',
    plantilla_id: SIN_PLANTILLA,
    guardar_plantilla: false,
    nombre_plantilla: '',
    desinfectado: false,
  }
}

/**
 * Registrar las aves que entran a un galpón. El galpón ya existe en la finca con
 * su nombre y su medida: aquí solo va lo de las aves (cuántas, cuándo, cuánto
 * costaron, con qué edad, para qué entran y si llegan de levante o en postura).
 * Lo que se repite de un lote a otro se guarda como plantilla.
 */
export default function CrearLoteModal({ open, onClose, fincaId, galpones, ocupados, vacioSanitario = {}, galponInicialId, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const libres = galpones.filter(g => !ocupados.has(g.id))
  // Primero un galpón listo; si todos están en vacío sanitario, el primero libre
  const galponPorDefecto = () => galponInicialId ?? (libres.find(g => !vacioSanitario[g.id]) ?? libres[0])?.id ?? ''
  const [form, setForm] = useState(() => defaultForm(galponPorDefecto()))
  const [posturaManual, setPosturaManual] = useState(false)
  const [salidaManual, setSalidaManual] = useState(false)
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  // Cambia al aplicar una plantilla: la referencia que trae no se reemplaza por la de la línea
  const [plantillaAplicada, setPlantillaAplicada] = useState(0)

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(galponPorDefecto()))
    setPosturaManual(false)
    setSalidaManual(false)
    setPlantillaAplicada(0)
    let vigente = true
    supabase.from('plantillas_lote_aves').select('*').eq('finca_id', fincaId).order('nombre')
      .then(({ data }) => { if (vigente) setPlantillas(data ?? []) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, galponInicialId, fincaId])

  const referencia = useReferencia(form.referencia_id)

  const edadValida = form.edad_semanas.trim() !== '' && Number(form.edad_semanas) >= 0
  const fechaNacimiento = edadValida ? nacimientoDesdeEdad(form.fecha_inicio, Number(form.edad_semanas)) : null

  // Cuándo se espera que pongan: la semana de vida en que la guía de la línea
  // espera postura; sin guía, hacia la semana 20 de vida (mientras no la escriban a mano)
  const semanaPostura = semanaInicioPostura(referencia) ?? SEMANAS_INICIO_POSTURA
  const posturaEstimada = (() => {
    const estimada = fechaNacimiento
      ? fechaDeSemanaDeVida(fechaNacimiento, semanaPostura)
      : sumarSemanas(form.fecha_inicio, SEMANAS_INICIO_POSTURA - 1)
    // Si ya pasó (pollas viejas), no se propone una fecha anterior a la entrada
    return estimada < form.fecha_inicio ? form.fecha_inicio : estimada
  })()
  const fechaInicioPostura = posturaManual ? form.fecha_inicio_postura : posturaEstimada

  // Si se venden, la salida sale de la semana de vida en que se van
  const seVende = form.proposito !== 'ciclo_completo'
  const semanaSalida = Number(form.semana_salida)
  const salidaEstimada = seVende && fechaNacimiento && form.semana_salida.trim() !== '' && semanaSalida > 0
    ? fechaDeSemanaDeVida(fechaNacimiento, semanaSalida)
    : ''
  const fechaSalida = seVende && !salidaManual ? salidaEstimada : form.fecha_salida_programada

  function set(field: string, value: string | null) {
    setForm(prev => {
      const next = { ...prev, [field]: value ?? '' }
      // Las que llegan poniendo no son de un día: la edad por defecto deja de servir
      if (field === 'estado' && value === 'activo' && prev.edad_semanas === '0') next.edad_semanas = ''
      if (field === 'estado' && value === 'preparacion' && prev.edad_semanas === '') next.edad_semanas = '0'
      // Unas aves que ya ponen no se venden como pollas
      if (field === 'estado' && value === 'activo' && prev.proposito === 'venta_levante') {
        next.proposito = 'ciclo_completo'
        next.semana_salida = ''
      }
      return next
    })
  }

  function elegirProposito(p: Proposito) {
    setSalidaManual(false)
    setForm(prev => ({
      ...prev,
      proposito: p,
      semana_salida: String(PROPOSITOS.find(x => x.v === p)?.semanaSalida ?? ''),
      fecha_salida_programada: p === 'ciclo_completo' ? prev.fecha_salida_programada : '',
    }))
  }

  function aplicarPlantilla(id: string) {
    const p = plantillas.find(x => x.id === id)
    if (!p) { setForm(prev => ({ ...prev, plantilla_id: SIN_PLANTILLA })); return }
    setSalidaManual(false)
    setPlantillaAplicada(n => n + 1)
    setForm(prev => ({
      ...prev,
      plantilla_id: id,
      linea_genetica: p.linea_genetica ?? '',
      referencia_id: p.referencia_id ?? '',
      proposito: p.proposito,
      estado: p.estado_llegada,
      edad_semanas: p.edad_llegada_semanas != null ? String(Number(p.edad_llegada_semanas)) : '',
      semana_salida: p.semana_salida != null ? String(p.semana_salida) : '',
      semanas_ciclo_postura: p.semanas_ciclo_postura != null ? String(p.semanas_ciclo_postura) : prev.semanas_ciclo_postura,
      meta_postura_pct: p.meta_postura_pct != null ? String(Number(p.meta_postura_pct)) : prev.meta_postura_pct,
    }))
  }

  async function borrarPlantilla() {
    const p = plantillas.find(x => x.id === form.plantilla_id)
    if (!p || !window.confirm(`¿Borrar la configuración "${p.nombre}"? Los lotes que la usaron no cambian.`)) return
    const { error } = await supabase.from('plantillas_lote_aves').delete().eq('id', p.id)
    if (error) { toast.error('No se pudo borrar la configuración'); return }
    setPlantillas(prev => prev.filter(x => x.id !== p.id))
    setForm(prev => ({ ...prev, plantilla_id: SIN_PLANTILLA }))
    toast.success('Configuración borrada')
  }

  const galpon = galpones.find(g => g.id === form.instalacion_id) ?? null
  const vacioHasta = galpon ? vacioSanitario[galpon.id] : undefined
  const enPostura = form.estado === 'activo'
  const area = galpon?.area_m2 != null ? Number(galpon.area_m2) : null
  const densidad = area && area > 0 && form.aves_iniciales
    ? (Number(form.aves_iniciales) / area).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!galpon) { toast.error('Elige el galpón al que entran las aves'); return }
    if (ocupados.has(galpon.id)) { toast.error(`${galpon.nombre} ya tiene aves: sácalas antes de registrar otras`); return }
    if (vacioHasta && !form.desinfectado) {
      toast.error(`${galpon.nombre} está en vacío sanitario hasta el ${fechaLarga(vacioHasta)}: confirma que ya se limpió y desinfectó`); return
    }
    if (!form.aves_iniciales || Number(form.aves_iniciales) <= 0) { toast.error('Ingresa cuántas aves entraron'); return }
    if (form.edad_semanas.trim() !== '' && (!Number.isFinite(Number(form.edad_semanas)) || Number(form.edad_semanas) < 0 || Number(form.edad_semanas) > 120)) {
      toast.error('La edad al llegar debe estar entre 0 y 120 semanas'); return
    }
    if (seVende && form.semana_salida.trim() !== '' && (!Number.isInteger(semanaSalida) || semanaSalida < 1 || semanaSalida > 120)) {
      toast.error('La semana de salida va de 1 a 120'); return
    }
    if (fechaSalida && fechaSalida <= form.fecha_inicio) { toast.error('La salida programada debe ser después de la entrada'); return }
    if (enPostura && (!form.meta_postura_pct || !form.semanas_ciclo_postura)) {
      toast.error('Si entran en postura, completa la duración del ciclo y la meta de pico'); return
    }
    const nombrePlantilla = form.nombre_plantilla.trim()
    if (form.guardar_plantilla && !nombrePlantilla) { toast.error('Ponle un nombre a la configuración que vas a guardar'); return }

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
        referencia_id: form.referencia_id || null,
        proposito: form.proposito,
        fecha_nacimiento: fechaNacimiento,
        fecha_inicio: form.fecha_inicio,
        aves_iniciales: aves,
        aves_actuales: aves,
        estado: form.estado,
        observaciones: form.observaciones || null,
        // Si entran poniendo, la postura empezó con su llegada
        fecha_inicio_postura: enPostura ? form.fecha_inicio : (fechaInicioPostura || null),
        fecha_salida_programada: fechaSalida || null,
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

    if (!error && form.guardar_plantilla) {
      const { error: errP } = await supabase.from('plantillas_lote_aves').insert({
        finca_id: fincaId,
        nombre: nombrePlantilla,
        linea_genetica: form.linea_genetica || null,
        referencia_id: form.referencia_id || null,
        proposito: form.proposito,
        estado_llegada: enPostura ? 'activo' : 'preparacion',
        edad_llegada_semanas: edadValida ? Number(form.edad_semanas) : null,
        semana_salida: seVende && semanaSalida > 0 ? semanaSalida : null,
        semanas_ciclo_postura: form.semanas_ciclo_postura ? Number(form.semanas_ciclo_postura) : null,
        meta_postura_pct: form.meta_postura_pct ? Number(form.meta_postura_pct) : null,
      })
      if (errP) toast.error(errP.code === '23505' ? `Ya hay una configuración llamada "${nombrePlantilla}": no se guardó` : 'No se pudo guardar la configuración')
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
              {plantillas.length > 0 && (
                <div className="col-span-2 space-y-1 rounded-lg bg-green-50/60 p-3">
                  <Label>Usar una configuración guardada</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.plantilla_id}
                      onValueChange={v => aplicarPlantilla(v ?? SIN_PLANTILLA)}
                      items={{ [SIN_PLANTILLA]: 'Llenar a mano', ...Object.fromEntries(plantillas.map(p => [p.id, p.nombre])) }}
                    >
                      <SelectTrigger className="min-w-0 flex-1 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value={SIN_PLANTILLA}>Llenar a mano</SelectItem>
                        {plantillas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.plantilla_id !== SIN_PLANTILLA && (
                      <button type="button" onClick={borrarPlantilla} title="Borrar esta configuración" className="shrink-0 rounded-lg px-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Ic n="borrar" className="size-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Llena la línea, la referencia, la edad, el propósito y las metas. Puedes cambiar lo que haga falta.</p>
                </div>
              )}

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
                        {ocupados.has(g.id) ? ' · con aves' : vacioSanitario[g.id] ? ` · vacío sanitario hasta ${fechaLarga(vacioSanitario[g.id])}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {vacioHasta && (
                <label className="col-span-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <input
                    type="checkbox" className="mt-0.5 accent-green-700"
                    checked={form.desinfectado}
                    onChange={e => setForm(p => ({ ...p, desinfectado: e.target.checked }))}
                  />
                  <span>
                    <strong>{galpon?.nombre}</strong> está en vacío sanitario hasta el {fechaLarga(vacioHasta)}.
                    Confirmo que ya se limpió y desinfectó y puede recibir aves.
                  </span>
                </label>
              )}

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

              <div className="col-span-2 space-y-1">
                <Label>¿Para qué entran?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PROPOSITOS.map(o => {
                    const deshabilitado = o.v === 'venta_levante' && enPostura
                    return (
                      <button
                        key={o.v}
                        type="button"
                        disabled={deshabilitado}
                        onClick={() => elegirProposito(o.v)}
                        aria-pressed={form.proposito === o.v}
                        className={cn(
                          'rounded-lg border p-2.5 text-left transition-colors disabled:opacity-40',
                          form.proposito === o.v ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300',
                        )}
                      >
                        <p className="text-sm font-semibold text-gray-800">{o.t}</p>
                        <p className="text-[0.6875rem] text-gray-500">{o.d}</p>
                      </button>
                    )
                  })}
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
                <Label>Edad al llegar (semanas)</Label>
                <Input
                  type="number" min="0" max="120" step="1"
                  placeholder={enPostura ? 'Ej: 18' : 'Ej: 0'}
                  value={form.edad_semanas}
                  onChange={e => set('edad_semanas', e.target.value)}
                />
                <p className="text-xs text-gray-400">0 si llegan de un día de nacidas. Con ella se compara con la guía de la línea.</p>
              </div>
              <SelectorReferencia
                key={plantillaAplicada}
                fincaId={fincaId}
                lineaGenetica={form.linea_genetica}
                value={form.referencia_id}
                onChange={v => set('referencia_id', v)}
                seguirLinea={plantillaAplicada === 0}
              />
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

              {seVende && (
                <>
                  <div className="space-y-1">
                    <Label>Semana de vida en que salen</Label>
                    <Input
                      type="number" min="1" max="120" step="1"
                      placeholder={form.proposito === 'venta_levante' ? 'Ej: 16' : 'Ej: 30'}
                      value={form.semana_salida}
                      onChange={e => { setSalidaManual(false); set('semana_salida', e.target.value) }}
                    />
                    <p className="text-xs text-gray-400">
                      {fechaNacimiento ? 'Con la edad al llegar se calcula la fecha.' : 'Indica la edad al llegar para calcular la fecha.'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha aproximada de venta</Label>
                    <Input
                      type="date" value={fechaSalida}
                      onChange={e => { setSalidaManual(true); setForm(p => ({ ...p, fecha_salida_programada: e.target.value })) }}
                    />
                    <p className="text-xs text-gray-400">Se puede ajustar a mano.</p>
                  </div>
                </>
              )}

              {!enPostura ? (
                <>
                  <div className="space-y-1">
                    <Label>¿Cuándo se espera que pongan?</Label>
                    <Input
                      type="date" value={fechaInicioPostura}
                      onChange={e => { setPosturaManual(true); setForm(p => ({ ...p, fecha_inicio_postura: e.target.value })) }}
                    />
                    <p className="text-xs text-gray-400">
                      {semanaInicioPostura(referencia) != null && fechaNacimiento
                        ? `Según la guía, hacia la semana ${semanaInicioPostura(referencia)} de vida.`
                        : 'Estimado.'} La postura se configura al marcar su inicio.
                    </p>
                  </div>
                  {!seVende && (
                    <div className="space-y-1">
                      <Label>Salida programada</Label>
                      <Input type="date" value={form.fecha_salida_programada} onChange={e => set('fecha_salida_programada', e.target.value)} />
                      <p className="text-xs text-gray-400">Cuándo se piensa descartar (opcional).</p>
                    </div>
                  )}
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
                  {!seVende && (
                    <div className="space-y-1">
                      <Label>Salida programada del lote</Label>
                      <Input type="date" value={form.fecha_salida_programada} onChange={e => set('fecha_salida_programada', e.target.value)} />
                    </div>
                  )}
                </>
              )}

              <div className="col-span-2 space-y-1">
                <Label>Observaciones</Label>
                <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
              </div>

              <div className="col-span-2 space-y-2 border-t pt-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox" className="accent-green-700"
                    checked={form.guardar_plantilla}
                    onChange={e => setForm(p => ({ ...p, guardar_plantilla: e.target.checked }))}
                  />
                  Guardar esta configuración para los próximos lotes
                </label>
                {form.guardar_plantilla && (
                  <Input
                    placeholder="Nombre, ej: Lohmann de un día · ciclo completo"
                    value={form.nombre_plantilla}
                    onChange={e => setForm(p => ({ ...p, nombre_plantilla: e.target.value }))}
                  />
                )}
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
