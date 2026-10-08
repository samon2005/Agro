import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aFechaLocal } from '@/lib/fechas'
import { categoriaInfo } from '@/lib/costos'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import { cargarFinanzasFinca, TIPOS_INGRESO, type CostoFinca, type Ingreso } from '@/lib/finanzas'
import { estaVivo } from '@/lib/lotesAves'

/**
 * Los datos de Reportes de toda la finca: cada galpón o corral (un lote) con lo
 * que se registró día a día, sus pesajes, sus eventos clínicos y su dinero.
 * Todo se agrupa por semana de calendario (lunes a domingo), así los galpones y
 * corrales quedan alineados en el tiempo.
 */

export interface Unidad { id: string; nombre: string; especie: EspecieFinca; activo: boolean; animales: number; ingreso: string | null }
export interface DiaReporte {
  fecha: string; lote: string; huevos: number; aves: number | null; muertes: number; alimentoKg: number; malos: number
  /** El alimento que se comió ese día y la causa de las muertes */
  tipo: string | null; causa: string | null
}

export type Nutriente = 'proteina' | 'grasa' | 'calcio' | 'fosforo' | 'lisina' | 'energia'
/** Un alimento con su composición (% del alimento; energía en kcal/kg) */
export interface Alimento { id: string; nombre: string; comp: Partial<Record<Nutriente, number>> }
/**
 * Lo que pide la guía de un galpón o corral desde una fecha. En ponedoras son
 * gramos por ave al día (mantenimiento + producción por huevo); en cerdos y
 * pollo es la composición que debe tener la dieta.
 */
