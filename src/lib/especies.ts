export type EspecieFinca = 'aves_ponedoras' | 'cerdos' | 'pollo_engorde'

/**
 * `label` es como se nombra la especie en toda la app; `labelNav` es como aparece
 * en la barra lateral, donde aves ponedoras va por su nombre y no por "Galpones".
 */
export const ESPECIES_FINCA: { value: EspecieFinca; label: string; labelNav?: string; icon: string; href: string }[] = [
  { value: 'aves_ponedoras', label: 'Galpones', labelNav: 'Aves ponedoras', icon: '🐔', href: '/aves-ponedoras' },
  { value: 'cerdos', label: 'Cerdos', icon: '🐷', href: '/cerdos' },
  { value: 'pollo_engorde', label: 'Pollo de Engorde', icon: '🐥', href: '/pollo-engorde' },
]
