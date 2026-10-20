'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { Widget, Cuadricula, ANCHO, AccionWidget, Pildora } from '@/components/ui/widgets/Widget'
import { Anillo, BarraMeta, Cifra, MiniBarras, TextoEstado } from '@/components/ui/widgets/Medidores'
import { CalendarioMes } from '@/components/ui/widgets/Calendario'
import { BandejaAlertas, type AlertaBandeja } from '@/components/ui/widgets/Alertas'
import { CurvaArea } from '@/components/ui/widgets/Curva'
import { pesosCompacto } from '@/components/ui/graficos/paleta'
import RadarGalpones from '@/components/agro/aves/resumen/RadarGalpones'
import { aFechaLocal, hoyLocal } from '@/lib/fechas'
import { semanaDelLote } from '@/lib/postura'
import { cargarFinanzasFinca } from '@/lib/finanzas'
import { recalcularStockAlimentoAves, leerStockAlimentoAves, type StockAlimentoAves } from '@/lib/inventario'
import { ESPECIES_FINCA, nombreSeccion, type EspecieFinca } from '@/lib/especies'
import { usoCorralLabel } from '@/lib/instalaciones'
import type { Database } from '@/types/database'

type Finca = Pick<Database['public']['Tables']['fincas']['Row'], 'id' | 'nombre' | 'municipio' | 'departamento' | 'area_valor' | 'area_unidad' | 'tipo_produccion'>
type Instalacion = Database['public']['Tables']['instalaciones']['Row']
type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']

interface DiaFinca { fecha: string; lote: string; huevos: number; aves: number | null; muertes: number; alimentoKg: number }

export interface DatosInicio {
  instalaciones: Instalacion[]
  aves: LoteAves[]
  cerdos: LoteCerdos[]
  pollos: LotePollo[]
  dias: DiaFinca[]
  stock: StockAlimentoAves[]
  dinero: { fecha: string; ingreso: number; costo: number; especie: EspecieFinca }[]
  inventario: { total: number; bajos: number }
  vacioSanitario: Record<string, string>
}

type Periodo = 'mes' | 'anterior' | 'anio' | 'todo'
const PERIODOS: { id: Periodo; t: string }[] = [
  { id: 'mes', t: 'Este mes' }, { id: 'anterior', t: 'Mes pasado' }, { id: 'anio', t: 'Este año' }, { id: 'todo', t: 'Todo' },
]

const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const etiquetaDia = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const restar = (f: string, n: number) => aFechaLocal(new Date(new Date(f + 'T00:00:00').getTime() - n * 86_400_000))

/**
 * El inicio de la finca como un tablero: alertas arriba, los cuatro números
 * del día, la producción del mes, el dinero, cada galpón o corral con su
 * estado, el alimento en bodega, el perfil frente a la guía y el calendario.
 */
