import type { EspecieFinca } from '@/lib/especies'

/**
 * Las naves de una granja de cerdos: una por etapa. Las de cría guardan cerdas
 * (en jaulas o parideras numeradas, o sueltas); las de engorde se dividen en
 * corrales, y cada corral tiene su grupo de cerdos.
 */
export const USOS_NAVE = [
  { value: 'gestacion', label: 'Gestación', grupo: 'cria', detalle: 'Cerdas servidas y gestantes', puestos: 'jaulas' },
  { value: 'parideras', label: 'Parideras', grupo: 'cria', detalle: 'Cerdas que van a parir y sus lechones', puestos: 'parideras' },
  { value: 'cuarentena', label: 'Cuarentena', grupo: 'cria', detalle: 'Hembras de reemplazo que llegan', puestos: null },
  { value: 'berraco', label: 'Berraco o celador', grupo: 'cria', detalle: 'Machos para detectar celos o sacar semen', puestos: null },
  { value: 'precebo', label: 'Precebo', grupo: 'engorde', detalle: 'Lechones destetados', puestos: null },
  { value: 'levante', label: 'Levante', grupo: 'engorde', detalle: 'Cerdos en crecimiento', puestos: null },
  { value: 'ceba', label: 'Ceba', grupo: 'engorde', detalle: 'Cerdos hasta el peso de venta', puestos: null },
  { value: 'clinica', label: 'Clínica', grupo: 'engorde', detalle: 'Animales enfermos o atrasados', puestos: null },
] as const

export type UsoNave = typeof USOS_NAVE[number]['value']

/** Antes se registraban "corrales de cría"; hoy son naves de gestación. Se sigue leyendo bien. */
const USOS_VIEJOS: Record<string, string> = { cria: 'Cría' }

/** Se mantiene el nombre de antes para lo que ya lo usa. */
export const USOS_CORRAL = USOS_NAVE

export function usoCorralLabel(uso: string | null | undefined): string | null {
  if (!uso) return null
  return USOS_NAVE.find(u => u.value === uso)?.label ?? USOS_VIEJOS[uso] ?? uso
}

/** La nave guarda cerdas del pie de cría (gestación, parideras, cuarentena, berraco). */
export function esNaveDeCria(uso: string | null | undefined): boolean {
  return uso === 'cria' || USOS_NAVE.some(u => u.value === uso && u.grupo === 'cria')
}

/** Cómo se llaman los puestos de la nave ("jaulas", "parideras"), o null si no lleva puestos. */
export function nombrePuestos(uso: string | null | undefined): string | null {
  return USOS_NAVE.find(u => u.value === uso)?.puestos ?? null
}

/**
 * Cómo se llama el lugar fijo donde viven los animales de cada especie: las aves
 * en galpones y los cerdos en naves (con sus corrales). Se registran con la finca.
 */
export const LUGAR: Partial<Record<EspecieFinca, {
  tipo: 'galpon' | 'nave'
  singular: string
  plural: string
  /** Para el ejemplo del primer nombre: "Galpón 1", "Nave 1" */
  base: string
  /** Lo que entra al lugar, para los textos ("con aves", "con cerdos") */
  animales: string
}>> = {
  aves_ponedoras: { tipo: 'galpon', singular: 'galpón', plural: 'galpones', base: 'Galpón', animales: 'aves' },
  cerdos: { tipo: 'nave', singular: 'nave', plural: 'naves', base: 'Nave', animales: 'cerdos' },
}

/** Las especies que registran sus lugares fijos al crear la finca. */
export function llevaLugares(especie: EspecieFinca | null | undefined): boolean {
  return especie != null && LUGAR[especie] != null
}

/** Lo mínimo de un lugar para armar el árbol de naves y corrales. */
export interface LugarCerdos {
  id: string
  nombre: string
  tipo: string
  uso: string | null
  padre_id: string | null
  puestos: number | null
  area_m2: number | null
}

/** Ordena por nombre como lo leería una persona: "Nave 2" antes que "Nave 10". */
export function porNombre<T extends { nombre: string }>(a: T, b: T): number {
  return a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
}

/**
 * Las naves en el orden en que el animal pasa por ellas (gestación → parideras →
 * precebo → levante → ceba → clínica) y, dentro de cada uso, por nombre.
 */
export function porFlujo<T extends { nombre: string; uso: string | null }>(a: T, b: T): number {
  const i = (u: string | null) => { const k = USOS_NAVE.findIndex(x => x.value === u); return k < 0 ? (u === 'cria' ? 0 : 99) : k }
  return i(a.uso) - i(b.uso) || porNombre(a, b)
}

/**
 * Las naves de la granja con sus corrales. Los corrales que se registraron antes
 * de que existieran las naves (sin nave) se devuelven aparte para no perderlos.
 */
export function arbolNaves<T extends LugarCerdos>(lugares: T[]): { naves: (T & { corrales: T[] })[]; sueltos: T[] } {
  const naves = lugares.filter(l => l.tipo === 'nave').sort(porFlujo)
  const ids = new Set(naves.map(n => n.id))
  return {
    naves: naves.map(n => ({ ...n, corrales: lugares.filter(l => l.padre_id === n.id).sort(porNombre) })),
    sueltos: lugares.filter(l => l.tipo !== 'nave' && (!l.padre_id || !ids.has(l.padre_id))).sort(porNombre),
  }
}

/** Lo que necesitan las pantallas de cría de cada nave. */
export type NaveRef = Pick<LugarCerdos, 'id' | 'nombre' | 'uso' | 'puestos'>
