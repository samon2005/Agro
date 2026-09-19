/** Tamaños de huevo con los que se clasifica, se vende y se pone precio. */
export const TAMANOS_HUEVO = [
  { key: 'b', label: 'B' },
  { key: 'a', label: 'A' },
  { key: 'aa', label: 'AA' },
  { key: 'aaa', label: 'AAA' },
  { key: 'jumbo', label: 'JUMBO' },
] as const

export type TamanoHuevo = typeof TAMANOS_HUEVO[number]['key']

/** Precio por tamaño que rige para toda la finca. */
export type PreciosHuevo = Record<TamanoHuevo, number | null>

type ConCantidades = { cantidad_b: number; cantidad_a: number; cantidad_aa: number; cantidad_aaa: number; cantidad_jumbo: number }
type ConPrecios = { precio_b: number | null; precio_a: number | null; precio_aa: number | null; precio_aaa: number | null; precio_jumbo: number | null }

export function huevosDe(v: ConCantidades): number {
  return v.cantidad_b + v.cantidad_a + v.cantidad_aa + v.cantidad_aaa + v.cantidad_jumbo
}

/** Lo que vale la venta según los precios con los que se registró. */
export function valorVenta(v: ConCantidades & ConPrecios): number {
  return v.cantidad_b * Number(v.precio_b ?? 0) + v.cantidad_a * Number(v.precio_a ?? 0)
    + v.cantidad_aa * Number(v.precio_aa ?? 0) + v.cantidad_aaa * Number(v.precio_aaa ?? 0)
    + v.cantidad_jumbo * Number(v.precio_jumbo ?? 0)
}

/** Los precios de la finca, leídos de su fila. */
export function preciosDeFinca(f: {
  precio_huevo_b?: number | null; precio_huevo_a?: number | null; precio_huevo_aa?: number | null
  precio_huevo_aaa?: number | null; precio_huevo_jumbo?: number | null
} | null | undefined): PreciosHuevo {
  return {
    b: f?.precio_huevo_b != null ? Number(f.precio_huevo_b) : null,
    a: f?.precio_huevo_a != null ? Number(f.precio_huevo_a) : null,
    aa: f?.precio_huevo_aa != null ? Number(f.precio_huevo_aa) : null,
    aaa: f?.precio_huevo_aaa != null ? Number(f.precio_huevo_aaa) : null,
    jumbo: f?.precio_huevo_jumbo != null ? Number(f.precio_huevo_jumbo) : null,
  }
}

/** Hay precios definidos cuando al menos un tamaño tiene precio mayor que cero. */
export function hayPrecios(p: PreciosHuevo): boolean {
  return TAMANOS_HUEVO.some(t => (p[t.key] ?? 0) > 0)
}

export function cop(n: number): string {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}
