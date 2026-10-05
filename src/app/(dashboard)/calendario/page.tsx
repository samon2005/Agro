'use client'

import { useFinca } from '@/components/agro/FincaProvider'
import { Skeleton } from '@/components/ui/skeleton'
import CalendarioSanitario from '@/components/agro/aves/calendario/CalendarioSanitario'

export default function CalendarioPage() {
  const { fincaActual, loading } = useFinca()
  if (loading || !fincaActual) return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>
  return (
    <div className="space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900">Calendario sanitario</h1>
        <p className="text-sm text-gray-500">
          {fincaActual.nombre} · vacunas, tratamientos, retiros, desinfecciones y el ciclo de cada galpón, con su color
        </p>
      </div>
      <CalendarioSanitario fincaId={fincaActual.id} />
    </div>
  )
}
