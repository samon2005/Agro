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

export function categoriaInfo(categoria: string) {
  return CATEGORIAS_COSTO.find(c => c.value === categoria || c.legacy?.includes(categoria))
}
