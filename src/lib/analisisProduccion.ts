/**
 * Análisis de la producción de huevo de lotes enteros, sin nada de ventas: por
 * mes, por semana de vida y por tamaño. Lo usa el análisis de las fincas con
 * datos viejos (fincas.sin_registro_ventas), donde solo hay producción.
 */
import { TAMANOS_HUEVO, type TamanoHuevo } from '@/lib/huevos'
import { esperadoDeSemana, mortalidadEsperadaDesde, semanaDeVida, type FilaReferencia } from '@/lib/referencias'

export interface DiaProduccion {
  lote_id: string
  fecha: string
  huevos_totales: number
  aves_en_dia: number | null
  muertes: number
  alimento_kg: number
  huevos_c: number; huevos_b: number; huevos_a: number; huevos_aa: number; huevos_aaa: number; huevos_jumbo: number
  huevos_rotos: number
  huevos_sucios: number
}

export interface LoteAnalisis {
  id: string
  nombre: string
  fecha_nacimiento: string | null
  fecha_inicio_postura: string | null
  aves_iniciales: number
}

export interface Acumulado {
  huevos: number
  /** Suma de las aves de cada día con aves contadas: el divisor de la postura */
  avesDias: number
  /** Huevos de esos mismos días, para que la postura no cuente días sin aves */
  huevosConAves: number
  alimentoConAvesKg: number
  muertes: number
  dias: number
  tamanos: Record<TamanoHuevo, number>
  clasificados: number
  rotos: number
  sucios: number
}

const vacio = (): Acumulado => ({
  huevos: 0, avesDias: 0, huevosConAves: 0, alimentoConAvesKg: 0, muertes: 0, dias: 0,
  tamanos: Object.fromEntries(TAMANOS_HUEVO.map(t => [t.key, 0])) as Record<TamanoHuevo, number>,
  clasificados: 0, rotos: 0, sucios: 0,
})

function sumar(a: Acumulado, d: DiaProduccion) {
  a.huevos += d.huevos_totales
  a.muertes += d.muertes
  a.dias += 1
  if (d.aves_en_dia && d.aves_en_dia > 0) {
    a.avesDias += d.aves_en_dia
    a.huevosConAves += d.huevos_totales
    a.alimentoConAvesKg += Number(d.alimento_kg)
  }
  for (const t of TAMANOS_HUEVO) {
    const v = d[`huevos_${t.key}` as const] ?? 0
    a.tamanos[t.key] += v
    a.clasificados += v
  }
  a.rotos += d.huevos_rotos
  a.sucios += d.huevos_sucios
}

/** Postura (%) de lo acumulado: huevos sobre aves de los días con aves contadas. */
export const posturaDe = (a: Acumulado) => (a.avesDias > 0 ? (a.huevosConAves / a.avesDias) * 100 : null)
/** Alimento por ave al día, en gramos. */
export const gramosAveDe = (a: Acumulado) => (a.avesDias > 0 ? (a.alimentoConAvesKg * 1000) / a.avesDias : null)
/** Parte (%) de un tamaño entre los huevos clasificados. */
export const parteDe = (a: Acumulado, t: TamanoHuevo) => (a.clasificados > 0 ? (a.tamanos[t] / a.clasificados) * 100 : null)

const MS_DIA = 86_400_000

/**
 * Los días de postura: desde el inicio de postura, o desde el primer huevo si no
 * hay fecha. Pasadas 4 semanas de postura, un día con 0 huevos es un día que no
 * se anotó (en los Excel quedan así los últimos días): no cuenta como 0 %.
 */
function enPostura(d: DiaProduccion, lote: LoteAnalisis | undefined) {
  const inicio = lote?.fecha_inicio_postura
  if (!inicio) return d.huevos_totales > 0
  if (d.fecha < inicio) return false
  const dias = (new Date(d.fecha + 'T00:00:00').getTime() - new Date(inicio + 'T00:00:00').getTime()) / MS_DIA
  return d.huevos_totales > 0 || dias < 28
}

