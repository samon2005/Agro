/**
 * Días de ciclo según el sexo. Los machos engordan más rápido y salen antes;
 * cada granja ajusta estos días, por eso quedan en el lote y se pueden cambiar.
 */
export const DIAS_CICLO_POR_SEXO = {
  machos: 42,
  hembras: 48,
  mixto: 45,
} as const

export type SexoLotePollo = keyof typeof DIAS_CICLO_POR_SEXO

/** Cómo se nombra el sexo del lote en la pantalla. */
export const SEXO_LABEL: Record<string, string> = {
  machos: 'Machos',
  hembras: 'Hembras',
  mixto: 'Mixto',
}

/** Días de vida que lleva el lote, contando desde que llegó. */
export function diasDeVida(fechaIngreso: string, hasta?: string): number {
  const inicio = new Date(fechaIngreso + 'T00:00:00').getTime()
  const fin = hasta ? new Date(hasta + 'T00:00:00').getTime() : Date.now()
  return Math.max(0, Math.floor((fin - inicio) / 86400000))
}

/** La fecha en la que el lote llega a su día de salida. */
export function fechaSalidaPrevista(fechaIngreso: string, diasCiclo: number | null | undefined): string | null {
  if (!diasCiclo || diasCiclo <= 0) return null
  const d = new Date(fechaIngreso + 'T00:00:00')
  d.setDate(d.getDate() + diasCiclo)
  return d.toISOString().slice(0, 10)
}

/**
 * Peso esperado del pollo de engorde por día de vida, en gramos. Es la curva de
 * referencia de una línea comercial: sirve para comparar, no para reemplazar la
 * tabla de la genética que use la granja.
 */
const CURVA_PESO_G: Record<number, number> = {
  0: 42, 7: 180, 14: 450, 21: 900, 28: 1500, 35: 2200, 42: 2900, 49: 3500,
}

/** Peso de referencia a un día de vida, interpolando entre semanas. */
export function pesoEsperadoG(dia: number): number | null {
  if (dia < 0) return null
  const dias = Object.keys(CURVA_PESO_G).map(Number).sort((a, b) => a - b)
  if (dia >= dias[dias.length - 1]) return CURVA_PESO_G[dias[dias.length - 1]]
  for (let i = 0; i < dias.length - 1; i++) {
    const a = dias[i]
    const b = dias[i + 1]
    if (dia >= a && dia <= b) {
      const proporcion = (dia - a) / (b - a)
      return Math.round(CURVA_PESO_G[a] + (CURVA_PESO_G[b] - CURVA_PESO_G[a]) * proporcion)
    }
  }
  return null
}
