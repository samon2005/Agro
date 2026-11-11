/**
 * Indicadores de cerdos: una sola fuente de fórmulas (sección 13 de la
 * entrevista con José). Los usan la pantalla de cría, la de engorde, las
 * fichas, los reportes, las alertas y las predicciones. Si una fórmula cambia,
 * cambia aquí y se refleja en todas partes.
 *
 * Todas son funciones puras: reciben los registros y devuelven el número (o
 * null si no hay datos suficientes para calcularlo, para no mostrar un cero
 * engañoso).
 */
import type { ConfigCerdos, EtapaEngorde } from '@/lib/configCerdos'

const MS_DIA = 86_400_000
const dias = (desde: string, hasta: string) => Math.round((new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / MS_DIA)
const promedio = (v: number[]) => (v.length > 0 ? v.reduce((s, x) => s + x, 0) / v.length : null)

// ─────────────────────────────── Comparar con la meta ───────────────────────────────

export type EstadoIndicador = 'bien' | 'revisar' | 'mal'

/**
 * Qué tan lejos está un valor de su meta. Dentro de la meta: bien. Hasta un 10 %
 * peor que la meta: revisar. Más lejos: mal. `mayorEsMejor` dice hacia dónde es mejor.
 */
export function frenteAMeta(valor: number | null, meta: number | null, mayorEsMejor: boolean): EstadoIndicador | null {
  if (valor == null || meta == null || meta === 0) return null
  const desvio = mayorEsMejor ? (meta - valor) / meta : (valor - meta) / meta
  if (desvio <= 0) return 'bien'
  return desvio <= 0.1 ? 'revisar' : 'mal'
}

// ─────────────────────────────────── Reproducción ───────────────────────────────────

export interface ServicioInd { id: string; reproductora_id: string; fecha_servicio: string; estado: string }
export interface PartoInd { id: string; reproductora_id: string; fecha_parto: string; nacidos_vivos: number; nacidos_muertos: number; momificados: number }
export interface DesteteInd { reproductora_id: string; parto_id: string | null; fecha_destete: string; lechones_destetados: number; peso_promedio_kg: number | null }

/** Nacidos totales (vivos + muertos + momias) por parto. */
export function nacidosTotalesPorParto(partos: PartoInd[]): number | null {
  return promedio(partos.map(p => p.nacidos_vivos + p.nacidos_muertos + p.momificados))
}

/** Nacidos vivos por parto. */
export function nacidosVivosPorParto(partos: PartoInd[]): number | null {
  return promedio(partos.map(p => p.nacidos_vivos))
}

/** Destetados por parto (camadas ya destetadas). */
export function destetadosPorParto(destetes: DesteteInd[]): number | null {
  return promedio(destetes.map(d => d.lechones_destetados))
}

/**
 * Mortalidad antes del destete: (nacidos vivos − destetados) ÷ nacidos vivos × 100,
 * solo con las camadas que ya se destetaron.
 */
export function mortalidadPredestetePct(partos: PartoInd[], destetes: DesteteInd[]): number | null {
  const porParto = new Map(partos.map(p => [p.id, p]))
  let vivos = 0, destetados = 0
  for (const d of destetes) {
    const p = d.parto_id ? porParto.get(d.parto_id) : null
    if (!p) continue
    vivos += p.nacidos_vivos
    destetados += d.lechones_destetados
  }
  return vivos > 0 ? Math.max(0, ((vivos - destetados) / vivos) * 100) : null
}

/**
 * Tasa de parto: partos ÷ servicios × 100. Solo cuentan los servicios que ya
 * tuvieron tiempo de parir (servicio + gestación ≤ hoy), para no castigar a las
 * cerdas que están gestando.
 */
export function tasaPartoPct(servicios: ServicioInd[], cfg: ConfigCerdos, hoy: string): number | null {
  const cumplidos = servicios.filter(s => dias(s.fecha_servicio, hoy) >= cfg.reproduccion.diasGestacion + 7 || s.estado === 'parido')
  if (cumplidos.length === 0) return null
  return (cumplidos.filter(s => s.estado === 'parido').length / cumplidos.length) * 100
}

/** % de servicios que repitieron celo. */
export function repeticionPct(servicios: ServicioInd[]): number | null {
  const cerrados = servicios.filter(s => s.estado !== 'pendiente')
  if (cerrados.length === 0) return null
  return (cerrados.filter(s => s.estado === 'repetido').length / cerrados.length) * 100
}

/** % de abortos: servicios que terminaron en aborto ÷ servicios con resultado × 100. */
export function abortosPct(servicios: ServicioInd[]): number | null {
  const cerrados = servicios.filter(s => s.estado !== 'pendiente')
  if (cerrados.length === 0) return null
  return (cerrados.filter(s => s.estado === 'abortado').length / cerrados.length) * 100
}

/** Intervalo entre partos (días): promedio entre partos seguidos de la misma cerda. */
export function intervaloEntrePartos(partos: PartoInd[]): number | null {
  const porCerda = new Map<string, string[]>()
  for (const p of partos) porCerda.set(p.reproductora_id, [...(porCerda.get(p.reproductora_id) ?? []), p.fecha_parto])
  const intervalos: number[] = []
  for (const fechas of porCerda.values()) {
    const orden = [...fechas].sort()
    for (let i = 1; i < orden.length; i++) intervalos.push(dias(orden[i - 1], orden[i]))
  }
  return promedio(intervalos)
}

/** Intervalo destete–servicio (días): del destete al siguiente servicio de la misma cerda. */
export function intervaloDesteteServicio(destetes: DesteteInd[], servicios: ServicioInd[]): number | null {
  const valores: number[] = []
  for (const d of destetes) {
    const siguiente = servicios
      .filter(s => s.reproductora_id === d.reproductora_id && s.fecha_servicio >= d.fecha_destete)
      .sort((a, b) => a.fecha_servicio.localeCompare(b.fecha_servicio))[0]
    if (siguiente) valores.push(dias(d.fecha_destete, siguiente.fecha_servicio))
  }
  return promedio(valores)
}

/**
 * Partos por cerda al año: 365 ÷ intervalo entre partos. Si todavía no hay dos
 * partos de una misma cerda, se estima con el ciclo de la granja
 * (gestación + lactancia objetivo + destete-servicio).
 */
export function partosCerdaAno(partos: PartoInd[], cfg: ConfigCerdos): { valor: number; estimado: boolean } {
  const intervalo = intervaloEntrePartos(partos)
  if (intervalo != null && intervalo > 0) return { valor: 365 / intervalo, estimado: false }
  const r = cfg.reproduccion
  const ciclo = r.diasGestacion + r.lactanciaObjetivo + (r.desteteServicioMin + r.desteteServicioMax) / 2
  return { valor: 365 / ciclo, estimado: true }
}

/** Destetados por cerda al año: partos/cerda/año × destetados por parto. */
export function destetadosCerdaAno(partosAno: number, destetadosParto: number | null): number | null {
  return destetadosParto != null ? partosAno * destetadosParto : null
}

/** Kg destetados por cerda al año: destetados/cerda/año × peso promedio al destete. */
export function kgDestetadosCerdaAno(destetadosAno: number | null, destetes: DesteteInd[]): number | null {
  const pesos = destetes.filter(d => d.peso_promedio_kg != null)
  if (destetadosAno == null || pesos.length === 0) return null
  const kg = pesos.reduce((s, d) => s + Number(d.peso_promedio_kg) * d.lechones_destetados, 0)
  const lechones = pesos.reduce((s, d) => s + d.lechones_destetados, 0)
  return lechones > 0 ? destetadosAno * (kg / lechones) : null
}

/**
 * Días no productivos por cerda al año: los que no está gestando ni lactando.
 * DNP = 365 − partos/cerda/año × (gestación + lactancia objetivo).
 */
export function diasNoProductivos(partosAno: number, cfg: ConfigCerdos): number {
  return Math.max(0, 365 - partosAno * (cfg.reproduccion.diasGestacion + cfg.reproduccion.lactanciaObjetivo))
}

/** Peso de la camada al destete: suma de los pesos de los lechones (o promedio × destetados). */
export function pesoCamadaDestete(d: DesteteInd, pesosIndividuales?: number[]): number | null {
  if (pesosIndividuales && pesosIndividuales.length > 0) return pesosIndividuales.reduce((s, p) => s + p, 0)
  return d.peso_promedio_kg != null ? Number(d.peso_promedio_kg) * d.lechones_destetados : null
}

// ───────────────────────────────────── Engorde ─────────────────────────────────────

export interface PesajeInd { fecha: string; peso_promedio: number }

/** Ganancia diaria de peso (kg/día) entre dos pesajes, o desde el ingreso. */
export function gananciaDiaria(pesoInicial: number, fechaInicial: string, pesoFinal: number, fechaFinal: string): number | null {
  const d = dias(fechaInicial, fechaFinal)
  return d > 0 ? (pesoFinal - pesoInicial) / d : null
}

/** GDP del grupo desde que entró (peso inicial del lote) hasta su último pesaje. */
export function gananciaDiariaGrupo(lote: { fecha_ingreso: string; peso_promedio_inicial: number | null }, pesajes: PesajeInd[]): number | null {
  const ultimo = [...pesajes].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  if (!ultimo) return null
  if (lote.peso_promedio_inicial != null) return gananciaDiaria(Number(lote.peso_promedio_inicial), lote.fecha_ingreso, Number(ultimo.peso_promedio), ultimo.fecha)
  const primero = [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
  return primero && primero !== ultimo ? gananciaDiaria(Number(primero.peso_promedio), primero.fecha, Number(ultimo.peso_promedio), ultimo.fecha) : null
}

/**
 * Kilos ganados por el grupo: peso de los que están + peso de los que murieron
 * (lo que alcanzaron a ganar también se comió) − peso con que entraron.
 */
export function kilosGanados(p: { iniciales: number; pesoInicial: number; actuales: number; pesoActual: number; kgMuertos?: number }): number {
  return p.actuales * p.pesoActual + (p.kgMuertos ?? 0) - p.iniciales * p.pesoInicial
}

/** Conversión alimenticia: alimento consumido ÷ kg ganados (confirmada por José). */
export function conversion(alimentoConsumidoKg: number, kgGanados: number): number | null {
  return kgGanados > 0 && alimentoConsumidoKg > 0 ? alimentoConsumidoKg / kgGanados : null
}

/** Mortalidad: muertos ÷ animales con que se empezó × 100. */
export function mortalidadPct(muertos: number, iniciales: number): number | null {
  return iniciales > 0 ? (muertos / iniciales) * 100 : null
}

/** Uniformidad: % de los pesos que quedan a ±10 % del promedio. */
export function uniformidadPct(pesos: number[], margen = 0.1): number | null {
  const prom = promedio(pesos)
  if (prom == null || pesos.length < 2) return null
  return (pesos.filter(p => Math.abs(p - prom) <= prom * margen).length / pesos.length) * 100
}

/** Costo por kg producido: costos del grupo ÷ kg producidos. */
export function costoPorKg(costos: number, kgProducidos: number): number | null {
  return kgProducidos > 0 ? costos / kgProducidos : null
}

/** La etapa de engorde que le toca a un peso según la granja (null si no es de engorde). */
export function etapaPorPeso(peso: number, cfg: ConfigCerdos): EtapaEngorde | null {
  const orden: EtapaEngorde[] = ['precebo', 'levante', 'ceba']
  for (const e of orden) if (peso < cfg.engorde[e].pesoSalida) return e
  return null
}

/**
 * Peso esperado de un grupo de la etapa a cierta cantidad de días en ella: línea
 * recta entre el peso de entrada y el de salida en los días de la etapa. Si la
 * granja no definió los días de la etapa, no se puede esperar un peso (null).
 */
export function pesoEsperado(etapa: EtapaEngorde, diasEnEtapa: number, cfg: ConfigCerdos): number | null {
  const e = cfg.engorde[etapa]
  if (!e.dias || e.dias <= 0) return null
  const avance = Math.min(Math.max(diasEnEtapa / e.dias, 0), 1.2)
  return e.pesoEntrada + (e.pesoSalida - e.pesoEntrada) * avance
}
