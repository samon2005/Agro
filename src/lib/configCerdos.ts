/**
 * Parámetros de cerdos de cada granja.
 *
 * Todo lo que antes estaba fijo en el código (días de gestación, lactancia,
 * etapas con sus pesos, umbrales de alerta, metas) sale de aquí. Cada granja
 * parte de los valores por defecto (fisiología y lo más común en Colombia) y
 * guarda en `fincas.config_cerdos` solo lo que cambie. Las pantallas, las
 * gráficas, los reportes, las alertas y las predicciones leen de este archivo,
 * así que un cambio aquí se refleja en todas partes.
 */
import type { Json } from '@/types/database'

export type EtapaEngorde = 'precebo' | 'levante' | 'ceba'
/** Cómo se sabe que la cerda quedó preñada (o que salió vacía) */
export type MetodoConfirmacion = 'no_repeticion' | 'ecografia' | 'otro'

export const METODOS_CONFIRMACION: { value: MetodoConfirmacion; label: string }[] = [
  { value: 'no_repeticion', label: 'No repitió celo' },
  { value: 'ecografia', label: 'Ecografía' },
  { value: 'otro', label: 'Otro método' },
]

export type GrupoAnimal = 'gestacion' | 'lactancia' | 'precebo' | 'levante' | 'ceba'

export interface EtapaEngordeConfig {
  /** Peso con que entra el grupo a la etapa (kg) */
  pesoEntrada: number
  /** Peso con que sale (kg) */
  pesoSalida: number
  /** Días que dura la etapa, si la granja los tiene definidos */
  dias: number | null
}

export interface RangoConfig { min: number; max: number }

export interface ConfigCerdos {
  reproduccion: {
    diasGestacion: number
    /** Lactancia: días mínimo, objetivo y máximo antes del destete */
    lactanciaMin: number
    lactanciaObjetivo: number
    lactanciaMax: number
    /** Días entre el destete y el siguiente servicio */
    desteteServicioMin: number
    desteteServicioMax: number
    /** Ciclo estral: si el servicio no prendió, la cerda repite a estos días */
    cicloEstral: number
    /** Días antes del parto en que la cerda pasa a parideras */
    trasladoParideras: number
    /** Desde cuántos días antes del parto empieza el aviso diario */
    avisoParto: number
    /** Cómo confirma la granja la preñez (por validar con los profesores) */
    metodoConfirmacion: MetodoConfirmacion
    /** Día después del servicio en que se confirma la preñez */
    diaConfirmacion: number
  }
  engorde: Record<EtapaEngorde, EtapaEngordeConfig>
  reemplazo: {
    /** Ganancia diaria máxima de la hembra de reemplazo (g/día) para que no se engrase */
    gananciaMaxGDia: number
    edadMinimaDias: number
    pesoIngresoKg: number
    /** En qué celo se le hace el primer servicio */
    celoPrimerServicio: number
    /** Días de cuarentena de la primeriza que llega a la finca (por validar) */
    diasCuarentena: number
  }
  alertas: {
    /** Mortalidad de una semana que dispara la alerta, en % de los animales del grupo */
    mortalidadSemanalPct: Record<GrupoAnimal, number>
    /** Alerta si el grupo comió este % menos que lo esperado */
    consumoBajoPct: number
    /** Alerta si el peso del pesaje queda este % por debajo de lo esperado */
    bajoPesoPct: number
    /** Avisar cuando el alimento en bodega alcance para estos días */
    diasAlimentoBodega: number
    /** Temperatura de confort por grupo (°C) */
    temperatura: Record<GrupoAnimal, RangoConfig>
    /** Humedad relativa aceptable (%) */
    humedad: RangoConfig
  }
  metas: {
    partosCerdaAno: number
    destetadosCerdaAno: number
    kgDestetadosCerdaAno: number
    nacidosVivosParto: number
    mortalidadPredestetePct: number
    tasaPartoPct: number
    conversion: Record<EtapaEngorde, number>
    /** Costo por kg producido que la granja se pone como meta (pesos); null = sin meta */
    costoKg: number | null
  }
  opciones: {
    /** La granja mide el agua: si no, el campo no aparece en el registro diario */
    medirAgua: boolean
    /** Kilos de un bulto de alimento */
    pesoBultoKg: number
  }
}

/**
 * Valores por defecto. Salen de la fisiología del cerdo y de lo más común en
 * granjas tecnificadas de Colombia. Los que dependen de cada granja (metas,
 * umbrales) son puntos de partida para validar con el veterinario o asesor.
 */
