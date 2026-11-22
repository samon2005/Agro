/**
 * La plata de los cerdos (José, sección 12): el valor de cada venta (en pie, en
 * canal o por animal), las cuentas por cobrar y la economía de cada grupo:
 * costo por kg producido, por lechón destetado, margen por cerdo y punto de
 * equilibrio. Los costos comunes de la finca se reparten a cada grupo según sus
 * animales-día (forma por defecto; el profesor puede definir otra).
 * Única fuente: ventas, estadísticas del grupo y reportes leen de aquí.
 */

export interface VentaEntrada {
  cantidad: number
  /** Kilos en pie de todos los cerdos vendidos */
  pesoTotalKg: number | null
  modo: 'kg' | 'animal'
  tipo: 'pie' | 'canal'
  precioKg: number | null
  precioAnimal: number | null
  /** % de rendimiento en canal (ej. 78) */
  rendimientoPct: number | null
}

/** Kilos que se cobran y valor de la venta. En canal: kg en pie × rendimiento (sugerencia por validar). */
export function valorVenta(v: VentaEntrada): { kgCobrados: number | null; valor: number | null } {
  if (v.modo === 'animal') {
    return { kgCobrados: v.pesoTotalKg, valor: v.precioAnimal != null ? v.precioAnimal * v.cantidad : null }
  }
  if (v.pesoTotalKg == null || v.precioKg == null) return { kgCobrados: null, valor: null }
  const kg = v.tipo === 'canal' ? v.pesoTotalKg * ((v.rendimientoPct ?? 78) / 100) : v.pesoTotalKg
  return { kgCobrados: kg, valor: kg * v.precioKg }
}

export interface VentaSaldo { valor_total: number | null; pagado: number | null; fecha: string; fecha_vencimiento: string | null }

/** Lo que falta por cobrar de una venta, y si ya se venció */
export function saldoVenta(v: VentaSaldo, hoy: string): { saldo: number; vencida: boolean } {
  const saldo = Math.max(0, Number(v.valor_total ?? 0) - Number(v.pagado ?? 0))
  return { saldo, vencida: saldo > 0 && !!v.fecha_vencimiento && v.fecha_vencimiento < hoy }
}

/**
 * Reparte un costo común de la finca entre los grupos según sus animales-día
 * en el periodo (un grupo con más animales y más días carga más).
 */
export function repartirCosto(monto: number, grupos: { id: string; animalesDia: number }[]): Map<string, number> {
  const total = grupos.reduce((s, g) => s + g.animalesDia, 0)
  return new Map(grupos.map(g => [g.id, total > 0 ? (monto * g.animalesDia) / total : 0]))
}

export interface EconomiaGrupo {
  costoTotal: number
  ingresos: number
  kgProducidos: number
  cerdosVendidos: number
  lechonesDestetados?: number
}

export function economiaGrupo(e: EconomiaGrupo) {
  const costoKg = e.kgProducidos > 0 ? e.costoTotal / e.kgProducidos : null
  const utilidad = e.ingresos - e.costoTotal
  const margenCerdo = e.cerdosVendidos > 0 ? utilidad / e.cerdosVendidos : null
  const costoLechon = e.lechonesDestetados ? e.costoTotal / e.lechonesDestetados : null
  // Precio por kg con el que la venta apenas cubre los costos
  const precioEquilibrioKg = costoKg
  return { costoKg, utilidad, margenCerdo, costoLechon, precioEquilibrioKg }
}
