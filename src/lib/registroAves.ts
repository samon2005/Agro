/**
 * El registro de aves en un galpón con las respuestas de José (19 nov 2026):
 * cómo llegan, para qué entran, las metas de cada propósito, la lista de
 * chequeo antes de vender y los recordatorios que deja el lote.
 * Única fuente: el registro, el cambio de propósito, la venta y el inicio de
 * postura leen de aquí.
 */
import type { Proposito } from './lotesAves'
import type { ConfigAves } from './configAves'
import { sumarDias } from '@/lib/cierreSemanal'

export type Llegada = 'pollitas_dia' | 'levantadas' | 'en_postura'

export const LLEGADAS: { v: Llegada; t: string; d: string }[] = [
  { v: 'pollitas_dia', t: 'Pollitas de un día', d: 'Hay que levantarlas; después se decide si ponen aquí o se venden' },
  { v: 'levantadas', t: 'Levantadas, listas para poner', d: 'Llegan de 16 a 18 semanas: todavía no ponen, pero están a punto' },
  { v: 'en_postura', t: 'Ya en postura', d: 'Llegan poniendo: solo queda registrar la postura diaria' },
]

/** La edad con que suelen llegar, para proponerla en el formulario */
export const EDAD_TIPICA: Record<Llegada, { valor: string; unidad: 'dias' | 'semanas' }> = {
  pollitas_dia: { valor: '1', unidad: 'dias' },
  levantadas: { valor: '17', unidad: 'semanas' },
  en_postura: { valor: '', unidad: 'semanas' },
}

/** Descripción de 1 o 2 renglones de cada propósito (José) */
export const DESCRIPCION_PROPOSITO: Record<Proposito, string> = {
  ciclo_completo: 'Levante y postura en la finca. Al final se venden las aves de descarte.',
  venta_postura: 'Se venden a mitad de la postura. No es lo común, pero puede pasar.',
  venta_levante: 'Se levantan y se venden como pollas para que pongan en otra granja. Nada de postura.',
}

export type ClaveMeta =
  | 'pico' | 'posturaVenta' | 'huevosAve' | 'huevosAcumulados' | 'mortalidadSemana' | 'mortalidadAcumulada'
  | 'semanasCiclo' | 'semanaVenta' | 'pesoHuevo' | 'consumo' | 'conversion' | 'pesoAves' | 'gananciaPeso'
  | 'uniformidad' | 'precioVenta' | 'avesVender'

/** Las metas de cada propósito (José, punto 5). Las unidades son sugeridas. */
export const METAS_LOTE: { k: ClaveMeta; t: string; u: string; para: Proposito[] }[] = [
  { k: 'pico', t: 'Postura en el pico', u: '%', para: ['ciclo_completo'] },
  { k: 'posturaVenta', t: 'Postura al vender', u: '%', para: ['venta_postura'] },
  { k: 'huevosAve', t: 'Huevos por ave alojada al final', u: 'huevos/ave', para: ['ciclo_completo'] },
  { k: 'huevosAcumulados', t: 'Huevos acumulados', u: 'huevos', para: ['ciclo_completo', 'venta_postura'] },
  { k: 'mortalidadSemana', t: 'Mortalidad de la semana', u: '%', para: ['ciclo_completo', 'venta_levante', 'venta_postura'] },
  { k: 'mortalidadAcumulada', t: 'Mortalidad acumulada', u: '%', para: ['ciclo_completo', 'venta_levante', 'venta_postura'] },
  { k: 'semanasCiclo', t: 'Semanas de ciclo', u: 'semanas', para: ['ciclo_completo'] },
  { k: 'semanaVenta', t: 'Semana de venta', u: 'semana de vida', para: ['venta_levante', 'venta_postura'] },
  { k: 'pesoHuevo', t: 'Peso promedio del huevo', u: 'g', para: ['ciclo_completo'] },
  { k: 'consumo', t: 'Alimento por ave al día', u: 'g/ave/día', para: ['ciclo_completo', 'venta_levante'] },
  { k: 'conversion', t: 'Conversión', u: 'kg alimento/kg huevo', para: ['ciclo_completo'] },
  { k: 'pesoAves', t: 'Peso de las aves (al vender o por semana)', u: 'g', para: ['ciclo_completo', 'venta_levante', 'venta_postura'] },
  { k: 'gananciaPeso', t: 'Ganancia de peso', u: 'g/semana', para: ['venta_levante'] },
  { k: 'uniformidad', t: 'Uniformidad', u: '%', para: ['venta_levante'] },
  { k: 'precioVenta', t: 'Precio de venta', u: '$ por ave', para: ['venta_levante', 'venta_postura'] },
  { k: 'avesVender', t: 'Aves a vender', u: 'aves', para: ['venta_levante', 'venta_postura'] },
]

