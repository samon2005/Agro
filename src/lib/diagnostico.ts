import type { FilaSemana } from '@/lib/resumenSemanal'
import type { FilaReferencia } from '@/lib/referencias'
import { mortalidadEsperadaDesde } from '@/lib/referencias'

/**
 * Sugerencias a partir de lo registrado y de las referencias de la línea.
 * NUNCA son un diagnóstico: dicen qué se salió de lo esperado y qué PODRÍA
 * estar pasando, para revisarlo con un veterinario. Solo aparecen cuando un
 * dato se sale de lo normal, para no llenar la pantalla.
 */

export type NivelSugerencia = 'alerta' | 'atento'

export interface Sugerencia {
  id: string
  nivel: NivelSugerencia
  titulo: string
  /** Lo que se observó, con números */
  observado: string
  /** Lo que posiblemente lo causa (nunca seguro) */
  causas: string[]
  /** Qué revisar o hacer */
  acciones: string[]
  /** Si conviene llamar al veterinario */
  veterinario: boolean
  fuente: string
}

const FUENTE_SANIDAD = 'Manual Merck de Veterinaria (enfermedades de las aves de corral) y guías de manejo Hy-Line y Lohmann'
const FUENTE_MANEJO = 'Guías de manejo de ponedoras Hy-Line y Lohmann'

export interface DiaCalidad {
  fecha: string
  huevos_totales: number
  huevos_rotos: number
  huevos_sucios: number
  huevos_deformes: number
}

export interface LecturaAmbiental {
  fecha: string
  temperatura_interior: number | null
  humedad_interior: number | null
  nh3_ppm: number | null
  co2_ppm: number | null
}

export interface ContextoDiagnostico {
  /** Días de los últimos 7 con producción registrada */
  dias: DiaCalidad[]
  semanas: FilaSemana[]
  ref: Map<number, FilaReferencia>
  /** Semana de vida al inicio de cada semana del lote (por su fecha `desde`) */
  vidaDe: (fecha: string) => number | null
  semanaEntrada: number | null
  pesoUltimo: { fecha: string; g: number } | null
  ambiental: LecturaAmbiental | null
  hoy: string
}

const pct = (v: number) => `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`

function semanaCompleta(f: FilaSemana) {
  return (new Date(f.hasta + 'T00:00:00').getTime() - new Date(f.desde + 'T00:00:00').getTime()) / 86_400_000 >= 6
}

