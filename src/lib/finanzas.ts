import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { CONFIG_ESPECIES, dbGenerico, totalVentaAnimales, type CostoGenerico, type VentaGenerica } from '@/lib/especiesConfig'
import type { EspecieFinca } from '@/lib/especies'

/** Un galpón o corral, para filtrar y para cargarle costos o ventas. */
export interface LoteFinanzas {
  id: string
  nombre: string
  especie: EspecieFinca
  estado: string
}

export type CostoFinca = CostoGenerico & { especie: EspecieFinca }

/** De qué es el dinero que entró */
export type TipoIngreso = 'huevo' | 'descarte' | 'pollas' | 'gallinaza' | 'otro' | 'animales'

export const TIPOS_INGRESO: Record<TipoIngreso, { label: string; color: string }> = {
  huevo: { label: 'Huevo', color: 'bg-amber-100 text-amber-800' },
  descarte: { label: 'Gallinas de descarte', color: 'bg-rose-100 text-rose-700' },
  pollas: { label: 'Pollas de levante', color: 'bg-green-100 text-green-800' },
  gallinaza: { label: 'Gallinaza', color: 'bg-stone-200 text-stone-700' },
  otro: { label: 'Otros', color: 'bg-gray-100 text-gray-600' },
  animales: { label: 'Venta de animales', color: 'bg-blue-100 text-blue-700' },
}

/** Lo que se vende en una finca de cada especie, en el orden en que se muestra */
export function tiposIngresoDe(especie: EspecieFinca | null): TipoIngreso[] {
  if (especie === 'aves_ponedoras') return ['huevo', 'descarte', 'pollas', 'gallinaza', 'otro']
  return ['animales']
}

/** Venta de aves u otros productos de una finca de ponedoras (todo menos el huevo) */
export type VentaAvesLote = Database['public']['Tables']['ventas_aves_lote']['Row']

export interface Ingreso {
  id: string
  fecha: string
  monto: number
  lote_id: string | null
  especie: EspecieFinca
  tipo: TipoIngreso
  concepto: string
  /** Si sale de ventas_aves_lote, la venta (para editarla o borrarla) */
  ventaAves?: VentaAvesLote
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

/**
 * Todo el dinero de la finca: costos e ingresos de cada especie que tenga. Es la
 * misma cuenta para Finanzas y para el Resumen, así las dos dicen lo mismo.
 *
 * - Huevo: cuenta lo que ya se pagó, en la fecha en que entró el dinero.
 * - Aves, gallinaza y otros (ponedoras): la venta, el día en que se hizo.
 * - Cerdos y pollo: la venta de animales, el día en que se hizo.
 */
export async function cargarFinanzasFinca(
  supabase: SupabaseClient<Database>,
  fincaId: string,
  especies: EspecieFinca[],
): Promise<{ lotes: LoteFinanzas[]; costos: CostoFinca[]; ingresos: Ingreso[] }> {
  const db = dbGenerico(supabase)

  const porEspecie = await Promise.all(especies.map(async especie => {
    const t = CONFIG_ESPECIES[especie].tablas
    const esAves = especie === 'aves_ponedoras'
    const [lotesRes, costosRes, ventasRes, pagosRes, ventasAvesRes] = await Promise.all([
      db.from(t.lotes).select('id, nombre, estado').eq('finca_id', fincaId).order('created_at', { ascending: false }),
      db.from(t.costos).select('*').eq('finca_id', fincaId).order('fecha', { ascending: false }),
      db.from(t.ventas).select('*').eq('finca_id', fincaId),
      esAves ? db.from('pagos_ventas_huevos').select('*').eq('finca_id', fincaId) : Promise.resolve({ data: [] }),
      esAves ? db.from('ventas_aves_lote').select('*').eq('finca_id', fincaId) : Promise.resolve({ data: [] }),
    ])

    const lotes: LoteFinanzas[] = ((lotesRes.data ?? []) as { id: string; nombre: string; estado: string }[])
      .map(l => ({ ...l, especie }))
    const costos: CostoFinca[] = ((costosRes.data ?? []) as CostoGenerico[]).map(c => ({ ...c, especie }))

    let ingresos: Ingreso[]
    if (esAves) {
      const loteDeVenta = new Map(((ventasRes.data ?? []) as { id: string; lote_id: string }[]).map(v => [v.id, v.lote_id]))
      const huevo: Ingreso[] = ((pagosRes.data ?? []) as { id: string; venta_id: string; fecha: string; monto: number; titular: string }[])
        .filter(p => loteDeVenta.has(p.venta_id))
        .map(p => ({
          id: p.id, fecha: p.fecha, monto: Number(p.monto), lote_id: loteDeVenta.get(p.venta_id)!,
          especie, tipo: 'huevo' as const, concepto: `Pago de huevo · ${p.titular}`,
        }))
      const otras: Ingreso[] = ((ventasAvesRes.data ?? []) as VentaAvesLote[]).map(v => ({
        id: v.id, fecha: v.fecha, monto: Number(v.total), lote_id: v.lote_id, especie, tipo: v.tipo,
        concepto: `${Number(v.cantidad).toLocaleString('es-CO')} ${v.unidad} × ${cop(Number(v.precio_unitario))}`
          + (v.descripcion ? ` · ${v.descripcion}` : '') + (v.cliente ? ` · ${v.cliente}` : ''),
        ventaAves: v,
      }))
      ingresos = [...huevo, ...otras]
    } else {
      ingresos = ((ventasRes.data ?? []) as VentaGenerica[]).map(v => ({
        id: v.id, fecha: v.fecha, monto: totalVentaAnimales(v), lote_id: v.lote_id, especie, tipo: 'animales' as const,
        concepto: `Venta de ${v.cantidad} ${CONFIG_ESPECIES[especie].animalPlural}${v.cliente ? ` · ${v.cliente}` : ''}`,
      }))
    }
    return { lotes, costos, ingresos }
  }))

  return {
    lotes: porEspecie.flatMap(p => p.lotes),
    costos: porEspecie.flatMap(p => p.costos).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    ingresos: porEspecie.flatMap(p => p.ingresos).sort((a, b) => b.fecha.localeCompare(a.fecha)),
  }
}