export default function TableroInicio<F extends Finca>({ finca, fincas, onEditarFinca, onEditarOtra }: {
  finca: F
  fincas: F[]
  onEditarFinca: () => void
  onEditarOtra: (f: F) => void
}) {
  const [datos, setDatos] = useState<{ fincaId: string; d: DatosInicio } | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const especies = (finca.tipo_produccion ?? []) as EspecieFinca[]
  const hayAves = especies.includes('aves_ponedoras')
  const hoy = hoyLocal()

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    const desde = restar(hoy, 59)
    ;(async () => {
      if (hayAves) await recalcularStockAlimentoAves(supabase, finca.id)
      const [inst, aves, cerdos, pollos, prodAves, nutCerdos, mortCerdos, prodPollo, stock, fin, inv, cerrados] = await Promise.all([
        supabase.from('instalaciones').select('*').eq('finca_id', finca.id),
        especies.includes('aves_ponedoras') ? supabase.from('lotes_aves').select('*').eq('finca_id', finca.id).in('estado', ['activo', 'preparacion']) : Promise.resolve({ data: [] as LoteAves[] }),
        especies.includes('cerdos') ? supabase.from('lotes_cerdos').select('*').eq('finca_id', finca.id).eq('estado', 'activo') : Promise.resolve({ data: [] as LoteCerdos[] }),
        especies.includes('pollo_engorde') ? supabase.from('lotes_pollo').select('*').eq('finca_id', finca.id).eq('estado', 'activo') : Promise.resolve({ data: [] as LotePollo[] }),
        especies.includes('aves_ponedoras') ? supabase.from('produccion_diaria_aves').select('lote_id, fecha, huevos_totales, aves_en_dia, muertes, alimento_kg').eq('finca_id', finca.id).gte('fecha', desde) : Promise.resolve({ data: [] }),
        especies.includes('cerdos') ? supabase.from('nutricion_diaria_cerdos').select('lote_id, fecha, alimento_kg').eq('finca_id', finca.id).gte('fecha', desde) : Promise.resolve({ data: [] }),
        especies.includes('cerdos') ? supabase.from('mortalidad_cerdos').select('lote_id, fecha, cantidad').eq('finca_id', finca.id).gte('fecha', desde) : Promise.resolve({ data: [] }),
        especies.includes('pollo_engorde') ? supabase.from('produccion_diaria_pollo').select('lote_id, fecha, alimento_kg, muertes').eq('finca_id', finca.id).gte('fecha', desde) : Promise.resolve({ data: [] }),
        hayAves ? leerStockAlimentoAves(supabase, finca.id) : Promise.resolve([] as StockAlimentoAves[]),
        especies.length > 0 ? cargarFinanzasFinca(supabase, finca.id, especies) : Promise.resolve({ costos: [], ingresos: [], lotes: [] }),
        supabase.from('inventario').select('cantidad_actual, cantidad_minima').eq('finca_id', finca.id),
        hayAves ? supabase.from('lotes_aves').select('instalacion_id, vacio_sanitario_hasta').eq('finca_id', finca.id).in('estado', ['vendido', 'finalizado']).gt('vacio_sanitario_hasta', hoy) : Promise.resolve({ data: [] as { instalacion_id: string | null; vacio_sanitario_hasta: string | null }[] }),
      ])
      if (!vigente) return
      const dias: DiaFinca[] = [
        ...((prodAves.data ?? []) as { lote_id: string; fecha: string; huevos_totales: number; aves_en_dia: number | null; muertes: number; alimento_kg: number }[])
          .map(p => ({ fecha: p.fecha, lote: p.lote_id, huevos: p.huevos_totales, aves: p.aves_en_dia, muertes: p.muertes ?? 0, alimentoKg: Number(p.alimento_kg ?? 0) })),
        ...((nutCerdos.data ?? []) as { lote_id: string; fecha: string; alimento_kg: number }[]).map(n => ({ fecha: n.fecha, lote: n.lote_id, huevos: 0, aves: null, muertes: 0, alimentoKg: Number(n.alimento_kg ?? 0) })),
        ...((mortCerdos.data ?? []) as { lote_id: string; fecha: string; cantidad: number }[]).map(m => ({ fecha: m.fecha, lote: m.lote_id, huevos: 0, aves: null, muertes: m.cantidad ?? 0, alimentoKg: 0 })),
        ...((prodPollo.data ?? []) as { lote_id: string; fecha: string; alimento_kg: number; muertes: number }[]).map(p => ({ fecha: p.fecha, lote: p.lote_id, huevos: 0, aves: null, muertes: p.muertes ?? 0, alimentoKg: Number(p.alimento_kg ?? 0) })),
      ]
      const vacio: Record<string, string> = {}
      for (const c of cerrados.data ?? []) {
        if (c.instalacion_id && c.vacio_sanitario_hasta && (!vacio[c.instalacion_id] || vacio[c.instalacion_id] < c.vacio_sanitario_hasta)) vacio[c.instalacion_id] = c.vacio_sanitario_hasta
      }
      setDatos({
        fincaId: finca.id,
        d: {
          instalaciones: (inst.data ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
          aves: (aves.data ?? []) as LoteAves[], cerdos: (cerdos.data ?? []) as LoteCerdos[], pollos: (pollos.data ?? []) as LotePollo[],
          dias, stock,
          dinero: [
            ...fin.ingresos.map(i => ({ fecha: i.fecha, ingreso: i.monto, costo: 0, especie: i.especie })),
            ...fin.costos.map(c => ({ fecha: c.fecha, ingreso: 0, costo: Number(c.monto), especie: c.especie })),
          ],
          inventario: { total: (inv.data ?? []).length, bajos: (inv.data ?? []).filter(i => Number(i.cantidad_minima) > 0 && Number(i.cantidad_actual) <= Number(i.cantidad_minima)).length },
          vacioSanitario: vacio,
        },
      })
    })()
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca.id, especies.join(',')])

  const d = datos?.fincaId === finca.id ? datos.d : null

  return (
    <div className="space-y-5">
      {/* Encabezado: la finca y sus datos en píldoras */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(finca.municipio || finca.departamento) && <Pildora icono="ubicacion">{[finca.municipio, finca.departamento].filter(Boolean).join(', ')}</Pildora>}
          {finca.area_valor != null && <Pildora>{Number(finca.area_valor).toLocaleString('es-CO')} {finca.area_unidad === 'ha' ? 'ha' : finca.area_unidad === 'm2' ? 'm²' : finca.area_unidad}</Pildora>}
          {ESPECIES_FINCA.filter(e => especies.includes(e.value)).map(e => (
            <Pildora key={e.value} tono="verde" icono={e.icon}>{e.labelNav ?? e.label}</Pildora>
          ))}
        </div>
        <button onClick={onEditarFinca} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-gray-500 transition-colors hover:bg-white hover:text-gray-800">
          <Ic n="ajustes" /> Datos de la finca
        </button>
      </div>

      {!d ? <EsqueletoInicio /> : <ContenidoInicio d={d} finca={finca} fincas={fincas} especies={especies} periodo={periodo} setPeriodo={setPeriodo} onEditarFinca={onEditarFinca} onEditarOtra={f => onEditarOtra(f as F)} />}
    </div>
  )
}

