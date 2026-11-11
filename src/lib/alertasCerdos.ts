/**
 * Alertas de cerdos: una sola fuente (sección 14 de la entrevista con José).
 * La bandeja de cada pantalla, el Resumen, las tareas automáticas y, más
 * adelante, el aviso al celular leen de aquí. Cada alerta dice para quién es y
 * qué tan urgente es; los días y umbrales salen de los parámetros de la granja.
 */
import type { ConfigCerdos, GrupoAnimal } from '@/lib/configCerdos'
import { pesoEsperado } from '@/lib/indicadoresCerdos'

export type Prioridad = 'urgente' | 'alta' | 'media'
/** Quién debe verla. Las urgentes van además al celular cuando llegue esa integración. */
export type Destinatario = 'encargado' | 'administrador' | 'asesor'

export interface AlertaCerdos {
  /** Estable entre recargas: sirve para no repetirla ni duplicar tareas */
  id: string
  tipo:
    | 'parto_proximo' | 'traslado_parideras' | 'celo_esperado' | 'cerda_sin_celo' | 'destete_pendiente'
    | 'dia_sin_registrar' | 'mortalidad_alta' | 'consumo_bajo' | 'bajo_peso' | 'cambio_etapa'
  prioridad: Prioridad
  para: Destinatario[]
  texto: string
  detalle?: string
  /** La fecha a la que se refiere (parto probable, destete, etc.) */
  fecha: string
  /** El animal o grupo al que se refiere */
  sujeto: { tipo: 'cerda' | 'grupo'; id: string; nombre: string }
}

