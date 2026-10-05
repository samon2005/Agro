import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aFechaLocal } from '@/lib/fechas'
import { PESO_HUEVO_G, type FilaSemana } from '@/lib/resumenSemanal'
import { TAMANOS_HUEVO, type PreciosHuevo, type TamanoHuevo } from '@/lib/huevos'

/**
 * Cómo se calcula el costo del huevo de un galpón, semana a semana:
 *
 * - Alimento: lo que se comió (el consumo registrado rige hasta el siguiente)
 *   por el precio por kg de ese alimento. Las compras de alimento no se cuentan
 *   como costo de la semana, porque lo que importa es lo que se consumió.
 * - Costos directos del galpón (sanidad, mano de obra, equipos...), en su fecha.
 * - Parte de los costos generales de la finca, según las aves del galpón.
 * - Las aves: su compra y todo lo gastado en el levante es una inversión que se
 *   reparte entre las semanas de postura del ciclo (amortización).
 *
 * En levante no hay huevo: lo de esas semanas va a la inversión.
 */

export const CATEGORIA_AVES = 'pollitas'
export const CATEGORIA_ALIMENTO = 'alimento'

export interface CostoFecha { fecha: string; categoria: string; monto: number }
export interface ConsumoDia { fecha: string; alimento_kg: number; tipo_alimento_id: string | null }

export interface CostoSemana {
  clave: string
  etapa: 'levante' | 'postura'
  semana: number
  desde: string
  hasta: string
  huevos: number
  posturaPct: number | null
  alimento: number
  /** Kg comidos sin precio conocido: el costo de alimento se queda corto */
  kgSinPrecio: number
  directos: number
  finca: number
  amortizacion: number
  /** Lo de la semana que cuesta producir huevo (en levante, 0: va a la inversión) */
  total: number
  costoHuevo: number | null
  /** Costo por gramo de huevo, para repartirlo por tamaño */
  costoGramo: number | null
  /** Lo que valen los huevos de la semana a los precios de la finca */
  ingreso: number | null
  precioPromedio: number | null
  utilidad: number | null
  /** % de postura con el que el ingreso apenas cubre los costos de la semana */
  equilibrioPct: number | null
}

export interface ResultadoCostos {
  semanas: CostoSemana[]
  /** Compra de las aves + todo lo del levante */
  inversion: number
  semanasCiclo: number
  amortizacionSemanal: number
}

/** Precio por kg de cada alimento: lo pagado en sus entradas ÷ los kg que entraron (o el precio del catálogo). */
export function precioKgPorTipo(
  tipos: { id: string; precio_bulto: number | null; peso_bulto_kg: number }[],
  entradas: { tipo_alimento_id: string; cantidad_bultos: number; precio_bulto: number | null }[],
): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of tipos) {
    const peso = Number(t.peso_bulto_kg) || 40
    const conPrecio = entradas.filter(e => e.tipo_alimento_id === t.id && e.precio_bulto != null && Number(e.precio_bulto) > 0)
    const bultos = conPrecio.reduce((s, e) => s + Number(e.cantidad_bultos), 0)
    if (bultos > 0) {
      const pagado = conPrecio.reduce((s, e) => s + Number(e.cantidad_bultos) * Number(e.precio_bulto), 0)
      m.set(t.id, pagado / (bultos * peso))
    } else if (t.precio_bulto != null && Number(t.precio_bulto) > 0) {
      m.set(t.id, Number(t.precio_bulto) / peso)
    }
  }
  return m
}

/** Lo que vale un huevo en promedio, según los tamaños de la semana y los precios de la finca. */
export function precioPromedioHuevo(porTamano: Record<TamanoHuevo, number>, precios: PreciosHuevo): number | null {
  let huevos = 0
  let valor = 0
  for (const t of TAMANOS_HUEVO) {
    const p = precios[t.key]
    if (p == null || p <= 0) continue
    huevos += porTamano[t.key]
    valor += porTamano[t.key] * p
  }
  if (huevos > 0) return valor / huevos
  // Sin clasificar: el promedio simple de los precios que haya
  const conPrecio = TAMANOS_HUEVO.map(t => precios[t.key]).filter((p): p is number => p != null && p > 0)
  return conPrecio.length ? conPrecio.reduce((s, p) => s + p, 0) / conPrecio.length : null
}

