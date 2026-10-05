import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { TAMANOS_HUEVO, type PreciosHuevo, type TamanoHuevo } from '@/lib/huevos'

export type PorTamano = Record<TamanoHuevo, number>
export const CERO: PorTamano = { b: 0, a: 0, aa: 0, aaa: 0, jumbo: 0 }

export type ClienteHuevos = Database['public']['Tables']['clientes_huevos']['Row']

export function totalTamanos(p: PorTamano): number {
  return TAMANOS_HUEVO.reduce((s, t) => s + p[t.key], 0)
}

type ConCantidades = { cantidad_b: number; cantidad_a: number; cantidad_aa: number; cantidad_aaa: number; cantidad_jumbo: number }

export function cantidadesDe(v: ConCantidades): PorTamano {
  return { b: Number(v.cantidad_b), a: Number(v.cantidad_a), aa: Number(v.cantidad_aa), aaa: Number(v.cantidad_aaa), jumbo: Number(v.cantidad_jumbo) }
}

export interface ProduccionGalpon {
  clave: string
  nombre: string
  puestos: PorTamano
  /** Ventas de antes, cuando se vendía por galpón */
  vendidos: PorTamano
}

export interface HuevosFinca {
  puestos: PorTamano
  vendidos: PorTamano
  /** Lo que hay en bodega de cada tamaño: puesto menos vendido, en toda la finca */
  disponible: PorTamano
  porGalpon: ProduccionGalpon[]
}

/**
 * El huevo de la finca por tamaño, contado desde los registros: lo puesto por
 * todos los galpones (también los lotes que ya salieron) menos lo vendido. Es la
 * misma cuenta que lleva la base en el inventario (migración 064).
 */
export async function cargarHuevosFinca(supabase: SupabaseClient<Database>, fincaId: string): Promise<HuevosFinca> {
  const [prodRes, ventasRes, lotesRes, galponesRes] = await Promise.all([
    supabase.from('produccion_diaria_aves').select('lote_id, huevos_b, huevos_a, huevos_aa, huevos_aaa, huevos_jumbo').eq('finca_id', fincaId),
    supabase.from('ventas_huevos_aves').select('lote_id, cantidad_b, cantidad_a, cantidad_aa, cantidad_aaa, cantidad_jumbo').eq('finca_id', fincaId),
    supabase.from('lotes_aves').select('id, nombre, instalacion_id').eq('finca_id', fincaId),
    supabase.from('instalaciones').select('id, nombre').eq('finca_id', fincaId),
  ])
  const nombreGalpon = new Map((galponesRes.data ?? []).map(g => [g.id, g.nombre]))
  const claveDe = (l: { nombre: string; instalacion_id: string | null }) =>
    l.instalacion_id && nombreGalpon.has(l.instalacion_id) ? l.instalacion_id : `lote:${l.nombre}`
  const porGalpon = new Map<string, ProduccionGalpon>()
  const filaDeLote = new Map<string, ProduccionGalpon>()
  for (const l of lotesRes.data ?? []) {
    const clave = claveDe(l)
    if (!porGalpon.has(clave)) {
      porGalpon.set(clave, {
        clave, nombre: (l.instalacion_id ? nombreGalpon.get(l.instalacion_id) : null) ?? l.nombre,
        puestos: { ...CERO }, vendidos: { ...CERO },
      })
    }
    filaDeLote.set(l.id, porGalpon.get(clave)!)
  }
  const puestos = { ...CERO }
  const vendidos = { ...CERO }
  for (const p of prodRes.data ?? []) {
    const fila = filaDeLote.get(p.lote_id)
    for (const t of TAMANOS_HUEVO) {
      const n = Number(p[`huevos_${t.key}` as keyof typeof p] ?? 0)
      puestos[t.key] += n
      if (fila) fila.puestos[t.key] += n
    }
  }
  for (const v of ventasRes.data ?? []) {
    const fila = v.lote_id ? filaDeLote.get(v.lote_id) : undefined
    for (const t of TAMANOS_HUEVO) {
      const n = Number(v[`cantidad_${t.key}` as keyof typeof v] ?? 0)
      vendidos[t.key] += n
      if (fila) fila.vendidos[t.key] += n
    }
  }
  const disponible = Object.fromEntries(TAMANOS_HUEVO.map(t => [t.key, puestos[t.key] - vendidos[t.key]])) as PorTamano
  return {
    puestos, vendidos, disponible,
    porGalpon: [...porGalpon.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
  }
}

/**
 * Precio de cada tamaño para un cliente en una fecha: el suyo si lo tiene (con
 * contrato, solo mientras el contrato rige); si no, el de la finca.
 */
export function preciosParaCliente(finca: PreciosHuevo, cliente: ClienteHuevos | null | undefined, fecha: string): PreciosHuevo {
  if (!cliente || (cliente.contrato && !contratoVigente(cliente, fecha))) return finca
  const propio = (v: number | null) => (v != null && Number(v) > 0 ? Number(v) : null)
  return {
    b: propio(cliente.precio_b) ?? finca.b,
    a: propio(cliente.precio_a) ?? finca.a,
    aa: propio(cliente.precio_aa) ?? finca.aa,
    aaa: propio(cliente.precio_aaa) ?? finca.aaa,
    jumbo: propio(cliente.precio_jumbo) ?? finca.jumbo,
  }
}

/** ¿El contrato del cliente rige en una fecha? */
export function contratoVigente(c: ClienteHuevos, fecha: string): boolean {
  if (!c.contrato) return false
  return (!c.contrato_desde || c.contrato_desde <= fecha) && (!c.contrato_hasta || c.contrato_hasta >= fecha)
}