export const CONFIG_CERDOS_DEFECTO: ConfigCerdos = {
  reproduccion: {
    diasGestacion: 114,
    lactanciaMin: 21,
    lactanciaObjetivo: 21,
    lactanciaMax: 28,
    desteteServicioMin: 5,
    desteteServicioMax: 7,
    cicloEstral: 21,
    trasladoParideras: 3,
    avisoParto: 7,
    metodoConfirmacion: 'no_repeticion',
    diaConfirmacion: 21,
  },
  engorde: {
    precebo: { pesoEntrada: 6.5, pesoSalida: 30, dias: 49 },
    levante: { pesoEntrada: 30, pesoSalida: 80, dias: null },
    ceba: { pesoEntrada: 80, pesoSalida: 120, dias: null },
  },
  reemplazo: {
    gananciaMaxGDia: 600,
    edadMinimaDias: 210,
    pesoIngresoKg: 140,
    celoPrimerServicio: 3,
    diasCuarentena: 30,
  },
  alertas: {
    mortalidadSemanalPct: { gestacion: 0.5, lactancia: 3, precebo: 1, levante: 0.5, ceba: 0.5 },
    consumoBajoPct: 15,
    bajoPesoPct: 10,
    diasAlimentoBodega: 7,
    temperatura: {
      gestacion: { min: 16, max: 22 },
      lactancia: { min: 18, max: 24 },
      precebo: { min: 22, max: 28 },
      levante: { min: 18, max: 24 },
      ceba: { min: 16, max: 22 },
    },
    humedad: { min: 50, max: 75 },
  },
  metas: {
    partosCerdaAno: 2.4,
    destetadosCerdaAno: 28,
    kgDestetadosCerdaAno: 180,
    nacidosVivosParto: 13,
    mortalidadPredestetePct: 10,
    tasaPartoPct: 85,
    conversion: { precebo: 1.5, levante: 2.4, ceba: 2.9 },
    costoKg: null,
  },
  opciones: {
    medirAgua: false,
    pesoBultoKg: 40,
  },
}

type Parcial<T> = { [K in keyof T]?: T[K] extends object ? Parcial<T[K]> | null : T[K] | null }

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Mezcla lo guardado con los valores por defecto: lo que falte o venga mal se toma del defecto. */
function mezclar<T>(base: T, cambios: unknown): T {
  if (!esObjeto(base) || !esObjeto(cambios)) return base
  const out: Record<string, unknown> = { ...base }
  for (const k of Object.keys(base)) {
    const b = (base as Record<string, unknown>)[k]
    const c = cambios[k]
    if (c === undefined) continue
    if (esObjeto(b)) out[k] = mezclar(b, c)
    else if (typeof b === 'number') out[k] = typeof c === 'number' && Number.isFinite(c) ? c : b
    else if (typeof b === 'boolean') out[k] = typeof c === 'boolean' ? c : b
    else if (b === null) out[k] = typeof c === 'number' && Number.isFinite(c) ? c : null
    else out[k] = c ?? b
  }
  return out as T
}

/** Los parámetros de la granja: los por defecto con lo que la granja haya cambiado. */
export function configCerdos(guardado: Json | Parcial<ConfigCerdos> | null | undefined): ConfigCerdos {
  const cfg = mezclar(CONFIG_CERDOS_DEFECTO, guardado ?? {})
  if (!METODOS_CONFIRMACION.some(m => m.value === cfg.reproduccion.metodoConfirmacion))
    cfg.reproduccion.metodoConfirmacion = CONFIG_CERDOS_DEFECTO.reproduccion.metodoConfirmacion
  return cfg
}

/**
 * Lo que se guarda en la base: solo las diferencias con el defecto, para que si
 * mañana cambia un valor por defecto, las granjas que no lo tocaron lo reciban.
 */
export function diferenciasConDefecto(cfg: ConfigCerdos): Json {
  function diff(base: unknown, actual: unknown): unknown {
    if (esObjeto(base) && esObjeto(actual)) {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(base)) {
        const d = diff(base[k], actual[k])
        if (d !== undefined) out[k] = d
      }
      return Object.keys(out).length > 0 ? out : undefined
    }
    return base === actual ? undefined : actual
  }
  return (diff(CONFIG_CERDOS_DEFECTO, cfg) ?? {}) as Json
}

/** Rango de lactancia en texto: "21 a 28 días" */
export function textoLactancia(cfg: ConfigCerdos): string {
  const r = cfg.reproduccion
  return r.lactanciaMin === r.lactanciaMax ? `${r.lactanciaMin} días` : `${r.lactanciaMin} a ${r.lactanciaMax} días`
}

/** Rango de destete a servicio en texto: "5 a 7 días" */
export function textoDesteteServicio(cfg: ConfigCerdos): string {
  const r = cfg.reproduccion
  return r.desteteServicioMin === r.desteteServicioMax ? `${r.desteteServicioMin} días` : `${r.desteteServicioMin} a ${r.desteteServicioMax} días`
}

/** "6,5 a 30 kg" */
export function textoPesosEtapa(e: EtapaEngordeConfig): string {
  const kg = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 })
  return `${kg(e.pesoEntrada)} a ${kg(e.pesoSalida)} kg`
}
