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
import { hoyLocal } from '@/lib/fechas'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { LINEAS_PONEDORAS as LINEAS, edadASemanas, edadAlLlegar, fechaDeSemanaDeVida, nacimientoDesdeEdad, semanaInicioPostura, type UnidadEdad } from '@/lib/referencias'
import EdadAlLlegarInput from './EdadAlLlegarInput'
import LoNormalDeLaLinea from './referencias/LoNormalDeLaLinea'
import { useReferencia } from '@/lib/useReferencia'
import { useFinca } from '@/components/agro/FincaProvider'
import { leerConfigAves } from '@/lib/configAves'
import { resumenDeGuia } from '@/lib/lineas'
import { PROPOSITOS, type Proposito } from '@/lib/lotesAves'
import {
  LLEGADAS, EDAD_TIPICA, DESCRIPCION_PROPOSITO, metasDe, metasParaGuardarLote, recordatoriosDelLote, type Llegada,
} from '@/lib/registroAves'
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

const SIN_PLANTILLA = 'ninguna'
const OTRA = 'Otra'
// Semana de vida en que suelen empezar a poner, si no hay guía de la línea
const SEMANA_POSTURA_DEFECTO = 19

function fechaLarga(f: string) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function defaultForm(galponId: string) {
  return {
    instalacion_id: galponId,
    llegada: 'pollitas_dia' as Llegada,
    proposito: 'ciclo_completo' as Proposito,
    linea_genetica: '',
    linea_otra: '',
    referencia_id: '',
    fecha_inicio: hoyLocal(),
    // Edad: en días o semanas, o la fecha de nacimiento (la app calcula la otra)
    edad: EDAD_TIPICA.pollitas_dia.valor,
    edad_unidad: EDAD_TIPICA.pollitas_dia.unidad as UnidadEdad,
    fecha_nacimiento: '',
    aves_iniciales: '',
    aves_facturadas: '',
    aves_muertas_llegada: '',
    costo_total: '',
    // Fechas según el propósito, en semanas de vida (la fecha sale sola, o se escribe)
    semana_postura: '',
    semana_salida: '',
    fecha_salida: '',
    metas: {} as Record<string, string>,
    // Datos de origen
    origen_aves: '',
    peso_llegada_g: '',
    uniformidad_llegada_pct: '',
    vacunas_llegada: '',
    factura_remision: '',
    machos_pct: '',
    observaciones: '',
    // Vacío sanitario del galpón (registro; no bloquea)
    registrar_vacio: false,
    vacio: { fecha_inicio: '', fecha_fin: '', producto: '', dosis: '', aplicaciones: '', control_roedores: false, control_insectos: false, cambio_cama: false, responsable: '' },
    plantilla_id: SIN_PLANTILLA,
    guardar_plantilla: false,
    nombre_plantilla: '',
  }
}
type Form = ReturnType<typeof defaultForm>

/**
 * Registrar las aves que entran a un galpón, como lo pidió José (19 nov 2026):
 * primero cómo llegan y para qué entran, y de ahí solo lo que aplica. Bastan
 * siete datos (cómo llegan, para qué, galpón, línea, fecha de entrada, edad y
 * aves); lo demás se puede completar después. La postura no se configura aquí:
 * se configura al marcar su inicio. El lote deja programados sus recordatorios.
 */