export function costosSemanales(input: {
  semanas: FilaSemana[]
  fechaInicio: string
  semanasCicloPostura: number | null
  consumos: ConsumoDia[]
  precioKg: Map<string, number>
  /** Alimento en uso, para los días en que el registro no dice cuál */
  alimentoActivoId: string | null
  costosLote: CostoFecha[]
  costosFinca: CostoFecha[]
  /** Parte del galpón en los costos generales (sus aves ÷ las de la finca) */
  fraccionFinca: number
  precios: PreciosHuevo
}): ResultadoCostos {
  const { semanas } = input
  // ── Alimento por día, con el consumo y el alimento vigentes ──
  const porFecha = new Map(input.consumos.filter(c => Number(c.alimento_kg) > 0).map(c => [c.fecha, c]))
  const alimentoDia = new Map<string, { costo: number; kgSinPrecio: number }>()
  const ultimaFecha = semanas.length ? semanas[semanas.length - 1].hasta : input.fechaInicio
  let kgVigente = 0
  let tipoVigente: string | null = null
  for (const d = new Date(input.fechaInicio + 'T00:00:00'); aFechaLocal(d) <= ultimaFecha; d.setDate(d.getDate() + 1)) {
    const fecha = aFechaLocal(d)
    const r = porFecha.get(fecha)
    if (r) { kgVigente = Number(r.alimento_kg); tipoVigente = r.tipo_alimento_id ?? tipoVigente }
    if (kgVigente <= 0) continue
    const tipo = tipoVigente ?? input.alimentoActivoId
    const precio = tipo ? input.precioKg.get(tipo) : undefined
    alimentoDia.set(fecha, precio != null ? { costo: kgVigente * precio, kgSinPrecio: 0 } : { costo: 0, kgSinPrecio: kgVigente })
  }

  const enRango = (lista: CostoFecha[], desde: string, hasta: string, filtro: (c: CostoFecha) => boolean) =>
    lista.filter(c => c.fecha >= desde && c.fecha <= hasta && filtro(c)).reduce((s, c) => s + Number(c.monto), 0)
  const esPeriodico = (c: CostoFecha) => c.categoria !== CATEGORIA_ALIMENTO && c.categoria !== CATEGORIA_AVES

  // ── Inversión: la compra de las aves y lo del levante ──
  const compraAves = input.costosLote.filter(c => c.categoria === CATEGORIA_AVES).reduce((s, c) => s + Number(c.monto), 0)
  const base = semanas.map(f => {
    let alimento = 0
    let kgSinPrecio = 0
    for (const d = new Date(f.desde + 'T00:00:00'); aFechaLocal(d) <= f.hasta; d.setDate(d.getDate() + 1)) {
      const a = alimentoDia.get(aFechaLocal(d))
      if (a) { alimento += a.costo; kgSinPrecio += a.kgSinPrecio }
    }
    const directos = enRango(input.costosLote, f.desde, f.hasta, esPeriodico)
    const finca = enRango(input.costosFinca, f.desde, f.hasta, esPeriodico) * input.fraccionFinca
    return { f, alimento, kgSinPrecio, directos, finca }
  })
  const inversion = compraAves + base.filter(b => b.f.etapa === 'levante').reduce((s, b) => s + b.alimento + b.directos + b.finca, 0)
  const semanasCiclo = input.semanasCicloPostura && input.semanasCicloPostura > 0 ? input.semanasCicloPostura : 60
  const amortizacionSemanal = inversion / semanasCiclo

  const resultado: CostoSemana[] = base.map(({ f, alimento, kgSinPrecio, directos, finca }) => {
    const enPostura = f.etapa === 'postura'
    // Una semana de postura incompleta amortiza solo sus días
    const dias = Math.round((new Date(f.hasta + 'T00:00:00').getTime() - new Date(f.desde + 'T00:00:00').getTime()) / 86_400_000) + 1
    const amortizacion = enPostura ? amortizacionSemanal * Math.min(1, dias / 7) : 0
    const total = enPostura ? alimento + directos + finca + amortizacion : 0
    const costoHuevo = enPostura && f.huevos > 0 ? total / f.huevos : null
    const gramos = f.pesoHuevoG != null ? f.huevos * f.pesoHuevoG : null
    const costoGramo = enPostura && gramos && gramos > 0 ? total / gramos : null
    const precioPromedio = enPostura ? precioPromedioHuevo(f.porTamano, input.precios) : null
    const ingreso = precioPromedio != null ? f.huevos * precioPromedio : null
    const equilibrioPct = enPostura && precioPromedio && total > 0 && f.avesDia > 0 ? (total / (f.avesDia * precioPromedio)) * 100 : null
    return {
      clave: f.clave, etapa: f.etapa, semana: f.semana, desde: f.desde, hasta: f.hasta,
      huevos: f.huevos, posturaPct: f.posturaPct,
      alimento, kgSinPrecio, directos, finca, amortizacion, total,
      costoHuevo, costoGramo, ingreso, precioPromedio,
      utilidad: ingreso != null && enPostura ? ingreso - total : null,
      equilibrioPct,
    }
  })
  return { semanas: resultado, inversion, semanasCiclo, amortizacionSemanal }
}

/** Costo de cada tamaño de huevo: el costo por gramo por el peso de referencia del tamaño. */
export function costoPorTamano(costoGramo: number): Record<TamanoHuevo, number> {
  return {
    b: costoGramo * PESO_HUEVO_G.b,
    a: costoGramo * PESO_HUEVO_G.a,
    aa: costoGramo * PESO_HUEVO_G.aa,
    aaa: costoGramo * PESO_HUEVO_G.aaa,
    jumbo: costoGramo * PESO_HUEVO_G.jumbo,
  }
}

