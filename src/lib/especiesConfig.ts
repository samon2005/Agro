import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { EspecieFinca } from './especies'

/**
 * Nombres de tabla por especie. Las columnas son iguales entre especies por
 * diseño, así que un mismo componente sirve para las tres cambiando solo esto.
 */
export interface TablasEspecie {
  lotes: string
  costos: string
  costosPredefinidos: string
  ventas: string
  equipos: string
  equiposLogs: string
  tiposAlimento: string
  requerimientos: string
  horarios: string
  horariosCompletados: string
  medicaciones: string
  eventosClinicos: string
  recordatorios: string
  vacunaciones: string
  desinfecciones: string
  /** Registro diario donde vive el consumo de alimento */
  registroDiario: string
}

/**
 * Cómo expresa cada especie sus requerimientos nutricionales. En carne se
 * trabaja con porcentajes de la dieta más un consumo objetivo por día; en
 * ponedoras se trabaja por gramos de mantenimiento y de producción.
 */
export interface ConfigNutricion {
  /** Columna que identifica la etapa/fase en la tabla de requerimientos */
  campoEtapa: string
  etiquetaEtapa: string
  /** Columna con el consumo objetivo por animal y día */
  campoConsumo: string
  unidadConsumo: 'kg' | 'g'
  /** Etapas o fases disponibles */
  etapas: { value: string; label: string }[]
  /** Categorías del catálogo de alimento */
  categoriasAlimento: { value: string; label: string }[]
}

export interface ConfigEspecie {
  especie: EspecieFinca
  label: string
  icono: string
  href: string
  /** Cómo se llama un animal de esta especie, para los textos de la interfaz */
  animalSingular: string
  animalPlural: string
  /** Cómo se llama el espacio donde vive el lote */
  loteLabel: string
  /** Columna con la cantidad de animales vivos en `lotes` */
  campoActuales: string
  /** Columna con la cantidad inicial en `lotes` */
  campoIniciales: string
  /** Columna con la fecha de entrada en `lotes` */
  campoFechaInicio: string
  /** Categoría de costo para la compra de animales */
  categoriaCria: string
  /** Clase de color del botón principal */
  botonClase: string
  tablas: TablasEspecie
  nutricion: ConfigNutricion
}

const NUTRICION_AVES: ConfigNutricion = {
  campoEtapa: 'etapa',
  etiquetaEtapa: 'Etapa',
  campoConsumo: 'consumo_g_dia',
  unidadConsumo: 'g',
  etapas: [{ value: 'postura', label: 'Postura' }],
  categoriasAlimento: [
    { value: 'levante', label: 'Levante' },
    { value: 'pollitas_ponedoras', label: 'Pollitas ponedoras' },
    { value: 'otros', label: 'Otros' },
  ],
}

const NUTRICION_CERDOS: ConfigNutricion = {
  campoEtapa: 'etapa',
  etiquetaEtapa: 'Etapa',
  campoConsumo: 'consumo_kg_dia',
  unidadConsumo: 'kg',
  etapas: [
    { value: 'precebo', label: 'Precebo (7–40 kg)' },
    { value: 'levante', label: 'Levante (40–60 kg)' },
    { value: 'ceba', label: 'Ceba (60–100 kg)' },
    { value: 'finalizacion', label: 'Finalización (100 kg en adelante)' },
  ],
  categoriasAlimento: [
    { value: 'preiniciacion', label: 'Preiniciación' },
    { value: 'iniciacion', label: 'Iniciación' },
    { value: 'levante', label: 'Levante' },
    { value: 'ceba', label: 'Ceba' },
    { value: 'finalizacion', label: 'Finalización' },
    { value: 'otros', label: 'Otros' },
  ],
}

const NUTRICION_POLLO: ConfigNutricion = {
  campoEtapa: 'fase',
  etiquetaEtapa: 'Fase',
  campoConsumo: 'consumo_g_dia',
  unidadConsumo: 'g',
  etapas: [
    { value: 'preiniciador', label: 'Preiniciador (día 0–10)' },
    { value: 'iniciador', label: 'Iniciador (día 11–24)' },
    { value: 'engorde', label: 'Engorde (día 25–35)' },
    { value: 'finalizador', label: 'Finalizador (día 36 en adelante)' },
  ],
  categoriasAlimento: [
    { value: 'preiniciador', label: 'Preiniciador' },
    { value: 'iniciador', label: 'Iniciador' },
    { value: 'engorde', label: 'Engorde' },
    { value: 'finalizador', label: 'Finalizador' },
    { value: 'otros', label: 'Otros' },
  ],
}

