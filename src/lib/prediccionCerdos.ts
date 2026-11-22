/**
 * Predicciones y sugerencias de cerdos (José: "que me sorprendan", "como
 * sugerencia, no como establecidas"). Son estimaciones con relaciones conocidas
 * de la literatura de producción porcina; cada número se presenta como
 * aproximado y se corrige con los pesajes reales.
 *
 * Referencias generales: la ganancia en lactancia ronda 200 a 250 g/día y los
 * lechones de menos de 1 kg al nacer crecen más lento; el peso al destete pesa
 * en todo el precebo (cada kg de más al destete suma alrededor de 1 a 1,5 kg al
 * final del precebo). Fuera del rango de confort el cerdo come menos con calor y
 * gasta energía con frío.
 */
import type { ConfigCerdos } from './configCerdos'

/** Peso estimado de un lechón al destete y a la salida del precebo, desde su peso al nacer o al destete */
export function prediccionLechon(p: {
  pesoNacer: number | null
  pesoDestete: number | null
  diasLactancia: number
  cfg: ConfigCerdos
}): { destete: number | null; salidaPrecebo: number | null; liviano: boolean } | null {
  const liviano = p.pesoNacer != null && p.pesoNacer < 1
  const destete = p.pesoDestete ?? (p.pesoNacer != null ? p.pesoNacer + (liviano ? 0.19 : 0.23) * p.diasLactancia : null)
  if (destete == null) return null
  const etapa = p.cfg.engorde.precebo
  // La referencia de la granja (6,5 → 30 kg en 49 días) se corre con el peso al destete
  const salida = etapa.pesoSalida + (destete - etapa.pesoEntrada) * 1.25
  return { destete, salidaPrecebo: Math.max(destete, salida), liviano }
}

/** Cómo cambia el consumo los días con temperatura fuera de rango frente a los días dentro */
export function impactoTemperatura(
  registros: { temperatura_c?: number | null; consumo_real_kg: number | null; alimento_kg: number }[],
  rango: { min: number; max: number },
): { diasFuera: number; diasDentro: number; difConsumoPct: number | null } | null {
  const con = registros.filter(r => r.temperatura_c != null)
  if (con.length < 4) return null
  const comido = (r: (typeof con)[number]) => Number(r.consumo_real_kg ?? r.alimento_kg ?? 0)
  const fuera = con.filter(r => Number(r.temperatura_c) < rango.min || Number(r.temperatura_c) > rango.max)
  const dentro = con.filter(r => !fuera.includes(r))
  if (fuera.length === 0 || dentro.length === 0) return { diasFuera: fuera.length, diasDentro: dentro.length, difConsumoPct: null }
  const prom = (xs: typeof con) => xs.reduce((t, r) => t + comido(r), 0) / xs.length
  const pd = prom(dentro)
  return { diasFuera: fuera.length, diasDentro: dentro.length, difConsumoPct: pd > 0 ? ((prom(fuera) - pd) / pd) * 100 : null }
}

export interface Sugerencia { titulo: string; texto: string; fuente: string }

/** Sugerencias para un grupo de engorde según lo que la app está midiendo */
export function sugerenciasGrupo(c: {
  etapa: string
  gdpKg: number | null
  gdpEsperadaKg: number | null
  conversion: number | null
  conversionMeta: number | null
  uniformidadPct: number | null
  mortalidadSemanaPct: number | null
  mortalidadUmbralPct: number
  tempFueraDias: number
  consumoBajo: boolean
}): Sugerencia[] {
  const out: Sugerencia[] = []
  if (c.gdpKg != null && c.gdpEsperadaKg != null && c.gdpKg < c.gdpEsperadaKg * 0.9) {
    out.push({
      titulo: 'Están ganando menos de lo esperado',
      texto: `Ganan ${Math.round(c.gdpKg * 1000)} g/día y se esperaban unos ${Math.round(c.gdpEsperadaKg * 1000)}. Revisa en este orden: agua (caudal de los chupos), alimento disponible y su calidad, densidad del corral, temperatura y salud (tos o diarrea).`,
      fuente: 'Guías de manejo de engorde porcino (PIC, NRC 2012)',
    })
  }
  if (c.conversion != null && c.conversionMeta != null && c.conversion > c.conversionMeta * 1.08) {
    out.push({
      titulo: 'La conversión está alta',
      texto: `Necesitan ${c.conversion.toFixed(2)} kg de alimento por kg ganado (meta ${c.conversionMeta}). Suele venir de desperdicio en el comedero (ajusta la apertura), de alimento que no corresponde a la etapa o de enfermedad subclínica.`,
      fuente: 'Manual de alimentación porcina (NRC 2012); experiencia de campo',
    })
  }
  if (c.uniformidadPct != null && c.uniformidadPct < 75) {
    out.push({
      titulo: 'El grupo está disparejo',
      texto: `Solo el ${Math.round(c.uniformidadPct)} % está cerca del promedio. Separa los más livianos en un corral aparte con más espacio de comedero, para que no los desplacen.`,
      fuente: 'Recomendaciones de manejo por tallas en precebo y engorde',
    })
  }
  if (c.mortalidadSemanaPct != null && c.mortalidadSemanaPct > c.mortalidadUmbralPct) {
    out.push({
      titulo: 'Mortalidad por encima del límite',
      texto: 'Haz necropsia de los muertos para saber la causa, separa los enfermos en clínica y revisa con el veterinario el plan de vacunas y el agua.',
      fuente: 'Protocolos sanitarios porcinos (ICA, Porkcolombia)',
    })
  }
  if (c.tempFueraDias >= 2) {
    out.push({
      titulo: 'Varios días fuera de la temperatura de confort',
      texto: 'Con calor comen menos y ganan menos; con frío gastan alimento en calentarse. Ajusta cortinas, ventilación o calefacción según la etapa.',
      fuente: 'Rangos de confort térmico por etapa (literatura de bienestar porcino)',
    })
  }
  if (c.consumoBajo) {
    out.push({
      titulo: 'Comieron menos de lo esperado',
      texto: 'Antes de pensar en enfermedad, revisa que los chupos den agua y que el comedero no esté tapado o vacío.',
      fuente: 'Diagnóstico de consumo en cerdos (guías de manejo)',
    })
  }
  return out
}