/** Acumulado de cada mes ('2024-05'), en orden. Solo días de postura. */
export function porMes(dias: DiaProduccion[], lotes: LoteAnalisis[]): { mes: string; a: Acumulado }[] {
  const lotePor = new Map(lotes.map(l => [l.id, l]))
  const meses = new Map<string, Acumulado>()
  for (const d of dias) {
    if (!enPostura(d, lotePor.get(d.lote_id))) continue
    const mes = d.fecha.slice(0, 7)
    if (!meses.has(mes)) meses.set(mes, vacio())
    sumar(meses.get(mes)!, d)
  }
  return [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, a]) => ({ mes, a }))
}

/** Acumulado de cada semana de vida de un lote, en orden. Solo días de postura. */
export function porSemanaDeVida(dias: DiaProduccion[], lote: LoteAnalisis): { semana: number; a: Acumulado }[] {
  const semanas = new Map<number, Acumulado>()
  for (const d of dias) {
    if (d.lote_id !== lote.id || !enPostura(d, lote)) continue
    const s = semanaDeVida(lote.fecha_nacimiento, d.fecha)
    if (s == null) continue
    if (!semanas.has(s)) semanas.set(s, vacio())
    sumar(semanas.get(s)!, d)
  }
  return [...semanas.entries()].sort(([a], [b]) => a - b).map(([semana, a]) => ({ semana, a }))
}

/** Todo junto: los días de postura de los lotes dados, y la mortalidad de todo el ciclo. */
export function resumenLotes(dias: DiaProduccion[], lotes: LoteAnalisis[]) {
  const lotePor = new Map(lotes.map(l => [l.id, l]))
  const total = vacio()
  let muertesCiclo = 0
  for (const d of dias) {
    if (!lotePor.has(d.lote_id)) continue
    muertesCiclo += d.muertes
    if (enPostura(d, lotePor.get(d.lote_id))) sumar(total, d)
  }
  const avesIniciales = lotes.reduce((s, l) => s + l.aves_iniciales, 0)
  // El pico: la mejor semana de vida de cualquiera de los lotes
  let pico: { pct: number; semana: number; lote: string } | null = null
  for (const l of lotes) {
    for (const { semana, a } of porSemanaDeVida(dias, l)) {
      const p = posturaDe(a)
      if (p != null && a.dias >= 5 && (!pico || p > pico.pct)) pico = { pct: p, semana, lote: l.nombre }
    }
  }
  return {
    total,
    postura: posturaDe(total),
    gramosAve: gramosAveDe(total),
    mortalidad: avesIniciales > 0 ? (muertesCiclo / avesIniciales) * 100 : null,
    muertesCiclo,
    pico,
  }
}

/** "may 2024" */
export function nombreMes(mes: string, corto = true) {
  return new Date(mes + '-01T00:00:00').toLocaleDateString('es-CO', { month: corto ? 'short' : 'long', year: 'numeric' })
}

// ─── Análisis profundo de lotes cerrados (Resumen de las fincas con datos viejos) ───


export type Guia = Map<number, FilaReferencia>

/** Lo que dejó cada lote en todo su ciclo de postura. */
export interface FilaLote {
  lote: LoteAnalisis
  /** Las aves que empezaron la postura (las del primer día de postura) */
  avesAlojadas: number | null
  diasPostura: number
  huevos: number
  /** Huevos por ave alojada: la medida que más dice de un lote entero */
  huevosAve: number | null
  postura: number | null
  pico: { pct: number; semana: number } | null
  /** Semanas con la postura en 90 % o más */
  semanasSobre90: number
  /** Muertes desde el inicio de postura, en % de las aves alojadas */
  mortalidadPostura: number | null
  muertesPostura: number
  /** Muertes antes de la postura (levante), si las hay */
  muertesLevante: number
  gramosAve: number | null
  /** Kilos de alimento por cada docena de huevos */
  kgDocena: number | null
  parteC: number | null
  rotosPct: number | null
  /** Puntos por encima (+) o por debajo (−) de la guía, en promedio por semana */
  contraGuia: number | null
}

