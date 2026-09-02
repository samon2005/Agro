export interface CategoriaCosto {
  value: string
  label: string
  emoji: string
  color: string
  legacy?: string[]
}

export const CATEGORIAS_COSTO: CategoriaCosto[] = [
  { value: 'pollitas', label: 'Pollitas', emoji: '🐣', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'alimento', label: 'Alimento', emoji: '🌾', color: 'bg-orange-100 text-orange-700' },
  { value: 'servicios_publicos', label: 'Servicios públicos', emoji: '💡', color: 'bg-blue-100 text-blue-700', legacy: ['agua', 'energia'] },
  { value: 'mantenimiento', label: 'Mantenimiento', emoji: '🔧', color: 'bg-gray-100 text-gray-700' },
  { value: 'sanitario', label: 'Sanitario', emoji: '💉', color: 'bg-purple-100 text-purple-700' },
  { value: 'equipos', label: 'Equipos', emoji: '⚙️', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'otro', label: 'Otro', emoji: '📋', color: 'bg-gray-100 text-gray-500' },
]

/**
 * La única categoría que cambia entre especies es la compra de animales:
 * pollitas en ponedoras, lechones en cerdos y pollitos en engorde.
 */
const CATEGORIA_CRIA: Record<string, CategoriaCosto> = {
  pollitas: { value: 'pollitas', label: 'Pollitas', emoji: '🐣', color: 'bg-yellow-100 text-yellow-700' },
  lechones: { value: 'lechones', label: 'Lechones', emoji: '🐖', color: 'bg-pink-100 text-pink-700' },
  pollitos: { value: 'pollitos', label: 'Pollitos', emoji: '🐥', color: 'bg-yellow-100 text-yellow-700' },
}

/** Categorías de costo de una especie, según cómo llame a los animales que compra. */
export function categoriasCosto(categoriaCria = 'pollitas'): CategoriaCosto[] {
  const cria = CATEGORIA_CRIA[categoriaCria] ?? CATEGORIA_CRIA.pollitas
  return [cria, ...CATEGORIAS_COSTO.filter(c => c.value !== 'pollitas')]
}

export function categoriaInfo(categoria: string) {
  const propias = CATEGORIAS_COSTO.find(c => c.value === categoria || c.legacy?.includes(categoria))
  return propias ?? CATEGORIA_CRIA[categoria]
}

/** Mapa value→label para el prop `items` de `<Select>` (Base UI necesita esto para mostrar la etiqueta seleccionada en vez del value crudo). */
export const CATEGORIAS_COSTO_ITEMS = Object.fromEntries(CATEGORIAS_COSTO.map(c => [c.value, `${c.emoji} ${c.label}`]))

export function categoriasCostoItems(categoriaCria = 'pollitas') {
  return Object.fromEntries(categoriasCosto(categoriaCria).map(c => [c.value, `${c.emoji} ${c.label}`]))
}
