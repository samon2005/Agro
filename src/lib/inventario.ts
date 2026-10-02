import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * El ítem de inventario con el huevo en bodega de un galpón. Su saldo lo lleva la
 * base (huevos puestos menos vendidos, migración 056): aquí solo se lee.
 */
export function nombreItemHuevos(nombreLote: string): string {
  return `Huevos — ${nombreLote}`
}

/** Stock de un alimento de aves: lo que entró menos lo que se comieron los galpones. */
export interface StockAlimentoAves {
  tipo_alimento_id: string
  finca_id: string
  nombre: string
  peso_bulto_kg: number
  bultos_entrados: number
  kg_consumidos: number
  bultos_consumidos: number
  bultos_disponibles: number
  ultima_entrada: string | null
  activo_en_algun_lote: boolean
}

/**
 * Rehace el stock de alimento de la finca: bultos que entraron menos los kg que
 * se consumieron, día por día, según lo registrado. Al ser una cuenta y no un
 * descuento, corregir o borrar un día deja el stock bien sin arrastrar errores.
 * Se llama al abrir las pantallas y después de tocar entradas, consumo o días.
 */
export async function recalcularStockAlimentoAves(supabase: SupabaseClient<Database>, fincaId: string): Promise<void> {
  if (!fincaId) return
  await (supabase as unknown as SupabaseClient).rpc('recalcular_stock_alimento_aves', { p_finca: fincaId })
}

/** Lo que hay y lo que se ha consumido de cada alimento de la finca. */
export async function leerStockAlimentoAves(
  supabase: SupabaseClient<Database>,
  fincaId: string,
): Promise<StockAlimentoAves[]> {
  if (!fincaId) return []
  const { data } = await (supabase as unknown as SupabaseClient)
    .from('stock_alimento_aves')
    .select('*')
    .eq('finca_id', fincaId)
  return ((data ?? []) as StockAlimentoAves[]).map(s => ({
    ...s,
    peso_bulto_kg: Number(s.peso_bulto_kg),
    bultos_entrados: Number(s.bultos_entrados),
    kg_consumidos: Number(s.kg_consumidos),
    bultos_consumidos: Number(s.bultos_consumidos),
    bultos_disponibles: Number(s.bultos_disponibles),
  }))
}

/** Un tramo de consumo: lo que rigió desde un día hasta que se registró otro. */
export interface TramoConsumo {
  desde: string
  hasta: string
  kgDia: number
  dias: number
  kgTotal: number
}

/**
 * El historial de consumo de un galpón. Cada consumo registrado rige desde su
 * día hasta que se registre otro, y el último sigue rigiendo hasta hoy mientras
 * el galpón esté en pie. Sirve para ver de dónde sale cada kilo descontado.
 */
export function tramosDeConsumo(
  registros: { fecha: string; alimento_kg: number | string }[],
  hoy: string,
  sigueActivo = true,
): TramoConsumo[] {
  const conConsumo = registros
    .map(r => ({ fecha: r.fecha, kg: Number(r.alimento_kg) || 0 }))
    .filter(r => r.kg > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  return conConsumo.map((r, i) => {
    const siguiente = conConsumo[i + 1]?.fecha
    // El último tramo llega hasta hoy si el galpón sigue comiendo
    const finExclusivo = siguiente ?? (sigueActivo ? sumarDias(hoy, 1) : sumarDias(r.fecha, 1))
    const dias = Math.max(0, diasEntre(r.fecha, finExclusivo))
    return {
      desde: r.fecha,
      hasta: sumarDias(finExclusivo, -1),
      kgDia: r.kg,
      dias,
      kgTotal: r.kg * dias,
    }
  }).reverse()
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / 86400000,
  )
}

/** Un tramo de consumo de un galpón, con el alimento que se comió. */
export interface TramoConsumoFinca extends TramoConsumo {
  loteId: string
  tipoAlimentoId: string
}

/**
 * Los tramos de consumo de toda la finca. Sigue la misma regla que el stock de la
 * base: en cada galpón, cada consumo registrado rige hasta el siguiente registro;
 * el último llega hasta hoy si el galpón sigue con aves, o solo cuenta su día si
 * el galpón ya cerró. Así el movimiento de bultos cuadra con el stock.
 */
export function tramosConsumoFinca(
  registros: { lote_id: string; fecha: string; alimento_kg: number | string; tipo_alimento_id: string | null }[],
  lotesVivos: Set<string>,
  hoy: string,
): TramoConsumoFinca[] {
  const porLote = new Map<string, { fecha: string; kg: number; tipo: string }[]>()
  for (const r of registros) {
    const kg = Number(r.alimento_kg) || 0
    if (kg <= 0 || !r.tipo_alimento_id) continue
    const lista = porLote.get(r.lote_id) ?? []
    lista.push({ fecha: r.fecha, kg, tipo: r.tipo_alimento_id })
    porLote.set(r.lote_id, lista)
  }

  const tramos: TramoConsumoFinca[] = []
  for (const [loteId, lista] of porLote) {
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
    lista.forEach((r, i) => {
      const siguiente = lista[i + 1]?.fecha
      const finExclusivo = siguiente ?? (lotesVivos.has(loteId) ? sumarDias(hoy, 1) : sumarDias(r.fecha, 1))
      const dias = Math.max(0, diasEntre(r.fecha, finExclusivo))
      tramos.push({
        loteId,
        tipoAlimentoId: r.tipo,
        desde: r.fecha,
        hasta: sumarDias(finExclusivo, -1),
        kgDia: r.kg,
        dias,
        kgTotal: r.kg * dias,
      })
    })
  }
  return tramos
}