export type MetasLote = Partial<Record<ClaveMeta, number>>

export const metasDe = (p: Proposito) => METAS_LOTE.filter(m => m.para.includes(p))

/** Solo las metas del propósito, con número */
export function metasParaGuardarLote(m: Record<string, string>, p: Proposito): MetasLote | null {
  const out: MetasLote = {}
  for (const d of metasDe(p)) {
    const n = Number(String(m[d.k] ?? '').replace(',', '.'))
    if (m[d.k] !== undefined && String(m[d.k]).trim() !== '' && Number.isFinite(n)) out[d.k] = n
  }
  return Object.keys(out).length ? out : null
}

/** Lista de chequeo antes de vender (José); cada finca agrega los suyos en Datos de la finca */
export const CHECKLIST_VENTA = [
  'Ayuno antes del transporte',
  'Vacunas al día',
  'Sin medicamentos en tiempo de retiro',
  'Pesaje y uniformidad del lote',
  'Papeles del ICA (guía de movilización)',
  'Cargue en horas frescas (evitar el calor)',
  'Precio negociado y comprador confirmado',
]

export function checklistVenta(cfg: ConfigAves): string[] {
  return [...CHECKLIST_VENTA, ...cfg.checklistVentaPropio]
}

/**
 * Las tareas que deja programadas un lote nuevo (luego llegan por WhatsApp):
 * preparar el galpón antes de la postura, preparar la venta con su lista de
 * chequeo y hacer el vacío sanitario cuando salen las aves.
 */
export function recordatoriosDelLote(p: {
  galpon: string
  proposito: Proposito
  llegada: Llegada
  fechaPostura: string | null
  fechaSalida: string | null
  cfg: ConfigAves
  hoy: string
}): { fecha: string; descripcion: string; prioridad: 'normal' | 'alta'; notas: string }[] {
  const out: { fecha: string; descripcion: string; prioridad: 'normal' | 'alta'; notas: string }[] = []
  const nota = '(Programada por la app al registrar las aves; los días se cambian en Datos de la finca.)'
  if (p.llegada !== 'en_postura' && p.proposito !== 'venta_levante' && p.fechaPostura) {
    const f = sumarDias(p.fechaPostura, -7 * p.cfg.avisoPosturaSemanas)
    if (f >= p.hoy) out.push({ fecha: f, prioridad: 'normal', descripcion: `Preparar ${p.galpon} para la postura`, notas: `Se espera que empiecen a poner hacia el ${p.fechaPostura}: nidos, luz y alimento de postura. ${nota}` })
  }
  if (p.fechaSalida) {
    const vende = p.proposito !== 'ciclo_completo'
    const f = sumarDias(p.fechaSalida, -p.cfg.avisoVentaDias)
    if (f >= p.hoy) out.push({
      fecha: f, prioridad: 'alta',
      descripcion: vende ? `Preparar la venta de ${p.galpon}` : `Preparar la venta de las aves de descarte de ${p.galpon}`,
      notas: `Salida el ${p.fechaSalida}. Lista de chequeo: ${checklistVenta(p.cfg).join(' · ')}. ${nota}`,
    })
    out.push({ fecha: sumarDias(p.fechaSalida, 1), prioridad: 'normal', descripcion: `Vacío sanitario de ${p.galpon}`, notas: `Limpieza, desinfección, control de roedores e insectos y cambio de cama. Anótalo en el galpón. ${nota}` })
  }
  return out
}
