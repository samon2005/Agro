import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aFechaLocal } from '@/lib/fechas'
import { calcularFechaLiberacion } from '@/lib/sanitario'
import type { FaseAlimento } from '@/lib/programaAlimento'
import { fechaDeSemanaDeVida } from '@/lib/referencias'

export type CategoriaCalendario =
  | 'vacuna' | 'tratamiento' | 'retiro' | 'recordatorio' | 'desinfeccion' | 'evento'
  | 'pesaje' | 'postura' | 'alimento' | 'entrada' | 'salida' | 'vacio'

export const CATEGORIAS_CALENDARIO: { v: CategoriaCalendario; t: string; color: string; punto: string }[] = [
  { v: 'vacuna', t: 'Vacunas', color: 'bg-purple-100 text-purple-800', punto: 'bg-purple-500' },
  { v: 'tratamiento', t: 'Tratamientos', color: 'bg-blue-100 text-blue-800', punto: 'bg-blue-500' },
  { v: 'recordatorio', t: 'Dosis por aplicar', color: 'bg-sky-100 text-sky-800', punto: 'bg-sky-500' },
  { v: 'retiro', t: 'Retiro (huevo no comercializable)', color: 'bg-red-100 text-red-800', punto: 'bg-red-500' },
  { v: 'evento', t: 'Eventos clínicos', color: 'bg-rose-100 text-rose-800', punto: 'bg-rose-500' },
  { v: 'desinfeccion', t: 'Desinfecciones', color: 'bg-teal-100 text-teal-800', punto: 'bg-teal-500' },
  { v: 'pesaje', t: 'Pesajes', color: 'bg-gray-200 text-gray-700', punto: 'bg-gray-500' },
  { v: 'alimento', t: 'Cambio de alimento', color: 'bg-orange-100 text-orange-800', punto: 'bg-orange-500' },
  { v: 'postura', t: 'Inicio de postura', color: 'bg-amber-100 text-amber-800', punto: 'bg-amber-500' },
  { v: 'entrada', t: 'Entrada de aves', color: 'bg-green-100 text-green-800', punto: 'bg-green-600' },
  { v: 'salida', t: 'Salida de aves', color: 'bg-stone-200 text-stone-700', punto: 'bg-stone-500' },
  { v: 'vacio', t: 'Vacío sanitario', color: 'bg-lime-100 text-lime-800', punto: 'bg-lime-500' },
]
export const INFO_CATEGORIA = Object.fromEntries(CATEGORIAS_CALENDARIO.map(c => [c.v, c])) as Record<CategoriaCalendario, typeof CATEGORIAS_CALENDARIO[number]>

export interface EventoCalendario {
  id: string
  categoria: CategoriaCalendario
  fecha: string
  /** Último día, si dura varios (tratamiento, retiro, vacío sanitario) */
  hasta: string | null
  titulo: string
  detalle: string | null
  loteId: string
  galpon: string
  /** Lo que todavía no pasa: se programó o se espera */
  programado: boolean
}

const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return aFechaLocal(d)
}

