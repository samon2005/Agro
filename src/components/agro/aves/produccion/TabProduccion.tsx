'use client'

import { Indicador, GrupoIndicadores } from '@/components/ui/indicador'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import RegistrarProduccionModal from './RegistrarProduccionModal'
import ConfigurarGalponModal from './ConfigurarGalponModal'
import HorariosRecoleccion from './HorariosRecoleccion'
import RevisionCalidadHuevo from './RevisionCalidadHuevo'
import GraficaCurvaPostura from './GraficaCurvaPostura'
import ConfigurarRecoleccionModal from './ConfigurarRecoleccionModal'
import { toast } from 'sonner'
import Link from 'next/link'
import { estadoPostura } from '@/lib/postura'
import type { Database } from '@/types/database'
import { aFechaLocal } from '@/lib/fechas'
import { ajustarHuevos } from '@/lib/inventario'
import { Ic } from '@/components/ui/icon'
import { useFinca } from '@/components/agro/FincaProvider'
import { preciosDeFinca, hayPrecios } from '@/lib/huevos'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']
type TipoAlimento = Database['public']['Tables']['tipos_alimento_aves']['Row']
type EventoClinico = Database['public']['Tables']['eventos_clinicos_aves']['Row']

interface Props {
  loteActual: LoteAves
  onLoteUpdated: (lote?: LoteAves) => void
  onLoteDeleted: () => void
}

const MS_DIA = 24 * 60 * 60 * 1000

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

const CAUSAS_LABEL: Record<string, string> = {
  'Marek': 'Marek', 'Newcastle': 'Newcastle', 'Bronquitis': 'Bronquitis',
  'Gumboro': 'Gumboro', 'Laringotraqueitis': 'Laringotraqueítis',
  'Coccidiosis': 'Coccidiosis', 'Micoplasmosis': 'Micoplasmosis',
  'Accidente': 'Accidente', 'Estrés calórico': 'Estrés calórico', 'Otra': 'Otra'
}

const TIPO_EVENTO_LABEL: Record<string, string> = {
  respiratorio: 'Respiratorio', locomotor: 'Locomotor', digestivo: 'Digestivo',
  reproductivo: 'Reproductivo', nervioso: 'Nervioso', piel: 'Piel / Plumas',
  otro: 'Otro',
}

