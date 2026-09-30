import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

interface AjusteInventario {
  fincaId: string
  /** Nombre del ítem en el inventario general de la finca */
  nombre: string
  /** Categoría bajo la que se agrupa; se crea si la finca todavía no la tiene */
  categoria: string
  colorCategoria?: string
  unidad?: string
  /** Positivo suma stock, negativo lo baja */
  delta: number
}

/**
 * Suma o resta stock de un ítem del inventario general de la finca, creando el
 * ítem y su categoría la primera vez. Es lo que mantiene el inventario al día
 * cuando entra alimento o cuando se ponen y se venden huevos.
 */
export async function ajustarInventario(
  supabase: SupabaseClient<Database>,
  { fincaId, nombre, categoria, colorCategoria = '#94A3B8', unidad = 'unidades', delta }: AjusteInventario,
): Promise<void> {
  if (!fincaId || !nombre || delta === 0) return

  const { data: item } = await supabase
    .from('inventario')
    .select('id, cantidad_actual')
    .eq('finca_id', fincaId)
    .eq('nombre', nombre)
    .maybeSingle()

  if (item) {
    // El stock nunca baja de cero: si se vende más de lo que figura registrado,
    // queda en cero en vez de quedar en negativo.
    const nuevo = Math.max(0, Number(item.cantidad_actual) + delta)
    await supabase.from('inventario').update({ cantidad_actual: nuevo }).eq('id', item.id)
    return
  }

  if (delta < 0) return // No se crea un ítem para descontar de algo que no existe

  const { data: cat } = await supabase
    .from('inventario_categorias')
    .select('id')
    .eq('finca_id', fincaId)
    .ilike('nombre', categoria)
    .maybeSingle()

  let categoriaId = cat?.id ?? null
  if (!categoriaId) {
    const { data: nueva } = await supabase
      .from('inventario_categorias')
      .insert({ finca_id: fincaId, nombre: categoria, color: colorCategoria })
      .select('id')
      .single()
    categoriaId = nueva?.id ?? null
  }

  await supabase.from('inventario').insert({
    finca_id: fincaId,
    categoria_id: categoriaId,
    nombre,
    unidad_medida: unidad,
    cantidad_actual: delta,
    cantidad_minima: 0,
  })
}

/** El ítem de inventario donde se acumulan los huevos puestos por un galpón. */
export function nombreItemHuevos(nombreLote: string): string {
  return `Huevos — ${nombreLote}`
}

/** Suma (o resta, con delta negativo) huevos al inventario de la finca. */
export function ajustarHuevos(
  supabase: SupabaseClient<Database>,
  fincaId: string,
  nombreLote: string,
  delta: number,
): Promise<void> {
  return ajustarInventario(supabase, {
    fincaId,
    nombre: nombreItemHuevos(nombreLote),
    categoria: 'Huevos',
    colorCategoria: '#FBBF24',
    unidad: 'huevos',
    delta,
  })
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