export type Requerimiento =
  | { lote: string; desde: string; modo: 'gramos'; mant: Record<Nutriente, number>; prod: Record<Nutriente, number> }
  | { lote: string; desde: string; modo: 'dieta'; pct: Partial<Record<Nutriente, number>>; diaDesde?: number; diaHasta?: number | null }
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
  alimentos: Map<string, Alimento>
  requerimientos: Requerimiento[]
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

  const [lotesAves, prodAves, evAves, lotesCerdos, nutCerdos, mortCerdos, pesoCerdos, evCerdos, lotesPollo, prodPollo, pesoPollo, evPollo, fin,
    tiposAves, tiposCerdos, tiposPollo, reqAves, reqCerdos, reqPollo] = await Promise.all([
    tiene('aves_ponedoras') ? supabase.from('lotes_aves').select('id, nombre, estado, aves_actuales, fecha_inicio, alimento_activo_id').eq('finca_id', fincaId) : vacio,
    tiene('aves_ponedoras') ? delLote(supabase.from('produccion_diaria_aves')
      .select('lote_id, fecha, huevos_totales, aves_en_dia, muertes, causa_muerte, alimento_kg, tipo_alimento_id, huevos_rotos, huevos_sucios, huevos_deformes')
      .eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('aves_ponedoras') ? delLote(supabase.from('eventos_clinicos_aves').select('lote_id, fecha, tipo_evento, aves_muertas, origen').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('cerdos') ? supabase.from('lotes_cerdos').select('id, nombre, estado, animales_actuales, fecha_ingreso, alimento_activo_id').eq('finca_id', fincaId) : vacio,
    tiene('cerdos') ? delLote(supabase.from('nutricion_diaria_cerdos').select('lote_id, fecha, alimento_kg, tipo_alimento_id').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('cerdos') ? delLote(supabase.from('mortalidad_cerdos').select('lote_id, fecha, cantidad, causa').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('cerdos') ? delLote(supabase.from('pesos_lote_cerdos').select('lote_id, fecha, peso_promedio').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('cerdos') ? delLote(supabase.from('eventos_clinicos_cerdos').select('lote_id, fecha, tipo_evento, animales_muertos').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('pollo_engorde') ? supabase.from('lotes_pollo').select('id, nombre, estado, pollos_actuales, fecha_ingreso, alimento_activo_id').eq('finca_id', fincaId) : vacio,
    tiene('pollo_engorde') ? delLote(supabase.from('produccion_diaria_pollo').select('lote_id, fecha, alimento_kg, muertes, causa_muerte, tipo_alimento_id').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('pollo_engorde') ? delLote(supabase.from('pesos_lote_pollo').select('lote_id, fecha, peso_promedio').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    tiene('pollo_engorde') ? delLote(supabase.from('eventos_clinicos_pollo').select('lote_id, fecha, tipo_evento, aves_muertas').eq('finca_id', fincaId).gte('fecha', desde)) : vacio,
    cargarFinanzasFinca(supabase, fincaId, especies),
    tiene('aves_ponedoras') ? supabase.from('tipos_alimento_aves').select('id, nombre, proteina_bruta_pct, grasa_pct, calcio_pct, fosforo_pct').eq('finca_id', fincaId) : vacio,
    tiene('cerdos') ? supabase.from('tipos_alimento_cerdos').select('id, nombre, proteina_bruta_pct, grasa_pct, calcio_pct, fosforo_pct, lisina_pct, energia_kcal_kg').eq('finca_id', fincaId) : vacio,
    tiene('pollo_engorde') ? supabase.from('tipos_alimento_pollo').select('id, nombre, proteina_bruta_pct, grasa_pct, calcio_pct, fosforo_pct, lisina_pct, energia_kcal_kg').eq('finca_id', fincaId) : vacio,
    tiene('aves_ponedoras') ? delLote(supabase.from('requerimientos_nutricionales_aves').select('*').eq('finca_id', fincaId)) : vacio,
    tiene('cerdos') ? delLote(supabase.from('requerimientos_nutricionales_cerdos').select('*').eq('finca_id', fincaId)) : vacio,
    tiene('pollo_engorde') ? delLote(supabase.from('requerimientos_nutricionales_pollo').select('*').eq('finca_id', fincaId)) : vacio,
  ])

  const unidades: Unidad[] = [
    ...(lotesAves.data ?? []).map(l => ({ id: l.id, nombre: l.nombre, especie: 'aves_ponedoras' as const, activo: estaVivo(l.estado), animales: l.aves_actuales, ingreso: l.fecha_inicio })),
    ...(lotesCerdos.data ?? []).map(l => ({ id: l.id, nombre: l.nombre, especie: 'cerdos' as const, activo: l.estado === 'activo', animales: l.animales_actuales, ingreso: l.fecha_ingreso })),
    ...(lotesPollo.data ?? []).map(l => ({ id: l.id, nombre: l.nombre, especie: 'pollo_engorde' as const, activo: l.estado === 'activo', animales: l.pollos_actuales, ingreso: l.fecha_ingreso })),
  ].filter(u => !loteId || u.id === loteId)

  // Los días que no anotan qué alimento se comió usan el que tiene activo el galpón o corral
  const activo = new Map<string, string | null>([...(lotesAves.data ?? []), ...(lotesCerdos.data ?? []), ...(lotesPollo.data ?? [])].map(l => [l.id, l.alimento_activo_id]))
  const tipoDe = (lote: string, tipo: string | null) => tipo ?? activo.get(lote) ?? null
  const dias: DiaReporte[] = [
    ...(prodAves.data ?? []).map(p => ({
      fecha: p.fecha, lote: p.lote_id, huevos: p.huevos_totales, aves: p.aves_en_dia, muertes: p.muertes ?? 0,
      alimentoKg: Number(p.alimento_kg ?? 0), malos: (p.huevos_rotos ?? 0) + (p.huevos_sucios ?? 0) + (p.huevos_deformes ?? 0),
      tipo: tipoDe(p.lote_id, p.tipo_alimento_id), causa: p.causa_muerte,
    })),
    ...(nutCerdos.data ?? []).map(n => ({ fecha: n.fecha, lote: n.lote_id, huevos: 0, aves: null, muertes: 0, alimentoKg: Number(n.alimento_kg ?? 0), malos: 0, tipo: tipoDe(n.lote_id, n.tipo_alimento_id), causa: null })),
    ...(mortCerdos.data ?? []).map(m => ({ fecha: m.fecha, lote: m.lote_id, huevos: 0, aves: null, muertes: m.cantidad ?? 0, alimentoKg: 0, malos: 0, tipo: null, causa: m.causa })),
    ...(prodPollo.data ?? []).map(p => ({ fecha: p.fecha, lote: p.lote_id, huevos: 0, aves: null, muertes: p.muertes ?? 0, alimentoKg: Number(p.alimento_kg ?? 0), malos: 0, tipo: tipoDe(p.lote_id, p.tipo_alimento_id), causa: p.causa_muerte })),
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
    alimentos: new Map([
      ...(tiposAves.data ?? []).map(t => ({ id: t.id, nombre: t.nombre, comp: comp(t) })),
      ...(tiposCerdos.data ?? []).map(t => ({ id: t.id, nombre: t.nombre, comp: comp(t) })),
      ...(tiposPollo.data ?? []).map(t => ({ id: t.id, nombre: t.nombre, comp: comp(t) })),
    ].map(a => [a.id, a])),
    requerimientos: [
      ...(reqAves.data ?? []).map(r => ({
        lote: r.lote_id, desde: r.vigente_desde, modo: 'gramos' as const,
        mant: { proteina: Number(r.mant_proteina_g), grasa: Number(r.mant_grasa_g), calcio: Number(r.mant_calcio_g), fosforo: Number(r.mant_fosforo_g), lisina: 0, energia: 0 },
        prod: { proteina: Number(r.prod_proteina_g), grasa: Number(r.prod_grasa_g), calcio: Number(r.prod_calcio_g), fosforo: Number(r.prod_fosforo_g), lisina: 0, energia: 0 },
      })),
      ...(reqCerdos.data ?? []).map(r => ({
        lote: r.lote_id, desde: r.vigente_desde, modo: 'dieta' as const,
        pct: { proteina: Number(r.proteina_pct), lisina: Number(r.lisina_pct), calcio: Number(r.calcio_pct), fosforo: Number(r.fosforo_pct), energia: Number(r.energia_kcal_kg) },
      })),
      ...(reqPollo.data ?? []).map(r => ({
        lote: r.lote_id, desde: r.vigente_desde, modo: 'dieta' as const, diaDesde: r.dia_desde, diaHasta: r.dia_hasta,
        pct: { proteina: Number(r.proteina_pct), lisina: Number(r.lisina_pct), calcio: Number(r.calcio_pct), fosforo: Number(r.fosforo_pct), energia: Number(r.energia_kcal_kg) },
      })),
    ],
  }
}

/** La composición de un alimento, sin los nutrientes que no tiene anotados */
function comp(t: { proteina_bruta_pct: number | null; grasa_pct: number | null; calcio_pct: number | null; fosforo_pct: number | null; lisina_pct?: number | null; energia_kcal_kg?: number | null }) {
  const c: Partial<Record<Nutriente, number>> = {}
  const poner = (n: Nutriente, v: number | null | undefined) => { if (v != null && Number(v) > 0) c[n] = Number(v) }
  poner('proteina', t.proteina_bruta_pct); poner('grasa', t.grasa_pct); poner('calcio', t.calcio_pct)
  poner('fosforo', t.fosforo_pct); poner('lisina', t.lisina_pct); poner('energia', t.energia_kcal_kg)
  return c
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
  /** Suma de las aves de cada día registrado (ponedoras): la base del % de postura */
  avesDia: number
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
    avesDia,
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

// ── Alimento ──

/** Kilos comidos de cada alimento */
export function alimentoPorTipo(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  const { enLote } = filtros(d, sel)
  const m = new Map<string, number>()
  for (const x of d.dias) {
    if (x.fecha < desde || x.fecha > hasta || x.alimentoKg <= 0 || !enLote(x.lote)) continue
    const k = x.tipo ? d.alimentos.get(x.tipo)?.nombre ?? 'Alimento borrado' : 'Sin alimento anotado'
    m.set(k, (m.get(k) ?? 0) + x.alimentoKg)
  }
  return [...m.entries()].map(([nombre, kg]) => ({ nombre, kg: Math.round(kg * 10) / 10 })).sort((a, b) => b.kg - a.kg)
}

export const NUTRIENTES: { id: Nutriente; nombre: string }[] = [
  { id: 'proteina', nombre: 'Proteína' },
  { id: 'energia', nombre: 'Energía' },
  { id: 'lisina', nombre: 'Lisina' },
  { id: 'grasa', nombre: 'Grasa' },
  { id: 'calcio', nombre: 'Calcio' },
  { id: 'fosforo', nombre: 'Fósforo' },
]

/** Lo que usa la app en ponedoras cuando el galpón no tiene requerimientos propios */
const REQ_AVES_POR_DEFECTO = {
  mant: { proteina: 9, grasa: 1.5, calcio: 0.3, fosforo: 0.25, lisina: 0, energia: 0 },
  prod: { proteina: 0, grasa: 0, calcio: 0, fosforo: 0, lisina: 0, energia: 0 },
}

export interface BalanceNutriente {
  id: Nutriente
  nombre: string
  /** Lo que comió y lo que necesitaba, en la misma unidad */
  comio: number
  necesita: number
  unidad: string
  /** % del requerimiento cubierto */
  pct: number
}

/**
 * Qué tan balanceada estuvo la comida en el período: de cada nutriente, lo
 * que aportó lo que se comió (alimento × su composición) frente a lo que pide
 * la guía del galpón o corral. En ponedoras se compara en gramos por ave al día
 * (mantenimiento + producción según la postura de cada día); en cerdos y pollo,
 * la composición de la dieta.
 */
export function balanceNutricional(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  const { enLote } = filtros(d, sel)
  const unidad = new Map(d.unidades.map(u => [u.id, u]))
  const reqDe = (lote: string, fecha: string) => {
    const delLote = d.requerimientos.filter(r => r.lote === lote && r.desde <= fecha)
    if (delLote.length === 0) return null
    const ultimo = delLote.reduce((a, r) => (r.desde > a.desde ? r : a)).desde
    const vigentes = delLote.filter(r => r.desde === ultimo)
    if (vigentes.length === 1 || vigentes[0].modo === 'gramos') return vigentes[0]
    // Pollo: la fase que corresponde al día de vida
    const ingreso = unidad.get(lote)?.ingreso
    const dia = ingreso ? Math.floor((new Date(fecha + 'T00:00:00').getTime() - new Date(ingreso + 'T00:00:00').getTime()) / DIA) : 0
    return vigentes.find(r => r.modo === 'dieta' && (r.diaDesde ?? 0) <= dia && (r.diaHasta == null || r.diaHasta >= dia)) ?? vigentes[0]
  }

  const comio = new Map<Nutriente, number>()
  const necesita = new Map<Nutriente, number>()
  // Cuántas veces (días de ponedoras) o cuántos kilos (dieta) entran en cada suma, para promediar
  const peso = new Map<Nutriente, number>()
  let modo: 'gramos' | 'dieta' | null = null
  let diasConDatos = 0, diasSinComposicion = 0, conGuia = false
  for (const x of d.dias) {
    if (x.fecha < desde || x.fecha > hasta || x.alimentoKg <= 0 || !enLote(x.lote)) continue
    const alimento = x.tipo ? d.alimentos.get(x.tipo) : undefined
    if (!alimento || Object.keys(alimento.comp).length === 0) { diasSinComposicion++; continue }
    const esAves = unidad.get(x.lote)?.especie === 'aves_ponedoras'
    const r = reqDe(x.lote, x.fecha)
    if (r) conGuia = true
    if (esAves) {
      if (!x.aves || x.aves <= 0) continue
      modo = 'gramos'
      const req = r?.modo === 'gramos' ? r : REQ_AVES_POR_DEFECTO
      const postura = x.huevos / x.aves
      for (const n of NUTRIENTES) {
        const pct = alimento.comp[n.id]
        const pide = req.mant[n.id] + req.prod[n.id] * postura
        if (pct == null || n.id === 'energia' || pide <= 0) continue
        comio.set(n.id, (comio.get(n.id) ?? 0) + (x.alimentoKg * 1000 * pct / 100) / x.aves)
        necesita.set(n.id, (necesita.get(n.id) ?? 0) + pide)
        peso.set(n.id, (peso.get(n.id) ?? 0) + 1)
      }
    } else {
      if (r?.modo !== 'dieta') continue
      modo = 'dieta'
      // Promedios ponderados por los kilos: la composición de lo que se comió frente a la pedida
      for (const n of NUTRIENTES) {
        const pct = alimento.comp[n.id], pide = r.pct[n.id]
        if (pct == null || pide == null || pide <= 0) continue
        comio.set(n.id, (comio.get(n.id) ?? 0) + pct * x.alimentoKg)
        necesita.set(n.id, (necesita.get(n.id) ?? 0) + pide * x.alimentoKg)
        peso.set(n.id, (peso.get(n.id) ?? 0) + x.alimentoKg)
      }
    }
    diasConDatos++
  }

  const nutrientes: BalanceNutriente[] = NUTRIENTES.filter(n => (necesita.get(n.id) ?? 0) > 0).map(n => {
    const c = comio.get(n.id) ?? 0, k = necesita.get(n.id)!, w = peso.get(n.id) || 1
    return {
      id: n.id, nombre: n.nombre,
      // Promedio por día (g/ave) o por kilo comido (% de la dieta, kcal/kg)
      comio: c / w, necesita: k / w,
      unidad: modo === 'gramos' ? 'g/ave al día' : n.id === 'energia' ? 'kcal/kg' : '% de la dieta',
      pct: (c / k) * 100,
    }
  })
  return { nutrientes, modo, diasConDatos, diasSinComposicion, conGuia }
}

// ── Dinero ──

/** Ingresos de la selección según de qué son (huevo, descarte, animales...) */
export function ingresosPorTipo(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  const { enDinero } = filtros(d, sel)
  const m = new Map<string, number>()
  for (const i of d.ingresos) {
    if (i.fecha < desde || i.fecha > hasta || !enDinero(i)) continue
    const k = TIPOS_INGRESO[i.tipo]?.label ?? i.tipo
    m.set(k, (m.get(k) ?? 0) + i.monto)
  }
  return [...m.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total)
}

/** Lo que entró por huevo en el período (para el costo por huevo y el equilibrio) */
export function ingresoHuevo(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  const { enDinero } = filtros(d, sel)
  return d.ingresos.filter(i => i.tipo === 'huevo' && i.fecha >= desde && i.fecha <= hasta && enDinero(i)).reduce((s, i) => s + i.monto, 0)
}

// ── Sanidad ──

/** De qué se murieron: las causas anotadas en el día y las muertes de cada evento clínico */
export function muertesPorCausa(d: DatosReporte, desde: string, hasta: string, sel: Seleccion) {
  const { enLote } = filtros(d, sel)
  const m = new Map<string, number>()
  const sumar = (k: string, n: number) => { if (n > 0) m.set(k, (m.get(k) ?? 0) + n) }
  for (const x of d.dias) if (x.fecha >= desde && x.fecha <= hasta && enLote(x.lote)) sumar(x.causa?.trim() || 'Sin causa anotada', x.muertes)
  for (const e of d.eventos) if (e.fecha >= desde && e.fecha <= hasta && enLote(e.lote)) sumar(e.tipo, e.muertas)
  return [...m.entries()].map(([causa, muertes]) => ({ causa: causa[0].toUpperCase() + causa.slice(1), muertes })).sort((a, b) => b.muertes - a.muertes)
}

/** Animales que hay hoy en la selección */
export function animalesActuales(d: DatosReporte, sel: Seleccion) {
  const { enLote } = filtros(d, sel)
  return d.unidades.filter(u => u.activo && enLote(u.id)).reduce((s, u) => s + u.animales, 0)
}

/**
 * Gramos de alimento por animal al día. En ponedoras con las aves de cada día;
 * en cerdos y pollo, con los animales de hoy (no se cuentan a diario).
 */
export function consumoPorAnimal(d: DatosReporte, desde: string, hasta: string, sel: Seleccion): number | null {
  const { enLote } = filtros(d, sel)
  const unidad = new Map(d.unidades.map(u => [u.id, u]))
  let gramos = 0, animalesDia = 0
  for (const x of d.dias) {
    if (x.fecha < desde || x.fecha > hasta || x.alimentoKg <= 0 || !enLote(x.lote)) continue
    const animales = x.aves ?? unidad.get(x.lote)?.animales ?? 0
    if (animales <= 0) continue
    gramos += x.alimentoKg * 1000
    animalesDia += animales
  }
  return animalesDia > 0 ? gramos / animalesDia : null
}
