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
export default function AnalisisFinca({ fincaId }: { fincaId: string }) {
  const datos = useProduccionFinca(fincaId)
  const [periodo, setPeriodo] = useState<Periodo>(TODO_EL_TIEMPO)
  return (
    <div className="space-y-4">
      {datos && datos.dias.length > 0 && <FiltroPeriodo dias={datos.dias} valor={periodo} onCambio={setPeriodo} />}
      <ResumenHistorico fincaId={fincaId} historico={false} periodo={periodo} />
      <AnalisisProduccion fincaId={fincaId} periodo={periodo} />
    </div>
  )
}
