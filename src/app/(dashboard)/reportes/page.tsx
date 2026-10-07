'use client'

import { useState } from 'react'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import TableroReportes from '@/components/agro/reportes/TableroReportes'
import { ESPECIES_FINCA, especiesDeFinca, nombreSeccion, type EspecieFinca } from '@/lib/especies'

/**
 * Reportes de toda la finca: una pestaña con todo junto y una por cada especie
 * (galpones, corrales), donde se puede filtrar por galpón o corral.
 */
export default function ReportesPage() {
  const { fincaActual, loading } = useFinca()
  const rol = useRol()
  const [vista, setVista] = useState<EspecieFinca | 'finca'>('finca')
  if (loading || !fincaActual) return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>
  // Tiene costos, ingresos y utilidad: no es para el operario
  if (rol === 'trabajador') return <div className="p-8"><AccesoRestringido /></div>

  const especies = especiesDeFinca(fincaActual.tipo_produccion)
  const pestanas = [
    { id: 'finca' as const, label: 'Toda la finca', icon: 'casa' as const },
    ...especies.map(e => ({ id: e, label: nombreSeccion(e, fincaActual.tipo_produccion), icon: ESPECIES_FINCA.find(x => x.value === e)!.icon })),
  ]
  const actual = pestanas.some(p => p.id === vista) ? vista : 'finca'

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">{fincaActual.nombre} · cómo va la finca en el tiempo: producción, mortalidad, alimento, enfermedades y dinero</p>
      </div>
      {especies.length > 0 && (
        <div className="superficie inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
          {pestanas.map(p => (
            <button key={p.id} onClick={() => setVista(p.id)}
              className={cn('inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium transition-colors',
                actual === p.id ? 'bg-green-50 text-green-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800')}>
              <Ic n={p.icon} className={cn('size-4', actual === p.id ? 'text-green-700' : 'text-gray-400')} />
              {p.label}
            </button>
          ))}
        </div>
      )}
      <TableroReportes
        key={actual}
        fincaId={fincaActual.id}
        fincaNombre={fincaActual.nombre}
        especies={especies}
        especie={actual === 'finca' ? null : actual}
      />
    </div>
  )
}
