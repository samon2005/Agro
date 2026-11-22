/**
 * Cuentas de la reproducción que no son indicadores de la granja (esos están en
 * indicadoresCerdos): el crecimiento de la hembra de reemplazo, las tareas del
 * lechón después del parto y el puntaje de descarte de cada cerda.
 * Única fuente: la ficha de la cerda, el parto y el tablero de cría leen de aquí.
 */
import type { ConfigCerdos } from './configCerdos'
import { sumarDias } from '@/lib/cierreSemanal'

/** Ganancia diaria (g/día) entre el primer y el último peso de la cerda; null si no hay dos pesos */
export function gananciaReemplazo(pesos: { fecha: string; peso_kg: number }[]): number | null {
  if (pesos.length < 2) return null
  const orden = [...pesos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const a = orden[orden.length - 2], b = orden[orden.length - 1]
  const dias = (new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime()) / 86400000
  if (dias <= 0) return null
  return ((Number(b.peso_kg) - Number(a.peso_kg)) * 1000) / dias
}

export const MANEJOS_LECHON: { clave: keyof ConfigCerdos['manejoLechon']; texto: string }[] = [
  { clave: 'tatuaje', texto: 'Tatuar los lechones' },
  { clave: 'colmillos', texto: 'Cortar o limar colmillos' },
  { clave: 'hierro', texto: 'Aplicar hierro (máximo al día 2)' },
  { clave: 'cola', texto: 'Cortar cola' },
  { clave: 'castracion', texto: 'Castrar machos' },
  { clave: 'chapeta', texto: 'Poner chapeta' },
  { clave: 'papillas', texto: 'Empezar papillas o lactorreemplazador' },
]

/** Las tareas del manejo de una camada, con su fecha, desde el día del parto (día 0) */
export function tareasManejoLechon(fechaParto: string, codigoCerda: string, cfg: ConfigCerdos) {
  return MANEJOS_LECHON.map(m => ({
    fecha: sumarDias(fechaParto, cfg.manejoLechon[m.clave]),
    descripcion: `${m.texto} · camada de ${codigoCerda}`,
    dia: cfg.manejoLechon[m.clave],
  }))
}

export interface HistoriaDescarte {
  partos: number
  repeticiones: number
  abortos: number
  /** Nacidos vivos por parto en sus partos */
  vivosPorParto: number | null
  /** Días que lleva en recuperación (sin celo tras el destete), o null */
  diasRecuperacion: number | null
}

/**
 * Puntaje de descarte de 0 a 100 y las razones. No decide: avisa a los
 * profesores qué cerdas revisar ("como sugerencia, no como establecida").
 */
export function puntajeDescarte(h: HistoriaDescarte, cfg: ConfigCerdos): { puntaje: number; razones: string[] } {
  const d = cfg.descarte
  const razones: string[] = []
  let puntaje = 0
  if (h.partos >= d.maxPartos) { puntaje += 35; razones.push(`${h.partos} partos (límite ${d.maxPartos})`) }
  else if (h.partos >= d.maxPartos - 1) { puntaje += 10; razones.push(`${h.partos} partos, cerca del límite`) }
  if (h.repeticiones >= d.maxRepeticiones) { puntaje += 30; razones.push(`${h.repeticiones} repeticiones de celo`) }
  else if (h.repeticiones > 0) puntaje += 10 * h.repeticiones
  if (h.abortos >= d.maxAbortos) { puntaje += 30; razones.push(`${h.abortos} abortos`) }
  else if (h.abortos > 0) { puntaje += 15; razones.push('1 aborto') }
  if (h.vivosPorParto != null && h.partos >= 2 && h.vivosPorParto < d.minNacidosVivos) {
    puntaje += 25; razones.push(`camadas pequeñas: ${h.vivosPorParto.toFixed(1)} vivos por parto`)
  }
  if (h.diasRecuperacion != null && h.diasRecuperacion > d.maxDiasRecuperacion) {
    puntaje += 30; razones.push(`${h.diasRecuperacion} días sin celo después del destete`)
  }
  return { puntaje: Math.min(100, puntaje), razones }
}

/**
 * Vacunas del plan que tocan pronto a cada grupo (José: avisar mínimo 5 días
 * antes, para pedir el medicamento). El día de vida sale de la fecha de
 * nacimiento del grupo o, si no la tiene, de su ingreso.
 */
export function vacunasProximas(p: {
  lotes: { id: string; nombre: string; fecha_nacimiento: string | null; fecha_ingreso: string }[]
  plan: { id: string; vacuna: string; dia_vida: number; obligatoria: boolean | null }[]
  aplicadas: { lote_id: string | null; plan_id: string | null; vacuna?: string | null }[]
  hoy: string
  anticipacion?: number
}) {
  const out: { lote: string; vacuna: string; fecha: string; faltan: number; obligatoria: boolean }[] = []
  // Aplicada si quedó ligada al plan o si el grupo ya tiene una vacuna con ese nombre
  const norm = (t: string | null | undefined) => (t ?? '').trim().toLowerCase()
  const ya = new Set(p.aplicadas.map(a => `${a.lote_id}|${a.plan_id}`))
  const porNombre = new Set(p.aplicadas.map(a => `${a.lote_id}|${norm(a.vacuna)}`))
  for (const l of p.lotes) {
    const base = l.fecha_nacimiento ?? l.fecha_ingreso
    for (const v of p.plan) {
      if (ya.has(`${l.id}|${v.id}`) || porNombre.has(`${l.id}|${norm(v.vacuna)}`)) continue
      const fecha = sumarDias(base, v.dia_vida)
      const faltan = Math.round((new Date(fecha + 'T00:00:00').getTime() - new Date(p.hoy + 'T00:00:00').getTime()) / 86400000)
      if (faltan <= (p.anticipacion ?? 5) && faltan >= -7) out.push({ lote: l.nombre, vacuna: v.vacuna, fecha, faltan, obligatoria: !!v.obligatoria })
    }
  }
  return out.sort((a, b) => a.faltan - b.faltan)
}