export function ContenidoInicio({ d, finca, fincas, especies, periodo, setPeriodo, onEditarFinca, onEditarOtra }: {
  d: DatosInicio; finca: Finca; fincas: Finca[]; especies: EspecieFinca[]; periodo: Periodo; setPeriodo: (p: Periodo) => void
  onEditarFinca: () => void; onEditarOtra: (f: Finca) => void
}) {
  const hoy = hoyLocal()
  const ayer = restar(hoy, 1)
  const hayAves = especies.includes('aves_ponedoras')
  const lugarPlural = hayAves ? 'galpones' : especies.includes('cerdos') ? 'corrales' : 'galpones'

  // ── Animales y lugares ──
  const animales = d.aves.reduce((s, l) => s + l.aves_actuales, 0) + d.cerdos.reduce((s, l) => s + l.animales_actuales, 0) + d.pollos.reduce((s, l) => s + l.pollos_actuales, 0)
  const ocupadas = new Set([...d.aves, ...d.cerdos].map(l => l.instalacion_id).filter(Boolean))
  const lugares = d.instalaciones.length

  // ── Producción de huevo ──
  const delDia = (f: string) => d.dias.filter(x => x.fecha === f)
  const huevosDe = (f: string) => delDia(f).reduce((s, x) => s + x.huevos, 0)
  const huevosHoy = huevosDe(hoy)
  const huevosAyer = huevosDe(ayer)
  const conAvesHoy = delDia(hoy).filter(x => x.aves)
  const posturaHoy = conAvesHoy.length ? (conAvesHoy.reduce((s, x) => s + x.huevos, 0) / conAvesHoy.reduce((s, x) => s + (x.aves ?? 0), 0)) * 100 : null
  const metas = d.aves.filter(l => l.estado === 'activo' && l.meta_postura_pct != null).map(l => Number(l.meta_postura_pct))
  const metaPostura = metas.length ? metas.reduce((a, b) => a + b, 0) / metas.length : null
  const activos = d.aves.filter(l => l.estado === 'activo').length
  // Hoy solo cuenta cuando todos los galpones en postura ya registraron: si no, parecería una caída
  const hoyCompleto = conAvesHoy.length >= activos
  const ultimos30 = Array.from({ length: 30 }, (_, i) => restar(hoy, 29 - i)).filter(f => f !== hoy || hoyCompleto)
  const ultimos14 = ultimos30.slice(-14)
  const serieHuevos = ultimos30.map(f => {
    const xs = delDia(f)
    return { x: etiquetaDia(f), y: xs.length ? xs.reduce((s, x) => s + x.huevos, 0) : null }
  })
  const serieAlimento = ultimos30.map(f => {
    const xs = delDia(f)
    return { x: etiquetaDia(f), y: xs.length ? Math.round(xs.reduce((s, x) => s + x.alimentoKg, 0) * 10) / 10 : null }
  })
  const muertes7 = d.dias.filter(x => x.fecha > restar(hoy, 7)).reduce((s, x) => s + x.muertes, 0)
  const muertes7Ant = d.dias.filter(x => x.fecha > restar(hoy, 14) && x.fecha <= restar(hoy, 7)).reduce((s, x) => s + x.muertes, 0)

  // ── Dinero ──
  const enPeriodo = (f: string) => {
    if (periodo === 'todo') return true
    if (periodo === 'anio') return f.slice(0, 4) === hoy.slice(0, 4)
    const mes = periodo === 'mes' ? hoy.slice(0, 7) : aFechaLocal(new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 2, 1)).slice(0, 7)
    return f.slice(0, 7) === mes
  }
  const movs = d.dinero.filter(m => enPeriodo(m.fecha))
  const ingresos = movs.reduce((s, m) => s + m.ingreso, 0)
  const costos = movs.reduce((s, m) => s + m.costo, 0)
  const utilidad = ingresos - costos
  const meses = Array.from({ length: 6 }, (_, i) => aFechaLocal(new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 6 + i, 1)).slice(0, 7))
  const utilidadMes = meses.map(m => d.dinero.filter(x => x.fecha.startsWith(m)).reduce((s, x) => s + x.ingreso - x.costo, 0))
  const mesActual = d.dinero.filter(x => x.fecha.startsWith(hoy.slice(0, 7))).reduce((s, x) => s + x.ingreso - x.costo, 0)

  // ── Alimento en bodega por galpón ──
  const stockPorTipo = new Map(d.stock.map(s => [s.tipo_alimento_id, s]))
  const bodega = d.aves.map(l => {
    const s = l.alimento_activo_id ? stockPorTipo.get(l.alimento_activo_id) ?? null : null
    const consumo = Number(l.consumo_activo_kg ?? 0)
    const diasAlcanza = s && consumo > 0 && s.bultos_disponibles > 0 ? Math.floor((s.bultos_disponibles * s.peso_bulto_kg) / consumo) : s && consumo > 0 ? 0 : null
    return { lote: l, s, consumo, diasAlcanza }
  })

  // ── Alertas de la finca ──
  const alertas: AlertaBandeja[] = [
    ...bodega.filter(b => b.diasAlcanza != null && b.diasAlcanza <= 7).map(b => ({
      id: `bodega-${b.lote.id}`, nivel: (b.diasAlcanza! <= 3 ? 'urgente' : 'revisar') as AlertaBandeja['nivel'],
      texto: `${b.lote.nombre}: el alimento en bodega alcanza para ${b.diasAlcanza} día${b.diasAlcanza === 1 ? '' : 's'}`,
      accion: { texto: 'Ver alimento', href: '/alimento' },
    })),
    ...bodega.filter(b => !b.s).map(b => ({
      id: `sin-alim-${b.lote.id}`, nivel: 'revisar' as const, texto: `${b.lote.nombre}: sin alimento registrado`,
      accion: { texto: 'Registrar', href: `/aves-ponedoras?lote=${b.lote.id}` },
    })),
    ...d.aves.filter(l => !d.dias.some(x => x.lote === l.id && x.fecha === hoy)).map(l => ({
      id: `hoy-${l.id}`, nivel: 'info' as const, texto: `${l.nombre}: falta registrar el día de hoy`,
      accion: { texto: 'Registrar', href: `/aves-ponedoras?lote=${l.id}` },
    })),
    ...(d.inventario.bajos > 0 ? [{
      id: 'inventario', nivel: 'revisar' as const, texto: `${d.inventario.bajos} producto${d.inventario.bajos === 1 ? '' : 's'} del inventario bajo el mínimo`,
      accion: { texto: 'Ver inventario', href: '/inventario' },
    }] : []),
  ]

  const valoresCalendario = new Map<string, number>()
  for (const x of d.dias) valoresCalendario.set(x.fecha, (valoresCalendario.get(x.fecha) ?? 0) + (hayAves ? x.huevos : x.alimentoKg) + (hayAves ? 0 : 0))
  const guia = [
    { t: 'Crea tu finca', hecho: fincas.length > 0 },
    { t: `Registra tus ${lugarPlural}`, hecho: lugares > 0 },
    { t: 'Registra tus animales', hecho: animales > 0 },
    { t: 'Agrega inventario', hecho: d.inventario.total > 0 },
    { t: 'Registra la producción del día', hecho: d.dias.length > 0 },
  ]
  const pasosHechos = guia.filter(g => g.hecho).length
  // El radar solo se dibuja si algún galpón tiene guía de su línea y fecha de nacimiento
  const conRadar = d.aves.some(l => l.referencia_id && l.fecha_nacimiento)
  const anchoPequeno = conRadar ? ANCHO.cuarto : hayAves ? ANCHO.mitad : ANCHO.tercio

  return (
    <>
      <BandejaAlertas titulo="Pendientes de la finca" alertas={alertas} />

      <Cuadricula>
        <Widget className={ANCHO.cuarto} titulo="Animales en la finca" icono="ganado">
          <div className="flex items-center gap-4">
            <Anillo pct={lugares ? (ocupadas.size / lugares) * 100 : null} centro={animales.toLocaleString('es-CO')} sub={hayAves ? 'aves' : 'animales'} />
            <div className="min-w-0 space-y-1.5">
              <Cifra etiqueta={`${lugarPlural[0].toUpperCase()}${lugarPlural.slice(1)} ocupados`} valor={`${ocupadas.size} de ${lugares}`} />
              <p className="text-[0.6875rem] text-gray-400">{lugares - ocupadas.size} vacío{lugares - ocupadas.size === 1 ? '' : 's'}</p>
            </div>
          </div>
        </Widget>

        {hayAves ? (
          <Widget className={ANCHO.cuarto} titulo="Huevos hoy" icono="huevo">
            <Cifra etiqueta={`${conAvesHoy.length} de ${activos} galpones registrados`} grande
              valor={huevosHoy > 0 ? huevosHoy.toLocaleString('es-CO') : '—'}
              cambio={hoyCompleto && huevosHoy > 0 && huevosAyer > 0 ? { texto: `${huevosHoy >= huevosAyer ? '↑' : '↓'} ${n1(Math.abs((huevosHoy - huevosAyer) / huevosAyer) * 100)} %`, bueno: huevosHoy >= huevosAyer } : null}
              nota={!hoyCompleto ? `faltan ${activos - conAvesHoy.length} por registrar` : huevosAyer > 0 ? 'vs ayer' : undefined} />
            <div className="mt-3"><MiniBarras valores={ultimos14.map(f => { const xs = delDia(f); return xs.length ? xs.reduce((s, x) => s + x.huevos, 0) : null })} etiquetas={ultimos14.map(etiquetaDia)} alto={36} /></div>
          </Widget>
        ) : (
          <Widget className={ANCHO.cuarto} titulo="Alimento hoy" icono="alimento">
            <Cifra etiqueta="Kilos registrados hoy" valor={`${n1(delDia(hoy).reduce((s, x) => s + x.alimentoKg, 0))} kg`} grande />
            <div className="mt-3"><MiniBarras valores={ultimos14.map(f => { const xs = delDia(f); return xs.length ? xs.reduce((s, x) => s + x.alimentoKg, 0) : null })} etiquetas={ultimos14.map(etiquetaDia)} alto={36} formato={v => `${n1(v)} kg`} /></div>
          </Widget>
        )}

        {hayAves ? (
          <Widget className={ANCHO.cuarto} titulo="Postura de hoy" icono="tendencia" info="Huevos ÷ aves de los galpones que ya registraron hoy. La rayita es la meta promedio">
            <div className="flex items-center gap-4">
              <Anillo pct={posturaHoy} centro={posturaHoy != null ? `${n1(posturaHoy)} %` : '—'} sub={metaPostura != null ? `meta ${n1(metaPostura)} %` : 'postura'} marca={metaPostura}
                estado={posturaHoy == null || metaPostura == null ? 'normal' : posturaHoy >= metaPostura ? 'bien' : posturaHoy >= metaPostura - 5 ? 'revisar' : 'mal'} />
              <div className="min-w-0 space-y-1.5">
                {posturaHoy != null && metaPostura != null
                  ? <TextoEstado estado={posturaHoy >= metaPostura ? 'bien' : 'revisar'}>{posturaHoy >= metaPostura ? 'En la meta' : `${n1(metaPostura - posturaHoy)} pts bajo la meta`}</TextoEstado>
                  : <p className="text-[0.6875rem] text-gray-400">{posturaHoy == null ? 'Sin registros de hoy' : 'Sin metas definidas'}</p>}
                <p className="text-[0.6875rem] text-gray-400">{muertes7.toLocaleString('es-CO')} muertes en 7 días</p>
              </div>
            </div>
          </Widget>
        ) : (
          <Widget className={ANCHO.cuarto} titulo="Mortalidad" icono="muerte">
            <Cifra etiqueta="Últimos 7 días" valor={muertes7.toLocaleString('es-CO')} grande
              cambio={muertes7Ant > 0 ? { texto: `${muertes7 <= muertes7Ant ? '↓' : '↑'} ${n1(Math.abs((muertes7 - muertes7Ant) / muertes7Ant) * 100)} %`, bueno: muertes7 <= muertes7Ant } : null}
              nota={muertes7Ant > 0 ? 'vs semana anterior' : undefined} />
          </Widget>
        )}

        <Widget className={ANCHO.cuarto} titulo="Utilidad del mes" icono="dinero" accion={<AccionWidget href="/finanzas">Finanzas</AccionWidget>}>
          <Cifra etiqueta={new Date(hoy + 'T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })} grande
            valor={<span className={mesActual < 0 ? 'text-red-600' : undefined}>{pesosCompacto(mesActual)}</span>}
            cambio={utilidadMes[4] !== 0 ? { texto: `${mesActual >= utilidadMes[4] ? '↑' : '↓'} vs mes pasado`, bueno: mesActual >= utilidadMes[4] } : null} />
          <div className="mt-3"><MiniBarras valores={utilidadMes.map(v => Math.max(0, v))} etiquetas={meses.map(m => new Date(m + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'short' }))} formato={pesosCompacto} alto={36} /></div>
        </Widget>

        <Widget className={ANCHO.dosTercios} titulo={hayAves ? 'Huevos por día' : 'Alimento por día'} icono="grafica" accion={<AccionWidget href="/reportes">Reportes</AccionWidget>}>
          <CurvaArea id="inicio-30" nombre={hayAves ? 'Huevos' : 'Alimento'} datos={hayAves ? serieHuevos : serieAlimento}
            formato={hayAves ? undefined : v => `${n1(v)} kg`} barras={!hayAves} alto={240} />
          <p className="mt-1 text-[0.6875rem] text-gray-400">Últimos 30 días, toda la finca</p>
        </Widget>

        <Widget className={ANCHO.tercio} titulo="Dinero" icono="recibo">
          <div className="mb-4 inline-flex flex-wrap rounded-full bg-gray-100 p-0.5">
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)}
                className={cn('h-6 rounded-full px-2.5 text-[0.6875rem] font-medium', periodo === p.id ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>{p.t}</button>
            ))}
          </div>
          <Cifra etiqueta="Utilidad" grande valor={<span className={utilidad < 0 ? 'text-red-600' : undefined}>{pesosCompacto(utilidad)}</span>}
            nota={ingresos > 0 ? `margen ${n1((utilidad / ingresos) * 100)} %` : 'sin ingresos en el período'} />
          <div className="mt-4 space-y-3">
            <BarraMeta etiqueta="Ingresos" valor={pesosCompacto(ingresos)} pct={Math.max(ingresos, costos) > 0 ? (ingresos / Math.max(ingresos, costos)) * 100 : null} />
            <BarraMeta etiqueta="Costos" valor={pesosCompacto(costos)} pct={Math.max(ingresos, costos) > 0 ? (costos / Math.max(ingresos, costos)) * 100 : null} estado={costos > ingresos ? 'mal' : 'suave'} />
          </div>
          {especies.length > 1 && (
            <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3">
              {especies.map(e => {
                const m = movs.filter(x => x.especie === e)
                const u = m.reduce((s, x) => s + x.ingreso - x.costo, 0)
                return (
                  <p key={e} className="flex justify-between text-xs">
                    <span className="text-gray-500">{nombreSeccion(e, especies)}</span>
                    <span className={cn('font-semibold tabular-nums', u < 0 ? 'text-red-600' : 'text-gray-900')}>{pesosCompacto(u)}</span>
                  </p>
                )
              })}
            </div>
          )}
        </Widget>

        <Widget className={hayAves ? ANCHO.dosTercios : ANCHO.todo} titulo={`Tus ${lugarPlural}`} icono={hayAves ? 'gallina' : 'cerdo'} accion={<AccionWidget onClick={onEditarFinca}>Configurar</AccionWidget>}>
          {lugares === 0 && d.aves.length + d.cerdos.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">La finca no tiene {lugarPlural}. <button onClick={onEditarFinca} className="font-medium text-green-700 hover:underline">Registrarlos</button></p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2.5">
              {d.instalaciones.filter(i => i.especie === (hayAves ? 'aves_ponedoras' : especies[0])).map(g => {
                const l = d.aves.find(x => x.instalacion_id === g.id)
                const c = d.cerdos.find(x => x.instalacion_id === g.id)
                const area = Number(g.area_m2 ?? 0)
                if (l) {
                  const h = delDia(hoy).find(x => x.lote === l.id)
                  const post = h && h.aves ? (h.huevos / h.aves) * 100 : null
                  const sem = semanaDelLote(l, hoy)
                  return (
                    <Link key={g.id} href={`/aves-ponedoras?lote=${l.id}`} className="flex items-center gap-3 rounded-xl bg-gray-50/80 p-3 ring-1 ring-black/5 transition-colors hover:bg-green-50/60">
                      <Anillo pct={l.estado === 'activo' ? post : null} centro={l.estado === 'activo' ? (post != null ? `${Math.round(post)}%` : '—') : `S${sem?.semana ?? '—'}`} tamano={52} grosor={6} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-gray-800">{g.nombre}</span>
                        <span className="block truncate text-[0.6875rem] text-gray-500">{l.aves_actuales.toLocaleString('es-CO')} aves · {l.estado === 'activo' ? 'postura' : 'levante'}</span>
                        <span className="block truncate text-[0.6875rem] text-gray-400">{sem ? `Semana ${sem.semana} de ${sem.etapa}` : ''}{area > 0 ? ` · ${n1(l.aves_actuales / area)}/m²` : ''}</span>
                      </span>
                    </Link>
                  )
                }
                if (c) {
                  return (
                    <Link key={g.id} href={`/cerdos?lote=${c.id}`} className="flex items-center gap-3 rounded-xl bg-gray-50/80 p-3 ring-1 ring-black/5 transition-colors hover:bg-green-50/60">
                      <Anillo pct={c.numero_animales > 0 ? (c.animales_actuales / c.numero_animales) * 100 : null} centro={c.animales_actuales.toLocaleString('es-CO')} tamano={52} grosor={6} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-gray-800">{g.nombre}</span>
                        <span className="block truncate text-[0.6875rem] text-gray-500">{usoCorralLabel(g.uso) ?? 'Corral'} · {c.sistema === 'cria' ? 'hembras' : 'cerdos'}</span>
                        <span className="block truncate text-[0.6875rem] text-gray-400">{c.nombre}</span>
                      </span>
                    </Link>
                  )
                }
                const hasta = d.vacioSanitario[g.id]
                return (
                  <Link key={g.id} href={hayAves ? '/aves-ponedoras' : '/cerdos'}
                    className={cn('flex items-center gap-3 rounded-xl border border-dashed p-3 transition-colors', hasta ? 'border-amber-300 bg-amber-50/50' : 'border-gray-300 hover:border-green-500')}>
                    <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"><Ic n={hasta ? 'desinfeccion' : 'mas'} className="size-5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-700">{g.nombre}</span>
                      <span className={cn('block truncate text-[0.6875rem]', hasta ? 'text-amber-700' : 'text-green-700')}>
                        {hasta ? `Limpieza hasta ${etiquetaDia(hasta)}` : 'Vacío · agregar animales'}
                      </span>
                    </span>
                  </Link>
                )
              })}
              {/* Lotes que no quedaron en un galpón o corral, para no perderlos */}
              {[...d.aves.filter(l => !l.instalacion_id), ...d.cerdos.filter(l => !l.instalacion_id)].map(l => (
                <Link key={l.id} href={'aves_actuales' in l ? `/aves-ponedoras?lote=${l.id}` : `/cerdos?lote=${l.id}`}
                  className="flex items-center gap-3 rounded-xl bg-gray-50/80 p-3 ring-1 ring-black/5 hover:bg-green-50/60">
                  <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700"><Ic n={'aves_actuales' in l ? 'gallina' : 'cerdo'} className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-800">{l.nombre}</span>
                    <span className="block truncate text-[0.6875rem] text-gray-500">{('aves_actuales' in l ? l.aves_actuales : l.animales_actuales).toLocaleString('es-CO')} animales · sin {hayAves ? 'galpón' : 'corral'}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Widget>

        {hayAves && (
          <Widget className={ANCHO.tercio} titulo="Alimento en bodega" icono="alimento" accion={<AccionWidget href="/alimento">Ver</AccionWidget>} info="Para cuántos días alcanza lo que queda del alimento que come cada galpón">
            {bodega.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Sin galpones con aves</p> : (
              <div className="space-y-4">
                {bodega.map(b => (
                  <BarraMeta key={b.lote.id}
                    etiqueta={<><span className="font-medium text-gray-700">{b.lote.nombre}</span>{b.s ? ` · ${b.s.nombre}` : ''}</>}
                    valor={b.s ? (b.diasAlcanza != null ? `${b.diasAlcanza} día${b.diasAlcanza === 1 ? '' : 's'}` : 'sin consumo') : 'sin alimento'}
                    pct={b.diasAlcanza != null ? Math.min(100, (b.diasAlcanza / 30) * 100) : null}
                    estado={b.diasAlcanza == null ? 'vacio' : b.diasAlcanza <= 3 ? 'mal' : b.diasAlcanza <= 7 ? 'revisar' : 'bien'}
                    nota={b.s && b.consumo > 0 ? `${n1(b.consumo)} kg al día · quedan ${n1(Math.max(0, b.s.bultos_disponibles))} bultos` : undefined} />
                ))}
              </div>
            )}
          </Widget>
        )}

        {conRadar && (
          <div className={`${ANCHO.mitad} [&>*]:h-full`}><RadarGalpones fincaId={finca.id} /></div>
        )}

        <Widget className={anchoPequeno} titulo="Registros del mes" icono="calendario" info={hayAves ? 'Días pintados según los huevos de la finca' : 'Días pintados según el alimento registrado'}>
          <CalendarioMes valores={valoresCalendario} formato={v => hayAves ? `${v.toLocaleString('es-CO')} huevos` : `${n1(v)} kg`} />
        </Widget>

        <Widget className={anchoPequeno} titulo="Inventario y fincas" icono="caja" accion={<AccionWidget href="/inventario">Inventario</AccionWidget>}>
          <div className="grid grid-cols-2 gap-3">
            <Cifra etiqueta="Productos" valor={d.inventario.total.toLocaleString('es-CO')} grande />
            <Cifra etiqueta="Bajo el mínimo" valor={<span className={d.inventario.bajos > 0 ? 'text-red-600' : undefined}>{d.inventario.bajos}</span>} grande />
          </div>
          <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3">
            <p className="text-[0.6875rem] font-semibold tracking-wide text-gray-400 uppercase">Tus fincas</p>
            {fincas.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-2 text-xs">
                <span className={cn('truncate', f.id === finca.id ? 'font-semibold text-green-800' : 'text-gray-600')}>{f.nombre}</span>
                <button onClick={() => onEditarOtra(f)} className="shrink-0 text-gray-400 hover:text-gray-700"><Ic n="ajustes" /></button>
              </div>
            ))}
          </div>
        </Widget>

        {pasosHechos < guia.length && (
          <Widget className={hayAves ? ANCHO.todo : ANCHO.tercio} titulo="Guía de inicio" icono="diario">
            <BarraMeta etiqueta={`${pasosHechos} de ${guia.length} pasos`} valor={`${Math.round((pasosHechos / guia.length) * 100)} %`} pct={(pasosHechos / guia.length) * 100} />
            <ol className="mt-3 flex flex-wrap gap-2">
              {guia.map((g, i) => (
                <li key={g.t} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs', g.hecho ? 'bg-green-50 text-green-800 line-through decoration-green-800/40' : 'bg-gray-100 text-gray-600')}>
                  <span className={cn('flex size-4 items-center justify-center rounded-full text-[0.625rem] font-bold', g.hecho ? 'bg-green-700 text-white' : 'bg-white text-gray-500')}>{g.hecho ? '✓' : i + 1}</span>
                  {g.t}
                </li>
              ))}
            </ol>
          </Widget>
        )}
      </Cuadricula>
    </>
  )
}

function EsqueletoInicio() {
  return (
    <div className="grid grid-cols-12 gap-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="col-span-12 h-40 rounded-2xl sm:col-span-6 xl:col-span-3" />)}
      <Skeleton className="col-span-12 h-72 rounded-2xl xl:col-span-8" />
      <Skeleton className="col-span-12 h-72 rounded-2xl xl:col-span-4" />
    </div>
  )
}
