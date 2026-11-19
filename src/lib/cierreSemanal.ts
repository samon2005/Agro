/**
 * El cierre de una semana (lunes a domingo). En la industria cada galpón se maneja
 * por semana: aquí sale lo de cada galpón, lo de la finca entera, el mejor y el
 * peor día, el patrón de cada día de la semana y el cambio frente a la semana
 * anterior. Lo usan el Resumen y el cierre guardado (tabla cierres_semanales).
 */
import { aFechaLocal } from '@/lib/fechas'
import { semanaDeVida, type FilaReferencia } from '@/lib/referencias'
import { metaDeFecha, type LoteConMeta } from '@/lib/metasPostura'

/** Un día registrado de un galpón. */
export interface DiaCierre {
  fecha: string; lote: string; huevos: number; aves: number | null; muertes: number; alimentoKg: number
  rotos?: number; sucios?: number; podridos?: number
}
export interface LoteCierre extends LoteConMeta { id: string; nombre: string; referencia_id: string | null }

const MS_DIA = 86_400_000
export const sumarDias = (f: string, n: number) => aFechaLocal(new Date(new Date(f + 'T00:00:00').getTime() + n * MS_DIA))
/** El lunes de la semana de una fecha. */
export const lunesDe = (f: string) => sumarDias(f, -((new Date(f + 'T00:00:00').getDay() + 6) % 7))
/** Los lunes de las últimas `n` semanas, la de hoy primero. */
export const ultimasSemanas = (hoy: string, n: number) => Array.from({ length: n }, (_, i) => sumarDias(lunesDe(hoy), -7 * i))

export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
/** 0 = lunes … 6 = domingo */
const indiceDia = (f: string) => (new Date(f + 'T00:00:00').getDay() + 6) % 7

export interface Totales {
  registros: number
  huevos: number
  /** Postura: huevos ÷ aves de los días con aves contadas */
  postura: number | null
  meta: number | null
  muertes: number
  mortalidad: number | null
  alimentoG: number | null
  rotosPct: number | null
  /** Sucios y podridos */
  malosPct: number | null
}

function totales(dias: DiaCierre[], metas: number[], avesInicio: number | null): Totales {
  const huevos = dias.reduce((s, d) => s + d.huevos, 0)
  const conAves = dias.filter(d => d.aves && d.aves > 0)
  const avesDias = conAves.reduce((s, d) => s + (d.aves ?? 0), 0)
  const huevosConAves = conAves.reduce((s, d) => s + d.huevos, 0)
  const muertes = dias.reduce((s, d) => s + d.muertes, 0)
  const rotos = dias.reduce((s, d) => s + (d.rotos ?? 0), 0)
  const malos = dias.reduce((s, d) => s + (d.sucios ?? 0) + (d.podridos ?? 0), 0)
  return {
    registros: dias.length,
    huevos,
    postura: avesDias > 0 ? (huevosConAves / avesDias) * 100 : null,
    meta: metas.length > 0 ? metas.reduce((s, x) => s + x, 0) / metas.length : null,
    muertes,
    mortalidad: avesInicio ? (muertes / avesInicio) * 100 : null,
    alimentoG: avesDias > 0 ? (conAves.reduce((s, d) => s + d.alimentoKg, 0) * 1000) / avesDias : null,
    rotosPct: huevos > 0 ? (rotos / huevos) * 100 : null,
    malosPct: huevos > 0 ? (malos / huevos) * 100 : null,
  }
}

/** Las aves al empezar la semana: las del primer día con aves de cada galpón, sumadas. */
function avesAlEmpezar(dias: DiaCierre[]): number | null {
  const porLote = new Map<string, DiaCierre>()
  for (const d of [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha))) if (d.aves && !porLote.has(d.lote)) porLote.set(d.lote, d)
  const total = [...porLote.values()].reduce((s, d) => s + (d.aves ?? 0), 0)
  return total > 0 ? total : null
}

