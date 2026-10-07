import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aFechaLocal } from '@/lib/fechas'
import { categoriaInfo } from '@/lib/costos'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import { cargarFinanzasFinca, type CostoFinca, type Ingreso } from '@/lib/finanzas'

/**
 * Los datos de Reportes de toda la finca: cada galpón o corral (un lote) con lo
 * que se registró día a día, sus pesajes, sus eventos clínicos y su dinero.
 * Todo se agrupa por semana de calendario (lunes a domingo), así los galpones y
 * corrales quedan alineados en el tiempo.
 */

export interface Unidad { id: string; nombre: string; especie: EspecieFinca; activo: boolean }
export interface DiaReporte { fecha: string; lote: string; huevos: number; aves: number | null; muertes: number; alimentoKg: number; malos: number }
export interface PesoReporte { fecha: string; lote: string; peso: number }
export interface EventoReporte { fecha: string; lote: string; tipo: string; muertas: number }

export interface DatosReporte {
  especies: EspecieFinca[]
  unidades: Unidad[]
  dias: DiaReporte[]
  pesos: PesoReporte[]
  eventos: EventoReporte[]
  costos: CostoFinca[]
  ingresos: Ingreso[]
}

/** Qué se está mirando: una especie (o toda la finca) y unos galpones/corrales (o todos) */
export interface Seleccion { especie: EspecieFinca | null; lotes: Set<string> | null }

const DIA = 86_400_000
const sumarDias = (f: string, n: number) => aFechaLocal(new Date(new Date(f + 'T00:00:00').getTime() + n * DIA))
export const restarDias = (f: string, n: number) => sumarDias(f, -n)

/** Lunes de la semana de una fecha */
export function lunesDe(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return aFechaLocal(d)
}

export function semanasEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  for (let s = lunesDe(desde); s <= hasta; s = sumarDias(s, 7)) out.push(s)
  return out
}

export const etiquetaSemana = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })

/** Cómo se llama donde viven los animales de una especie, en singular */
export const lugarDe = (e: EspecieFinca | null) => (e === 'cerdos' ? 'corral' : e ? 'galpón' : 'galpón o corral')

/**
 * Carga lo de las especies pedidas desde `desde`. Con `loteId` solo trae ese
 * galpón o corral (la pestaña Estadísticas de cada uno).
 */
