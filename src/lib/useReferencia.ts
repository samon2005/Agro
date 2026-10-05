'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cargarReferencia, type FilaReferencia } from '@/lib/referencias'

const VACIA: Map<number, FilaReferencia> = new Map()

/** La tabla de una referencia, cargada cuando cambia; vacía si no hay referencia. */
export function useReferencia(lineaId: string | null | undefined): Map<number, FilaReferencia> {
  const [cargada, setCargada] = useState<{ id: string; mapa: Map<number, FilaReferencia> } | null>(null)
  useEffect(() => {
    if (!lineaId) return
    let vigente = true
    cargarReferencia(createClient(), lineaId).then(mapa => { if (vigente) setCargada({ id: lineaId, mapa }) })
    return () => { vigente = false }
  }, [lineaId])
  return lineaId && cargada?.id === lineaId ? cargada.mapa : VACIA
}
