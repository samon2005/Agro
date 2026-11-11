'use client'

import { useMemo } from 'react'
import { useFinca } from '@/components/agro/FincaProvider'
import { configCerdos, type ConfigCerdos } from '@/lib/configCerdos'

/** Los parámetros de cerdos de la finca abierta (defecto + lo que la granja cambió). */
export function useConfigCerdos(): ConfigCerdos {
  const { fincaActual } = useFinca()
  const guardado = fincaActual?.config_cerdos
  return useMemo(() => configCerdos(guardado), [guardado])
}
