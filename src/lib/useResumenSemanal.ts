'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal } from '@/lib/fechas'
import { resumenSemanal, type DiaProduccion, type FilaSemana, type LoteResumen } from '@/lib/resumenSemanal'

/**
 * Las semanas de un lote (las del resumen semanal), cargadas de sus registros:
 * producción, muertes de eventos clínicos, aves vendidas y pesajes. `hasta` es el
 * último día (un lote cerrado llega hasta su salida; uno vivo, hasta hoy).
 */
export async function cargarSemanasLote(
  supabase: SupabaseClient<Database>,
  lote: LoteResumen & { id: string },
  hasta?: string,
): Promise<FilaSemana[]> {
  const [prod, eventos, ventas, pesos] = await Promise.all([
    supabase.from('produccion_diaria_aves')
      .select('fecha, huevos_totales, huevos_b, huevos_a, huevos_aa, huevos_aaa, huevos_jumbo, muertes, alimento_kg')
      .eq('lote_id', lote.id),
    supabase.from('eventos_clinicos_aves').select('fecha, aves_muertas, origen').eq('lote_id', lote.id),
    supabase.from('ventas_aves_lote').select('fecha, cantidad, tipo').eq('lote_id', lote.id),
    supabase.from('pesos_lote_aves').select('fecha, peso_promedio_g').eq('lote_id', lote.id),
  ])
  return resumenSemanal(
    lote,
    ((prod.data ?? []) as DiaProduccion[]).map(d => ({ ...d, alimento_kg: Number(d.alimento_kg ?? 0) })),
    // Las de origen "mortalidad" son el reflejo de las muertes del día: no se cuentan dos veces
    (eventos.data ?? []).filter(e => e.origen !== 'mortalidad' && (e.aves_muertas ?? 0) > 0)
      .map(e => ({ fecha: e.fecha, cantidad: e.aves_muertas ?? 0 })),
    (ventas.data ?? []).filter(v => v.tipo === 'descarte' || v.tipo === 'pollas')
      .map(v => ({ fecha: v.fecha, cantidad: Number(v.cantidad) })),
    (pesos.data ?? []).map(p => ({ fecha: p.fecha, peso_promedio_g: Number(p.peso_promedio_g) })),
    hasta ?? hoyLocal(),
  )
}

/** Las semanas de un lote como hook: se recargan cuando cambia lo que mueve el cálculo. */
export function useResumenSemanal(
  lote: (LoteResumen & { id: string; aves_actuales?: number }) | null,
  hasta?: string,
  /** Cambia cuando se registra o borra algo del lote, para volver a cargar */
  version?: string | number,
): { filas: FilaSemana[]; cargando: boolean } {
  const [estado, setEstado] = useState<{ clave: string; filas: FilaSemana[] } | null>(null)
  // La clave cambia con todo lo que mueve el cálculo: así no se muestra un lote con datos de otro
  const clave = lote
    ? [lote.id, lote.estado, lote.fecha_inicio, lote.fecha_inicio_postura, lote.aves_iniciales, lote.aves_actuales ?? '', hasta ?? '', version ?? ''].join('|')
    : ''

  useEffect(() => {
    if (!lote) return
    let vigente = true
    cargarSemanasLote(createClient(), lote, hasta).then(filas => { if (vigente) setEstado({ clave, filas }) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const vigente = estado != null && estado.clave === clave
  return { filas: vigente ? estado.filas : [], cargando: lote != null && !vigente }
}