function diasDelLote(dias: DiaProduccion[], lote: LoteAnalisis) {
  return dias.filter(d => d.lote_id === lote.id).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** El resumen de cada lote, en el orden de los lotes. */
export function analisisPorLote(dias: DiaProduccion[], lotes: LoteAnalisis[], guiaDe: (l: LoteAnalisis) => Guia | undefined): FilaLote[] {
  return lotes.map(lote => {
    const propios = diasDelLote(dias, lote)
    const inicio = lote.fecha_inicio_postura
    const deLaPostura = propios.filter(d => !inicio || d.fecha >= inicio)
    const avesAlojadas = deLaPostura.find(d => d.aves_en_dia && d.aves_en_dia > 0)?.aves_en_dia ?? null
    const total = vacio()
    for (const d of propios) if (enPostura(d, lote)) sumar(total, d)
    const muertesPostura = deLaPostura.reduce((s, d) => s + d.muertes, 0)
    const muertesLevante = propios.reduce((s, d) => s + d.muertes, 0) - muertesPostura
    const semanas = porSemanaDeVida(dias, lote)
    let pico: FilaLote['pico'] = null
    let sobre90 = 0
    const desvios: number[] = []
    const guia = guiaDe(lote)
    for (const { semana, a } of semanas) {
      const p = posturaDe(a)
      if (p == null || a.dias < 5) continue
      if (!pico || p > pico.pct) pico = { pct: p, semana }
      if (p >= 90) sobre90++
      const g = guia ? esperadoDeSemana(guia, semana)?.postura : null
      if (g != null) desvios.push(p - g)
    }
    return {
      lote, avesAlojadas, diasPostura: total.dias, huevos: total.huevos,
      huevosAve: avesAlojadas ? total.huevos / avesAlojadas : null,
      postura: posturaDe(total), pico, semanasSobre90: sobre90,
      mortalidadPostura: avesAlojadas ? (muertesPostura / avesAlojadas) * 100 : null,
      muertesPostura, muertesLevante,
      gramosAve: gramosAveDe(total),
      kgDocena: total.huevosConAves > 0 ? total.alimentoConAvesKg / (total.huevosConAves / 12) : null,
      parteC: parteDe(total, 'c'),
      rotosPct: total.huevos > 0 && total.clasificados > 0 ? (total.rotos / total.huevos) * 100 : null,
      contraGuia: desvios.length > 0 ? desvios.reduce((s, x) => s + x, 0) / desvios.length : null,
    }
  })
}

/** Un mes de la finca: su producción (días de postura) y sus muertes (todos los días). */
export interface MesFinca {
  mes: string
  a: Acumulado
  postura: number | null
  muertes: number
  /** Muertes en % de las aves promedio del mes (null si no hay aves contadas) */
  mortalidad: number | null
  /** El mes es el primero o el último de algún lote: arranque o cierre, no cuenta para mejor o peor */
  parcial: boolean
  lotes: string[]
}

export function mesesDeLaFinca(dias: DiaProduccion[], lotes: LoteAnalisis[]): MesFinca[] {
  const lotePor = new Map(lotes.map(l => [l.id, l]))
  const prod = new Map(porMes(dias, lotes).map(m => [m.mes, m.a]))
  const muertes = new Map<string, number>()
  const avesPorDia = new Map<string, Map<string, number>>()
  const lotesMes = new Map<string, Set<string>>()
  for (const d of dias) {
    const l = lotePor.get(d.lote_id)
    if (!l) continue
    const mes = d.fecha.slice(0, 7)
    muertes.set(mes, (muertes.get(mes) ?? 0) + d.muertes)
    if (d.aves_en_dia && d.aves_en_dia > 0) {
      const delMes = avesPorDia.get(mes) ?? new Map<string, number>()
      delMes.set(d.fecha, (delMes.get(d.fecha) ?? 0) + d.aves_en_dia)
      avesPorDia.set(mes, delMes)
    }
    if (!lotesMes.has(mes)) lotesMes.set(mes, new Set())
    lotesMes.get(mes)!.add(l.nombre)
  }
  // Primer y último mes de postura de cada lote
  const bordes = new Set<string>()
  for (const l of lotes) {
    const ms = [...new Set(dias.filter(d => d.lote_id === l.id && enPostura(d, l)).map(d => d.fecha.slice(0, 7)))].sort()
    if (ms.length) { bordes.add(ms[0]); bordes.add(ms[ms.length - 1]) }
  }
  const meses = [...new Set([...prod.keys(), ...muertes.keys()])].sort()
  return meses.map(mes => {
    const a = prod.get(mes) ?? vacio()
    const aves = [...(avesPorDia.get(mes)?.values() ?? [])]
    const avesProm = aves.length ? aves.reduce((s, x) => s + x, 0) / aves.length : null
    const m = muertes.get(mes) ?? 0
    return {
      mes, a, postura: posturaDe(a), muertes: m,
      mortalidad: avesProm ? (m / avesProm) * 100 : null,
      parcial: bordes.has(mes), lotes: [...(lotesMes.get(mes) ?? [])],
    }
  })
}

/** Mortalidad acumulada de un lote desde el inicio de postura, semana a semana, frente a la guía. */
export function mortalidadAcumulada(dias: DiaProduccion[], lote: LoteAnalisis, guia?: Guia): { semana: number; real: number; guia: number | null }[] {
  const inicio = lote.fecha_inicio_postura
  const propios = diasDelLote(dias, lote).filter(d => !inicio || d.fecha >= inicio)
  const alojadas = propios.find(d => d.aves_en_dia && d.aves_en_dia > 0)?.aves_en_dia
  if (!alojadas) return []
  const porSemana = new Map<number, number>()
  for (const d of propios) {
    const s = semanaDeVida(lote.fecha_nacimiento, d.fecha)
    if (s != null) porSemana.set(s, (porSemana.get(s) ?? 0) + d.muertes)
  }
  const semanas = [...porSemana.keys()].sort((a, b) => a - b)
  if (!semanas.length) return []
  let acum = 0
  return semanas.map(s => {
    acum += porSemana.get(s)!
    return {
      semana: s,
      real: (acum / alojadas) * 100,
      guia: guia && guia.size > 0 ? mortalidadEsperadaDesde(guia, semanas[0], s) : null,
    }
  })
}

/** Lo más llamativo de los datos, en frases cortas para el productor. */
export interface Hallazgo { tono: 'bien' | 'mal' | 'nota'; texto: string }

export function hallazgos(lotesRes: FilaLote[], meses: MesFinca[]): Hallazgo[] {
  const out: Hallazgo[] = []
  const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
  const completos = meses.filter(m => !m.parcial && m.postura != null && m.a.dias >= 20)
  const mejor = completos.reduce<MesFinca | null>((x, m) => (!x || m.postura! > x.postura! ? m : x), null)
  const peor = completos.reduce<MesFinca | null>((x, m) => (!x || m.postura! < x.postura! ? m : x), null)
  if (mejor) out.push({ tono: 'bien', texto: `El mejor mes fue ${nombreMes(mejor.mes, false)}: ${n1(mejor.postura!)} % de postura y ${mejor.a.huevos.toLocaleString('es-CO')} huevos.` })
  if (peor && peor !== mejor) out.push({ tono: 'mal', texto: `El peor mes fue ${nombreMes(peor.mes, false)}: ${n1(peor.postura!)} % de postura (sin contar el arranque ni el cierre de los lotes).` })
  const masMuertes = meses.reduce<MesFinca | null>((x, m) => (!x || m.muertes > x.muertes ? m : x), null)
  const totalMuertes = meses.reduce((s, m) => s + m.muertes, 0)
  if (masMuertes && masMuertes.muertes > 0) {
    const parte = totalMuertes > 0 ? (masMuertes.muertes / totalMuertes) * 100 : 0
    out.push({ tono: parte >= 25 ? 'mal' : 'nota', texto: `El mes con más muertes fue ${nombreMes(masMuertes.mes, false)}: ${masMuertes.muertes.toLocaleString('es-CO')} aves${parte >= 15 ? `, el ${n1(parte)} % de todas las muertes` : ''}.` })
  }
  const conHA = lotesRes.filter(l => l.huevosAve != null)
  if (conHA.length > 1) {
    const top = conHA.reduce((x, l) => (l.huevosAve! > x.huevosAve! ? l : x))
    out.push({ tono: 'bien', texto: `${top.lote.nombre} fue el lote más productivo: ${Math.round(top.huevosAve!)} huevos por ave alojada.` })
  }
  const persistente = lotesRes.filter(l => l.semanasSobre90 > 0).sort((a, b) => b.semanasSobre90 - a.semanasSobre90)[0]
  if (persistente) out.push({ tono: 'bien', texto: `${persistente.lote.nombre} sostuvo 90 % o más de postura durante ${persistente.semanasSobre90} semanas.` })
  for (const l of lotesRes) {
    if (l.contraGuia == null || Math.abs(l.contraGuia) < 2) continue
    out.push({ tono: l.contraGuia > 0 ? 'bien' : 'mal', texto: `${l.lote.nombre} estuvo en promedio ${n1(Math.abs(l.contraGuia))} puntos ${l.contraGuia > 0 ? 'por encima' : 'por debajo'} de la guía de la línea.` })
  }
  const conConv = lotesRes.filter(l => l.kgDocena != null)
  if (conConv.length > 1) {
    const mejorConv = conConv.reduce((x, l) => (l.kgDocena! < x.kgDocena! ? l : x))
    out.push({ tono: 'nota', texto: `La mejor conversión fue la de ${mejorConv.lote.nombre}: ${n1(mejorConv.kgDocena!)} kg de alimento por docena de huevos.` })
  }
  const mesC = meses.filter(m => m.a.clasificados >= 1000)
    .reduce<{ m: MesFinca; p: number } | null>((x, m) => { const p = parteDe(m.a, 'c') ?? 0; return !x || p > x.p ? { m, p } : x }, null)
  if (mesC && mesC.p >= 1) out.push({ tono: 'nota', texto: `El huevo C se concentró en ${nombreMes(mesC.m.mes, false)} (${n1(mesC.p)} % de lo clasificado), cuando ${mesC.m.lotes.join(' y ')} ${mesC.m.lotes.length > 1 ? 'estaban' : 'estaba'} en postura.` })
  return out
}

// ─── Periodo: el análisis de un rango de fechas ───

/** Un rango de fechas (AAAA-MM-DD); null en un extremo es "sin límite". */
export interface Periodo { desde: string | null; hasta: string | null }
export const TODO_EL_TIEMPO: Periodo = { desde: null, hasta: null }

/** Los días dentro del periodo. */
export function filtrarPorPeriodo<T extends { fecha: string }>(dias: T[], p: Periodo): T[] {
  if (!p.desde && !p.hasta) return dias
  return dias.filter(d => (!p.desde || d.fecha >= p.desde) && (!p.hasta || d.fecha <= p.hasta))
}

/** El último día de un mes ('2025-02' → '2025-02-28'). */
export function finDeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`
}

/** Los periodos para elegir según los datos que hay: todo, los últimos 12 meses con datos y cada año. */
export function periodosDisponibles(dias: { fecha: string }[]): { id: string; nombre: string; p: Periodo }[] {
  if (dias.length === 0) return [{ id: 'todo', nombre: 'Todo el tiempo', p: TODO_EL_TIEMPO }]
  let min = dias[0].fecha, max = dias[0].fecha
  for (const d of dias) { if (d.fecha < min) min = d.fecha; if (d.fecha > max) max = d.fecha }
  const hace12 = new Date(max + 'T00:00:00'); hace12.setMonth(hace12.getMonth() - 11)
  const desde12 = `${hace12.getFullYear()}-${String(hace12.getMonth() + 1).padStart(2, '0')}-01`
  const anios: number[] = []
  for (let a = Number(max.slice(0, 4)); a >= Number(min.slice(0, 4)); a--) anios.push(a)
  return [
    { id: 'todo', nombre: 'Todo el tiempo', p: TODO_EL_TIEMPO },
    { id: '12m', nombre: 'Últimos 12 meses con datos', p: { desde: desde12, hasta: null } },
    ...anios.map(a => ({ id: String(a), nombre: `Año ${a}`, p: { desde: `${a}-01-01`, hasta: `${a}-12-31` } })),
  ]
}

// ─── Alimento de un lote, hasta un día ───

export interface AlimentoLote {
  /** Por semana de vida: kilos y gramos por ave al día */
  semanas: { semana: number; kg: number; gAve: number | null; dias: number }[]
  meses: { mes: string; kg: number; gAve: number | null; huevos: number; kgDocena: number | null }[]
  totalKg: number
  gAve: number | null
  kgDocena: number | null
  dias: number
}

/**
 * Lo que comió un lote hasta `hasta`. Las aves de cada día son las anotadas; si el
 * día no las tiene (levante), las que entraron menos las muertas hasta ese día.
 */
export function alimentoDelLote(dias: DiaProduccion[], lote: LoteAnalisis, hasta: string): AlimentoLote {
  const propios = dias.filter(d => d.lote_id === lote.id && d.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha))
  let muertas = 0
  const semanas = new Map<number, { kg: number; avesDias: number; kgConAves: number; dias: number }>()
  const meses = new Map<string, { kg: number; avesDias: number; kgConAves: number; huevos: number; kgHuevo: number }>()
  let totalKg = 0, totalAvesDias = 0, totalKgConAves = 0, huevosConAlimento = 0, kgConHuevos = 0
  for (const d of propios) {
    const kg = Number(d.alimento_kg) || 0
    const aves = d.aves_en_dia && d.aves_en_dia > 0 ? d.aves_en_dia : Math.max(0, lote.aves_iniciales - muertas)
    muertas += d.muertes
    if (kg <= 0) continue
    totalKg += kg
    if (aves > 0) { totalAvesDias += aves; totalKgConAves += kg }
    if (d.huevos_totales > 0) { huevosConAlimento += d.huevos_totales; kgConHuevos += kg }
    const s = semanaDeVida(lote.fecha_nacimiento, d.fecha)
    if (s != null) {
      const w = semanas.get(s) ?? { kg: 0, avesDias: 0, kgConAves: 0, dias: 0 }
      w.kg += kg; w.dias++
      if (aves > 0) { w.avesDias += aves; w.kgConAves += kg }
      semanas.set(s, w)
    }
    const mes = d.fecha.slice(0, 7)
    const m = meses.get(mes) ?? { kg: 0, avesDias: 0, kgConAves: 0, huevos: 0, kgHuevo: 0 }
    m.kg += kg
    if (aves > 0) { m.avesDias += aves; m.kgConAves += kg }
    if (d.huevos_totales > 0) { m.huevos += d.huevos_totales; m.kgHuevo += kg }
    meses.set(mes, m)
  }
  const g = (kg: number, avesDias: number) => (avesDias > 0 ? (kg * 1000) / avesDias : null)
  return {
    semanas: [...semanas.entries()].sort(([a], [b]) => a - b).map(([semana, w]) => ({ semana, kg: w.kg, gAve: g(w.kgConAves, w.avesDias), dias: w.dias })),
    meses: [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, m]) => ({
      mes, kg: m.kg, gAve: g(m.kgConAves, m.avesDias), huevos: m.huevos, kgDocena: m.huevos > 0 ? m.kgHuevo / (m.huevos / 12) : null,
    })),
    totalKg, gAve: g(totalKgConAves, totalAvesDias),
    kgDocena: huevosConAlimento > 0 ? kgConHuevos / (huevosConAlimento / 12) : null,
    dias: propios.length,
  }
}