export async function cargarReporte(
  supabase: SupabaseClient<Database>, fincaId: string, especies: EspecieFinca[], desde: string, loteId?: string,
): Promise<DatosReporte> {
  const delLote = <T extends { eq: (c: string, v: string) => T }>(q: T) => (loteId ? q.eq('lote_id', loteId) : q)
  const tiene = (e: EspecieFinca) => especies.includes(e)
  const vacio = Promise.resolve({ data: [] as never[] })

  const [lotesAves, prodAves, evAves, lotesCerdos, nutCerdos, mortCerdos, pesoCerdos, evCerdos, lotesPollo, prodPollo, pesoPollo, evPollo, fin] = await Promise.all([
    tiene('aves_ponedoras') ? supabase.from('lotes_aves').select('id, nombre, estado').eq('finca_id', fincaId) : vacio,
    tiene('aves_ponedoras') ? delLote(supabase.from('produccion_diaria_aves')
      .select('lote_id, fecha, huevos_totales, aves_en_dia, muertes, alimento_kg, huevos_rotos, huevos_sucios, huevos_deformes')
      .eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('aves_ponedoras') ? delLote(supabase.from('eventos_clinicos_aves').select('lote_id, fecha, tipo_evento, aves_muertas, origen').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('cerdos') ? supabase.from('lotes_cerdos').select('id, nombre, estado').eq('finca_id', fincaId) : vacio,
    tiene('cerdos') ? delLote(supabase.from('nutricion_diaria_cerdos').select('lote_id, fecha, alimento_kg').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('cerdos') ? delLote(supabase.from('mortalidad_cerdos').select('lote_id, fecha, cantidad').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('cerdos') ? delLote(supabase.from('pesos_lote_cerdos').select('lote_id, fecha, peso_promedio').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('cerdos') ? delLote(supabase.from('eventos_clinicos_cerdos').select('lote_id, fecha, tipo_evento, animales_muertos').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('pollo_engorde') ? supabase.from('lotes_pollo').select('id, nombre, estado').eq('finca_id', fincaId) : vacio,
    tiene('pollo_engorde') ? delLote(supabase.from('produccion_diaria_pollo').select('lote_id, fecha, alimento_kg, muertes').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('pollo_engorde') ? delLote(supabase.from('pesos_lote_pollo').select('lote_id, fecha, peso_promedio').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('pollo_engorde') ? delLote(supabase.from('eventos_clinicos_pollo').select('lote_id, fecha, tipo_evento, aves_muertas').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    cargarFinanzasFinca(supabase, fincaId, especies),
  ])

  const unidades: Unidad[] = [
    ...(lotesAves.data ?? []).map(l => ({ id: l.id, nombre: l.nombre, especie: 'aves_ponedoras' as const, activo: l.estado !== 'finalizado' && l.estado !== 'cerrado' })),
    ...(lotesCerdos.data ?? []).map(l => ({ id: l.id, nombre: l.nombre, especie: 'cerdos' as const, activo: l.estado === 'activo' })),
    ...(lotesPollo.data ?? []).map(l => ({ id: l.id, nombre: l.nombre, especie: 'pollo_engorde' as const, activo: l.estado === 'activo' })),
  ].filter(u => !loteId || u.id === loteId)

  const dias: DiaReporte[] = [
    ...(prodAves.data ?? []).map(p => ({
      fecha: p.fecha, lote: p.lote_id, huevos: p.huevos_totales, aves: p.aves_en_dia, muertes: p.muertes ?? 0,
      alimentoKg: Number(p.alimento_kg ?? 0), malos: (p.huevos_rotos ?? 0) + (p.huevos_sucios ?? 0) + (p.huevos_deformes ?? 0),
    })),
    ...(nutCerdos.data ?? []).map(n => ({ fecha: n.fecha, lote: n.lote_id, huevos: 0, aves: null, muertes: 0, alimentoKg: Number(n.alimento_kg ?? 0), malos: 0 })),
    ...(mortCerdos.data ?? []).map(m => ({ fecha: m.fecha, lote: m.lote_id, huevos: 0, aves: null, muertes: m.cantidad ?? 0, alimentoKg: 0, malos: 0 })),
    ...(prodPollo.data ?? []).map(p => ({ fecha: p.fecha, lote: p.lote_id, huevos: 0, aves: null, muertes: p.muertes ?? 0, alimentoKg: Number(p.alimento_kg ?? 0), malos: 0 })),
  ]
  const pesos: PesoReporte[] = [
    ...(pesoCerdos.data ?? []).map(p => ({ fecha: p.fecha, lote: p.lote_id, peso: Number(p.peso_promedio) })),
    ...(pesoPollo.data ?? []).map(p => ({ fecha: p.fecha, lote: p.lote_id, peso: Number(p.peso_promedio) })),
  ]
  const eventos: EventoReporte[] = [
    // Los de origen "mortalidad" son el reflejo de las muertes del día: no se cuentan dos veces
    ...(evAves.data ?? []).map(e => ({
      fecha: e.fecha, lote: e.lote_id,
      tipo: e.origen === 'mortalidad' ? 'mortalidad' : e.tipo_evento,
      muertas: e.origen === 'mortalidad' ? 0 : e.aves_muertas ?? 0,
    })),
    ...(evCerdos.data ?? []).map(e => ({ fecha: e.fecha, lote: e.lote_id, tipo: e.tipo_evento, muertas: e.animales_muertos ?? 0 })),
    ...(evPollo.data ?? []).map(e => ({ fecha: e.fecha, lote: e.lote_id, tipo: e.tipo_evento, muertas: e.aves_muertas ?? 0 })),
  ]

  return {
    especies,
    unidades,
    dias, pesos, eventos,
    costos: fin.costos.filter(c => c.fecha >= desde && (!loteId || c.lote_id === loteId)),
    ingresos: fin.ingresos.filter(i => i.fecha >= desde && (!loteId || i.lote_id === loteId)),
  }
}

/** Ayudantes para filtrar por la selección */
function filtros(d: DatosReporte, sel: Seleccion) {
  const especieDe = new Map(d.unidades.map(u => [u.id, u.especie]))
  const enLote = (lote: string | null) => {
    if (lote == null) return false
    if (sel.especie && especieDe.get(lote) !== sel.especie) return false
    return !sel.lotes || sel.lotes.has(lote)
  }
  // Los costos e ingresos generales (sin galpón) solo entran cuando se mira todo
  const enDinero = (x: { lote_id: string | null; especie: EspecieFinca }) =>
    x.lote_id == null ? !sel.lotes && (!sel.especie || x.especie === sel.especie) : enLote(x.lote_id)
  return { enLote, enDinero }
}

export interface Indicadores {
  huevos: number
  posturaPct: number | null
  muertes: number
  alimentoKg: number
  /** Promedio del último pesaje de cada galpón/corral en el período */
  pesoKg: number | null
  costos: number
  ingresos: number
  utilidad: number
  calidadMalaPct: number | null
}

export function indicadores(d: DatosReporte, desde: string, hasta: string, sel: Seleccion): Indicadores {
  const { enLote, enDinero } = filtros(d, sel)
  const enRango = (f: string) => f >= desde && f <= hasta
  const dias = d.dias.filter(x => enRango(x.fecha) && enLote(x.lote))
  const huevos = dias.reduce((s, x) => s + x.huevos, 0)
  const avesDia = dias.reduce((s, x) => s + (x.aves ?? 0), 0)
  const huevosConAves = dias.filter(x => x.aves).reduce((s, x) => s + x.huevos, 0)
  const malos = dias.reduce((s, x) => s + x.malos, 0)
  const muertesEv = d.eventos.filter(e => enRango(e.fecha) && enLote(e.lote)).reduce((s, e) => s + e.muertas, 0)
  const ultimo = new Map<string, PesoReporte>()
  for (const p of d.pesos) if (enRango(p.fecha) && enLote(p.lote) && (!ultimo.has(p.lote) || ultimo.get(p.lote)!.fecha < p.fecha)) ultimo.set(p.lote, p)
  const costos = d.costos.filter(c => enRango(c.fecha) && enDinero(c)).reduce((s, c) => s + Number(c.monto), 0)
  const ingresos = d.ingresos.filter(i => enRango(i.fecha) && enDinero(i)).reduce((s, i) => s + i.monto, 0)
  return {
    huevos,
    posturaPct: avesDia > 0 ? (huevosConAves / avesDia) * 100 : null,
    muertes: dias.reduce((s, x) => s + x.muertes, 0) + muertesEv,
    alimentoKg: dias.reduce((s, x) => s + x.alimentoKg, 0),
    pesoKg: ultimo.size > 0 ? [...ultimo.values()].reduce((s, p) => s + p.peso, 0) / ultimo.size : null,
    costos, ingresos, utilidad: ingresos - costos,
    calidadMalaPct: huevos > 0 ? (malos / huevos) * 100 : null,
  }
}

export type FilaSemana = { semana: string } & Record<string, number | string | null>

/**
 * Una serie por galpón/corral, semana a semana (la columna de cada uno es su
 * id): huevos, % de postura, muertes, alimento y peso promedio.
 */
export function seriesSemanales(d: DatosReporte, desde: string, hasta: string, lotes: string[]) {
  const semanas = semanasEntre(desde, hasta)
  const vacia = () => Object.fromEntries(lotes.map(g => [g, 0])) as Record<string, number>
  const mapa = () => new Map(semanas.map(s => [s, vacia()]))
  const huevos = mapa(), aves = mapa(), huevosConAves = mapa(), muertes = mapa(), alimento = mapa()
  const pesoSuma = mapa(), pesoN = mapa()
  const incluye = new Set(lotes)
  const ok = (f: string, l: string) => f >= desde && f <= hasta && incluye.has(l)
  for (const x of d.dias) {
    if (!ok(x.fecha, x.lote)) continue
    const s = lunesDe(x.fecha)
    huevos.get(s)![x.lote] += x.huevos
    muertes.get(s)![x.lote] += x.muertes
    alimento.get(s)![x.lote] += x.alimentoKg
    if (x.aves) { aves.get(s)![x.lote] += x.aves; huevosConAves.get(s)![x.lote] += x.huevos }
  }
  for (const e of d.eventos) if (ok(e.fecha, e.lote)) muertes.get(lunesDe(e.fecha))![e.lote] += e.muertas
  for (const p of d.pesos) if (ok(p.fecha, p.lote)) { const s = lunesDe(p.fecha); pesoSuma.get(s)![p.lote] += p.peso; pesoN.get(s)![p.lote] += 1 }
  const fila = (s: string, valores: Record<string, number | null>) => ({ semana: etiquetaSemana(s), ...valores }) as FilaSemana
  const redondear = (v: number) => Math.round(v * 10) / 10
  return {
    huevos: semanas.map(s => fila(s, huevos.get(s)!)),
    postura: semanas.map(s => fila(s, Object.fromEntries(lotes.map(g => [g, aves.get(s)![g] > 0 ? redondear((huevosConAves.get(s)![g] / aves.get(s)![g]) * 100) : null])))),
    muertes: semanas.map(s => fila(s, muertes.get(s)!)),
    alimento: semanas.map(s => fila(s, Object.fromEntries(lotes.map(g => [g, redondear(alimento.get(s)![g])])))),
    peso: semanas.map(s => fila(s, Object.fromEntries(lotes.map(g => [g, pesoN.get(s)![g] > 0 ? Math.round((pesoSuma.get(s)![g] / pesoN.get(s)![g]) * 100) / 100 : null])))),
  }
}

/** Totales de la selección semana a semana, para las tendencias de los indicadores */
export function totalesSemanales(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  return semanasEntre(desde, hasta).map(s => {
    const fin = sumarDias(s, 6)
    const i = indicadores(d, s < desde ? desde : s, fin > hasta ? hasta : fin, sel)
    return { semana: s, ...i }
  })
}

/** Dinero mes a mes de la selección */
export function dineroPorMes(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  const { enDinero } = filtros(d, sel)
  const meses = new Map<string, { ingresos: number; costos: number }>()
  for (let m = desde.slice(0, 7); m <= hasta.slice(0, 7); m = aFechaLocal(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)).slice(0, 7)) {
    meses.set(m, { ingresos: 0, costos: 0 })
  }
  for (const c of d.costos) if (c.fecha >= desde && c.fecha <= hasta && enDinero(c)) meses.get(c.fecha.slice(0, 7))!.costos += Number(c.monto)
  for (const i of d.ingresos) if (i.fecha >= desde && i.fecha <= hasta && enDinero(i)) meses.get(i.fecha.slice(0, 7))!.ingresos += i.monto
  return [...meses.entries()].map(([mes, v]) => ({
    // "jul", y con el año solo si no es el de hoy ("dic 25")
    mes: new Date(mes + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')
      + (mes.slice(0, 4) !== hasta.slice(0, 4) ? ` ${mes.slice(2, 4)}` : ''),
    ingresos: Math.round(v.ingresos), costos: Math.round(v.costos), utilidad: Math.round(v.ingresos - v.costos),
  }))
}

/** Costos de la selección por categoría, de mayor a menor */
export function costosPorCategoria(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  const { enDinero } = filtros(d, sel)
  const m = new Map<string, number>()
  for (const c of d.costos) {
    if (c.fecha < desde || c.fecha > hasta || !enDinero(c)) continue
    const k = categoriaInfo(c.categoria)?.label ?? c.categoria
    m.set(k, (m.get(k) ?? 0) + Number(c.monto))
  }
  return [...m.entries()].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total)
}

/** Eventos clínicos de la selección por tipo */
export function enfermedadesPorTipo(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  const { enLote } = filtros(d, sel)
  const m = new Map<string, number>()
  for (const e of d.eventos) {
    if (e.fecha < desde || e.fecha > hasta || e.tipo === 'mortalidad' || !enLote(e.lote)) continue
    m.set(e.tipo, (m.get(e.tipo) ?? 0) + 1)
  }
  return [...m.entries()].map(([tipo, casos]) => ({ tipo, casos })).sort((a, b) => b.casos - a.casos)
}

/** Dinero de cada especie en el período (para "Toda la finca") */
export function dineroPorEspecie(d: DatosReporte, desde: string, hasta: string) {
  return d.especies.map(e => {
    const i = indicadores(d, desde, hasta, { especie: e, lotes: null })
    return { especie: e, nombre: ESPECIES_FINCA.find(x => x.value === e)?.labelNav ?? ESPECIES_FINCA.find(x => x.value === e)?.label ?? e, ingresos: i.ingresos, costos: i.costos, utilidad: i.utilidad }
  })
}
