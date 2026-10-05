'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRol } from '@/components/agro/RolProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { avisoCostoVinculado } from '@/lib/eliminarConAviso'
import CrearTipoAlimentoModal from './CrearTipoAlimentoModal'
import ProgramaAlimentacion from './ProgramaAlimentacion'
import EditarRequerimientosModal from './EditarRequerimientosModal'
import RegistrarConsumoAlimentoModal from './RegistrarConsumoAlimentoModal'
import HorariosAlimentacion from './HorariosAlimentacion'
import RegistrarEntradaAlimentoModal from './RegistrarEntradaAlimentoModal'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { recalcularStockAlimentoAves, leerStockAlimentoAves, tramosConsumoFinca, type StockAlimentoAves } from '@/lib/inventario'
import Link from 'next/link'
import { Indicador } from '@/components/ui/indicador'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'
import { Ic } from '@/components/ui/icon'
import { CATEGORIAS_ALIMENTO_AVES } from '@/lib/programaAlimento'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']
type TipoAlimento = Database['public']['Tables']['tipos_alimento_aves']['Row']
type Requerimientos = Database['public']['Tables']['requerimientos_nutricionales_aves']['Row']
type Entrada = Database['public']['Tables']['entradas_alimento_aves']['Row']

interface Props {
  lotes: LoteAves[]
  /** Galpón con el que abre la pestaña (llega de ?lote= al venir desde el galpón) */
  loteInicialId?: string | null
  /**
   * 'galpon': el alimento de un galpón, en su navbar — consumo, horarios y balance,
   *   sin inventario (solo los bultos disponibles).
   * 'finca': el alimento general del menú — catálogo, consumos activos de todos
   *   los galpones, inventario total con filtro por alimento y balance por galpón.
   */
  modo?: 'finca' | 'galpon'
  /** Avisa que cambió el alimento o el consumo del galpón, para refrescarlo */
  onLoteCambiado?: () => void
}

/** Un registro de consumo de cualquier galpón de la finca, para el movimiento de bultos. */
interface RegistroConsumoFinca {
  lote_id: string
  fecha: string
  alimento_kg: number
  tipo_alimento_id: string | null
}

type SubTab = 'alimento' | 'inventario' | 'balance'

