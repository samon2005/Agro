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