export const CONFIG_ESPECIES: Record<EspecieFinca, ConfigEspecie> = {
  aves_ponedoras: {
    especie: 'aves_ponedoras',
    label: 'Aves Ponedoras',
    icono: '🐔',
    href: '/aves-ponedoras',
    animalSingular: 'ave',
    animalPlural: 'aves',
    loteLabel: 'galpón',
    campoActuales: 'aves_actuales',
    campoIniciales: 'aves_iniciales',
    campoFechaInicio: 'fecha_inicio',
    categoriaCria: 'pollitas',
    botonClase: 'bg-green-700 hover:bg-green-800 text-white',
    tablas: {
      lotes: 'lotes_aves',
      costos: 'costos_lote_aves',
      costosPredefinidos: 'costos_predefinidos_aves',
      ventas: 'ventas_huevos_aves',
      equipos: 'equipos_aves',
      equiposLogs: 'equipos_aves_logs',
      tiposAlimento: 'tipos_alimento_aves',
      requerimientos: 'requerimientos_nutricionales_aves',
      horarios: 'horarios_alimentacion_aves',
      horariosCompletados: 'horarios_alimentacion_completados',
      medicaciones: 'medicaciones_aves',
      eventosClinicos: 'eventos_clinicos_aves',
      recordatorios: 'recordatorios_medicacion_aves',
      vacunaciones: 'vacunaciones_aves',
      desinfecciones: 'desinfecciones_aves',
      registroDiario: 'produccion_diaria_aves',
    },
    nutricion: NUTRICION_AVES,
  },
  cerdos: {
    especie: 'cerdos',
    label: 'Cerdos',
    icono: '🐷',
    href: '/cerdos',
    animalSingular: 'cerdo',
    animalPlural: 'cerdos',
    loteLabel: 'corral',
    campoActuales: 'animales_actuales',
    campoIniciales: 'numero_animales',
    campoFechaInicio: 'fecha_ingreso',
    categoriaCria: 'lechones',
    botonClase: 'bg-orange-600 hover:bg-orange-700 text-white',
    tablas: {
      lotes: 'lotes_cerdos',
      costos: 'costos_lote_cerdos',
      costosPredefinidos: 'costos_predefinidos_cerdos',
      ventas: 'ventas_cerdos',
      equipos: 'equipos_cerdos',
      equiposLogs: 'equipos_cerdos_logs',
      tiposAlimento: 'tipos_alimento_cerdos',
      requerimientos: 'requerimientos_nutricionales_cerdos',
      horarios: 'horarios_alimentacion_cerdos',
      horariosCompletados: 'horarios_alimentacion_cerdos_completados',
      medicaciones: 'medicaciones_cerdos',
      eventosClinicos: 'eventos_clinicos_cerdos',
      recordatorios: 'recordatorios_medicacion_cerdos',
      vacunaciones: 'vacunaciones_cerdos',
      desinfecciones: 'desinfecciones_cerdos',
      registroDiario: 'nutricion_diaria_cerdos',
    },
    nutricion: NUTRICION_CERDOS,
  },
  pollo_engorde: {
    especie: 'pollo_engorde',
    label: 'Pollo de Engorde',
    icono: '🐥',
    href: '/pollo-engorde',
    animalSingular: 'pollo',
    animalPlural: 'pollos',
    loteLabel: 'galpón',
    campoActuales: 'pollos_actuales',
    campoIniciales: 'pollos_iniciales',
    campoFechaInicio: 'fecha_ingreso',
    categoriaCria: 'pollitos',
    botonClase: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    tablas: {
      lotes: 'lotes_pollo',
      costos: 'costos_lote_pollo',
      costosPredefinidos: 'costos_predefinidos_pollo',
      ventas: 'ventas_pollo',
      equipos: 'equipos_pollo',
      equiposLogs: 'equipos_pollo_logs',
      tiposAlimento: 'tipos_alimento_pollo',
      requerimientos: 'requerimientos_nutricionales_pollo',
      horarios: 'horarios_alimentacion_pollo',
      horariosCompletados: 'horarios_alimentacion_pollo_completados',
      medicaciones: 'medicaciones_pollo',
      eventosClinicos: 'eventos_clinicos_pollo',
      recordatorios: 'recordatorios_medicacion_pollo',
      vacunaciones: 'vacunaciones_pollo',
      desinfecciones: 'desinfecciones_pollo',
      registroDiario: 'produccion_diaria_pollo',
    },
    nutricion: NUTRICION_POLLO,
  },
}

/**
 * Cliente sin tipar por tabla, para los componentes genéricos que reciben el
 * nombre de la tabla en tiempo de ejecución. Las columnas sí están tipadas a
 * mano en cada componente con la interfaz que corresponda.
 */
export function dbGenerico(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient
}

/** Forma común de una fila de costos en cualquier especie. */
export interface CostoGenerico {
  id: string
  lote_id: string
  finca_id: string
  fecha: string
  categoria: string
  descripcion: string
  monto: number
  proveedor: string | null
  observaciones: string | null
  created_at: string
}

/** Forma común de una venta de animales (cerdos y pollo de engorde). */
export interface VentaGenerica {
  id: string
  lote_id: string
  finca_id: string
  fecha: string
  cantidad: number
  peso_promedio_kg: number | null
  modo_precio: string
  precio_kg: number | null
  precio_animal: number | null
  tipo_venta: string
  rendimiento_canal_pct: number | null
  cliente: string | null
  destino: string | null
  observaciones: string | null
  created_at: string
}

/** Forma común de un equipo en cualquier especie. */
export interface EquipoGenerico {
  id: string
  lote_id: string
  finca_id: string
  nombre: string
  tipo: string
  estado: string
  marca: string | null
  modelo: string | null
  numero_serie: string | null
  fecha_instalacion: string | null
  horas_operacion: number | null
  ultima_revision: string | null
  proximo_mantenimiento: string | null
  ubicacion: string | null
  sensor_id: string | null
  observaciones: string | null
  costo_compra: number | null
  fecha_compra: string | null
  created_at: string
}

/** Kilos vendidos en una venta (peso vivo; si es canal, aplica el rendimiento). */
export function kilosVenta(v: VentaGenerica): number {
  const kgVivo = v.cantidad * Number(v.peso_promedio_kg ?? 0)
  if (v.tipo_venta === 'canal' && v.rendimiento_canal_pct) {
    return kgVivo * (Number(v.rendimiento_canal_pct) / 100)
  }
  return kgVivo
}

/** Valor total de una venta, según se haya cobrado por kg o por animal. */
export function totalVentaAnimales(v: VentaGenerica): number {
  if (v.modo_precio === 'animal') return v.cantidad * Number(v.precio_animal ?? 0)
  return kilosVenta(v) * Number(v.precio_kg ?? 0)
}