const MS_DIA = 86_400_000
const sumar = (f: string, n: number) => {
  const d = new Date(f + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const diasEntre = (desde: string, hasta: string) => Math.round((new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / MS_DIA)
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const cuando = (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : n < 0 ? `hace ${-n} ${n === -1 ? 'día' : 'días'}` : `en ${n} días`)

const ORDEN: Record<Prioridad, number> = { urgente: 0, alta: 1, media: 2 }

/** Cómo se pinta cada prioridad en la bandeja de alertas de las pantallas. */
export function nivelBandeja(p: Prioridad): 'urgente' | 'revisar' | 'info' {
  return p === 'urgente' ? 'urgente' : p === 'alta' ? 'revisar' : 'info'
}
export function ordenarAlertas(a: AlertaCerdos[]): AlertaCerdos[] {
  return [...a].sort((x, y) => ORDEN[x.prioridad] - ORDEN[y.prioridad] || x.fecha.localeCompare(y.fecha))
}

// ─────────────────────────────────── Pie de cría ───────────────────────────────────

export interface CerdaAlerta { id: string; codigo: string; estado: string; ubicacion_id: string | null }
export interface ServicioAlerta { id: string; reproductora_id: string; fecha_servicio: string; fecha_probable_parto: string | null; estado: string }
export interface PartoAlerta { id: string; reproductora_id: string; fecha_parto: string }
export interface DesteteAlerta { reproductora_id: string; parto_id: string | null; fecha_destete: string }

/**
 * Alertas de las cerdas: parto próximo, traslado a parideras, celo esperado,
 * cerda sin celo después del destete y destete pendiente.
 * `naveDeParideras` dice si una ubicación es una nave de parideras.
 */
export function alertasPieDeCria(p: {
  cerdas: CerdaAlerta[]
  servicios: ServicioAlerta[]
  partos: PartoAlerta[]
  destetes: DesteteAlerta[]
  cfg: ConfigCerdos
  hoy: string
  naveDeParideras?: (ubicacionId: string | null) => boolean
}): AlertaCerdos[] {
  const { cfg, hoy } = p
  const r = cfg.reproduccion
  const out: AlertaCerdos[] = []
  const activas = p.cerdas.filter(c => c.estado !== 'descartada')
  const cerda = new Map(activas.map(c => [c.id, c]))

  for (const s of p.servicios) {
    const c = cerda.get(s.reproductora_id)
    if (!c) continue
    const sujeto = { tipo: 'cerda' as const, id: c.id, nombre: c.codigo }

    // Gestando (servicio sin parto): parto próximo y traslado a parideras
    if (s.estado === 'pendiente' || s.estado === 'confirmado') {
      const parto = s.fecha_probable_parto ?? sumar(s.fecha_servicio, r.diasGestacion)
      const faltan = diasEntre(hoy, parto)
      if (faltan <= r.avisoParto && faltan >= -7) {
        out.push({
          id: `parto:${s.id}`, tipo: 'parto_proximo', prioridad: 'alta', para: ['encargado', 'administrador', 'asesor'],
          texto: `Cerda ${c.codigo}: parto ${cuando(faltan)}`, detalle: `Fecha probable ${fechaCorta(parto)}. Revísala a diario.`,
          fecha: parto, sujeto,
        })
      }
      const traslado = sumar(parto, -r.trasladoParideras)
      const faltaTraslado = diasEntre(hoy, traslado)
      const yaEnParideras = p.naveDeParideras?.(c.ubicacion_id) ?? false
      if (!yaEnParideras && faltaTraslado <= 2 && faltan >= 0) {
        out.push({
          id: `traslado:${s.id}`, tipo: 'traslado_parideras', prioridad: 'alta', para: ['encargado'],
          texto: `Pasar la cerda ${c.codigo} a parideras ${faltaTraslado <= 0 ? 'ya' : cuando(faltaTraslado)}`,
          detalle: `Su parto es ${cuando(faltan)} (${fechaCorta(parto)}).`, fecha: traslado, sujeto,
        })
      }
      // Si el servicio no prendió, la cerda repite celo a los días del ciclo
      if (s.estado === 'pendiente') {
        const repite = sumar(s.fecha_servicio, r.cicloEstral)
        const f = diasEntre(hoy, repite)
        if (f >= -2 && f <= 3) {
          out.push({
            id: `celo:${s.id}`, tipo: 'celo_esperado', prioridad: 'media', para: ['encargado'],
            texto: `Revisar si la cerda ${c.codigo} repite celo (${cuando(f)})`,
            detalle: `Se cumplen ${r.cicloEstral} días del servicio. Si no repite, probablemente quedó preñada.`, fecha: repite, sujeto,
          })
        }
      }
    }
  }

  // Lactando (parto sin destete): destete pendiente
  const destetados = new Set(p.destetes.map(d => d.parto_id).filter(Boolean))
  for (const pa of p.partos) {
    const c = cerda.get(pa.reproductora_id)
    if (!c || destetados.has(pa.id)) continue
    const objetivo = sumar(pa.fecha_parto, r.lactanciaObjetivo)
    const maximo = sumar(pa.fecha_parto, r.lactanciaMax)
    const f = diasEntre(hoy, objetivo)
    if (f <= 3) {
      const vencido = diasEntre(hoy, maximo) < 0
      out.push({
        id: `destete:${pa.id}`, tipo: 'destete_pendiente', prioridad: vencido ? 'alta' : 'media', para: ['encargado'],
        texto: vencido ? `Camada de la cerda ${c.codigo}: pasó los ${r.lactanciaMax} días sin destetar` : `Destetar la camada de la cerda ${c.codigo} ${cuando(f)}`,
        detalle: `Parió el ${fechaCorta(pa.fecha_parto)}; lactancia de ${r.lactanciaMin} a ${r.lactanciaMax} días.`,
        fecha: objetivo, sujeto: { tipo: 'cerda', id: c.id, nombre: c.codigo },
      })
    }
  }

  // Destetadas: celo esperado a los días destete-servicio; si se pasa, sin celo (en recuperación)
  const ultimoDestete = new Map<string, string>()
  for (const d of p.destetes) if (!ultimoDestete.has(d.reproductora_id) || ultimoDestete.get(d.reproductora_id)! < d.fecha_destete) ultimoDestete.set(d.reproductora_id, d.fecha_destete)
  for (const [id, fecha] of ultimoDestete) {
    const c = cerda.get(id)
    if (!c) continue
    const servidaDespues = p.servicios.some(s => s.reproductora_id === id && s.fecha_servicio >= fecha)
    if (servidaDespues) continue
    const desde = sumar(fecha, r.desteteServicioMin)
    const hasta = sumar(fecha, r.desteteServicioMax)
    const sujeto = { tipo: 'cerda' as const, id: c.id, nombre: c.codigo }
    if (diasEntre(hoy, desde) <= 2 && diasEntre(hoy, hasta) >= 0) {
      out.push({
        id: `celo-destete:${id}:${fecha}`, tipo: 'celo_esperado', prioridad: 'media', para: ['encargado'],
        texto: `La cerda ${c.codigo} debe entrar en celo (${fechaCorta(desde)} a ${fechaCorta(hasta)})`,
        detalle: `Se destetó el ${fechaCorta(fecha)}. Hay que servirla cuando entre en celo.`, fecha: desde, sujeto,
      })
    } else if (diasEntre(hoy, hasta) < 0) {
      out.push({
        id: `sin-celo:${id}:${fecha}`, tipo: 'cerda_sin_celo', prioridad: 'media', para: ['encargado', 'administrador'],
        texto: `La cerda ${c.codigo} no ha entrado en celo`, detalle: `Lleva ${diasEntre(fecha, hoy)} días destetada: queda en recuperación.`,
        fecha: hasta, sujeto,
      })
    }
  }

  return ordenarAlertas(out)
}

// ──────────────────────────────────── Un grupo ────────────────────────────────────

export interface GrupoAlerta {
  id: string
  nombre: string
  etapa_actual: string
  fecha_ingreso: string
  numero_animales: number
  animales_actuales: number
  consumo_activo_kg: number | null
}

/**
 * Alertas de un grupo (corral o pie de cría): día sin registrar, mortalidad
 * alta en la semana, comieron menos de lo esperado, bajo peso y listo para
 * cambiar de etapa.
 */
export function alertasGrupo(p: {
  grupo: GrupoAlerta
  /** Registros diarios recientes: fecha y lo que comieron (consumo real) */
  registros: { fecha: string; consumo_real_kg: number | null; alimento_kg: number }[]
  mortalidad: { fecha: string; cantidad: number }[]
  pesajes?: { fecha: string; peso_promedio: number }[]
  /** Fecha en que el grupo entró a la etapa actual (si no, la de ingreso) */
  inicioEtapa?: string
  cfg: ConfigCerdos
  hoy: string
}): AlertaCerdos[] {
  const { grupo: g, cfg, hoy } = p
  const out: AlertaCerdos[] = []
  const sujeto = { tipo: 'grupo' as const, id: g.id, nombre: g.nombre }
  const grupo: GrupoAnimal = g.etapa_actual === 'cria' ? 'gestacion' : (['lactancia', 'precebo', 'levante', 'ceba'].includes(g.etapa_actual) ? g.etapa_actual as GrupoAnimal : 'ceba')

  // Día sin registrar: ayer no se anotó nada ("no se pueden perder datos")
  const ayer = sumar(hoy, -1)
  if (g.fecha_ingreso <= ayer && !p.registros.some(r => r.fecha === ayer)) {
    out.push({
      id: `sin-registro:${g.id}:${ayer}`, tipo: 'dia_sin_registrar', prioridad: 'alta', para: ['encargado', 'administrador'],
      texto: `${g.nombre}: falta el registro de ayer`, detalle: 'Anótalo para no perder el dato del alimento y la mortalidad.', fecha: ayer, sujeto,
    })
  }

  // Mortalidad de los últimos 7 días frente al umbral de la etapa
  const semana = sumar(hoy, -6)
  const muertos = p.mortalidad.filter(m => m.fecha >= semana).reduce((s, m) => s + m.cantidad, 0)
  const base = g.animales_actuales + muertos
  const umbral = cfg.alertas.mortalidadSemanalPct[grupo]
  if (muertos > 0 && base > 0 && (muertos / base) * 100 > umbral) {
    out.push({
      id: `mortalidad:${g.id}:${hoy}`, tipo: 'mortalidad_alta', prioridad: 'urgente', para: ['encargado', 'administrador', 'asesor'],
      texto: `${g.nombre}: mortalidad alta esta semana`,
      detalle: `${muertos} ${muertos === 1 ? 'muerto' : 'muertos'} en 7 días (${((muertos / base) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %; el límite es ${umbral} %).`,
      fecha: hoy, sujeto,
    })
  }

  // Comieron menos de lo esperado (consumo real del último registro frente al vigente)
  const ultimo = [...p.registros].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const esperado = Number(g.consumo_activo_kg ?? 0)
  if (ultimo && esperado > 0 && diasEntre(ultimo.fecha, hoy) <= 1) {
    const comido = Number(ultimo.consumo_real_kg ?? ultimo.alimento_kg)
    const falta = ((esperado - comido) / esperado) * 100
    if (falta > cfg.alertas.consumoBajoPct) {
      out.push({
        id: `consumo:${g.id}:${ultimo.fecha}`, tipo: 'consumo_bajo', prioridad: 'urgente', para: ['encargado', 'administrador', 'asesor'],
        texto: `${g.nombre}: comieron ${Math.round(falta)} % menos de lo esperado`,
        detalle: `El ${fechaCorta(ultimo.fecha)} comieron ${comido.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg de ${esperado.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg. Puede ser enfermedad, calor o un problema con el comedero o el agua.`,
        fecha: ultimo.fecha, sujeto,
      })
    }
  }

  // Bajo peso y cambio de etapa, con el último pesaje (solo grupos de engorde)
  const etapa = g.etapa_actual === 'precebo' || g.etapa_actual === 'levante' || g.etapa_actual === 'ceba' ? g.etapa_actual : null
  const pesaje = [...(p.pesajes ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  if (etapa && pesaje) {
    const enEtapa = diasEntre(p.inicioEtapa ?? g.fecha_ingreso, pesaje.fecha)
    const esperadoKg = pesoEsperado(etapa, enEtapa, cfg)
    if (esperadoKg != null && pesaje.peso_promedio < esperadoKg * (1 - cfg.alertas.bajoPesoPct / 100)) {
      out.push({
        id: `bajo-peso:${g.id}:${pesaje.fecha}`, tipo: 'bajo_peso', prioridad: 'media', para: ['encargado', 'administrador'],
        texto: `${g.nombre}: peso por debajo de lo esperado`,
        detalle: `Pesaron ${Number(pesaje.peso_promedio).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg y se esperaban unos ${esperadoKg.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg a los ${enEtapa} días de ${etapa}.`,
        fecha: pesaje.fecha, sujeto,
      })
    }
    const salida = cfg.engorde[etapa].pesoSalida
    if (pesaje.peso_promedio >= salida * 0.97) {
      out.push({
        id: `cambio-etapa:${g.id}:${etapa}`, tipo: 'cambio_etapa', prioridad: 'media', para: ['encargado', 'administrador'],
        texto: etapa === 'ceba' ? `${g.nombre}: listo para la venta` : `${g.nombre}: listo para pasar a ${etapa === 'precebo' ? 'levante' : 'ceba'}`,
        detalle: `Pesaron ${Number(pesaje.peso_promedio).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg; la etapa termina en ${salida} kg.`,
        fecha: pesaje.fecha, sujeto,
      })
    }
  }

  return ordenarAlertas(out)
}
