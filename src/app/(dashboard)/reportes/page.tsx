'use client'

import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import { Skeleton } from '@/components/ui/skeleton'
import TableroFinca from '@/components/agro/reportes/TableroFinca'

export default function ReportesPage() {
  const { fincaActual, loading } = useFinca()
  const rol = useRol()
  if (loading || !fincaActual) return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>
  // Tiene costos, ingresos y utilidad: no es para el operario
  if (rol === 'trabajador') return <div className="p-8"><AccesoRestringido /></div>
  return (
    <div className="space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">{fincaActual.nombre} · cómo va la finca en el tiempo: producción, postura, mortalidad, enfermedades y dinero</p>
      </div>
      <TableroFinca fincaId={fincaActual.id} fincaNombre={fincaActual.nombre} />
    </div>
  )
}