export interface DiaDeLaSemana { fecha: string; nombre: string; huevos: number; postura: number | null; registros: number }

export interface CierreAves {
  lunes: string
  domingo: string
  enCurso: boolean
  /** Días que van de la semana (7 si ya terminó) */
  diasSemana: number
  filas: { lote: LoteCierre; semanaVida: number | null; t: Totales; diferencia: number | null }[]
  finca: Totales
  /** Cada día de la semana, para la finca entera */
  dias: DiaDeLaSemana[]
  mejorDia: DiaDeLaSemana | null
  peorDia: DiaDeLaSemana | null
  /** La semana anterior, para comparar */
  anterior: Totales
}

/** El cierre de las aves de la semana que empieza el `lunes`. */
export function cierreAves(
  lotes: LoteCierre[], dias: DiaCierre[], lunes: string, hoy: string,
  guiaDe: (l: LoteCierre) => Map<number, FilaReferencia> | undefined,
  /** La tabla base de la finca (lib/configAves), que manda sobre la guía */
  base?: Map<number, FilaReferencia>,
): CierreAves {
  const domingo = sumarDias(lunes, 6)
  const enCurso = lunes === lunesDe(hoy)
  const ids = new Set(lotes.map(l => l.id))
  const deLaSemana = (desde: string, hasta: string) => dias.filter(d => ids.has(d.lote) && d.fecha >= desde && d.fecha <= hasta)
  const semana = deLaSemana(lunes, domingo)
  const metasDe = (ds: DiaCierre[]) => ds.flatMap(d => {
    const l = lotes.find(x => x.id === d.lote)
    const m = l ? metaDeFecha(l, d.fecha, guiaDe(l), base)?.pct : null
    return m != null ? [m] : []
  })

  const filas = lotes.map(l => {
    const delLote = semana.filter(d => d.lote === l.id)
    const metas = metasDe(delLote)
    const t = totales(delLote, metas.length ? metas : [metaDeFecha(l, lunes, guiaDe(l), base)?.pct].filter((x): x is number => x != null), avesAlEmpezar(delLote))
    return { lote: l, semanaVida: semanaDeVida(l.fecha_nacimiento, lunes), t, diferencia: t.postura != null && t.meta != null ? t.postura - t.meta : null }
  })

  const diasSemana: DiaDeLaSemana[] = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes, i)
    const delDia = semana.filter(d => d.fecha === fecha)
    const t = totales(delDia, [], null)
    return { fecha, nombre: DIAS_SEMANA[i], huevos: t.huevos, postura: t.postura, registros: t.registros }
  })
  // El mejor y el peor día: solo los días que tienen a todos los galpones registrados
  const completos = diasSemana.filter(d => d.postura != null && d.registros >= lotes.length)
  const mejorDia = completos.reduce<DiaDeLaSemana | null>((x, d) => (!x || d.postura! > x.postura! ? d : x), null)
  const peorDia = completos.reduce<DiaDeLaSemana | null>((x, d) => (!x || d.postura! < x.postura! ? d : x), null)

  const anteriorDias = deLaSemana(sumarDias(lunes, -7), sumarDias(lunes, -1))
  return {
    lunes, domingo, enCurso,
    diasSemana: enCurso ? Math.max(1, Math.round((new Date(hoy + 'T00:00:00').getTime() - new Date(lunes + 'T00:00:00').getTime()) / MS_DIA) + 1) : 7,
    filas,
    finca: totales(semana, metasDe(semana), avesAlEmpezar(semana)),
    dias: diasSemana,
    mejorDia, peorDia: peorDia && mejorDia && peorDia.fecha !== mejorDia.fecha ? peorDia : null,
    anterior: totales(anteriorDias, metasDe(anteriorDias), avesAlEmpezar(anteriorDias)),
  }
}

/**
 * El patrón de cada día de la semana en las últimas semanas: la postura promedio
 * de los lunes, de los martes… Sirve para ver si un día siempre sale peor (un turno,
 * un operario, la hora de recolección).
 */
