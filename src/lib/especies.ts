export type EspecieFinca = 'aves_ponedoras' | 'cerdos' | 'pollo_engorde'

export const ESPECIES_FINCA: { value: EspecieFinca; label: string; icon: string; href: string }[] = [
  { value: 'aves_ponedoras', label: 'Galpones', icon: '🐔', href: '/aves-ponedoras' },
  { value: 'cerdos', label: 'Cerdos', icon: '🐷', href: '/cerdos' },
  { value: 'pollo_engorde', label: 'Pollo de Engorde', icon: '🐥', href: '/pollo-engorde' },
]