const DEFAULTS = {
  mant_proteina_g: 9, mant_calcio_g: 0.3, mant_fosforo_g: 0.25, mant_grasa_g: 1.5,
  prod_proteina_g: 0, prod_calcio_g: 0, prod_fosforo_g: 0, prod_grasa_g: 0,
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CATEGORIA_LABEL: Record<string, string> = Object.fromEntries(CATEGORIAS_ALIMENTO_AVES.map(c => [c.value, c.label]))

const NUTRIENTES = [
  { key: 'proteina', label: 'Proteína bruta', pctKey: 'proteina_bruta_pct' as const, mantKey: 'mant_proteina_g' as const, prodKey: 'prod_proteina_g' as const },
  { key: 'grasa', label: 'Grasa', pctKey: 'grasa_pct' as const, mantKey: 'mant_grasa_g' as const, prodKey: 'prod_grasa_g' as const },
  { key: 'calcio', label: 'Calcio', pctKey: 'calcio_pct' as const, mantKey: 'mant_calcio_g' as const, prodKey: 'prod_calcio_g' as const },
  { key: 'fosforo', label: 'Fósforo', pctKey: 'fosforo_pct' as const, mantKey: 'mant_fosforo_g' as const, prodKey: 'prod_fosforo_g' as const },
]

export default function TabAlimentoAves({ lotes, loteInicialId, modo = 'finca', onLoteCambiado }: Props) {
  const enGalpon = modo === 'galpon'
  const supabase = createClient()
  const rol = useRol()
  const puedeVerCostos = rol !== 'trabajador'
  const [subTab, setSubTab] = useState<SubTab>('alimento')
  const router = useRouter()
  const [loteId, setLoteId] = useState(
    loteInicialId && lotes.some(l => l.id === loteInicialId) ? loteInicialId : (lotes[0]?.id ?? '')
  )
  const [hoy, setHoy] = useState<ProduccionDiaria | null>(null)
  const [alimentoActivo, setAlimentoActivo] = useState<{ alimento_activo_id: string | null; consumo_activo_kg: number | null } | null>(null)
  const [consumos, setConsumos] = useState<ProduccionDiaria[]>([])
  const [tipos, setTipos] = useState<TipoAlimento[]>([])
  const [requerimientosHistorial, setRequerimientosHistorial] = useState<Requerimientos[]>([])
  const [loading, setLoading] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditar, setTipoEditar] = useState<TipoAlimento | null>(null)
  const [modalRequerimientos, setModalRequerimientos] = useState(false)
  const [modalConsumo, setModalConsumo] = useState(false)
  const [consumoEditar, setConsumoEditar] = useState<ProduccionDiaria | null>(null)
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [sinHorarios, setSinHorarios] = useState(false)
  // Lo repartido en horarios, al momento: el aviso de "falta repartir" lo usa sin recargar
  const [repartidoKg, setRepartidoKg] = useState<number | null>(null)
  // Lo que hay de cada alimento: entradas menos lo consumido, calculado en la base
  const [stockAlimento, setStockAlimento] = useState<StockAlimentoAves[]>([])
  // Vencimiento más cercano de cada alimento, que vive en sus entradas
  const [vencePorTipo, setVencePorTipo] = useState<Record<string, string>>({})
  // Tras el primer consumo de un galpón nuevo, se ofrece volver a él
  const [ofrecerVolver, setOfrecerVolver] = useState(false)
  const [modalEntrada, setModalEntrada] = useState(false)
  const [entradaEditar, setEntradaEditar] = useState<Entrada | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  // Inventario general: el consumo de todos los galpones y un filtro por alimento
  const [registrosFinca, setRegistrosFinca] = useState<RegistroConsumoFinca[]>([])
  const [filtroTipo, setFiltroTipo] = useState('todos')
  // La bodega es de la finca: los días que alcanza un alimento dependen de lo que
  // comen entre todos los galpones que lo usan, no solo este
  const [consumoPorTipoFinca, setConsumoPorTipoFinca] = useState<Record<string, { kg: number; galpones: number }>>({})

  const lote = lotes.find(l => l.id === loteId) ?? lotes[0] ?? null

  const fetchAll = useCallback(async () => {
    if (!lote) { setLoading(false); return }
    setLoading(true)
    await recalcularStockAlimentoAves(supabase, lote.finca_id)
    const [prod, consumosRes, tiposRes, reqRes, loteRes, entradasRes, horariosRes] = await Promise.all([
      supabase.from('produccion_diaria_aves').select('*').eq('lote_id', lote.id).order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('produccion_diaria_aves').select('*').eq('lote_id', lote.id).gt('alimento_kg', 0).order('fecha', { ascending: false }).limit(30),
      supabase.from('tipos_alimento_aves').select('*').eq('finca_id', lote.finca_id).order('nombre'),
      supabase.from('requerimientos_nutricionales_aves').select('*').eq('lote_id', lote.id).order('vigente_desde', { ascending: false }),
      supabase.from('lotes_aves').select('alimento_activo_id, consumo_activo_kg').eq('id', lote.id).single(),
      supabase.from('entradas_alimento_aves').select('*').eq('finca_id', lote.finca_id).order('fecha', { ascending: false }).limit(50),
      supabase.from('horarios_alimentacion_aves').select('id', { count: 'exact', head: true }).eq('lote_id', lote.id).eq('activo', true),
    ])
    setStockAlimento(await leerStockAlimentoAves(supabase, lote.finca_id))
    const { data: lotesFinca } = await supabase
      .from('lotes_aves')
      .select('alimento_activo_id, consumo_activo_kg')
      .eq('finca_id', lote.finca_id)
      .in('estado', ['activo', 'preparacion'])
    const porTipo: Record<string, { kg: number; galpones: number }> = {}
    for (const l of lotesFinca ?? []) {
      const kg = Number(l.consumo_activo_kg ?? 0)
      if (!l.alimento_activo_id || kg <= 0) continue
      const actual = porTipo[l.alimento_activo_id] ?? { kg: 0, galpones: 0 }
      porTipo[l.alimento_activo_id] = { kg: actual.kg + kg, galpones: actual.galpones + 1 }
    }
    setConsumoPorTipoFinca(porTipo)
    // El movimiento de bultos de la finca necesita el consumo de todos los galpones
    if (modo === 'finca') {
      const { data: regs } = await supabase
        .from('produccion_diaria_aves')
        .select('lote_id, fecha, alimento_kg, tipo_alimento_id')
        .eq('finca_id', lote.finca_id)
        .gt('alimento_kg', 0)
        .order('fecha')
      setRegistrosFinca((regs ?? []).map(r => ({ ...r, alimento_kg: Number(r.alimento_kg) })))
    }
    setHoy(prod.data ?? null)
    setConsumos(consumosRes.data ?? [])
    setTipos(tiposRes.data ?? [])
    setRequerimientosHistorial(reqRes.data ?? [])
    setAlimentoActivo(loteRes.data ?? null)
    const listaEntradas = entradasRes.data ?? []
    setEntradas(listaEntradas)
    // De cada alimento se avisa el vencimiento más cercano que todavía no pasó
    const hoyStr = hoyLocal()
    const vencimientos: Record<string, string> = {}
    for (const e of listaEntradas) {
      if (!e.fecha_vencimiento || e.fecha_vencimiento < hoyStr) continue
      const actual = vencimientos[e.tipo_alimento_id]
      if (!actual || e.fecha_vencimiento < actual) vencimientos[e.tipo_alimento_id] = e.fecha_vencimiento
    }
    setVencePorTipo(vencimientos)
    setSinHorarios((horariosRes.count ?? 0) === 0)
    setLoading(false)
  }, [lote, supabase, modo])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleActivo(tipo: TipoAlimento) {
    const { error } = await supabase.from('tipos_alimento_aves').update({ activo: !tipo.activo }).eq('id', tipo.id)
    if (error) { toast.error('Error al actualizar el alimento'); return }
    toast.success(tipo.activo ? 'Alimento desactivado' : 'Alimento reactivado')
    fetchAll()
  }

  async function eliminarTipo(tipo: TipoAlimento) {
    if (confirmandoEliminar !== tipo.id) {
      setConfirmandoEliminar(tipo.id)
      const aviso = await avisoCostoVinculado(supabase, 'tipo_alimento_id', tipo.id)
      if (aviso) toast.warning(aviso)
      return
    }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('tipos_alimento_aves').delete().eq('id', tipo.id)
    if (error) { toast.error('Error al eliminar el alimento'); return }
    toast.success(`Alimento "${tipo.nombre}" eliminado`)
    fetchAll()
  }

  async function eliminarEntrada(entrada: Entrada) {
    if (confirmandoEliminar !== entrada.id) {
      setConfirmandoEliminar(entrada.id)
      toast.warning('Se eliminará también su costo en Finanzas. Presiona de nuevo para confirmar.')
      return
    }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('entradas_alimento_aves').delete().eq('id', entrada.id)
    if (error) { toast.error('Error al eliminar la entrada'); return }
    toast.success('Entrada eliminada')
    fetchAll()
  }

  async function quitarConsumo(registro: ProduccionDiaria) {
    // Si ese día no tiene nada más (huevos, muertes, notas), la fila solo existía por
    // el consumo: se borra entera y desaparece del historial. Si tiene más datos,
    // se conserva el día y solo se le quita el consumo.
    const soloConsumo = registro.huevos_totales === 0 && registro.muertes === 0 && !registro.observaciones
    const { count: eventosDelDia } = await supabase
      .from('eventos_clinicos_aves').select('id', { count: 'exact', head: true }).eq('produccion_id', registro.id)
    const { error } = soloConsumo && !eventosDelDia
      ? await supabase.from('produccion_diaria_aves').delete().eq('id', registro.id)
      : await supabase.from('produccion_diaria_aves').update({ alimento_kg: 0, tipo_alimento_id: null }).eq('id', registro.id)
    if (error) { toast.error('Error al quitar el consumo'); return }

    if (lote) {
      const { data: ultimo } = await supabase
        .from('produccion_diaria_aves')
        .select('tipo_alimento_id, alimento_kg')
        .eq('lote_id', lote.id)
        .gt('alimento_kg', 0)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()
      await supabase.from('lotes_aves').update({
        alimento_activo_id: ultimo?.tipo_alimento_id ?? null,
        consumo_activo_kg: ultimo ? Number(ultimo.alimento_kg) : null,
      }).eq('id', lote.id)
    }

    toast.success('Consumo eliminado')
    fetchAll()
    onLoteCambiado?.()
  }

  const manejarResumenHorarios = useCallback((total: number) => setRepartidoKg(total), [])

  if (lotes.length === 0) {
    return (
      <Card className="border-dashed border-gray-300">
        <CardContent className="py-16 text-center">
          <p className="text-4xl mb-2"><Ic n="alimento" /></p>
          <p className="text-gray-600 font-medium">No hay lotes de aves ponedoras activos</p>
          <p className="text-sm text-gray-400">Crea un lote en la sección Galpones para ver su alimentación</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>

  const tiposActivos = tipos.filter(t => t.activo)
  // El alimento que este galpón está consumiendo hoy, con su stock y sus entradas
  const stockActivo = stockAlimento.find(s => s.tipo_alimento_id === alimentoActivo?.alimento_activo_id) ?? null
  const venceActivo = stockActivo ? vencePorTipo[stockActivo.tipo_alimento_id] ?? null : null
  const consumoDelGalpon = Number(alimentoActivo?.consumo_activo_kg ?? 0)
  // Lo que se come ese alimento entre todos los galpones que lo usan
  const consumoCompartido = stockActivo ? consumoPorTipoFinca[stockActivo.tipo_alimento_id] ?? null : null
  const kgDiaDelAlimento = consumoCompartido?.kg ?? consumoDelGalpon
  const diasQueAlcanza = stockActivo && kgDiaDelAlimento > 0 && stockActivo.bultos_disponibles > 0
    ? Math.floor((stockActivo.bultos_disponibles * stockActivo.peso_bulto_kg) / kgDiaDelAlimento)
    : null
  const sinEntradas = stockActivo != null && stockActivo.bultos_entrados === 0
  const bultosDia = stockActivo && consumoDelGalpon > 0 ? consumoDelGalpon / stockActivo.peso_bulto_kg : null

  // ---- Inventario general de la finca ----
  // Los alimentos que se están usando o que tienen bultos en bodega
  const alimentosEnBodega = stockAlimento.filter(s => s.activo_en_algun_lote || s.bultos_disponibles > 0)
  const nombrePorLote = new Map(lotes.map(l => [l.id, l.nombre]))
  const nombrePorTipo = new Map(tipos.map(x => [x.id, x.nombre]))
  const lotesVivos = new Set(lotes.map(l => l.id))
  const tramosFinca = enGalpon ? [] : tramosConsumoFinca(registrosFinca, lotesVivos, hoyLocal())
  const pesoBultoDe = (tipoId: string) => stockAlimento.find(s => s.tipo_alimento_id === tipoId)?.peso_bulto_kg ?? 40
  const pasaFiltro = (tipoId: string) => filtroTipo === 'todos' || filtroTipo === tipoId
  const entradasFiltradas = entradas.filter(e => pasaFiltro(e.tipo_alimento_id))

  /**
   * El movimiento de la bodega en bultos: lo que entró y lo que salió, en orden y
   * con el saldo que queda. Con "todos" suma todos los alimentos; con uno, solo ese.
   */
  const movimientosFinca = (() => {
    const filas: { fecha: string; concepto: string; detalle: string; entran: number; salen: number }[] = [
      ...entradasFiltradas.map(e => ({
        fecha: e.fecha,
        concepto: 'Entrada',
        detalle: [nombrePorTipo.get(e.tipo_alimento_id), e.proveedor].filter(Boolean).join(' · '),
        entran: Number(e.cantidad_bultos),
        salen: 0,
      })),
      ...tramosFinca.filter(tr => pasaFiltro(tr.tipoAlimentoId)).map(tr => ({
        fecha: tr.desde,
        concepto: `Consumo ${nombrePorLote.get(tr.loteId) ?? 'galpón cerrado'}`,
        detalle: `${filtroTipo === 'todos' ? `${nombrePorTipo.get(tr.tipoAlimentoId) ?? 'Alimento'} · ` : ''}${tr.kgDia.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg/día × ${tr.dias} día${tr.dias === 1 ? '' : 's'}`,
        entran: 0,
        salen: tr.kgTotal / pesoBultoDe(tr.tipoAlimentoId),
      })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha) || b.entran - a.entran)

    let saldo = 0
    return filas.map(f => {
      saldo += f.entran - f.salen
      return { ...f, saldo }
    }).reverse()
  })()

  // Lo que come cada galpón hoy: el general lo muestra con su galpón al lado
  const consumosActivos = lotes
    .filter(l => l.alimento_activo_id && Number(l.consumo_activo_kg ?? 0) > 0)
    .map(l => {
      const kg = Number(l.consumo_activo_kg)
      const peso = l.alimento_activo_id ? pesoBultoDe(l.alimento_activo_id) : 40
      return {
        lote: l,
        alimento: l.alimento_activo_id ? nombrePorTipo.get(l.alimento_activo_id) ?? '—' : '—',
        kg,
        bultos: kg / peso,
        gramosAve: l.aves_actuales > 0 ? (kg * 1000) / l.aves_actuales : null,
      }
    })
  const hoyStr = hoyLocal()
  const requerimientos = requerimientosHistorial.find(r => r.vigente_desde <= hoyStr) ?? null
  const req = requerimientos ?? { ...DEFAULTS, lote_id: lote!.id, finca_id: lote!.finca_id, id: '', vigente_desde: '', created_at: '' }
  const avesEnDia = hoy?.aves_en_dia ?? lote?.aves_actuales ?? 0
  const alimentoKgHoy = alimentoActivo?.consumo_activo_kg != null ? Number(alimentoActivo.consumo_activo_kg) : 0
  const posturaFraccion = hoy && hoy.aves_en_dia && hoy.aves_en_dia > 0 ? hoy.huevos_totales / hoy.aves_en_dia : 0
  const tipoActual = tipos.find(t => t.id === alimentoActivo?.alimento_activo_id) ?? null

  const pesoBulto = tipoActual?.peso_bulto_kg ?? 40
  const bultosHoy = alimentoKgHoy / pesoBulto
  const costoHoy = tipoActual?.precio_bulto ? bultosHoy * tipoActual.precio_bulto : null

  // El galpón no maneja inventario: eso es de la finca, en el alimento general
  const subTabItems: { id: SubTab; label: string }[] = enGalpon
    ? [
        { id: 'alimento', label: 'Consumo y horarios' },
        { id: 'balance', label: 'Balance' },
      ]
    : [
        { id: 'alimento', label: 'Alimentos y consumos' },
        { id: 'inventario', label: 'Inventario' },
        { id: 'balance', label: 'Balance' },
      ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* En el general solo el balance se mira galpón por galpón */}
        {!enGalpon && subTab === 'balance' ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Galpón:</span>
            <select
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              value={loteId || lote?.id}
              onChange={e => setLoteId(e.target.value)}
            >
              {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
        ) : <span />}
        {subTab === 'alimento' ? (
          enGalpon ? (
            <Button
              className="bg-green-700 hover:bg-green-800 text-white text-sm"
              disabled={tiposActivos.length === 0}
              title={tiposActivos.length === 0 ? 'Primero crea el alimento en Alimento (menú izquierdo)' : undefined}
              onClick={() => { setConsumoEditar(null); setModalConsumo(true) }}
            >
              + Registrar consumo
            </Button>
          ) : (
            <Button variant="outline" className="text-sm" onClick={() => { setTipoEditar(null); setModalTipo(true) }}>
              + Tipo de alimento
            </Button>
          )
        ) : subTab === 'inventario' ? (
          <Button
            className="bg-green-700 hover:bg-green-800 text-white text-sm"
            disabled={tiposActivos.length === 0}
            title={tiposActivos.length === 0 ? 'Primero registra un tipo de alimento' : undefined}
            onClick={() => { setEntradaEditar(null); setModalEntrada(true) }}
          >
            + Registrar entrada
          </Button>
        ) : (
          <Button variant="outline" className="text-sm" onClick={() => setModalRequerimientos(true)}><Ic n="meta" /> Requerimientos</Button>
        )}
      </div>

      {/* Mini-tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {subTabItems.map(item => (
          <button
            key={item.id}
            onClick={() => setSubTab(item.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              subTab === item.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* En el galpón: los bultos que hay de lo que está comiendo, al día con la bodega */}
      {enGalpon && subTab === 'alimento' && stockActivo && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
          <Indicador
            tono="green" icono="alimento" etiqueta="Consume al día"
            valor={<>{consumoDelGalpon.toLocaleString('es-CO', { maximumFractionDigits: 1 })} <span className="text-base font-medium text-gray-500">kg</span></>}
            detalle={bultosDia ? `${bultosDia.toFixed(2)} bultos al día · ${stockActivo.nombre}` : stockActivo.nombre}
          />
          <Indicador
            tono={sinEntradas || stockActivo.bultos_disponibles <= 0 || (diasQueAlcanza != null && diasQueAlcanza <= 7) ? 'red' : 'amber'}
            icono="caja" etiqueta="Bultos disponibles"
            valor={
              sinEntradas
                ? <span className="text-xl text-red-700">Sin entradas</span>
                : <>{Math.max(0, stockActivo.bultos_disponibles).toLocaleString('es-CO', { maximumFractionDigits: 1 })} <span className="text-base font-medium text-gray-500">bultos</span></>
            }
            detalle={
              sinEntradas
                ? <span className="font-medium text-red-700">Registra la entrada en Alimento (menú izquierdo)</span>
                : stockActivo.bultos_disponibles <= 0
                  ? <span className="font-medium text-red-700">Se acabó: registra la entrada en Alimento</span>
                  : diasQueAlcanza != null
                    ? `Alcanza para ${diasQueAlcanza} día${diasQueAlcanza === 1 ? '' : 's'}${
                        consumoCompartido && consumoCompartido.galpones > 1
                          ? ` · lo comen ${consumoCompartido.galpones} galpones (${consumoCompartido.kg.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg/día)`
                          : ''
                      }${venceActivo ? ` · vence el ${fmt(venceActivo)}` : ''}`
                    : 'En bodega de la finca'
            }
          />
        </div>
      )}

      {/* Lo que le corresponde comer a su edad, según su referencia */}
      {enGalpon && subTab === 'alimento' && lote && (
        <ProgramaAlimentacion
          lote={lote}
          consumoKgDia={alimentoActivo?.consumo_activo_kg != null ? Number(alimentoActivo.consumo_activo_kg) : null}
          alimento={tipoActual}
        />
      )}

      {!enGalpon && subTab === 'alimento' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Tipos de alimento registrados</CardTitle>
            <p className="text-xs text-gray-400">El catálogo de la finca: cada galpón escoge de aquí lo que come, y las entradas de cada alimento se registran en Inventario.</p>
          </CardHeader>
          <CardContent className="p-0">
            {tipos.length === 0 ? (
              <p className="text-sm text-gray-400 p-4">Aún no has registrado ningún tipo de alimento. Usa &quot;+ Tipo de alimento&quot; arriba.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tipos.map(t => (
                      <TableRow key={t.id} className={t.activo ? '' : 'opacity-50'}>
                        <TableCell className="font-medium text-sm">{t.nombre}</TableCell>
                        <TableCell className="text-sm text-gray-600">{t.marca || '—'}</TableCell>
                        <TableCell className="text-sm text-gray-600">{t.tipo_alimento_categoria ? CATEGORIA_LABEL[t.tipo_alimento_categoria] ?? t.tipo_alimento_categoria : '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setTipoEditar(t); setModalTipo(true) }}><Ic n="editar" /></Button>
                            <Button
                              size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-500"
                              title={t.activo ? 'Desactivar' : 'Reactivar'}
                              onClick={() => toggleActivo(t)}
                            >
                              {t.activo ? <Ic n="prohibido" /> : <Ic n="ciclo" />}
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className={confirmandoEliminar === t.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                              onClick={() => eliminarTipo(t)}
                            >
                              {confirmandoEliminar === t.id ? '¿Confirmar?' : <Ic n="borrar" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!enGalpon && subTab === 'alimento' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Consumos activos</CardTitle>
            <p className="text-xs text-gray-400">
              Lo que come cada galpón hoy. El consumo y los horarios se manejan en la pestaña Alimento de cada galpón.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {consumosActivos.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Ningún galpón tiene consumo registrado todavía.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Galpón</TableHead>
                      <TableHead>Alimento</TableHead>
                      <TableHead className="text-right">Kg al día</TableHead>
                      <TableHead className="text-right">Bultos al día</TableHead>
                      <TableHead className="text-right">Por gallina</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumosActivos.map(c => (
                      <TableRow key={c.lote.id}>
                        <TableCell className="py-2 text-sm font-medium">
                          <Link href={`/aves-ponedoras?lote=${c.lote.id}`} className="text-green-800 hover:underline">{c.lote.nombre}</Link>
                        </TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">{c.alimento}</TableCell>
                        <TableCell className="py-2 text-right text-sm">{c.kg.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="py-2 text-right text-sm">{c.bultos.toFixed(2)}</TableCell>
                        <TableCell className="py-2 text-right text-sm text-gray-600">{c.gramosAve != null ? `${c.gramosAve.toFixed(1)} g` : '—'}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableCell className="py-2 text-sm font-semibold" colSpan={2}>Toda la finca</TableCell>
                      <TableCell className="py-2 text-right text-sm font-semibold">
                        {consumosActivos.reduce((s, c) => s + c.kg, 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })}
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm font-semibold">
                        {consumosActivos.reduce((s, c) => s + c.bultos, 0).toFixed(2)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {subTab === 'alimento' && tiposActivos.length === 0 && (
        <div className="px-4 py-3 rounded-lg border border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Empieza por registrar un tipo de alimento</p>
          <p className="text-xs text-amber-700 mt-0.5">
            {enGalpon
              ? <>El catálogo de alimento es de la finca: créalo en <Link href="/alimento" className="font-medium underline">Alimento</Link> (menú izquierdo) y vuelve aquí a registrar el consumo.</>
              : 'Sin un tipo de alimento los galpones no pueden registrar su consumo.'}
          </p>
        </div>
      )}

      {enGalpon && subTab === 'alimento' && tiposActivos.length > 0 && !alimentoActivo?.consumo_activo_kg && (
        <div className="px-4 py-3 rounded-lg border border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Falta registrar el consumo del galpón</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Registra cuántos kg come el galpón al día para poder repartirlos en horarios.
          </p>
        </div>
      )}

      {enGalpon && subTab === 'alimento' && alimentoActivo?.consumo_activo_kg != null
        && (repartidoKg != null ? repartidoKg + 0.05 < Number(alimentoActivo.consumo_activo_kg) : sinHorarios) && (
        <div className="px-4 py-3 rounded-lg border border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">
            <Ic n="alerta" /> Falta repartir el consumo en horarios de alimentación
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            El galpón consume {alimentoActivo.consumo_activo_kg} kg/día
            {repartidoKg != null && repartidoKg > 0 ? ` y hay ${repartidoKg.toFixed(1)} kg repartidos` : ''}.
            Agrega abajo los horarios con la porción de cada uno hasta cubrir ese total.
          </p>
        </div>
      )}

      {enGalpon && subTab === 'alimento' && lote && alimentoActivo?.consumo_activo_kg != null && (
        <HorariosAlimentacion
          loteId={lote.id}
          fincaId={lote.finca_id}
          consumoRegistradoKg={alimentoActivo?.consumo_activo_kg}
          onResumen={manejarResumenHorarios}
        />
      )}

      {enGalpon && subTab === 'alimento' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Consumo registrado</CardTitle>
              <p className="text-xs text-gray-400">
                El último consumo registrado es el que rige para el galpón hasta que se registre otro.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {consumos.length === 0 ? (
                <p className="text-sm text-gray-400 p-4">Sin consumo registrado. Usa &quot;+ Registrar consumo&quot; arriba.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Alimento</TableHead>
                        <TableHead className="text-right">Kg consumidos</TableHead>
                        <TableHead className="text-right">Por gallina</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consumos.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">{fmt(c.fecha)}</TableCell>
                          <TableCell className="text-sm text-gray-600">{tipos.find(t => t.id === c.tipo_alimento_id)?.nombre ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{Number(c.alimento_kg).toFixed(1)}</TableCell>
                          {/* Alimento diario ÷ gallinas vivas actuales */}
                          <TableCell className="text-right text-sm text-gray-600">
                            {lote && lote.aves_actuales > 0
                              ? `${((Number(c.alimento_kg) * 1000) / lote.aves_actuales).toFixed(1)} g/ave`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500"
                                onClick={() => { setConsumoEditar(c); setModalConsumo(true) }}
                              >
                                <Ic n="editar" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={() => quitarConsumo(c)}>Quitar</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
      )}

      {!enGalpon && subTab === 'inventario' && (
        <>
          {tiposActivos.length === 0 && (
            <div className="px-4 py-3 rounded-lg border border-amber-200 bg-amber-50">
              <p className="text-sm font-semibold text-amber-800">Primero registra un tipo de alimento</p>
              <p className="text-xs text-amber-700 mt-0.5">
                El inventario se maneja por tipo de alimento: créalo en la pestaña Alimentos y consumos y vuelve aquí.
              </p>
            </div>
          )}

          {/* El filtro manda en toda la pestaña: tarjetas, movimiento y entradas */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Alimento:</span>
            <select
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todos los alimentos</option>
              {tipos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>

          {/* Lo que hay en la bodega de la finca, alimento por alimento */}
          {alimentosEnBodega.filter(s => pasaFiltro(s.tipo_alimento_id)).length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
              {alimentosEnBodega.filter(s => pasaFiltro(s.tipo_alimento_id)).map(s => {
                const kgDia = lotes
                  .filter(l => l.alimento_activo_id === s.tipo_alimento_id)
                  .reduce((suma, l) => suma + Number(l.consumo_activo_kg ?? 0), 0)
                const dias = kgDia > 0 && s.bultos_disponibles > 0 ? Math.floor((s.bultos_disponibles * s.peso_bulto_kg) / kgDia) : null
                const sinEntrada = s.bultos_entrados === 0
                return (
                  <Indicador
                    key={s.tipo_alimento_id}
                    tono={sinEntrada || s.bultos_disponibles <= 0 || (dias != null && dias <= 7) ? 'red' : 'amber'}
                    icono="alimento"
                    etiqueta={s.nombre}
                    valor={
                      sinEntrada
                        ? <span className="text-xl text-red-700">Sin entradas</span>
                        : <>{Math.max(0, s.bultos_disponibles).toLocaleString('es-CO', { maximumFractionDigits: 1 })} <span className="text-base font-medium text-gray-500">bultos</span></>
                    }
                    detalle={
                      sinEntrada
                        ? <span className="font-medium text-red-700">Se han consumido {s.bultos_consumidos.toLocaleString('es-CO', { maximumFractionDigits: 1 })} bultos sin entrada registrada</span>
                        : s.bultos_disponibles <= 0
                          ? <span className="font-medium text-red-700">Se consumió más de lo que entró</span>
                          : kgDia > 0
                            ? <span className={dias != null && dias <= 7 ? 'font-medium text-red-700' : undefined}>
                                {kgDia.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg/día entre todos los galpones
                                {dias != null ? ` · alcanza ${dias} día${dias === 1 ? '' : 's'}` : ''}
                              </span>
                            : 'Ningún galpón lo está comiendo'
                    }
                  />
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
              No hay alimento en bodega{filtroTipo !== 'todos' ? ' de este tipo' : ''}. Registra una entrada para empezar.
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Movimiento de bultos</CardTitle>
              <p className="text-xs text-gray-400">
                Lo que entró a la finca y lo que se comieron los galpones, con los bultos que van quedando
                {filtroTipo !== 'todos' ? ` de ${nombrePorTipo.get(filtroTipo) ?? 'este alimento'}` : ' entre todos los alimentos'}.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {movimientosFinca.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Sin movimientos todavía.</p>
              ) : (
                <div className="max-h-[28rem] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Movimiento</TableHead>
                        <TableHead className="text-right">Entran</TableHead>
                        <TableHead className="text-right">Salen</TableHead>
                        <TableHead className="text-right">Quedan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientosFinca.map((m, i) => (
                        <TableRow key={`${m.fecha}-${i}`}>
                          <TableCell className="py-2 text-sm">{fmt(m.fecha)}</TableCell>
                          <TableCell className="py-2 text-sm">
                            <span className="font-medium text-gray-800">{m.concepto}</span>
                            {m.detalle && <span className="block text-[0.6875rem] text-gray-500">{m.detalle}</span>}
                          </TableCell>
                          <TableCell className="py-2 text-right text-sm font-medium text-green-700">
                            {m.entran > 0 ? `+${m.entran.toLocaleString('es-CO', { maximumFractionDigits: 2 })}` : '—'}
                          </TableCell>
                          <TableCell className="py-2 text-right text-sm font-medium text-orange-700">
                            {m.salen > 0 ? `−${m.salen.toLocaleString('es-CO', { maximumFractionDigits: 2 })}` : '—'}
                          </TableCell>
                          <TableCell className={`py-2 text-right text-sm font-semibold ${m.saldo < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                            {m.saldo.toLocaleString('es-CO', { maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="-mt-1 text-xs text-gray-400">
            El stock se calcula solo: bultos que entraron menos lo que se consumió día a día, según lo registrado en cada galpón.
          </p>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Entradas de alimento</CardTitle>
              <p className="text-xs text-gray-400">
                El alimento llega a la finca: de una entrada pueden comer varios galpones. Cada entrada queda como costo en Finanzas.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {entradasFiltradas.length === 0 ? (
                <p className="text-sm text-gray-400 p-4">Sin entradas registradas. Usa &quot;+ Registrar entrada&quot; arriba.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Alimento</TableHead>
                        <TableHead className="text-right">Bultos</TableHead>
                        {puedeVerCostos && <TableHead className="text-right">Precio por bulto</TableHead>}
                        {puedeVerCostos && <TableHead className="text-right">Costo</TableHead>}
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entradasFiltradas.map(e => {
                        const tipoEntrada = tipos.find(x => x.id === e.tipo_alimento_id)
                        const precio = e.precio_bulto ?? tipoEntrada?.precio_bulto ?? 0
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-sm">{fmt(e.fecha)}</TableCell>
                            <TableCell className="text-sm text-gray-600">{tipoEntrada?.nombre ?? '—'}</TableCell>
                            <TableCell className="text-right text-sm">{Number(e.cantidad_bultos).toLocaleString('es-CO')}</TableCell>
                            {puedeVerCostos && (
                              <TableCell className="text-right text-sm">
                                {precio > 0 ? cop(precio) : '—'}
                                {e.precio_bulto == null && precio > 0 && (
                                  <span className="block text-[11px] text-gray-400">del catálogo</span>
                                )}
                              </TableCell>
                            )}
                            {puedeVerCostos && (
                              <TableCell className="text-right text-sm font-medium">
                                {precio > 0 ? cop(Number(e.cantidad_bultos) * precio) : '—'}
                              </TableCell>
                            )}
                            <TableCell className="text-sm text-gray-500">{e.proveedor ?? '—'}</TableCell>
                            <TableCell className="text-sm text-gray-500">{e.fecha_vencimiento ? fmt(e.fecha_vencimiento) : '—'}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500"
                                  onClick={() => { setEntradaEditar(e); setModalEntrada(true) }}
                                >
                                  <Ic n="editar" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className={confirmandoEliminar === e.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                  onClick={() => eliminarEntrada(e)}
                                >
                                  {confirmandoEliminar === e.id ? '¿Confirmar?' : <Ic n="borrar" />}
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
        </>
      )}

      {subTab === 'balance' && (
        <>
          {!hoy && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              <Ic n="alerta" /> Este lote no tiene registro de producción reciente. Los cálculos usan las aves activas del lote pero no hay consumo de alimento registrado.
            </div>
          )}

          {/* Aquí solo importa qué alimento está comiendo el galpón */}
          <div className="superficie flex items-center gap-3 rounded-2xl px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <Ic n="alimento" className="size-[18px]" />
            </span>
            <div>
              <p className="text-xs font-medium text-gray-500">Alimento activo</p>
              <p className="text-base font-semibold text-gray-900">{tipoActual?.nombre ?? 'Sin alimento registrado'}</p>
            </div>
          </div>

          {/* Balance nutricional */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Balance Nutricional del Día</CardTitle>
              <p className="text-xs text-gray-400">
                <strong>Requerimiento</strong> = lo que el ave necesita (mantenimiento + producción según % de postura).{' '}
                <strong>Consumo registrado</strong> = lo que realmente comió, calculado del alimento consumido × su composición.
              </p>
              {requerimientos ? (
                <p className="text-xs text-gray-400">Requerimiento vigente desde {fmt(requerimientos.vigente_desde)}</p>
              ) : (
                <p className="text-xs text-amber-600">Usando valores por defecto — configúralos en &quot; Requerimientos&quot;</p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nutriente</TableHead>
                      <TableHead className="text-right">Requerimiento de mantenimiento</TableHead>
                      <TableHead className="text-right">Requerimiento de producción</TableHead>
                      <TableHead className="text-right">Requerimiento total</TableHead>
                      <TableHead className="text-right">Consumo registrado</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {NUTRIENTES.map(n => {
                      const mant = req[n.mantKey]
                      const prod = req[n.prodKey] * posturaFraccion
                      const total = mant + prod
                      const pctAlimento = tipoActual?.[n.pctKey] ?? null
                      const consumoGalpon = pctAlimento != null ? alimentoKgHoy * 1000 * (pctAlimento / 100) : null
                      const consumoAve = consumoGalpon != null && avesEnDia > 0 ? consumoGalpon / avesEnDia : null
                      const diferencia = consumoAve != null ? consumoAve - total : null
                      const bien = diferencia != null && diferencia >= 0
                      const sinDatos = diferencia == null

                      return (
                        <TableRow key={n.key}>
                          <TableCell className="font-medium text-sm">{n.label}</TableCell>
                          <TableCell className="text-right text-sm text-gray-600">{mant.toFixed(2)} g</TableCell>
                          <TableCell className="text-right text-sm text-gray-600">{prod.toFixed(2)} g</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-gray-800">{total.toFixed(2)} g/ave</TableCell>
                          <TableCell className="text-right text-sm">{consumoAve != null ? `${consumoAve.toFixed(2)} g/ave` : '—'}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${sinDatos ? 'text-gray-400' : bien ? 'text-green-700' : 'text-red-700'}`}>
                            {diferencia != null ? `${diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)} g/ave` : '—'}
                          </TableCell>
                          <TableCell>
                            {sinDatos ? (
                              <Badge variant="outline" className="text-[10px]">Sin datos</Badge>
                            ) : bien ? (
                              <Badge className="bg-green-100 text-green-700 text-[10px]"><Ic n="check" /> Suficiente</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 text-[10px]"><Ic n="alerta" /> Insuficiente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </>
      )}

      {lote && (
        <>
          <CrearTipoAlimentoModal
            open={modalTipo}
            onClose={() => { setModalTipo(false); setTipoEditar(null) }}
            fincaId={lote.finca_id}
            tipoExistente={tipoEditar}
            onCreated={fetchAll}
          />
          <EditarRequerimientosModal
            open={modalRequerimientos}
            onClose={() => setModalRequerimientos(false)}
            loteId={lote.id}
            fincaId={lote.finca_id}
            actual={requerimientos}
            historial={requerimientosHistorial}
            fechaInicioPostura={lote.fecha_inicio_postura}
            onUpdated={fetchAll}
          />
          <RegistrarEntradaAlimentoModal
            open={modalEntrada}
            onClose={() => { setModalEntrada(false); setEntradaEditar(null) }}
            loteId={null}
            fincaId={lote.finca_id}
            tiposAlimento={tiposActivos}
            entradaExistente={entradaEditar}
            onCreated={fetchAll}
          />
          <RegistrarConsumoAlimentoModal
            open={modalConsumo}
            onClose={() => { setModalConsumo(false); setConsumoEditar(null) }}
            loteId={lote.id}
            fincaId={lote.finca_id}
            tiposAlimento={tiposActivos}
            consumoExistente={consumoEditar}
            requerimientos={requerimientos}
            enPostura={lote.estado === 'activo'}
            avesActuales={lote.aves_actuales}
            posturaFraccion={posturaFraccion}
            consumoActualKg={alimentoActivo?.consumo_activo_kg}
            onCreated={() => {
              // Desde el galpón, el galpón se refresca solo (ya puede registrar días);
              // desde el general, se ofrece volver a él
              if (!enGalpon && !consumoEditar && alimentoActivo?.consumo_activo_kg == null) setOfrecerVolver(true)
              fetchAll()
              onLoteCambiado?.()
            }}
          />
        </>
      )}

      <Dialog open={ofrecerVolver} onOpenChange={setOfrecerVolver}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>El galpón ya tiene alimento</DialogTitle>
            <p className="text-sm text-gray-500">
              {lote?.nombre} ya tiene alimento y consumo registrados. Ya puedes volver al galpón a
              configurarlo y registrar sus días.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfrecerVolver(false)}>Seguir en Alimento</Button>
            <Button onClick={() => { setOfrecerVolver(false); router.push(`/aves-ponedoras?lote=${lote?.id}`) }}>
              <Ic n="gallina" /> Volver a configurar el galpón
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