export function patronDiaSemana(dias: DiaCierre[], lotesIds: string[], desde: string, hasta: string) {
  const ids = new Set(lotesIds)
  const acum = Array.from({ length: 7 }, () => ({ huevos: 0, aves: 0, dias: new Set<string>() }))
  for (const d of dias) {
    if (!ids.has(d.lote) || d.fecha < desde || d.fecha > hasta || !d.aves || d.aves <= 0) continue
    const a = acum[indiceDia(d.fecha)]
    a.huevos += d.huevos; a.aves += d.aves; a.dias.add(d.fecha)
  }
  const porDia = acum.map((a, i) => ({ nombre: DIAS_SEMANA[i], postura: a.aves > 0 ? (a.huevos / a.aves) * 100 : null, semanas: a.dias.size }))
  const validos = porDia.filter(p => p.postura != null && p.semanas >= 2)
  const mejor = validos.reduce<typeof porDia[number] | null>((x, p) => (!x || p.postura! > x.postura! ? p : x), null)
  const peor = validos.reduce<typeof porDia[number] | null>((x, p) => (!x || p.postura! < x.postura! ? p : x), null)
  return { porDia, mejor, peor: peor && mejor && peor.nombre !== mejor.nombre ? peor : null }
}

// ─── Cerdos ───

export interface MovimientosCerdos {
  servicios: { fecha_servicio: string }[]
  partos: { fecha_parto: string; nacidos_vivos: number | null; nacidos_muertos: number | null; momificados: number | null; muertos_postparto: number | null }[]
  destetes: { fecha_destete: string; lechones_destetados: number | null; peso_promedio_kg: number | null }[]
  mortalidad: { fecha: string; cantidad: number | null }[]
  alimento: { fecha: string; kg: number }[]
}

export interface TotalesCerdos {
  servicios: number
  partos: number
  nacidosVivos: number
  nacidosTotales: number
  vivosPorParto: number | null
  muertosPostparto: number
  destetados: number
  pesoDestete: number | null
  muertes: number
  alimentoKg: number
}

/** Lo de una semana de cerdos (entre `desde` y `hasta`, ambos incluidos). */
export function totalesCerdos(m: MovimientosCerdos, desde: string, hasta: string): TotalesCerdos {
  const en = (f: string) => f >= desde && f <= hasta
  const partos = m.partos.filter(p => en(p.fecha_parto))
  const destetes = m.destetes.filter(d => en(d.fecha_destete))
  const vivos = partos.reduce((s, p) => s + (p.nacidos_vivos ?? 0), 0)
  const destetados = destetes.reduce((s, d) => s + (d.lechones_destetados ?? 0), 0)
  const conPeso = destetes.filter(d => d.peso_promedio_kg != null && (d.lechones_destetados ?? 0) > 0)
  const lechonesConPeso = conPeso.reduce((s, d) => s + (d.lechones_destetados ?? 0), 0)
  return {
    servicios: m.servicios.filter(s => en(s.fecha_servicio)).length,
    partos: partos.length,
    nacidosVivos: vivos,
    nacidosTotales: partos.reduce((s, p) => s + (p.nacidos_vivos ?? 0) + (p.nacidos_muertos ?? 0) + (p.momificados ?? 0), 0),
    vivosPorParto: partos.length ? vivos / partos.length : null,
    muertosPostparto: partos.reduce((s, p) => s + (p.muertos_postparto ?? 0), 0),
    destetados,
    pesoDestete: lechonesConPeso > 0 ? conPeso.reduce((s, d) => s + Number(d.peso_promedio_kg) * (d.lechones_destetados ?? 0), 0) / lechonesConPeso : null,
    muertes: m.mortalidad.filter(x => en(x.fecha)).reduce((s, x) => s + (x.cantidad ?? 0), 0),
    alimentoKg: m.alimento.filter(a => en(a.fecha)).reduce((s, a) => s + a.kg, 0),
  }
}