export default function TabProduccion({ loteActual, onLoteUpdated, onLoteDeleted }: Props) {
  const { fincaActual } = useFinca()
  const supabase = createClient()
  const [registros, setRegistros] = useState<ProduccionDiaria[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [registroEditar, setRegistroEditar] = useState<ProduccionDiaria | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [tipoAlimentoActivo, setTipoAlimentoActivo] = useState<TipoAlimento | null>(null)
  const [eventosClinicos, setEventosClinicos] = useState<EventoClinico[]>([])
  const [hayAlimentoRegistrado, setHayAlimentoRegistrado] = useState(true)
  const [guardandoSinNovedades, setGuardandoSinNovedades] = useState(false)
  const [modalRecoleccionObligatoria, setModalRecoleccionObligatoria] = useState(false)
  // Huevos de toda la vida del lote, para el HAA (huevos por ave alojada)
  const [huevosAcumulados, setHuevosAcumulados] = useState(0)

  const fetchRegistros = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('produccion_diaria_aves')
      .select('*')
      .eq('lote_id', loteActual.id)
      .order('fecha', { ascending: false })
      .limit(60)
    setRegistros(data ?? [])
    const { data: todos } = await supabase
      .from('produccion_diaria_aves').select('huevos_totales').eq('lote_id', loteActual.id)
    setHuevosAcumulados((todos ?? []).reduce((s, r) => s + (r.huevos_totales ?? 0), 0))
    setLoading(false)
  }, [loteActual.id, supabase])

  const fetchEventosClinicos = useCallback(async () => {
    const { data } = await supabase
      .from('eventos_clinicos_aves')
      .select('*')
      .eq('lote_id', loteActual.id)
      .order('fecha', { ascending: false })
      .limit(60)
    setEventosClinicos(data ?? [])
  }, [loteActual.id, supabase])

  useEffect(() => {
    if (!loteActual.alimento_activo_id) { setTipoAlimentoActivo(null); return }
    supabase.from('tipos_alimento_aves').select('*').eq('id', loteActual.alimento_activo_id).maybeSingle()
      .then(({ data }) => setTipoAlimentoActivo(data ?? null))
  }, [loteActual.alimento_activo_id, supabase])

  // El aviso es por galpón: mira si ESTE lote ya tiene alimento asignado, no si la
  // finca tiene catálogo. Así también sale en los galpones creados después del primero.
  useEffect(() => {
    setHayAlimentoRegistrado(loteActual.alimento_activo_id != null && loteActual.consumo_activo_kg != null)
  }, [loteActual.alimento_activo_id, loteActual.consumo_activo_kg])

  useEffect(() => { fetchRegistros() }, [fetchRegistros])
  useEffect(() => { fetchEventosClinicos() }, [fetchEventosClinicos])

  async function eliminarRegistro(r: ProduccionDiaria) {
    if (confirmandoEliminar !== r.id) { setConfirmandoEliminar(r.id); return }
    setConfirmandoEliminar(null)

    // Los eventos clínicos que se registraron con este día se van con él (la base
    // los borra en cascada), así que primero se mira cuántas aves aportaban.
    const { data: eventosDelDia } = await supabase
      .from('eventos_clinicos_aves')
      .select('aves_muertas')
      .eq('produccion_id', r.id)
    const muertasEventos = (eventosDelDia ?? []).reduce((s, ev) => s + (ev.aves_muertas ?? 0), 0)

    const { error } = await supabase.from('produccion_diaria_aves').delete().eq('id', r.id)
    if (error) { toast.error('Error al eliminar el registro'); return }

    const devolver = r.muertes + muertasEventos
    if (devolver > 0) {
      await supabase.from('lotes_aves').update({ aves_actuales: loteActual.aves_actuales + devolver }).eq('id', loteActual.id)
    }
    // Los huevos de ese día también salen del inventario de la finca
    if (r.huevos_totales > 0) {
      await ajustarHuevos(supabase, loteActual.finca_id, loteActual.nombre, -r.huevos_totales)
    }
    // Si ese día se había registrado un consumo, el vigente vuelve a ser el anterior
    if (Number(r.alimento_kg) > 0) {
      const { data: anterior } = await supabase
        .from('produccion_diaria_aves')
        .select('tipo_alimento_id, alimento_kg')
        .eq('lote_id', loteActual.id)
        .gt('alimento_kg', 0)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()
      await supabase.from('lotes_aves').update({
        alimento_activo_id: anterior?.tipo_alimento_id ?? loteActual.alimento_activo_id,
        consumo_activo_kg: anterior ? Number(anterior.alimento_kg) : null,
      }).eq('id', loteActual.id)
    }

    toast.success(muertasEventos > 0 || eventosDelDia?.length
      ? 'Día eliminado junto con su evento clínico'
      : 'Registro eliminado')
    fetchRegistros()
    fetchEventosClinicos()
    onLoteUpdated()
  }

  const ultimos30 = registros.slice(0, 30)
  const hoyDate = new Date()
  const hoyStr = aFechaLocal(hoyDate)
  // Solo cuenta como "hoy" el registro que sea realmente de la fecha de hoy:
  // al pasar la medianoche el contador arranca de nuevo en 0.
  const hoy = registros.find(r => r.fecha === hoyStr)

  const posturaHoy = hoy && hoy.aves_en_dia && hoy.aves_en_dia > 0
    ? ((hoy.huevos_totales / hoy.aves_en_dia) * 100).toFixed(1)
    : null

  const totalHuevos30 = ultimos30.reduce((s, r) => s + r.huevos_totales, 0)
  const totalAlimento30 = ultimos30.reduce((s, r) => s + Number(r.alimento_kg), 0)
  // HAA (huevos por ave alojada): todos los huevos del lote ÷ las aves que entraron al galpón
  const haa = loteActual.aves_iniciales > 0 && huevosAcumulados > 0
    ? (huevosAcumulados / loteActual.aves_iniciales).toFixed(1)
    : null
  void totalAlimento30

  // La mortalidad acumulada cuenta las muertes del día y las de los eventos clínicos:
  // ambas descuentan aves del galpón, así que ambas suman aquí.
  const mortAcum = registros.reduce((s, r) => s + r.muertes, 0)
    + eventosClinicos.filter(ev => ev.origen !== 'mortalidad').reduce((s, ev) => s + (ev.aves_muertas ?? 0), 0)
  const mortPct = loteActual.aves_iniciales > 0
    ? ((mortAcum / loteActual.aves_iniciales) * 100).toFixed(1)
    : '0.0'

  // ── Ciclo de postura ──
  const metaPostura = loteActual.meta_postura_pct ?? 90
  const estadoPosturaHoy = estadoPostura(loteActual.fecha_inicio_postura, hoyStr)
  const semanaPostura = estadoPosturaHoy.iniciada ? estadoPosturaHoy.semana : null
  const inicioSemanaActual = estadoPosturaHoy.iniciada ? estadoPosturaHoy.inicioSemana : null
  const finSemanaActual = estadoPosturaHoy.iniciada ? estadoPosturaHoy.finSemana : null
  const semanasFaltantesPostura = !estadoPosturaHoy.iniciada ? estadoPosturaHoy.semanasFaltantes : null
  /** Mientras el galpón esté en preparación no se muestra nada de huevos. */
  const enPostura = loteActual.estado !== 'preparacion'

  // Si la fecha tentativa de postura ya pasó y el galpón sigue en preparación, está
  // atrasado: no es "semana de postura", porque la postura todavía no ha empezado.
  const diasAtraso = !enPostura && loteActual.fecha_inicio_postura && loteActual.fecha_inicio_postura < hoyStr
    ? Math.floor((hoyDate.getTime() - new Date(loteActual.fecha_inicio_postura + 'T00:00:00').getTime()) / MS_DIA)
    : 0
  const textoAtraso = diasAtraso >= 7
    ? `${Math.floor(diasAtraso / 7)} semana${Math.floor(diasAtraso / 7) === 1 ? '' : 's'}`
    : `${diasAtraso} día${diasAtraso === 1 ? '' : 's'}`

  // Un galpón nuevo no puede registrar días hasta tener alimento y consumo definidos.
  const tieneAlimento = loteActual.alimento_activo_id != null
  const tieneConsumo = loteActual.consumo_activo_kg != null
  const listoParaRegistrar = tieneAlimento && tieneConsumo
  const faltaParaRegistrar = !tieneAlimento
    ? 'Primero registra un tipo de alimento y el consumo del galpón en la sección Alimento.'
    : !tieneConsumo
      ? 'Falta registrar el consumo diario del galpón en la sección Alimento.'
      : ''
  let fechaFinEstimada: Date | null = null
  if (loteActual.fecha_inicio_postura && loteActual.semanas_ciclo_postura) {
    const inicio = new Date(loteActual.fecha_inicio_postura + 'T00:00:00')
    fechaFinEstimada = new Date(inicio.getTime() + loteActual.semanas_ciclo_postura * 7 * MS_DIA)
  }

  // ── Precio por tamaño de huevo: rige el de la finca; si aún no hay, el viejo del galpón ──
  const deFinca = preciosDeFinca(fincaActual)
  const precios = hayPrecios(deFinca)
    ? deFinca
    : { b: loteActual.precio_huevo_b, a: loteActual.precio_huevo_a, aa: loteActual.precio_huevo_aa, aaa: loteActual.precio_huevo_aaa, jumbo: loteActual.precio_huevo_jumbo }
  const preciosTamano = [precios.b, precios.a, precios.aa, precios.aaa, precios.jumbo].filter((p): p is number => p != null && p > 0)
  const precioPromedio = preciosTamano.length > 0
    ? preciosTamano.reduce((s, p) => s + p, 0) / preciosTamano.length
    : (loteActual.precio_huevo ?? 0)

  function valorHuevosDia(r: ProduccionDiaria | undefined) {
    if (!r) return 0
    return r.huevos_b * (precios.b ?? 0)
      + r.huevos_a * (precios.a ?? 0)
      + r.huevos_aa * (precios.aa ?? 0)
      + r.huevos_aaa * (precios.aaa ?? 0)
      + r.huevos_jumbo * (precios.jumbo ?? 0)
  }
  const ingresoHoy = valorHuevosDia(hoy)

  // ── Huevos perdidos por postura bajo la meta (últimos 30 días) ──
  let huevosPerdidos30 = 0
  for (const r of ultimos30) {
    if (!r.aves_en_dia) continue
    const esperados = r.aves_en_dia * (metaPostura / 100)
    huevosPerdidos30 += Math.max(0, esperados - r.huevos_totales)
  }
  const valorPerdido30 = huevosPerdidos30 * precioPromedio
  const perdidaHoy = hoy && hoy.aves_en_dia
    ? Math.max(0, hoy.aves_en_dia * (metaPostura / 100) - hoy.huevos_totales)
    : 0
  const valorPerdidoHoy = perdidaHoy * precioPromedio
  const excedenteHoy = hoy && hoy.aves_en_dia
    ? Math.max(0, hoy.huevos_totales - hoy.aves_en_dia * (metaPostura / 100))
    : 0
  const diffPuntosHoy = posturaHoy ? Number(posturaHoy) - metaPostura : null

  // ── Alimento: costo y bultos del consumo activo (persiste hasta que se cambie) ──
  const precioGramo = loteActual.precio_gramo_alimento ?? 0
  const pesoBulto = tipoAlimentoActivo?.peso_bulto_kg ?? loteActual.peso_bulto_alimento_kg ?? 40
  const consumoActivoKg = loteActual.consumo_activo_kg != null ? Number(loteActual.consumo_activo_kg) : 0
  const bultosHoy = consumoActivoKg > 0 ? consumoActivoKg / pesoBulto : 0
  const costoAlimentoHoy = tipoAlimentoActivo?.precio_bulto
    ? bultosHoy * tipoAlimentoActivo.precio_bulto
    : consumoActivoKg * 1000 * precioGramo
  const kgTotalHoy = consumoActivoKg > 0 ? consumoActivoKg : null
  const gramosGallinaHoy = consumoActivoKg > 0 && loteActual.aves_actuales > 0
    ? (consumoActivoKg * 1000) / loteActual.aves_actuales
    : null

  // ── Densidad ──
  const densidad = loteActual.area_galpon_m2 && loteActual.area_galpon_m2 > 0
    ? (loteActual.aves_actuales / loteActual.area_galpon_m2).toFixed(1)
    : null

  // ── Meta de huevos diaria ──
  const metaHuevosDiaria = loteActual.meta_huevos_diaria ?? null
  const cumplimientoMeta = hoy && metaHuevosDiaria
    ? ((hoy.huevos_totales / metaHuevosDiaria) * 100).toFixed(0)
    : null

  // ── Estado del lote: preparación (levante) vs activo (en postura) ──
  const semanasEnGalpon = Math.max(0, Math.floor(
    (hoyDate.getTime() - new Date(loteActual.fecha_inicio + 'T00:00:00').getTime()) / (7 * MS_DIA)
  ))

  /** Registra el día con el consumo vigente y su costo, sin pedir nada más. */
  async function registrarDiaSinNovedades() {
    if (!listoParaRegistrar) { toast.error(faltaParaRegistrar); return }
    setGuardandoSinNovedades(true)
    const consumo = Number(loteActual.consumo_activo_kg ?? 0)
    const { data: existente } = await supabase
      .from('produccion_diaria_aves')
      .select('id')
      .eq('lote_id', loteActual.id)
      .eq('fecha', hoyStr)
      .maybeSingle()

    const payload = {
      alimento_kg: consumo,
      tipo_alimento_id: loteActual.alimento_activo_id,
      muertes: 0,
    }
    const { error } = existente
      ? await supabase.from('produccion_diaria_aves').update(payload).eq('id', existente.id)
      : await supabase.from('produccion_diaria_aves').insert({
          ...payload, lote_id: loteActual.id, finca_id: loteActual.finca_id, fecha: hoyStr,
        })

    setGuardandoSinNovedades(false)
    if (error) { toast.error('Error al registrar el día'); return }
    toast.success(`Día sin novedades: ${consumo} kg de alimento${costoAlimentoHoy > 0 ? ` · ${cop(costoAlimentoHoy)}` : ''}`)
    fetchRegistros()
    onLoteUpdated()
  }

  /**
   * Arranque de postura: activa el lote, deja puestos los requerimientos de
   * producción y encadena los horarios de recolección con el registro del día.
   */
  async function marcarInicioPostura() {
    if (!listoParaRegistrar) { toast.error(faltaParaRegistrar); return }
    const { data, error } = await supabase
      .from('lotes_aves')
      .update({ estado: 'activo', fecha_inicio_postura: hoyStr })
      .eq('id', loteActual.id)
      .select()
      .single()
    if (error) { toast.error('Error al actualizar el lote'); return }

    // Los requerimientos de producción se ponen solos: en preparación estaban en
    // cero porque el ave no ponía; al arrancar la postura ya necesita el aporte
    // extra por huevo.
    const { data: reqExistente } = await supabase
      .from('requerimientos_nutricionales_aves')
      .select('id, prod_proteina_g')
      .eq('lote_id', loteActual.id)
      .order('vigente_desde', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!reqExistente || Number(reqExistente.prod_proteina_g) === 0) {
      await supabase.from('requerimientos_nutricionales_aves').insert({
        lote_id: loteActual.id,
        finca_id: loteActual.finca_id,
        vigente_desde: hoyStr,
        mant_proteina_g: 9, mant_calcio_g: 0.3, mant_fosforo_g: 0.25, mant_grasa_g: 1.5,
        prod_proteina_g: 4.2, prod_calcio_g: 3.8, prod_fosforo_g: 0.45, prod_grasa_g: 1.0,
      })
      toast.success('Requerimientos de producción cargados para la postura')
    }

    toast.success('Lote marcado como activo en producción')
    onLoteUpdated(data)
    // Primero los horarios de recolección, y al guardarlos se abre el registro del día
    setModalRecoleccionObligatoria(true)
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }

  // ── Agrupación semanal del historial (separador cada 7 días) ──
  // En preparación la fecha de postura es solo tentativa: las semanas cuentan desde la entrada
  const origenSemanas = (enPostura ? loteActual.fecha_inicio_postura : null) ?? loteActual.fecha_inicio
  const origenSemanasDate = new Date(origenSemanas + 'T00:00:00')
  function semanaDeFecha(fecha: string) {
    const d = new Date(fecha + 'T00:00:00')
    return Math.floor((d.getTime() - origenSemanasDate.getTime()) / (7 * MS_DIA))
  }

  // El consumo rige hasta que se cambie: un día sin consumo propio hereda el del
  // último día que sí lo tuvo, para que el historial no muestre huecos.
  const consumoEfectivoPorFecha = new Map<string, number>()
  {
    const porFechaAsc = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha))
    let ultimo = 0
    for (const r of porFechaAsc) {
      const propio = Number(r.alimento_kg) || 0
      if (propio > 0) ultimo = propio
      consumoEfectivoPorFecha.set(r.fecha, ultimo)
    }
  }

  // Los eventos de origen "mortalidad" son el reflejo de las muertes del día, que ya
  // salen en su propia fila: si se mostraran otra vez quedarían duplicadas. Solo se
  // listan los clínicos, y cada uno va en su propia fila, aparte de las muertes.
  // Días en que el consumo cambió respecto al anterior: en el historial llevan una marca
  const cambiosConsumo = new Map<string, number | null>()
  {
    const asc = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha))
    let previo: number | null = null
    for (const r of asc) {
      const propio = Number(r.alimento_kg) || 0
      if (propio > 0) {
        if (previo === null || Math.abs(propio - previo) > 0.001) cambiosConsumo.set(r.fecha, previo)
        previo = propio
      }
    }
  }

  const eventosVisibles = eventosClinicos.filter(ev => ev.origen !== 'mortalidad')
  const eventosPorFecha = new Map<string, EventoClinico[]>()
  for (const ev of eventosVisibles) {
    const lista = eventosPorFecha.get(ev.fecha) ?? []
    lista.push(ev)
    eventosPorFecha.set(ev.fecha, lista)
  }

  type FilaHistorial =
    | { tipo: 'separador'; key: string; inicio: Date; fin: Date; etiquetaSemana: string; totalAlimento: number; mortalidad: number }
    | { tipo: 'hito'; key: string; etiqueta: string; fecha: string; color: 'azul' | 'verde' }
    | { tipo: 'dato'; key: string; registro: ProduccionDiaria; eventos: EventoClinico[] }

  /** Qué semana es la del separador: de preparación mientras no haya postura, de postura después. */
  function etiquetaDeSemana(fechaInicioSemana: Date): string {
    const fechaStr = aFechaLocal(fechaInicioSemana)
    const est = estadoPostura(enPostura ? loteActual.fecha_inicio_postura : null, fechaStr)
    if (est.iniciada) return `Semana ${est.semana} de postura`
    const semanasDesdeEntrada = Math.floor(
      (fechaInicioSemana.getTime() - new Date(loteActual.fecha_inicio + 'T00:00:00').getTime()) / (7 * MS_DIA)
    )
    return `Semana ${Math.max(1, semanasDesdeEntrada + 1)} de preparación`
  }

  // Una fila por día. El evento clínico de ese día va dentro de la misma fila, en un
  // cuadro aparte con sus afectadas y sus muertas, para no partir el día en dos.
  const registroPorFecha = new Map(registros.map(r => [r.fecha, r]))
  const fechasHistorial = [...new Set(registros.map(r => r.fecha))].sort((a, b) => b.localeCompare(a))

  const filasHistorial: FilaHistorial[] = []
  let semanaAnterior: number | null = null
  for (const fecha of fechasHistorial) {
    const semana = semanaDeFecha(fecha)
    if (semana !== semanaAnterior) {
      const grupo = registros.filter(x => semanaDeFecha(x.fecha) === semana)
      // El alimento de la semana usa el consumo vigente de cada día, no solo los
      // días que tienen consumo propio: si no se cambió, sigue siendo el mismo.
      const totalAlimento = grupo.reduce((s, x) => s + (consumoEfectivoPorFecha.get(x.fecha) ?? 0), 0)
      // La mortalidad de la semana suma las muertes del día y las de los eventos
      // clínicos, que son aparte, para que cuadre con las filas de abajo.
      const mortalidad = grupo.reduce((s, x) => s + x.muertes, 0)
        + eventosVisibles
          .filter(ev => semanaDeFecha(ev.fecha) === semana)
          .reduce((s, ev) => s + (ev.aves_muertas ?? 0), 0)
      const inicio = new Date(origenSemanasDate.getTime() + semana * 7 * MS_DIA)
      const fin = new Date(inicio.getTime() + 6 * MS_DIA)
      filasHistorial.push({
        tipo: 'separador', key: `sep-${semana}`, inicio, fin,
        etiquetaSemana: etiquetaDeSemana(inicio), totalAlimento, mortalidad,
      })
      semanaAnterior = semana
    }
    const registro = registroPorFecha.get(fecha)
    if (registro) {
      filasHistorial.push({ tipo: 'dato', key: registro.id, registro, eventos: eventosPorFecha.get(fecha) ?? [] })
    }
  }

  // Hito de inicio de postura: separa la preparación de la producción.
  if (loteActual.fecha_inicio_postura && enPostura) {
    const fechaPostura = loteActual.fecha_inicio_postura
    const idx = filasHistorial.findIndex(f =>
      (f.tipo === 'dato' && f.registro.fecha < fechaPostura) ||
      (f.tipo === 'separador' && aFechaLocal(f.inicio) < fechaPostura)
    )
    const hito: FilaHistorial = {
      tipo: 'hito', key: 'hito-postura', color: 'verde',
      etiqueta: 'Inicio de postura', fecha: fechaPostura,
    }
    if (idx === -1) filasHistorial.push(hito)
    else filasHistorial.splice(idx, 0, hito)
  }

  // Y al final del todo, el día en que el lote entró al galpón.
  filasHistorial.push({
    tipo: 'hito', key: 'hito-entrada', color: 'azul',
    etiqueta: 'Entrada al galpón', fecha: loteActual.fecha_inicio,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Producción y crecimiento</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setConfigOpen(true)} variant="ghost">
            <Ic n="ajustes" /> Configurar galpón
          </Button>
          {!enPostura && (
            <Button
              onClick={marcarInicioPostura}
              disabled={!listoParaRegistrar}
              title={!listoParaRegistrar ? faltaParaRegistrar : undefined}
              variant="outline"
            >
              <Ic n="huevo" /> Marcar inicio de postura
            </Button>
          )}
          {!enPostura && (
            <Button
              onClick={registrarDiaSinNovedades}
              disabled={!listoParaRegistrar || guardandoSinNovedades}
              title={!listoParaRegistrar ? faltaParaRegistrar : undefined}
              variant="outline"
            >
              {guardandoSinNovedades ? 'Guardando...' : 'Día sin novedades'}
            </Button>
          )}
          <Button
            onClick={() => { setRegistroEditar(null); setModalOpen(true) }}
            disabled={!listoParaRegistrar}
            title={!listoParaRegistrar ? faltaParaRegistrar : undefined}
          >
            <Ic n="mas" /> Registrar día
          </Button>
        </div>
      </div>

      {!listoParaRegistrar && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-200/70">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Ic n="alerta" className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Este galpón todavía no tiene alimento registrado</p>
              <p className="mt-0.5 text-xs text-gray-600">{faltaParaRegistrar}</p>
            </div>
          </div>
          <Link href={`/alimento?lote=${loteActual.id}`}>
            <Button size="sm">Registrar alimento</Button>
          </Link>
        </div>
      )}

      {enPostura && (
      <GrupoIndicadores titulo="Producción de hoy" columnas={5}>
        {enPostura && (<>
        <Indicador tono="amber" icono="huevo" etiqueta="Huevos puestos hoy" valor={hoy ? hoy.huevos_totales.toLocaleString('es-CO') : '—'} detalle={<>Comerciales: {hoy ? (hoy.huevos_totales - hoy.huevos_rotos - hoy.huevos_deformes).toLocaleString('es-CO') : '—'}</>} />
        <Indicador
          tono={metaHuevosDiaria && hoy && hoy.huevos_totales < metaHuevosDiaria ? 'red' : 'green'}
          icono="meta"
          etiqueta="Meta de huevos/día"
          valor={metaHuevosDiaria ? metaHuevosDiaria.toLocaleString('es-CO') : '—'}
          detalle={cumplimientoMeta ? `${cumplimientoMeta}% cumplido hoy` : metaHuevosDiaria ? 'Sin registro de hoy' : (
            <button type="button" onClick={() => setConfigOpen(true)} className="font-medium text-green-700 hover:underline">
              Definir la meta de huevos/día →
            </button>
          )}
        />
        <Indicador
          tono={posturaHoy && Number(posturaHoy) < metaPostura ? 'red' : 'green'}
          icono="huevo"
          etiqueta="% Postura hoy"
          valor={posturaHoy ? `${posturaHoy}%` : '—'}
          detalle={loteActual.meta_postura_pct != null ? <>Meta lote: {metaPostura}%</> : (
            <button type="button" onClick={() => setConfigOpen(true)} className="font-medium text-green-700 hover:underline">
              Definir la meta de % postura →
            </button>
          )}
        >
          {diffPuntosHoy != null && (
            <p className={`mt-1 text-xs font-medium ${diffPuntosHoy < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {diffPuntosHoy < 0
                ? `Faltan ${Math.abs(diffPuntosHoy).toFixed(1)} pts (${Math.round(perdidaHoy).toLocaleString('es-CO')} huevos bajo la meta)`
                : `+${diffPuntosHoy.toFixed(1)} pts (${Math.round(excedenteHoy).toLocaleString('es-CO')} huevos sobre la meta)`}
            </p>
          )}
        </Indicador>
        <Indicador
          tono="blue"
          icono="huevo"
          etiqueta="HAA · huevos por ave alojada"
          valor={haa ?? '—'}
          detalle={`${huevosAcumulados.toLocaleString('es-CO')} huevos ÷ ${loteActual.aves_iniciales.toLocaleString('es-CO')} aves alojadas`}
        />
        </>)}
        <Indicador tono="gray" icono="muerte" etiqueta="Mortalidad acumulada" valor={mortAcum} detalle={<>{mortPct}% del lote inicial</>} />
      </GrupoIndicadores>
      )}

      {/* Ciclo de postura y densidad. En preparación también lleva la mortalidad,
          así el lote se lee en un solo bloque y no queda una tarjeta suelta. */}
      <GrupoIndicadores titulo={enPostura ? 'Ciclo y galpón' : 'Estado del lote'} columnas={5}>
        {diasAtraso > 0 ? (
          <Indicador
            tono="red"
            icono="reloj"
            etiqueta="Postura"
            valor={<span className="text-red-700">Atrasada {textoAtraso}</span>}
            detalle={<>Estaba prevista para el {new Date(loteActual.fecha_inicio_postura + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })}. Marca el inicio cuando empiece o cambia la fecha en &quot;Configurar galpón&quot;.</>}
          />
        ) : (
        <Indicador tono="purple" icono="reloj" etiqueta={semanaPostura != null && enPostura ? 'Semana de postura' : 'Postura'} valor={semanaPostura ?? (semanasFaltantesPostura != null ? `Faltan ${semanasFaltantesPostura}` : '—')} detalle={<>{inicioSemanaActual && finSemanaActual
                ? `${inicioSemanaActual.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} – ${finSemanaActual.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`
                : semanasFaltantesPostura != null ? `semana${semanasFaltantesPostura === 1 ? '' : 's'} para iniciar` : 'Sin fecha de inicio'}</>}>
          {fechaFinEstimada && (
          <p className="mt-0.5 text-xs text-gray-400">
          Fin ciclo est.: {fechaFinEstimada.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          )}
        </Indicador>
        )}
        {enPostura && (<>
        <Indicador tono="green" icono="dinero" etiqueta="Ingreso por venta (hoy)" valor={ingresoHoy > 0 ? cop(ingresoHoy) : '—'} detalle={precioPromedio > 0 ? 'Según precio por tamaño configurado' : 'Define el precio del huevo en Ventas de la finca'} />
        <Indicador
          tono={perdidaHoy > 0 ? 'red' : 'gray'}
          icono="tendencia"
          etiqueta="Pérdida por baja postura (hoy)"
          valor={precioPromedio > 0
            ? (valorPerdidoHoy > 0 ? cop(valorPerdidoHoy) : cop(0))
            : `${Math.round(perdidaHoy).toLocaleString('es-CO')}`}
          detalle={precioPromedio > 0
            ? `${Math.round(perdidaHoy).toLocaleString('es-CO')} huevos bajo la meta`
            : 'huevos bajo la meta · pon el precio en Ventas de la finca para verlo en pesos'}
        />
        <Indicador
          tono={huevosPerdidos30 > 0 ? 'red' : 'gray'}
          icono="calendario"
          etiqueta="Pérdida acumulada (30d)"
          valor={precioPromedio > 0
            ? (valorPerdido30 > 0 ? cop(valorPerdido30) : cop(0))
            : `${Math.round(huevosPerdidos30).toLocaleString('es-CO')}`}
          detalle={precioPromedio > 0
            ? `${Math.round(huevosPerdidos30).toLocaleString('es-CO')} huevos bajo la meta`
            : 'huevos bajo la meta · pon el precio en Ventas de la finca para verlo en pesos'}
        />
        </>)}
        {!enPostura && (
          <Indicador tono="blue" icono="calendario" etiqueta="Semana de preparación" valor={semanasEnGalpon + 1} detalle={diasAtraso > 0
                  ? <span className="font-medium text-red-700">Postura atrasada {textoAtraso}</span>
                  : semanasFaltantesPostura != null
                  ? `Faltan ${semanasFaltantesPostura} semana${semanasFaltantesPostura === 1 ? '' : 's'} para postura`
                  : 'Aún no inicia postura'}>
            {loteActual.fecha_inicio_postura && (
            <p className="mt-0.5 text-xs text-gray-400">
            Tentativa: {new Date(loteActual.fecha_inicio_postura + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            )}
          </Indicador>
        )}
        <Indicador tono="orange" icono="ubicacion" etiqueta="Densidad" valor={densidad ?? '—'} detalle="aves / m²" />
        {!enPostura && (
          <Indicador tono="gray" icono="muerte" etiqueta="Mortalidad acumulada" valor={mortAcum} detalle={<>{mortPct}% del lote inicial</>} />
        )}
      </GrupoIndicadores>

      {/* Alimento: costo, bultos, gramos/gallina y kg totales (consumo activo) */}
      {/* Un solo cuadro con todo el alimento del día: qué come el galpón y cuánto */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Alimento</h3>
        <div className="superficie rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Ic n="alimento" className="size-[18px]" />
            </span>
            <div>
              <p className="text-xs font-medium text-gray-500">Alimento en uso</p>
              <p className="text-base font-semibold text-gray-900">{tipoAlimentoActivo?.nombre ?? 'Sin alimento registrado'}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-gray-500">Kg consumidos</p>
              <p className={`mt-1 text-2xl tracking-tight tabular-nums ${kgTotalHoy != null ? 'font-semibold text-gray-900' : 'text-gray-300'}`}>
                {kgTotalHoy != null ? kgTotalHoy.toFixed(1) : '—'}
              </p>
              <p className="mt-1 text-xs text-gray-500">kg por día, todo el galpón</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Bultos</p>
              <p className={`mt-1 text-2xl tracking-tight tabular-nums ${bultosHoy > 0 ? 'font-semibold text-gray-900' : 'text-gray-300'}`}>
                {bultosHoy > 0 ? bultosHoy.toFixed(2) : '—'}
              </p>
              <p className="mt-1 text-xs text-gray-500">por día, bulto de {pesoBulto} kg</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Alimento por gallina</p>
              <p className={`mt-1 text-2xl tracking-tight tabular-nums ${gramosGallinaHoy != null ? 'font-semibold text-gray-900' : 'text-gray-300'}`}>
                {gramosGallinaHoy != null ? gramosGallinaHoy.toFixed(0) : '—'}
              </p>
              <p className="mt-1 text-xs text-gray-500">gramos por gallina viva al día</p>
            </div>
          </div>
        </div>
      </section>

      {enPostura && (
        <>
          <HorariosRecoleccion loteId={loteActual.id} fincaId={loteActual.finca_id} />
          <RevisionCalidadHuevo
            loteId={loteActual.id}
            fincaId={loteActual.finca_id}
            fechaInicioPostura={loteActual.fecha_inicio_postura}
            fechaInicioLote={loteActual.fecha_inicio}
            registros={registros}
          />
        </>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial (alimento y muertes)</CardTitle>
          <p className="text-xs text-gray-400">
            Cada día es una fila con sus muertes y su causa. Si ese día hubo además un evento clínico,
            aparece en un recuadro dentro de la misma fila con sus afectadas y sus muertas.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    {enPostura && <TableHead className="text-right">Huevos</TableHead>}
                    <TableHead className="text-right">Alimento kg</TableHead>
                    <TableHead className="text-right">Muertes</TableHead>
                    <TableHead>Causa</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* El galpón recién creado ya muestra su fecha de entrada: no hay que
                      esperar al primer día registrado para ver la tabla. */}
                  {fechasHistorial.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={enPostura ? 6 : 5} className="py-8 text-center">
                        <p className="text-3xl mb-1"><Ic n="diario" /></p>
                        <p className="text-gray-600 font-medium text-sm">Sin días registrados todavía</p>
                        <p className="text-xs text-gray-400 mb-3">
                          {loteActual.estado === 'preparacion' ? 'Registra alimento, muertes o eventos clínicos del día' : 'Registra el primer día'}
                        </p>
                        <Button size="sm" onClick={() => setModalOpen(true)} className="bg-green-700 hover:bg-green-800 text-white">
                          + Registrar día
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                  {filasHistorial.map(fila => {
                    if (fila.tipo === 'separador') {
                      return (
                        <TableRow key={fila.key} className="bg-purple-50 hover:bg-purple-50 border-y border-purple-200">
                          <TableCell colSpan={enPostura ? 6 : 5} className="py-2">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-purple-800 font-medium">
                              <span className="font-semibold"><Ic n="calendario" /> {fila.etiquetaSemana}</span>
                              <span>
                                {fila.inicio.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} – {fila.fin.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                              </span>
                              <span>Alimento: {fila.totalAlimento.toFixed(1)} kg</span>
                              <span>Mortalidad: {fila.mortalidad}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    if (fila.tipo === 'hito') {
                      const cls = fila.color === 'verde'
                        ? 'bg-green-50 hover:bg-green-50 border-y border-green-200 text-green-800'
                        : 'bg-blue-50 hover:bg-blue-50 border-y border-blue-200 text-blue-800'
                      return (
                        <TableRow key={fila.key} className={cls}>
                          <TableCell colSpan={enPostura ? 6 : 5} className="py-2">
                            <div className="flex items-center gap-3 text-xs font-medium">
                              <span>{fila.etiqueta}</span>
                              <span className="font-normal opacity-80">
                                {new Date(fila.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    const r = fila.registro
                    return (
                      <TableRow key={fila.key}>
                        <TableCell className="font-medium text-sm">{formatDate(r.fecha)}</TableCell>
                        {enPostura && (
                          <TableCell className="text-right font-medium">
                            {r.huevos_totales > 0 ? r.huevos_totales.toLocaleString('es-CO') : '—'}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          {(consumoEfectivoPorFecha.get(r.fecha) ?? 0) > 0
                            ? (consumoEfectivoPorFecha.get(r.fecha) ?? 0).toFixed(1)
                            : '—'}
                          {cambiosConsumo.has(r.fecha) && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-amber-800">
                              {cambiosConsumo.get(r.fecha) == null
                                ? 'Consumo inicial'
                                : `Cambió de ${Number(cambiosConsumo.get(r.fecha)).toFixed(1)}`}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.muertes > 0 ? <Badge variant="destructive" className="text-xs">{r.muertes}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {r.causa_muerte ? CAUSAS_LABEL[r.causa_muerte] ?? r.causa_muerte : '—'}
                          {/* El evento clínico del día, en su propio cuadro dentro de la
                              misma fila, con sus afectadas y sus muertas. */}
                          {fila.eventos.map(ev => (
                            <span key={ev.id} className="mt-1 block rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] leading-tight text-red-700">
                              <span className="font-semibold"><Ic n="clinico" /> {ev.causa ? CAUSAS_LABEL[ev.causa] ?? ev.causa : ev.descripcion}</span>
                              <span className="block text-red-500">
                                {TIPO_EVENTO_LABEL[ev.tipo_evento] ?? ev.tipo_evento}
                                {(ev.aves_afectadas ?? 0) > 0 ? ` · ${ev.aves_afectadas} afectadas` : ''}
                                {(ev.aves_muertas ?? 0) > 0 ? ` · ${ev.aves_muertas} muertas` : ''}
                              </span>
                            </span>
                          ))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setRegistroEditar(r); setModalOpen(true) }}><Ic n="editar" /></Button>
                            <Button
                              size="sm" variant="ghost"
                              className={confirmandoEliminar === r.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                              onClick={() => eliminarRegistro(r)}
                            >
                              {confirmandoEliminar === r.id ? '¿Confirmar?' : <Ic n="borrar" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {enPostura && (
        <>
          <GraficaCurvaPostura
            fechaInicioLote={loteActual.fecha_inicio}
            metaPosturaPct={loteActual.meta_postura_pct}
            registros={registros}
          />
        </>
      )}

      <ConfigurarRecoleccionModal
        open={modalRecoleccionObligatoria}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        onListo={() => {
          setModalRecoleccionObligatoria(false)
          // Encadena con el registro del primer día de postura
          setRegistroEditar(null)
          setModalOpen(true)
        }}
      />

      <RegistrarProduccionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setRegistroEditar(null) }}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        avesActuales={loteActual.aves_actuales}
        nombreLote={loteActual.nombre}
        estadoLote={loteActual.estado}
        registroExistente={registroEditar}
        onCreated={() => { fetchRegistros(); fetchEventosClinicos(); onLoteUpdated() }}
      />

      <ConfigurarGalponModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        lote={loteActual}
        onUpdated={updated => onLoteUpdated(updated)}
        onDeleted={onLoteDeleted}
      />
    </div>
  )
}
