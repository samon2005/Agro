'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cargarReferencia, type FilaReferencia } from '@/lib/referencias'
import type { DiaProduccion, LoteAnalisis } from '@/lib/analisisProduccion'

export interface LoteHistorico extends LoteAnalisis { referencia_id: string | null; fecha_fin: string | null }

/**
 * Todos los lotes de aves de una finca, todos sus días y la guía de cada línea.
 * Lo usan el Resumen y el análisis de las fincas con datos viejos.
 */
export function useProduccionFinca(fincaId: string) {
  const [datos, setDatos] = useState<{
    fincaId: string; lotes: LoteHistorico[]; dias: DiaProduccion[]; guias: Map<string, Map<number, FilaReferencia>>
  } | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    ;(async () => {
      const { data: ls } = await supabase.from('lotes_aves')
        .select('id, nombre, fecha_nacimiento, fecha_inicio_postura, fecha_fin, aves_iniciales, referencia_id')
        .eq('finca_id', fincaId).order('fecha_inicio')
      // La base entrega de a 1.000 filas: se pide por páginas
      const dias: DiaProduccion[] = []
      for (let desde = 0; ; desde += 1000) {
        const { data } = await supabase.from('produccion_diaria_aves')
          .select('lote_id, fecha, huevos_totales, aves_en_dia, muertes, alimento_kg, huevos_c, huevos_b, huevos_a, huevos_aa, huevos_aaa, huevos_jumbo, huevos_rotos, huevos_sucios')
          .eq('finca_id', fincaId).order('fecha').range(desde, desde + 999)
        dias.push(...((data ?? []) as DiaProduccion[]))
        if (!data || data.length < 1000) break
      }
      const refs = [...new Set((ls ?? []).map(l => l.referencia_id).filter((x): x is string => Boolean(x)))]
      const guias = new Map(await Promise.all(refs.map(async id => [id, await cargarReferencia(supabase, id)] as const)))
      if (vigente) setDatos({ fincaId, lotes: (ls ?? []) as LoteHistorico[], dias, guias })
    })()
    return () => { vigente = false }
  }, [fincaId])

  // Mientras llega la finca nueva no se muestran los datos de la anterior
  return datos?.fincaId === fincaId ? datos : null
}