export function diagnosticar(ctx: ContextoDiagnostico): Sugerencia[] {
  const s: Sugerencia[] = []
  const totales = ctx.dias.reduce((a, d) => a + d.huevos_totales, 0)

  // ── Calidad del huevo (últimos 7 días) ──
  if (totales >= 100) {
    const deformes = ctx.dias.reduce((a, d) => a + (d.huevos_deformes ?? 0), 0)
    const rotos = ctx.dias.reduce((a, d) => a + (d.huevos_rotos ?? 0), 0)
    const sucios = ctx.dias.reduce((a, d) => a + (d.huevos_sucios ?? 0), 0)
    const pD = (deformes / totales) * 100
    const picoDia = ctx.dias
      .filter(d => d.huevos_totales >= 50)
      .map(d => ({ fecha: d.fecha, p: ((d.huevos_deformes ?? 0) / d.huevos_totales) * 100 }))
      .sort((a, b) => b.p - a.p)[0]
    if (pD > 2 || (picoDia && picoDia.p >= 10)) {
      s.push({
        id: 'deformes',
        nivel: pD > 5 || (picoDia && picoDia.p >= 10) ? 'alerta' : 'atento',
        titulo: 'Más huevos deformes de lo normal',
        observado: `${pct(pD)} de huevos deformes en los últimos 7 días (lo normal es menos de 2 %)`
          + (picoDia && picoDia.p >= 10 ? `; el ${picoDia.fecha} llegó a ${pct(picoDia.p)}` : '') + '.',
        causas: [
          'Bronquitis infecciosa (cáscaras deformes o rugosas, albúmina aguada)',
          'Newcastle o síndrome de baja postura (EDS-76): cáscaras delgadas, blandas o sin cáscara',
          'Estrés: calor, ruido, manejo brusco o cambios de rutina',
          'Falta de calcio, fósforo o vitamina D3 en el alimento',
          'Micotoxinas en el alimento',
          'Edad avanzada del lote',
        ],
        acciones: [
          'Revisar el plan de vacunación (bronquitis, Newcastle, EDS)',
          'Revisar el calcio del alimento y el tamaño de partícula del carbonato',
          'Revisar temperatura y fuentes de estrés en el galpón',
          'Pedir al veterinario que examine aves y huevos',
        ],
        veterinario: true,
        fuente: FUENTE_SANIDAD,
      })
    }
    const pR = (rotos / totales) * 100
    if (pR > 3) {
      s.push({
        id: 'rotos',
        nivel: pR > 6 ? 'alerta' : 'atento',
        titulo: 'Muchos huevos rotos',
        observado: `${pct(pR)} de huevos rotos en los últimos 7 días (se busca menos de 3 %).`,
        causas: [
          'Cáscara débil: calcio, vitamina D3, calor o edad del lote',
          'Recolección poco frecuente',
          'Jaulas, bandas o bandejas en mal estado; manejo brusco',
          'Enfermedad que afecta la cáscara (bronquitis infecciosa, EDS-76)',
        ],
        acciones: ['Recolectar más veces al día', 'Revisar el piso de jaula y las bandas', 'Revisar el calcio del alimento'],
        veterinario: false,
        fuente: FUENTE_MANEJO,
      })
    }
    const pS = (sucios / totales) * 100
    if (pS > 3) {
      s.push({
        id: 'sucios',
        nivel: pS > 6 ? 'alerta' : 'atento',
        titulo: 'Muchos huevos sucios',
        observado: `${pct(pS)} de huevos sucios en los últimos 7 días (se busca menos de 3 %).`,
        causas: [
          'Diarrea o enteritis (coccidiosis, infecciones bacterianas)',
          'Nidos, cama o jaulas sucias',
          'Bebederos que gotean o mucha sal en el alimento',
          'Recolección poco frecuente',
        ],
        acciones: ['Revisar las heces de las aves', 'Limpiar nidos y revisar bebederos', 'Recolectar más veces al día'],
        veterinario: false,
        fuente: FUENTE_MANEJO,
      })
    }
  }

  // ── La última semana completa frente a la guía ──
  const completas = ctx.semanas.filter(semanaCompleta)
  const ultima = completas[completas.length - 1] ?? null
  const vidaUltima = ultima ? ctx.vidaDe(ultima.desde) : null
  const filaRef = vidaUltima != null ? ctx.ref.get(vidaUltima) : undefined

  if (ultima?.etapa === 'postura' && ultima.posturaPct != null) {
    const min = filaRef?.postura_min != null ? Number(filaRef.postura_min) : null
    if (min != null && ultima.posturaPct < min - 5) {
      s.push({
        id: 'postura',
        nivel: ultima.posturaPct < min - 10 ? 'alerta' : 'atento',
        titulo: 'Postura por debajo de la guía',
        observado: `La semana ${ultima.semana} de postura dio ${pct(ultima.posturaPct)}; la guía espera desde ${pct(min)} en la semana ${vidaUltima} de vida.`,
        causas: [
          'Estrés por calor',
          'Agua insuficiente o bebederos tapados',
          'Consumo de alimento bajo o alimento que no corresponde a la fase',
          'Programa de luz (horas o intensidad)',
          'Enfermedad: bronquitis infecciosa, Newcastle, EDS-76, coriza, micoplasma',
          'Parásitos o inicio de muda',
        ],
        acciones: ['Revisar agua, alimento y luz', 'Comparar con el consumo y la temperatura de la semana', 'Consultar al veterinario si sigue bajando'],
        veterinario: ultima.posturaPct < min - 10,
        fuente: FUENTE_MANEJO,
      })
    }
  }

  // Mortalidad de la semana frente a la que espera la guía (o a un 0,2 % semanal)
  if (ultima && ultima.mortalidadPct != null && ultima.muertes > 0) {
    let esperada = 0.2
    if (vidaUltima != null && ctx.semanaEntrada != null && ctx.ref.size) {
      const a = mortalidadEsperadaDesde(ctx.ref, ctx.semanaEntrada, vidaUltima)
      const b = vidaUltima - 1 >= ctx.semanaEntrada ? mortalidadEsperadaDesde(ctx.ref, ctx.semanaEntrada, vidaUltima - 1) : 0
      if (a != null && b != null && a - b > 0) esperada = Math.max(0.1, (a - b) * 2)
    }
    if (ultima.mortalidadPct > esperada) {
      s.push({
        id: 'mortalidad',
        nivel: ultima.mortalidadPct > Math.max(0.5, esperada * 2) ? 'alerta' : 'atento',
        titulo: 'Mortalidad alta',
        observado: `Murieron ${ultima.muertes.toLocaleString('es-CO')} aves en la semana (${pct(ultima.mortalidadPct)}), más de lo esperado (${pct(esperada)}).`,
        causas: [
          'Picaje y canibalismo (luz muy intensa, densidad, falta de proteína)',
          'Prolapsos al inicio de la postura',
          'Estrés por calor',
          'Enfermedad: colibacilosis, coriza, cólera aviar, Newcastle, influenza aviar; Marek en aves jóvenes',
          'Intoxicación (alimento, agua, productos)',
        ],
        acciones: [
          'Pedir necropsia de las aves muertas a un veterinario',
          'Revisar lesiones de picaje y la intensidad de la luz',
          'Si las muertes suben de golpe, avisar al ICA: Newcastle e influenza aviar son de notificación obligatoria',
        ],
        veterinario: true,
        fuente: FUENTE_SANIDAD,
      })
    }
  }

  // Consumo frente a la guía
  if (ultima?.consumoAveGDia != null && filaRef?.consumo_min_g != null && filaRef.consumo_max_g != null) {
    const min = Number(filaRef.consumo_min_g)
    const max = Number(filaRef.consumo_max_g)
    const c = ultima.consumoAveGDia
    if (c < min * 0.92) {
      s.push({
        id: 'consumo-bajo', nivel: c < min * 0.85 ? 'alerta' : 'atento',
        titulo: 'Comen menos de lo esperado',
        observado: `${c.toLocaleString('es-CO', { maximumFractionDigits: 1 })} g/ave/día; la guía espera ${min}–${max} g.`,
        causas: ['Calor', 'Falta de agua', 'Enfermedad', 'Alimento viejo, con hongos o mal molido', 'Comederos insuficientes o mal repartidos'],
        acciones: ['Revisar agua y temperatura', 'Revisar el alimento y los comederos', 'Observar si hay aves decaídas'],
        veterinario: false, fuente: FUENTE_MANEJO,
      })
    } else if (c > max * 1.08) {
      s.push({
        id: 'consumo-alto', nivel: 'atento',
        titulo: 'Comen más de lo esperado',
        observado: `${c.toLocaleString('es-CO', { maximumFractionDigits: 1 })} g/ave/día; la guía espera ${min}–${max} g.`,
        causas: ['Desperdicio en los comederos', 'Frío', 'Alimento con poca energía', 'Roedores o aves silvestres comiendo'],
        acciones: ['Revisar la altura y el llenado de los comederos', 'Revisar la energía del alimento con el proveedor'],
        veterinario: false, fuente: FUENTE_MANEJO,
      })
    }
  }

  // Peso del último pesaje (de las últimas 3 semanas) frente a la guía
  if (ctx.pesoUltimo) {
    const vida = ctx.vidaDe(ctx.pesoUltimo.fecha)
    const r = vida != null ? ctx.ref.get(vida) : undefined
    const dias = (new Date(ctx.hoy + 'T00:00:00').getTime() - new Date(ctx.pesoUltimo.fecha + 'T00:00:00').getTime()) / 86_400_000
    if (r?.peso_ave_min_g != null && dias <= 21 && ctx.pesoUltimo.g < Number(r.peso_ave_min_g) * 0.95) {
      const min = Number(r.peso_ave_min_g)
      s.push({
        id: 'peso', nivel: ctx.pesoUltimo.g < min * 0.9 ? 'alerta' : 'atento',
        titulo: 'Aves con bajo peso',
        observado: `El pesaje del ${ctx.pesoUltimo.fecha} dio ${Math.round(ctx.pesoUltimo.g)} g; la guía espera desde ${Math.round(min)} g en la semana ${vida} de vida.`,
        causas: ['Consumo insuficiente o alimento de otra fase', 'Densidad alta o comederos insuficientes', 'Enfermedad o parásitos'],
        acciones: ['Revisar el programa de alimentación', 'Pesar de nuevo una muestra más grande', 'Revisar la uniformidad del lote'],
        veterinario: false, fuente: FUENTE_MANEJO,
      })
    }
  }

  // ── Ambiente (lectura de los últimos 3 días) ──
  const a = ctx.ambiental
  const reciente = a && (new Date(ctx.hoy + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime()) / 86_400_000 <= 3
  if (a && reciente) {
    const t = a.temperatura_interior != null ? Number(a.temperatura_interior) : null
    if (t != null && t > 28) {
      s.push({
        id: 'calor', nivel: t > 32 ? 'alerta' : 'atento',
        titulo: 'Calor en el galpón',
        observado: `Temperatura interior de ${t} °C (las ponedoras están bien entre 18 y 25 °C).`,
        causas: ['Poca ventilación', 'Cortinas cerradas en horas de calor', 'Densidad alta'],
        acciones: [
          'Subir las cortinas y ventilar en las horas de más calor',
          'Asegurar agua fresca y suficiente',
          'Dar el alimento en las horas frescas',
        ],
        veterinario: false,
        fuente: `${FUENTE_MANEJO}. Posible efecto: menos postura, huevo más pequeño y cáscara más delgada`,
      })
    } else if (t != null && t < 15) {
      s.push({
        id: 'frio', nivel: 'atento',
        titulo: 'Frío en el galpón',
        observado: `Temperatura interior de ${t} °C.`,
        causas: ['Cortinas abiertas en la noche', 'Corrientes de aire'],
        acciones: ['Bajar las cortinas en la noche y evitar corrientes de aire'],
        veterinario: false,
        fuente: `${FUENTE_MANEJO}. Posible efecto: comen más alimento por huevo`,
      })
    }
    if (a.nh3_ppm != null && Number(a.nh3_ppm) > 25) {
      s.push({
        id: 'amoniaco', nivel: 'alerta',
        titulo: 'Amoníaco alto',
        observado: `NH₃ de ${a.nh3_ppm} ppm (el límite es 25 ppm).`,
        causas: ['Gallinaza o cama húmeda acumulada', 'Poca ventilación'],
        acciones: ['Ventilar', 'Retirar la gallinaza y secar la cama'],
        veterinario: false,
        fuente: `${FUENTE_MANEJO}. Posible efecto: problemas respiratorios e irritación de los ojos`,
      })
    }
    if (a.humedad_interior != null && Number(a.humedad_interior) > 75) {
      s.push({
        id: 'humedad', nivel: 'atento',
        titulo: 'Humedad alta',
        observado: `Humedad interior de ${a.humedad_interior} %.`,
        causas: ['Poca ventilación', 'Bebederos que gotean'],
        acciones: ['Ventilar y revisar bebederos'],
        veterinario: false,
        fuente: `${FUENTE_MANEJO}. Con calor, la humedad alta empeora el estrés de las aves`,
      })
    }
    if (a.co2_ppm != null && Number(a.co2_ppm) > 3000) {
      s.push({
        id: 'co2', nivel: 'atento',
        titulo: 'CO₂ alto',
        observado: `CO₂ de ${a.co2_ppm} ppm (se busca menos de 3.000 ppm).`,
        causas: ['Poca renovación de aire'],
        acciones: ['Ventilar el galpón'],
        veterinario: false,
        fuente: FUENTE_MANEJO,
      })
    }
  }

  // Lo más grave primero
  return s.sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'alerta' ? -1 : 1))
}
