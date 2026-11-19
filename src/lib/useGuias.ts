'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cargarReferencia, type FilaReferencia } from '@/lib/referencias'

export type Guias = Map<string, Map<number, FilaReferencia>>

/**
 * La guía (por semana de vida) de cada línea que usan los lotes dados, por id de
 * referencia. La usan el Resumen y el cierre semanal para la meta de las semanas
 * sin meta propia (lib/metasPostura).
 */
export function useGuias(lotes: { referencia_id: string | null }[]): Guias {
  const [guias, setGuias] = useState<Guias>(new Map())
  const refs = [...new Set(lotes.map(l => l.referencia_id).filter((x): x is string => Boolean(x)))].sort().join(',')
  useEffect(() => {
    if (!refs) return
    let vigente = true
    const supabase = createClient()
    Promise.all(refs.split(',').map(async id => [id, await cargarReferencia(supabase, id)] as const))
      .then(lista => { if (vigente) setGuias(new Map(lista)) })
    return () => { vigente = false }
  }, [refs])
  return guias
}
