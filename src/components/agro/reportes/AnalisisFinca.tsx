'use client'

import { useState } from 'react'
import { useProduccionFinca } from '@/lib/useProduccionFinca'
import { TODO_EL_TIEMPO, type Periodo } from '@/lib/analisisProduccion'
import ResumenHistorico from '@/components/agro/resumen/ResumenHistorico'
import AnalisisProduccion from './AnalisisProduccion'
import FiltroPeriodo from './FiltroPeriodo'

/**
 * La pestaña "Análisis de producción" de Reportes: un solo periodo para todo,
 * lo que dicen los datos y las gráficas por lote.
 */
export default function AnalisisFinca({ fincaId, loteId }: {
  fincaId: string
  /** Solo un lote (la pestaña Análisis de un galpón) */
  loteId?: string
}) {
  const datos = useProduccionFinca(fincaId)
  const [periodo, setPeriodo] = useState<Periodo>(TODO_EL_TIEMPO)
  const diasDelFiltro = datos ? (loteId ? datos.dias.filter(d => d.lote_id === loteId) : datos.dias) : []
  return (
    <div className="space-y-4">
      {diasDelFiltro.length > 0 && <FiltroPeriodo dias={diasDelFiltro} valor={periodo} onCambio={setPeriodo} />}
      <ResumenHistorico fincaId={fincaId} historico={false} periodo={periodo} loteId={loteId} />
      <AnalisisProduccion fincaId={fincaId} periodo={periodo} loteId={loteId} />
    </div>
  )
}
