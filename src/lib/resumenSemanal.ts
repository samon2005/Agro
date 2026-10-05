import { semanaDelLote } from '@/lib/postura'
import { aFechaLocal } from '@/lib/fechas'

/**
 * Peso de referencia de cada tamaño de huevo (g): el punto medio de su rango en
 * la clasificación colombiana (NTC 1240). Con él se estima el peso promedio del
 * huevo de cada semana a partir de cuántos salieron de cada gramaje.
 */
export const PESO_HUEVO_G = { b: 49.5, a: 56.5, aa: 63.5, aaa: 72.5, jumbo: 80 } as const

export interface DiaProduccion {
  fecha: string
  huevos_totales: number
  huevos_b: number; huevos_a: number; huevos_aa: number; huevos_aaa: number; huevos_jumbo: number
  muertes: number
  alimento_kg: number
}

export interface LoteResumen {
  estado: string
  fecha_inicio: string
  fecha_inicio_postura: string | null
  aves_iniciales: number
}

export interface FilaSemana {
  clave: string
  etapa: 'levante' | 'postura'
  semana: number
  desde: string
  hasta: string
  huevos: number
  huevosAcumulados: number
  saldoAves: number
  muertes: number
  consumoKg: number
  pesoAveG: number | null
  pesoHuevoG: number | null
  avesEncasetadas: number
  posturaPct: number | null
  haa: number
  consumoAveGDia: number | null
  mortalidadPct: number | null
  mortalidadAcumPct: number
  conversion: number | null
  /** Huevos clasificados de la semana por tamaño */
  porTamano: { b: number; a: number; aa: number; aaa: number; jumbo: number }
  /** Aves-día de la semana (las que amanecieron cada día, haya registro o no) */
  avesDia: number
}

/**
 * El lote semana a semana, con promedios de 7 días. Cada día del lote, desde que
 * entró hasta hoy, cuenta aunque no se haya registrado:
 * - Las aves de cada día son las encasetadas menos las muertas y vendidas antes.
 * - El % de postura solo usa los días registrados (uno sin registro no es un día sin huevos).
 * - El alimento de cada día es el del último consumo registrado (rige hasta el siguiente).
 * - Las semanas van desde la entrada en levante y desde el inicio de postura en postura.
 */