/** Todo lo sanitario y del ciclo de los galpones de la finca, pasado y por venir. */
export async function cargarCalendario(supabase: SupabaseClient<Database>, fincaId: string, hoy: string): Promise<EventoCalendario[]> {
  const [lotesRes, vacRes, medRes, recRes, desRes, evRes, pesRes] = await Promise.all([
    supabase.from('lotes_aves').select('*').eq('finca_id', fincaId),
    supabase.from('vacunaciones_aves').select('id, lote_id, fecha_aplicacion, vacuna, dosis, proxima_dosis').eq('finca_id', fincaId),
    supabase.from('medicaciones_aves').select('id, lote_id, fecha_inicio, fecha_fin, medicamento, dosis, periodo_retiro_dias').eq('finca_id', fincaId),
    supabase.from('recordatorios_medicacion_aves').select('id, lote_id, medicacion_id, fecha, hora, completado').eq('finca_id', fincaId),
    supabase.from('desinfecciones_aves').select('id, lote_id, fecha, producto').eq('finca_id', fincaId),
    supabase.from('eventos_clinicos_aves').select('id, lote_id, fecha, tipo_evento, descripcion, aves_afectadas, origen, resuelto').eq('finca_id', fincaId),
    supabase.from('pesos_lote_aves').select('id, lote_id, fecha, peso_promedio_g').eq('finca_id', fincaId),
  ])
  const lotes = lotesRes.data ?? []
  const lote = new Map(lotes.map(l => [l.id, l]))
  const galpon = (id: string) => lote.get(id)?.nombre ?? 'Galpón'
  const ev: EventoCalendario[] = []
  const meds = new Map((medRes.data ?? []).map(m => [m.id, m.medicamento]))

  for (const v of vacRes.data ?? []) {
    ev.push({ id: `vac-${v.id}`, categoria: 'vacuna', fecha: v.fecha_aplicacion, hasta: null, titulo: v.vacuna, detalle: v.dosis, loteId: v.lote_id, galpon: galpon(v.lote_id), programado: false })
    if (v.proxima_dosis) {
      ev.push({ id: `vacp-${v.id}`, categoria: 'vacuna', fecha: v.proxima_dosis, hasta: null, titulo: `${v.vacuna} (siguiente dosis)`, detalle: null, loteId: v.lote_id, galpon: galpon(v.lote_id), programado: v.proxima_dosis >= hoy })
    }
  }
  for (const m of medRes.data ?? []) {
    ev.push({ id: `med-${m.id}`, categoria: 'tratamiento', fecha: m.fecha_inicio, hasta: m.fecha_fin, titulo: m.medicamento, detalle: m.dosis, loteId: m.lote_id, galpon: galpon(m.lote_id), programado: m.fecha_inicio > hoy })
    if (m.fecha_fin && m.periodo_retiro_dias) {
      // El huevo vuelve a ser comercializable el día de la liberación: el retiro va hasta el día antes
      const libera = aFechaLocal(calcularFechaLiberacion(m.fecha_fin, m.periodo_retiro_dias))
      ev.push({
        id: `ret-${m.id}`, categoria: 'retiro', fecha: sumarDias(m.fecha_fin, 1), hasta: sumarDias(libera, -1),
        titulo: `Retiro de ${m.medicamento}`, detalle: `Huevo comercializable desde el ${libera}`,
        loteId: m.lote_id, galpon: galpon(m.lote_id), programado: libera > hoy,
      })
    }
  }
  for (const r of recRes.data ?? []) {
    if (r.completado) continue
    ev.push({ id: `rec-${r.id}`, categoria: 'recordatorio', fecha: r.fecha, hasta: null, titulo: `Aplicar ${meds.get(r.medicacion_id) ?? 'tratamiento'}`, detalle: r.hora, loteId: r.lote_id, galpon: galpon(r.lote_id), programado: r.fecha >= hoy })
  }
  for (const d of desRes.data ?? []) {
    ev.push({ id: `des-${d.id}`, categoria: 'desinfeccion', fecha: d.fecha, hasta: null, titulo: d.producto, detalle: null, loteId: d.lote_id, galpon: galpon(d.lote_id), programado: false })
  }
  for (const e of evRes.data ?? []) {
    if (e.origen === 'mortalidad') continue
    ev.push({ id: `ev-${e.id}`, categoria: 'evento', fecha: e.fecha, hasta: null, titulo: e.tipo_evento, detalle: `${e.descripcion}${e.resuelto ? '' : ' · sin resolver'}`, loteId: e.lote_id, galpon: galpon(e.lote_id), programado: false })
  }
  for (const p of pesRes.data ?? []) {
    ev.push({ id: `pes-${p.id}`, categoria: 'pesaje', fecha: p.fecha, hasta: null, titulo: `Pesaje: ${Math.round(Number(p.peso_promedio_g))} g`, detalle: null, loteId: p.lote_id, galpon: galpon(p.lote_id), programado: false })
  }

  // ── El ciclo de cada lote ──
  const refs = [...new Set(lotes.filter(l => l.referencia_id && l.fecha_nacimiento && l.estado === 'preparacion').map(l => l.referencia_id as string))]
  const { data: fases } = refs.length
    ? await supabase.from('fases_alimento').select('*').in('linea_id', refs)
    : { data: [] as FaseAlimento[] }
  for (const l of lotes) {
    ev.push({ id: `ent-${l.id}`, categoria: 'entrada', fecha: l.fecha_inicio, hasta: null, titulo: `Entran ${l.aves_iniciales.toLocaleString('es-CO')} aves`, detalle: l.linea_genetica, loteId: l.id, galpon: l.nombre, programado: false })
    const vivo = l.estado === 'activo' || l.estado === 'preparacion'
    if (l.fecha_inicio_postura) {
      const esperado = l.estado === 'preparacion'
      ev.push({ id: `pos-${l.id}`, categoria: 'postura', fecha: l.fecha_inicio_postura, hasta: null, titulo: esperado ? 'Inicio de postura esperado' : 'Inicio de postura', detalle: null, loteId: l.id, galpon: l.nombre, programado: esperado })
    }
    if (vivo && l.fecha_salida_programada) {
      ev.push({ id: `salp-${l.id}`, categoria: 'salida', fecha: l.fecha_salida_programada, hasta: null, titulo: 'Salida programada', detalle: null, loteId: l.id, galpon: l.nombre, programado: true })
    }
    if (!vivo && l.fecha_fin) {
      ev.push({ id: `sal-${l.id}`, categoria: 'salida', fecha: l.fecha_fin, hasta: null, titulo: 'Salen las aves', detalle: null, loteId: l.id, galpon: l.nombre, programado: false })
      if (l.vacio_sanitario_hasta && l.vacio_sanitario_hasta > l.fecha_fin) {
        ev.push({ id: `vac-${l.id}`, categoria: 'vacio', fecha: sumarDias(l.fecha_fin, 1), hasta: l.vacio_sanitario_hasta, titulo: 'Vacío sanitario', detalle: 'Limpieza y desinfección del galpón', loteId: l.id, galpon: l.nombre, programado: l.vacio_sanitario_hasta >= hoy })
      }
    }
    // Cambios de alimento por edad que vienen (levante)
    if (l.estado === 'preparacion' && l.referencia_id && l.fecha_nacimiento) {
      const propias = (fases ?? []).filter(f => f.linea_id === l.referencia_id && f.categoria !== 'postura' && f.desde_semana != null)
      for (const f of propias) {
        const fecha = fechaDeSemanaDeVida(l.fecha_nacimiento, f.desde_semana!)
        if (fecha < l.fecha_inicio) continue
        ev.push({ id: `ali-${l.id}-${f.id}`, categoria: 'alimento', fecha, hasta: null, titulo: `Pasa a ${f.nombre}`, detalle: f.notas, loteId: l.id, galpon: l.nombre, programado: fecha >= hoy })
      }
    }
  }
  return ev.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** ¿El evento cae (o sigue) en ese día? */
export function ocurreEn(e: EventoCalendario, fecha: string): boolean {
  return e.hasta ? e.fecha <= fecha && fecha <= e.hasta : e.fecha === fecha
}