type LoteCostos = {
  id: string; finca_id: string; aves_actuales: number; fecha_inicio: string
  semanas_ciclo_postura: number | null; alimento_activo_id: string | null
}

export interface DatosCostosLote {
  loteId: string
  consumos: ConsumoDia[]
  precioKg: Map<string, number>
  costosLote: CostoFecha[]
  costosFinca: CostoFecha[]
  fraccionFinca: number
}

/** Lo que hace falta, además de las semanas, para el costo del huevo de un galpón. */
export async function cargarDatosCostos(supabase: SupabaseClient<Database>, lote: LoteCostos): Promise<DatosCostosLote> {
  const [prod, tipos, entradas, costos, vivos] = await Promise.all([
    supabase.from('produccion_diaria_aves').select('fecha, alimento_kg, tipo_alimento_id').eq('lote_id', lote.id),
    supabase.from('tipos_alimento_aves').select('id, precio_bulto, peso_bulto_kg').eq('finca_id', lote.finca_id),
    supabase.from('entradas_alimento_aves').select('tipo_alimento_id, cantidad_bultos, precio_bulto').eq('finca_id', lote.finca_id),
    supabase.from('costos_lote_aves').select('fecha, categoria, monto, lote_id').eq('finca_id', lote.finca_id).or(`lote_id.eq.${lote.id},lote_id.is.null`),
    supabase.from('lotes_aves').select('id, aves_actuales').eq('finca_id', lote.finca_id).in('estado', ['activo', 'preparacion']),
  ])
  const avesFinca = (vivos.data ?? []).reduce((s, l) => s + l.aves_actuales, 0)
  return {
    loteId: lote.id,
    consumos: (prod.data ?? []).map(p => ({ fecha: p.fecha, alimento_kg: Number(p.alimento_kg ?? 0), tipo_alimento_id: p.tipo_alimento_id })),
    precioKg: precioKgPorTipo(tipos.data ?? [], entradas.data ?? []),
    costosLote: (costos.data ?? []).filter(c => c.lote_id === lote.id),
    costosFinca: (costos.data ?? []).filter(c => c.lote_id == null),
    // Un lote cerrado ya no está entre los vivos: no se le cargan costos de la finca
    fraccionFinca: avesFinca > 0 && (vivos.data ?? []).some(l => l.id === lote.id) ? lote.aves_actuales / avesFinca : 0,
  }
}

/** El costo del huevo con las semanas y los datos ya cargados. */
export function costosDeLote(lote: LoteCostos, semanas: FilaSemana[], datos: DatosCostosLote, precios: PreciosHuevo): ResultadoCostos {
  return costosSemanales({
    semanas,
    fechaInicio: lote.fecha_inicio,
    semanasCicloPostura: lote.semanas_ciclo_postura,
    consumos: datos.consumos,
    precioKg: datos.precioKg,
    alimentoActivoId: lote.alimento_activo_id,
    costosLote: datos.costosLote,
    costosFinca: datos.costosFinca,
    fraccionFinca: datos.fraccionFinca,
    precios,
  })
}

/** La última semana completa de postura (la que va corriendo todavía no tiene sus 7 días). */
export function ultimaSemanaPostura(semanas: CostoSemana[]): CostoSemana | null {
  const postura = semanas.filter(s => s.etapa === 'postura')
  const completas = postura.filter(s => (new Date(s.hasta + 'T00:00:00').getTime() - new Date(s.desde + 'T00:00:00').getTime()) / 86_400_000 >= 6)
  return completas[completas.length - 1] ?? postura[postura.length - 1] ?? null
}

/**
 * El costo por gramo de huevo de toda la finca: la última semana completa de
 * postura de cada galpón, sumando costos y gramos. Sirve para estimar lo que
 * costó el huevo de una venta (que es de la finca, no de un galpón).
 */
export async function costoGramoFinca(
  supabase: SupabaseClient<Database>,
  fincaId: string,
  precios: PreciosHuevo,
  cargarSemanas: (lote: Database['public']['Tables']['lotes_aves']['Row']) => Promise<FilaSemana[]>,
): Promise<number | null> {
  const { data } = await supabase.from('lotes_aves').select('*').eq('finca_id', fincaId).eq('estado', 'activo')
  let costo = 0
  let gramos = 0
  await Promise.all((data ?? []).map(async lote => {
    const [semanas, datos] = await Promise.all([cargarSemanas(lote), cargarDatosCostos(supabase, lote)])
    const u = ultimaSemanaPostura(costosDeLote(lote, semanas, datos, precios).semanas)
    if (u?.costoGramo != null && u.total > 0) {
      costo += u.total
      gramos += u.total / u.costoGramo
    }
  }))
  return gramos > 0 ? costo / gramos : null
}
