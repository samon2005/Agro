'use client'

import { useFinca } from '@/components/agro/FincaProvider'
import { leerConfigAves } from '@/lib/configAves'
import { useReferencia } from '@/lib/useReferencia'
import type { FilaReferencia } from '@/lib/referencias'

/**
 * La tabla base de la finca que se está viendo ("lo que se quiere tener"), por
 * semana de vida. Vacía si la finca no eligió una. Ver lib/configAves.
 */
export function useBaseFinca(): Map<number, FilaReferencia> {
  const { fincaActual } = useFinca()
  return useReferencia(leerConfigAves(fincaActual?.config_aves).baseReferenciaId)
}
