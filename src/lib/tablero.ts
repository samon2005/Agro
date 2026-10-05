import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aFechaLocal } from '@/lib/fechas'
import { cargarFinanzasFinca, type CostoFinca, type Ingreso } from '@/lib/finanzas'

/**
 * Los datos del tablero de la finca, por semana de calendario (de lunes a
 * domingo) para que todos los galpones queden alineados en el tiempo.
 */

export interface DiaTablero {
  fecha: string
  galpon: string
  huevos: number
  aves: number | null
  muertes: number
  alimentoKg: number
  rotos: number
  sucios: number
  deformes: number
}

export interface EventoTablero { fecha: string; galpon: string; tipo: string; muertas: number }

export interface DatosTablero {
  dias: DiaTablero[]
  eventos: EventoTablero[]
  costos: CostoFinca[]
  ingresos: Ingreso[]
  /** Nombre del galpón de cada lote (también de los que ya salieron) */
  galponDeLote: Map<string, string>
  galpones: string[]
}

export async function cargarTablero(supabase: SupabaseClient<Database>, fincaId: string, desde: string): Promise<DatosTablero> {
  const [lotes, prod, eventos, fin] = await Promise.all([
    supabase.from('lotes_aves').select('id, nombre').eq('finca_id', fincaId),
    supabase.from('produccion_diaria_aves')
      .select('lote_id, fecha, huevos_totales, aves_en_dia, muertes, alimento_kg, huevos_rotos, huevos_sucios, huevos_deformes')
      .eq('finca_id', fincaId).gte('fecha', desde),
    supabase.from('eventos_clinicos_aves').select('lote_id, fecha, tipo_evento, aves_muertas, origen').eq('finca_id', fincaId).gte('fecha', desde),
    cargarFinanzasFinca(supabase, fincaId, ['aves_ponedoras']),
  ])
  const galponDeLote = new Map((lotes.data ?? []).map(l => [l.id, l.nombre]))
  const g = (id: string | null) => (id ? galponDeLote.get(id) ?? 'Galpón' : 'Toda la finca')
  const dias: DiaTablero[] = (prod.data ?? []).map(p => ({
    fecha: p.fecha, galpon: g(p.lote_id), huevos: p.huevos_totales, aves: p.aves_en_dia,
    muertes: p.muertes ?? 0, alimentoKg: Number(p.alimento_kg ?? 0),
    rotos: p.huevos_rotos ?? 0, sucios: p.huevos_sucios ?? 0, deformes: p.huevos_deformes ?? 0,
  }))
  const evs: EventoTablero[] = (eventos.data ?? []).map(e => ({
    fecha: e.fecha, galpon: g(e.lote_id),
    // Las de origen "mortalidad" son el reflejo de las muertes del día
    tipo: e.origen === 'mortalidad' ? 'mortalidad' : e.tipo_evento,
    muertas: e.origen === 'mortalidad' ? 0 : e.aves_muertas ?? 0,
  }))
  const galpones = [...new Set([...dias.map(d => d.galpon), ...evs.map(e => e.galpon)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  return {
    dias, eventos: evs,
    costos: fin.costos.filter(c => c.fecha >= desde),
    ingresos: fin.ingresos.filter(i => i.fecha >= desde),
    galponDeLote, galpones,
  }
}

/** Lunes de la semana de una fecha */
export function lunesDe(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return aFechaLocal(d)
}

export interface Indicadores {
  huevos: number
  posturaPct: number | null
  muertes: number
  alimentoKg: number
  costos: number
  ingresos: number
  utilidad: number
  calidadMalaPct: number | null
}

/** Los números del período para los galpones elegidos (los costos e ingresos de la finca entran con "todos") */
export function indicadores(d: DatosTablero, desde: string, hasta: string, galpones: Set<string> | null): Indicadores {
  const enGalpon = (x: string) => !galpones || galpones.has(x)
  const dias = d.dias.filter(x => x.fecha >= desde && x.fecha <= hasta && enGalpon(x.galpon))
  const huevos = dias.reduce((s, x) => s + x.huevos, 0)
  const avesDia = dias.reduce((s, x) => s + (x.aves ?? 0), 0)
  const huevosConAves = dias.filter(x => x.aves).reduce((s, x) => s + x.huevos, 0)
  const malos = dias.reduce((s, x) => s + x.rotos + x.sucios + x.deformes, 0)
  const muertesEv = d.eventos.filter(e => e.fecha >= desde && e.fecha <= hasta && enGalpon(e.galpon)).reduce((s, e) => s + e.muertas, 0)
  const nombreDe = (id: string | null) => (id ? d.galponDeLote.get(id) ?? 'Galpón' : 'Toda la finca')
  const costos = d.costos.filter(c => c.fecha >= desde && c.fecha <= hasta && (!galpones || galpones.has(nombreDe(c.lote_id)))).reduce((s, c) => s + Number(c.monto), 0)
  const ingresos = d.ingresos.filter(i => i.fecha >= desde && i.fecha <= hasta && (!galpones || galpones.has(nombreDe(i.lote_id)))).reduce((s, i) => s + i.monto, 0)
  return {
    huevos,
    posturaPct: avesDia > 0 ? (huevosConAves / avesDia) * 100 : null,
    muertes: dias.reduce((s, x) => s + x.muertes, 0) + muertesEv,
    alimentoKg: dias.reduce((s, x) => s + x.alimentoKg, 0),
    costos, ingresos, utilidad: ingresos - costos,
    calidadMalaPct: huevos > 0 ? (malos / huevos) * 100 : null,
  }
}

export interface SemanaGalpon { semana: string; [galpon: string]: number | string | null }

/** Una serie por galpón, semana a semana: huevos, % de postura y muertes */
export function seriesSemanales(d: DatosTablero, desde: string, hasta: string, galpones: string[]) {
  const semanas: string[] = []
  for (let s = lunesDe(desde); s <= hasta; s = aFechaLocal(new Date(new Date(s + 'T00:00:00').getTime() + 7 * 86_400_000))) semanas.push(s)
  const vacia = () => Object.fromEntries(galpones.map(g => [g, 0])) as Record<string, number>
  const huevos = new Map(semanas.map(s => [s, vacia()]))
  const aves = new Map(semanas.map(s => [s, vacia()]))
  const huevosConAves = new Map(semanas.map(s => [s, vacia()]))
  const muertes = new Map(semanas.map(s => [s, vacia()]))
  for (const x of d.dias) {
    if (x.fecha < desde || x.fecha > hasta || !galpones.includes(x.galpon)) continue
    const s = lunesDe(x.fecha)
    huevos.get(s)![x.galpon] += x.huevos
    muertes.get(s)![x.galpon] += x.muertes
    if (x.aves) { aves.get(s)![x.galpon] += x.aves; huevosConAves.get(s)![x.galpon] += x.huevos }
  }
  for (const e of d.eventos) {
    if (e.fecha < desde || e.fecha > hasta || !galpones.includes(e.galpon)) continue
    muertes.get(lunesDe(e.fecha))![e.galpon] += e.muertas
  }
  const etiqueta = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  type Fila = { semana: string } & Record<string, number | string | null>
  return {
    huevos: semanas.map(s => ({ semana: etiqueta(s), ...huevos.get(s)! }) as Fila),
    postura: semanas.map(s => ({
      semana: etiqueta(s),
      ...Object.fromEntries(galpones.map(g => [g, aves.get(s)![g] > 0 ? Math.round((huevosConAves.get(s)![g] / aves.get(s)![g]) * 1000) / 10 : null])),
    }) as Fila),
    muertes: semanas.map(s => ({ semana: etiqueta(s), ...muertes.get(s)! }) as Fila),
  }
}