export function resumenSemanal(
  lote: LoteResumen,
  dias: DiaProduccion[],
  /** Muertes por fecha que no están en el día (eventos clínicos) */
  muertesExtra: { fecha: string; cantidad: number }[],
  /** Aves que salieron vendidas, por fecha */
  ventasAves: { fecha: string; cantidad: number }[],
  pesajes: { fecha: string; peso_promedio_g: number }[],
  hoy: string,
): FilaSemana[] {
  const porFecha = new Map(dias.map(d => [d.fecha, d]))
  const sumaPorFecha = (lista: { fecha: string; cantidad: number }[]) => {
    const m = new Map<string, number>()
    for (const x of lista) m.set(x.fecha, (m.get(x.fecha) ?? 0) + x.cantidad)
    return m
  }
  const extra = sumaPorFecha(muertesExtra)
  const vendidas = sumaPorFecha(ventasAves)
  const pesajesOrden = [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const filas: FilaSemana[] = []
  let actual: FilaSemana | null = null
  // Aves-día solo de los días registrados: un día sin registro es un dato que falta, no cero huevos
  let avesDiaRegistrados = 0
  // Aves-día de los días con consumo: antes del primer consumo registrado no se sabe cuánto comieron
  let avesDiaConsumo = 0
  let kgHuevoSemana = 0
  let clasificadosSemana = 0
  let avesInicioSemana = lote.aves_iniciales

  let saldo = lote.aves_iniciales
  let consumoVigente = 0
  let huevosAcum = 0
  let muertesAcum = 0

  const cerrar = (f: FilaSemana) => {
    f.posturaPct = f.etapa === 'postura' && avesDiaRegistrados > 0 ? (f.huevos / avesDiaRegistrados) * 100 : null
    f.consumoAveGDia = avesDiaConsumo > 0 && f.consumoKg > 0 ? (f.consumoKg * 1000) / avesDiaConsumo : null
    f.pesoHuevoG = clasificadosSemana > 0 ? kgHuevoSemana * 1000 / clasificadosSemana : null
    f.mortalidadPct = avesInicioSemana > 0 ? (f.muertes / avesInicioSemana) * 100 : null
    // Kg de alimento por kg de huevo, con el peso estimado por gramaje
    const kgHuevo = f.pesoHuevoG != null ? (f.huevos * f.pesoHuevoG) / 1000 : 0
    f.conversion = kgHuevo > 0 && f.consumoKg > 0 ? f.consumoKg / kgHuevo : null
    const pesaje = [...pesajesOrden].reverse().find(p => p.fecha >= f.desde && p.fecha <= f.hasta)
    f.pesoAveG = pesaje ? Number(pesaje.peso_promedio_g) : null
    filas.push(f)
  }

  const d = new Date(lote.fecha_inicio + 'T00:00:00')
  const fin = new Date(hoy + 'T00:00:00')
  for (; d <= fin; d.setDate(d.getDate() + 1)) {
    const fecha = aFechaLocal(d)
    const { etapa, semana } = semanaDelLote(lote, fecha)
    const clave = `${etapa}-${semana}`
    if (!actual || actual.clave !== clave) {
      if (actual) cerrar(actual)
      actual = {
        clave, etapa, semana, desde: fecha, hasta: fecha,
        huevos: 0, huevosAcumulados: 0, saldoAves: saldo, muertes: 0, consumoKg: 0,
        pesoAveG: null, pesoHuevoG: null, avesEncasetadas: lote.aves_iniciales,
        posturaPct: null, haa: 0, consumoAveGDia: null, mortalidadPct: null, mortalidadAcumPct: 0, conversion: null,
        porTamano: { b: 0, a: 0, aa: 0, aaa: 0, jumbo: 0 }, avesDia: 0,
      }
      avesDiaRegistrados = 0
      avesDiaConsumo = 0
      kgHuevoSemana = 0
      clasificadosSemana = 0
      avesInicioSemana = saldo
    }
    const f: FilaSemana = actual
    const r = porFecha.get(fecha)
    // Las aves del día son las que amanecieron: las bajas del día cuentan desde mañana
    if (r && Number(r.alimento_kg) > 0) consumoVigente = Number(r.alimento_kg)
    f.consumoKg += consumoVigente
    if (consumoVigente > 0) avesDiaConsumo += Math.max(0, saldo)
    f.avesDia += Math.max(0, saldo)

    if (r) {
      avesDiaRegistrados += Math.max(0, saldo)
      f.huevos += r.huevos_totales
      kgHuevoSemana += (r.huevos_b * PESO_HUEVO_G.b + r.huevos_a * PESO_HUEVO_G.a + r.huevos_aa * PESO_HUEVO_G.aa
        + r.huevos_aaa * PESO_HUEVO_G.aaa + r.huevos_jumbo * PESO_HUEVO_G.jumbo) / 1000
      clasificadosSemana += r.huevos_b + r.huevos_a + r.huevos_aa + r.huevos_aaa + r.huevos_jumbo
      f.porTamano.b += r.huevos_b; f.porTamano.a += r.huevos_a; f.porTamano.aa += r.huevos_aa
      f.porTamano.aaa += r.huevos_aaa; f.porTamano.jumbo += r.huevos_jumbo
    }
    const muertesDia = (r?.muertes ?? 0) + (extra.get(fecha) ?? 0)
    f.muertes += muertesDia
    muertesAcum += muertesDia
    huevosAcum += r?.huevos_totales ?? 0
    saldo -= muertesDia + (vendidas.get(fecha) ?? 0)

    f.hasta = fecha
    f.saldoAves = saldo
    f.huevosAcumulados = huevosAcum
    f.haa = lote.aves_iniciales > 0 ? huevosAcum / lote.aves_iniciales : 0
    f.mortalidadAcumPct = lote.aves_iniciales > 0 ? (muertesAcum / lote.aves_iniciales) * 100 : 0
  }
  if (actual) cerrar(actual)
  return filas
}
