import type { NombreIcono } from '@/components/ui/icon'

export type EspecieFinca = 'aves_ponedoras' | 'cerdos' | 'pollo_engorde'

/**
 * `label` es como se nombra la especie en toda la app; `labelNav` es como aparece
 * en la barra lateral, donde aves ponedoras va por su nombre y no por "Galpones".
 * `lugar` es cómo se llama donde viven los animales, que es lo que se muestra
 * cuando la finca trabaja una sola especie: ahí decir la especie sobra.
 */
export const ESPECIES_FINCA: { value: EspecieFinca; label: string; labelNav?: string; lugar: string; icon: NombreIcono; href: string }[] = [
  { value: 'aves_ponedoras', label: 'Galpones', labelNav: 'Aves ponedoras', lugar: 'Galpones', icon: 'gallina', href: '/aves-ponedoras' },
  { value: 'cerdos', label: 'Cerdos', lugar: 'Corrales', icon: 'cerdo', href: '/cerdos' },
  { value: 'pollo_engorde', label: 'Pollo de Engorde', lugar: 'Galpones', icon: 'pollo', href: '/pollo-engorde' },
]

/** Las especies con las que trabaja la finca, en el orden de siempre. */
export function especiesDeFinca(tipoProduccion: string[] | null | undefined): EspecieFinca[] {
  const marcadas = tipoProduccion ?? []
  return ESPECIES_FINCA.filter(e => marcadas.includes(e.value)).map(e => e.value)
}

/** La finca trabaja una sola especie: no hay con qué confundirla, así que no se nombra. */
export function unaSolaEspecie(tipoProduccion: string[] | null | undefined): boolean {
  return especiesDeFinca(tipoProduccion).length <= 1
}

/**
 * Cómo se titula la sección de una especie. Con varias especies se nombra la
 * especie ("Aves ponedoras", "Cerdos"); con una sola basta el lugar donde
 * viven los animales ("Galpones", "Corrales"), porque el productor ya sabe
 * con qué trabaja.
 */
export function nombreSeccion(especie: EspecieFinca, tipoProduccion: string[] | null | undefined): string {
  const info = ESPECIES_FINCA.find(e => e.value === especie)
  if (!info) return ''
  return unaSolaEspecie(tipoProduccion) ? info.lugar : (info.labelNav ?? info.label)
}
