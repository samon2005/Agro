import type { EspecieFinca } from '@/lib/especies'

/** Para qué se usa un corral de cerdos: se muestra bajo su nombre ("Corral 1 · cría"). */
export const USOS_CORRAL = [
  { value: 'cria', label: 'Cría', detalle: 'Cerdas de cría: servicios, partos y destetes' },
  { value: 'precebo', label: 'Precebo', detalle: 'Lechones destetados' },
] as const

export type UsoCorral = typeof USOS_CORRAL[number]['value']

export function usoCorralLabel(uso: string | null | undefined): string | null {
  if (!uso) return null
  return USOS_CORRAL.find(u => u.value === uso)?.label ?? uso
}

/**
 * Cómo se llama el lugar fijo donde viven los animales de cada especie: las aves
 * en galpones y los cerdos en corrales. Se registran con la finca, con su medida.
 */
export const LUGAR: Partial<Record<EspecieFinca, {
  tipo: 'galpon' | 'corral'
  singular: string
  plural: string
  /** Para el ejemplo del primer nombre: "Galpón 1", "Corral 1" */
  base: string
  /** Lo que entra al lugar, para los textos ("con aves", "con cerdos") */
  animales: string
}>> = {
  aves_ponedoras: { tipo: 'galpon', singular: 'galpón', plural: 'galpones', base: 'Galpón', animales: 'aves' },
  cerdos: { tipo: 'corral', singular: 'corral', plural: 'corrales', base: 'Corral', animales: 'cerdos' },
}

/** Las especies que registran sus lugares fijos al crear la finca. */
export function llevaLugares(especie: EspecieFinca | null | undefined): boolean {
  return especie != null && LUGAR[especie] != null
}