export default function CrearLoteModal({ open, onClose, fincaId, galpones, ocupados, vacioSanitario = {}, galponInicialId, onCreated }: Props) {
  const supabase = createClient()
  const { fincaActual } = useFinca()
  const cfg = leerConfigAves(fincaActual?.config_aves)
  const [loading, setLoading] = useState(false)
  const libres = galpones.filter(g => !ocupados.has(g.id))
  const galponPorDefecto = () => galponInicialId ?? (libres.find(g => !vacioSanitario[g.id]) ?? libres[0])?.id ?? ''
  const [form, setForm] = useState<Form>(() => defaultForm(galponPorDefecto()))
  const [salidaManual, setSalidaManual] = useState(false)
  const [masDatos, setMasDatos] = useState(false)
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [plantillaAplicada, setPlantillaAplicada] = useState(0)

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(galponPorDefecto()))
    setSalidaManual(false)
    setMasDatos(false)
    setPlantillaAplicada(0)
    let vigente = true
    supabase.from('plantillas_lote_aves').select('*').eq('finca_id', fincaId).order('nombre')
      .then(({ data }) => { if (vigente) setPlantillas(data ?? []) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, galponInicialId, fincaId])

  const referencia = useReferencia(form.referencia_id)
  const guia = referencia ? resumenDeGuia(referencia) : null
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }))
  const setMeta = (k: string, v: string) => setForm(p => ({ ...p, metas: { ...p.metas, [k]: v } }))
  const setVacio = (k: keyof Form['vacio'], v: string | boolean) => setForm(p => ({ ...p, vacio: { ...p.vacio, [k]: v } }))

  // ── Edad: de la edad sale el nacimiento, o del nacimiento la edad ──
  const edadValida = form.edad.trim() !== '' && Number(form.edad) >= 0
  const fechaNacimiento = form.fecha_nacimiento
    || (edadValida ? nacimientoDesdeEdad(form.fecha_inicio, edadASemanas(Number(form.edad), form.edad_unidad)) : null)
  const enPostura = form.llegada === 'en_postura'

  // ── Fechas según el propósito (José, punto 4): cada uno ve solo las suyas ──
  const semanaPosturaGuia = semanaInicioPostura(referencia) ?? SEMANA_POSTURA_DEFECTO
  const pidePostura = !enPostura && form.proposito !== 'venta_levante'
  const semanaPostura = form.semana_postura.trim() !== '' ? Number(form.semana_postura) : semanaPosturaGuia
  const fechaPostura = pidePostura && fechaNacimiento
    ? (() => { const f = fechaDeSemanaDeVida(fechaNacimiento, semanaPostura); return f < form.fecha_inicio ? form.fecha_inicio : f })()
    : null
  const semanaSalidaDefecto = form.proposito === 'venta_levante' ? cfg.semanaVentaPollas : form.proposito === 'ciclo_completo' ? cfg.semanaFinProduccion : null
  const semanaSalida = form.semana_salida.trim() !== '' ? Number(form.semana_salida) : semanaSalidaDefecto
  const salidaCalculada = fechaNacimiento && semanaSalida ? fechaDeSemanaDeVida(fechaNacimiento, semanaSalida) : ''
  const fechaSalida = salidaManual ? form.fecha_salida : salidaCalculada
  // Semanas de producción entre el inicio de postura y la salida
  const inicioProduccion = enPostura ? form.fecha_inicio : fechaPostura
  const semanasProduccion = inicioProduccion && fechaSalida && form.proposito !== 'venta_levante'
    ? Math.round((new Date(fechaSalida + 'T00:00:00').getTime() - new Date(inicioProduccion + 'T00:00:00').getTime()) / (7 * 86400000))
    : null

  function elegirLlegada(l: Llegada) {
    setForm(p => ({
      ...p, llegada: l,
      edad: p.fecha_nacimiento ? p.edad : EDAD_TIPICA[l].valor,
      edad_unidad: p.fecha_nacimiento ? p.edad_unidad : EDAD_TIPICA[l].unidad,
      // Unas aves que ya ponen no se venden como pollas
      proposito: l === 'en_postura' && p.proposito === 'venta_levante' ? 'ciclo_completo' : p.proposito,
    }))
  }

  function elegirProposito(p: Proposito) {
    setSalidaManual(false)
    setForm(prev => ({ ...prev, proposito: p, semana_salida: '' }))
  }

  function cambiarNacimiento(f: string) {
    if (!f) { set('fecha_nacimiento', ''); return }
    const e = edadAlLlegar(f, form.fecha_inicio)
    setForm(p => ({ ...p, fecha_nacimiento: f, edad: e.valor, edad_unidad: e.unidad }))
  }

  function aplicarPlantilla(id: string) {
    const p = plantillas.find(x => x.id === id)
    if (!p) { set('plantilla_id', SIN_PLANTILLA); return }
    setSalidaManual(false)
    setPlantillaAplicada(n => n + 1)
    const edad = (() => {
      if (p.edad_llegada_semanas == null) return null
      const dias = Math.round(Number(p.edad_llegada_semanas) * 7)
      return dias % 7 === 0 ? { edad: String(dias / 7), edad_unidad: 'semanas' as UnidadEdad } : { edad: String(dias), edad_unidad: 'dias' as UnidadEdad }
    })()
    setForm(prev => ({
      ...prev,
      plantilla_id: id,
      linea_genetica: p.linea_genetica && LINEAS.includes(p.linea_genetica) ? p.linea_genetica : p.linea_genetica ? OTRA : '',
      linea_otra: p.linea_genetica && !LINEAS.includes(p.linea_genetica) ? p.linea_genetica : '',
      referencia_id: p.referencia_id ?? '',
      proposito: p.proposito,
      llegada: p.estado_llegada === 'activo' ? 'en_postura' : (p.edad_llegada_semanas ?? 0) >= 14 ? 'levantadas' : 'pollitas_dia',
      fecha_nacimiento: '',
      ...(edad ?? {}),
      semana_salida: p.semana_salida != null ? String(p.semana_salida) : '',
      metas: {
        ...prev.metas,
        ...(p.meta_postura_pct != null ? { pico: String(Number(p.meta_postura_pct)) } : {}),
        ...(p.semanas_ciclo_postura != null ? { semanasCiclo: String(p.semanas_ciclo_postura) } : {}),
      },
    }))
  }

  async function borrarPlantilla() {
    const p = plantillas.find(x => x.id === form.plantilla_id)
    if (!p || !window.confirm(`¿Borrar la configuración "${p.nombre}"? Los lotes que la usaron no cambian.`)) return
    const { error } = await supabase.from('plantillas_lote_aves').delete().eq('id', p.id)
    if (error) { toast.error('No se pudo borrar la configuración'); return }
    setPlantillas(prev => prev.filter(x => x.id !== p.id))
    set('plantilla_id', SIN_PLANTILLA)
    toast.success('Configuración borrada')
  }

  const galpon = galpones.find(g => g.id === form.instalacion_id) ?? null
  const vacioHasta = galpon ? vacioSanitario[galpon.id] : undefined
  const area = galpon?.area_m2 != null ? Number(galpon.area_m2) : null
  const aves = Number(form.aves_iniciales) || 0
  const densidad = area && area > 0 && aves ? aves / area : null
  const costo = Number(form.costo_total) || 0
  const linea = form.linea_genetica === OTRA ? form.linea_otra.trim() : form.linea_genetica
  const facturadas = Number(form.aves_facturadas) || 0
  // Lo que la guía de la línea dice de cada meta, para proponerlo
  const sugerida: Record<string, number | null | undefined> = {
    pico: guia?.pico?.pct, pesoHuevo: guia?.pesoHuevo,
    // El consumo de la guía es el de postura: no sirve de meta para pollas de levante
    consumo: form.proposito === 'venta_levante' ? undefined : guia?.consumoPostura,
    huevosAve: guia?.huevosAve?.[cfg.semanaFinProduccion] ?? guia?.huevosAve?.[80],
    semanasCiclo: semanasProduccion ?? undefined, semanaVenta: semanaSalida ?? undefined, avesVender: aves || undefined,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Lo mínimo indispensable (José): cómo llegan, para qué, galpón, línea, entrada, edad y aves
    if (!galpon) { toast.error('Elige el galpón al que entran las aves'); return }
    if (ocupados.has(galpon.id)) { toast.error(`${galpon.nombre} ya tiene aves: sácalas antes de registrar otras`); return }
    if (!linea) { toast.error('Elige la línea genética'); return }
    if (!fechaNacimiento) { toast.error('Escribe la edad con que llegan o su fecha de nacimiento'); return }
    if (fechaNacimiento > form.fecha_inicio) { toast.error('La fecha de nacimiento no puede ser después de la entrada'); return }
    if (edadASemanas(Number(form.edad) || 0, form.edad_unidad) > 120) { toast.error('La edad al llegar no puede pasar de 120 semanas'); return }
    if (!(aves > 0)) { toast.error('Escribe cuántas aves entraron'); return }
    if (form.semana_postura.trim() !== '' && !(semanaPostura >= 1 && semanaPostura <= 120)) { toast.error('La semana en que empiezan a poner va de 1 a 120'); return }
    if (fechaSalida && fechaSalida <= form.fecha_inicio) { toast.error('La salida debe ser después de la entrada'); return }
    const nombrePlantilla = form.nombre_plantilla.trim()
    if (form.guardar_plantilla && !nombrePlantilla) { toast.error('Ponle un nombre a la configuración que vas a guardar'); return }

    setLoading(true)
    const metasLote = metasParaGuardarLote(form.metas, form.proposito)
    const n = (v: string) => (v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
    const { data, error } = await supabase.from('lotes_aves').insert({
      finca_id: fincaId,
      instalacion_id: galpon.id,
      nombre: galpon.nombre,
      area_galpon_m2: area,
      llegada: form.llegada,
      proposito: form.proposito,
      linea_genetica: linea,
      referencia_id: form.referencia_id || null,
      fecha_inicio: form.fecha_inicio,
      fecha_nacimiento: fechaNacimiento,
      aves_iniciales: aves,
      aves_actuales: aves,
      aves_facturadas: n(form.aves_facturadas),
      aves_muertas_llegada: n(form.aves_muertas_llegada),
      estado: enPostura ? 'activo' : 'preparacion',
      // Si llegan poniendo, la postura empezó con su llegada; en levante y venta no hay postura.
      // En los demás es la fecha esperada: la postura se configura al marcar su inicio.
      fecha_inicio_postura: enPostura ? form.fecha_inicio : pidePostura ? fechaPostura : null,
      fecha_salida_programada: fechaSalida || null,
      // Las que llegan poniendo toman el pico y el ciclo de sus metas
      meta_postura_pct: enPostura ? (metasLote?.pico ?? null) : null,
      semanas_ciclo_postura: enPostura ? (metasLote?.semanasCiclo ?? semanasProduccion ?? null) : null,
      metas_lote: metasLote,
      origen_aves: form.origen_aves.trim() || null,
      peso_llegada_g: n(form.peso_llegada_g),
      uniformidad_llegada_pct: n(form.uniformidad_llegada_pct),
      vacunas_llegada: form.vacunas_llegada.trim() || null,
      factura_remision: form.factura_remision.trim() || null,
      machos_pct: n(form.machos_pct),
      observaciones: form.observaciones.trim() || null,
    }).select().single()

    if (!error && data) {
      const extras: PromiseLike<unknown>[] = []
      // El costo es del lote completo (José): queda en Finanzas
      if (costo > 0) extras.push(supabase.from('costos_lote_aves').insert({
        lote_id: data.id, finca_id: fincaId, fecha: form.fecha_inicio, categoria: 'pollitas',
        descripcion: `Compra de ${aves.toLocaleString('es-CO')} aves - ${data.nombre}`, monto: costo,
      }))
      if (form.registrar_vacio && form.vacio.fecha_inicio) extras.push(supabase.from('vacios_sanitarios').insert({
        finca_id: fincaId, instalacion_id: galpon.id, fecha_inicio: form.vacio.fecha_inicio, fecha_fin: form.vacio.fecha_fin || null,
        producto: form.vacio.producto.trim() || null, dosis: form.vacio.dosis.trim() || null,
        aplicaciones: n(form.vacio.aplicaciones), control_roedores: form.vacio.control_roedores,
        control_insectos: form.vacio.control_insectos, cambio_cama: form.vacio.cambio_cama, responsable: form.vacio.responsable.trim() || null,
      }))
      // Los recordatorios del lote quedan como tareas (luego llegan por WhatsApp)
      const tareas = recordatoriosDelLote({
        galpon: galpon.nombre, proposito: form.proposito, llegada: form.llegada,
        fechaPostura: pidePostura ? fechaPostura : null, fechaSalida: fechaSalida || null, cfg, hoy: hoyLocal(),
      })
      if (tareas.length) extras.push(supabase.from('tareas_operarios').insert(tareas.map(t => ({ ...t, finca_id: fincaId, instalacion_id: galpon.id }))))
      if (form.guardar_plantilla) extras.push(supabase.from('plantillas_lote_aves').insert({
        finca_id: fincaId, nombre: nombrePlantilla, linea_genetica: linea, referencia_id: form.referencia_id || null,
        proposito: form.proposito, estado_llegada: enPostura ? 'activo' : 'preparacion',
        edad_llegada_semanas: edadASemanas(Number(form.edad) || 0, form.edad_unidad),
        semana_salida: form.semana_salida.trim() !== '' ? Number(form.semana_salida) : null,
        semanas_ciclo_postura: metasLote?.semanasCiclo ?? null, meta_postura_pct: metasLote?.pico ?? null,
      }).then(({ error: errP }) => {
        if (errP) toast.error(errP.code === '23505' ? `Ya hay una configuración llamada "${nombrePlantilla}": no se guardó` : 'No se pudo guardar la configuración')
      }))
      await Promise.all(extras)
    }

    setLoading(false)
    if (error) { toast.error(error.code === '23505' ? `${galpon.nombre} ya tiene aves` : 'Error al registrar las aves'); return }
    toast.success(`${aves.toLocaleString('es-CO')} aves registradas en ${data.nombre}`)
    onCreated(data)
    onClose()
  }

  const boton = (activo: boolean) => cn('rounded-lg border p-2.5 text-left transition-colors disabled:opacity-40', activo ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300')

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="ave" /> Registrar aves en un galpón</DialogTitle>
          <p className="text-sm text-gray-500">Con los datos marcados con * basta. Lo demás se puede completar después.</p>
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
                    <Select value={form.plantilla_id} onValueChange={v => aplicarPlantilla(v ?? SIN_PLANTILLA)}
                      items={{ [SIN_PLANTILLA]: 'Llenar a mano', ...Object.fromEntries(plantillas.map(p => [p.id, p.nombre])) }}>
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
                  <p className="text-xs text-gray-500">Después de cargarla puedes cambiar cualquier dato.</p>
                </div>
              )}

              {/* 1 · Cómo llegan */}
              <div className="col-span-2 space-y-1">
                <Label>¿Cómo llegan las aves? *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {LLEGADAS.map(o => (
                    <button key={o.v} type="button" onClick={() => elegirLlegada(o.v)} aria-pressed={form.llegada === o.v} className={boton(form.llegada === o.v)}>
                      <p className="text-sm font-semibold text-gray-800">{o.t}</p>
                      <p className="text-[0.6875rem] leading-snug text-gray-500">{o.d}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2 · Para qué entran */}
              <div className="col-span-2 space-y-1">
                <Label>¿Para qué entran? *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PROPOSITOS.map(o => (
                    <button key={o.v} type="button" disabled={o.v === 'venta_levante' && enPostura} onClick={() => elegirProposito(o.v)}
                      aria-pressed={form.proposito === o.v} className={boton(form.proposito === o.v)}>
                      <p className="text-sm font-semibold text-gray-800">{o.t}</p>
                      <p className="text-[0.6875rem] leading-snug text-gray-500">{DESCRIPCION_PROPOSITO[o.v]}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Se puede cambiar en cualquier momento desde el galpón.</p>
              </div>

              {/* 3 · Galpón y su vacío sanitario */}
              <div className="col-span-2 space-y-1">
                <Label>Galpón *</Label>
                <Select value={form.instalacion_id} onValueChange={v => set('instalacion_id', v ?? '')} items={Object.fromEntries(galpones.map(g => [g.id, g.nombre]))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar galpón..." /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {galpones.map(g => (
                      <SelectItem key={g.id} value={g.id} disabled={ocupados.has(g.id)}>
                        {g.nombre}{g.area_m2 != null ? ` · ${Number(g.area_m2).toLocaleString('es-CO')} m²` : ''}
                        {ocupados.has(g.id) ? ' · con aves' : vacioSanitario[g.id] ? ` · vacío sanitario hasta ${fechaLarga(vacioSanitario[g.id])}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {vacioHasta && <p className="text-xs text-amber-700">{galpon?.nombre} está en vacío sanitario hasta el {fechaLarga(vacioHasta)}. No impide registrar las aves.</p>}
                <label className="flex items-center gap-2 pt-1 text-sm text-gray-700">
                  <input type="checkbox" className="accent-green-700" checked={form.registrar_vacio} onChange={e => set('registrar_vacio', e.target.checked)} />
                  Anotar el vacío sanitario que se le hizo al galpón
                </label>
                {form.registrar_vacio && (
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2.5">
                    <label className="text-xs text-gray-600">Desde<Input type="date" className="mt-0.5 h-8 bg-white" value={form.vacio.fecha_inicio} onChange={e => setVacio('fecha_inicio', e.target.value)} /></label>
                    <label className="text-xs text-gray-600">Hasta<Input type="date" className="mt-0.5 h-8 bg-white" value={form.vacio.fecha_fin} onChange={e => setVacio('fecha_fin', e.target.value)} /></label>
                    <label className="text-xs text-gray-600">Producto<Input className="mt-0.5 h-8 bg-white" value={form.vacio.producto} onChange={e => setVacio('producto', e.target.value)} /></label>
                    <label className="text-xs text-gray-600">Dosis<Input className="mt-0.5 h-8 bg-white" value={form.vacio.dosis} onChange={e => setVacio('dosis', e.target.value)} /></label>
                    <label className="text-xs text-gray-600">Aplicaciones<Input type="number" min="0" className="mt-0.5 h-8 bg-white" value={form.vacio.aplicaciones} onChange={e => setVacio('aplicaciones', e.target.value)} /></label>
                    <label className="text-xs text-gray-600">Quién lo hizo<Input className="mt-0.5 h-8 bg-white" value={form.vacio.responsable} onChange={e => setVacio('responsable', e.target.value)} /></label>
                    <div className="col-span-2 flex flex-wrap gap-3 text-xs text-gray-700">
                      {([['control_roedores', 'Control de roedores'], ['control_insectos', 'Control de insectos'], ['cambio_cama', 'Cambio de cama']] as const).map(([k, t]) => (
                        <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={form.vacio[k]} onChange={e => setVacio(k, e.target.checked)} /> {t}</label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4 · Línea genética y su guía */}
              <div className="space-y-1">
                <Label>Línea genética *</Label>
                <Select value={form.linea_genetica} onValueChange={v => set('linea_genetica', v ?? '')} items={Object.fromEntries(LINEAS.map(l => [l, l === OTRA ? 'Otra (escribirla)' : l]))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{LINEAS.map(l => <SelectItem key={l} value={l}>{l === OTRA ? 'Otra (escribirla)' : l}</SelectItem>)}</SelectContent>
                </Select>
                {form.linea_genetica === OTRA && <Input className="mt-1" placeholder="Nombre de la línea" value={form.linea_otra} onChange={e => set('linea_otra', e.target.value)} />}
              </div>
              <SelectorReferencia key={plantillaAplicada} fincaId={fincaId} lineaGenetica={linea} value={form.referencia_id}
                onChange={v => set('referencia_id', v)} seguirLinea={plantillaAplicada === 0}
                etiqueta="Guía para comparar" ayuda="La guía de la línea o la tabla propia de la finca: así se compara lo esperado con lo real." />
              <div className="col-span-2">
                <LoNormalDeLaLinea referenciaId={form.referencia_id || null} aves={aves || null} />
              </div>

              {/* 5 · Entrada y edad */}
              <div className="space-y-1">
                <Label>Fecha de entrada *</Label>
                <Input type="date" value={form.fecha_inicio} max={hoyLocal()} onChange={e => set('fecha_inicio', e.target.value)} />
                <p className="text-xs text-gray-400">Desde aquí la app suma la edad cada día.</p>
              </div>
              <EdadAlLlegarInput valor={form.edad} unidad={form.edad_unidad}
                onChange={(valor, unidad) => setForm(p => ({ ...p, edad: valor, edad_unidad: unidad, fecha_nacimiento: '' }))}
                placeholder={form.edad_unidad === 'dias' ? 'Ej: 1' : 'Ej: 17'}
                ayuda={fechaNacimiento ? `Nacieron hacia el ${fechaLarga(fechaNacimiento)}.` : 'Edad al llegar (obligatoria).'} />
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-gray-600">…o la fecha de nacimiento, si el proveedor la dio</Label>
                <Input type="date" className="w-48" value={form.fecha_nacimiento} max={form.fecha_inicio} onChange={e => cambiarNacimiento(e.target.value)} />
              </div>

              {/* 6 · Aves y costo */}
              <div className="space-y-1">
                <Label>Aves que entraron (contadas) *</Label>
                <Input type="number" min="1" placeholder="Ej: 5000" value={form.aves_iniciales} onChange={e => set('aves_iniciales', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Aves facturadas</Label>
                <Input type="number" min="0" placeholder="Las de la factura" value={form.aves_facturadas} onChange={e => set('aves_facturadas', e.target.value)} />
                {facturadas > 0 && aves > 0 && facturadas !== aves && (
                  <p className="text-xs text-amber-700">{Math.abs(facturadas - aves).toLocaleString('es-CO')} {facturadas > aves ? 'menos de las facturadas' : 'más de las facturadas'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Muertas o débiles en el transporte</Label>
                <Input type="number" min="0" value={form.aves_muertas_llegada} onChange={e => set('aves_muertas_llegada', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Costo del lote</Label>
                <CurrencyInput placeholder="Total pagado" value={form.costo_total} onValueChange={v => set('costo_total', v ?? '')} />
                <p className="text-xs text-gray-400">{costo > 0 && aves > 0 ? `Sale a ${Math.round(costo / aves).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} por ave · ` : ''}Queda en Finanzas</p>
              </div>
              <div className={cn('col-span-2 rounded-lg px-3 py-2 text-xs', densidad && densidad > cfg.densidadMaxAvesM2 ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-600')}>
                {area != null
                  ? <>Galpón de {area.toLocaleString('es-CO')} m²{densidad ? <> · <strong>{densidad.toLocaleString('es-CO', { maximumFractionDigits: 1 })} aves/m²</strong>{densidad > cfg.densidadMaxAvesM2 ? ` · pasa de lo recomendado (${cfg.densidadMaxAvesM2} aves/m²)` : ''}</> : ''}</>
                  : 'Este galpón no tiene medida registrada: agrégala en Datos de la finca.'}
              </div>

              {/* 7 · Las fechas de su propósito (José, punto 4) */}
              <div className="col-span-2 border-t pt-3">
                <p className="text-sm font-medium text-gray-700"><Ic n="calendario" /> Fechas del lote</p>
                <p className="text-xs text-gray-400">
                  {form.proposito === 'venta_levante' ? 'Solo la venta de las pollas: nada de postura.'
                    : enPostura ? 'Llegan poniendo: falta solo cuándo termina la producción o se venden.'
                    : 'Cuándo empieza la producción y cuándo termina. La postura se configura al marcar su inicio.'}
                </p>
              </div>
              {pidePostura && (
                <div className="space-y-1">
                  <Label>¿En qué semana de vida empiezan a poner?</Label>
                  <Input type="number" min="1" max="120" placeholder={String(semanaPosturaGuia)} value={form.semana_postura} onChange={e => set('semana_postura', e.target.value)} />
                  <p className="text-xs text-gray-400">
                    {fechaPostura ? `Hacia el ${fechaLarga(fechaPostura)}. ` : ''}{semanaInicioPostura(referencia) != null && !form.semana_postura ? 'La propone la guía. ' : ''}
                    Se avisa {cfg.avisoPosturaSemanas} {cfg.avisoPosturaSemanas === 1 ? 'semana' : 'semanas'} antes para preparar el galpón.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label>{form.proposito === 'ciclo_completo' ? 'Semana en que termina la producción' : 'Semana de vida en que se venden'}</Label>
                <Input type="number" min="1" max="130" placeholder={semanaSalidaDefecto ? String(semanaSalidaDefecto) : 'Ej: 40'} value={form.semana_salida}
                  onChange={e => { setSalidaManual(false); set('semana_salida', e.target.value) }} />
              </div>
              <div className="space-y-1">
                <Label>{form.proposito === 'ciclo_completo' ? 'Fecha de salida' : 'Fecha aproximada de venta'}</Label>
                <Input type="date" value={fechaSalida} onChange={e => { setSalidaManual(true); set('fecha_salida', e.target.value) }} />
                <p className="text-xs text-gray-400">
                  {semanasProduccion != null && semanasProduccion > 0 ? `${semanasProduccion} semanas de producción. ` : ''}Se puede cambiar después desde el galpón.
                </p>
              </div>

              {/* 8 · Metas de su propósito (José, punto 5) */}
              <div className="col-span-2 border-t pt-3">
                <p className="text-sm font-medium text-gray-700"><Ic n="meta" /> Metas de este lote</p>
                <p className="text-xs text-gray-400">Para comparar lo esperado con lo real desde el principio. Lo gris lo propone la guía; se pueden cambiar después.</p>
              </div>
              {metasDe(form.proposito).map(m => (
                <label key={m.k} className="space-y-0.5 text-xs text-gray-600">
                  {m.t} <span className="text-gray-400">({m.u})</span>
                  <Input type="number" step="any" className="h-8"
                    placeholder={sugerida[m.k] != null ? String(Math.round(Number(sugerida[m.k]) * 10) / 10) : ''}
                    value={form.metas[m.k] ?? ''} onChange={e => setMeta(m.k, e.target.value)} />
                </label>
              ))}

              {/* 9 · Datos de origen (opcionales) */}
              <div className="col-span-2 border-t pt-3">
                <button type="button" onClick={() => setMasDatos(v => !v)} className="text-sm font-medium text-green-800 hover:underline">
                  {masDatos ? '▾' : '▸'} Datos de origen del lote (opcional)
                </button>
              </div>
              {masDatos && (
                <>
                  <div className="space-y-1"><Label>Proveedor o incubadora</Label><Input value={form.origen_aves} onChange={e => set('origen_aves', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Factura o remisión</Label><Input value={form.factura_remision} onChange={e => set('factura_remision', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Peso promedio al llegar (g)</Label><Input type="number" min="0" value={form.peso_llegada_g} onChange={e => set('peso_llegada_g', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Uniformidad al llegar (%)</Label><Input type="number" min="0" max="100" value={form.uniformidad_llegada_pct} onChange={e => set('uniformidad_llegada_pct', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Vacunas que traen</Label><Input placeholder="Ej: Marek, Newcastle" value={form.vacunas_llegada} onChange={e => set('vacunas_llegada', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Machos en el lote (%)</Label><Input type="number" min="0" max="100" step="0.1" placeholder="Error de sexaje" value={form.machos_pct} onChange={e => set('machos_pct', e.target.value)} /></div>
                </>
              )}

              <div className="col-span-2 space-y-1">
                <Label>Observaciones</Label>
                <Input placeholder="Notas adicionales..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
              </div>

              <div className="col-span-2 space-y-2 border-t pt-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="accent-green-700" checked={form.guardar_plantilla} onChange={e => set('guardar_plantilla', e.target.checked)} />
                  Guardar esta configuración para los próximos lotes
                </label>
                {form.guardar_plantilla && (
                  <Input placeholder="Nombre, ej: Lohmann de un día · ciclo completo" value={form.nombre_plantilla} onChange={e => set('nombre_plantilla', e.target.value)} />
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
