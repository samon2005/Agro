'use client'

import { useState } from 'react'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRolFinca } from '@/components/agro/RolProvider'
import { permisos } from '@/lib/roles'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import TableroReportes from '@/components/agro/reportes/TableroReportes'
import AnalisisProduccion from '@/components/agro/reportes/AnalisisProduccion'
import AnalisisFinca from '@/components/agro/reportes/AnalisisFinca'
import ComparadorLineas from '@/components/agro/reportes/ComparadorLineas'
import PrecioCerdo from '@/components/agro/reportes/PrecioCerdo'
import AvisoImportados from '@/components/agro/comun/AvisoImportados'
import { ESPECIES_FINCA, especiesDeFinca, nombreSeccion, type EspecieFinca } from '@/lib/especies'

/**
 * Reportes de toda la finca: una pestaña con todo junto y una por cada especie
 * (galpones, corrales), donde se puede filtrar por galpón o corral.
 */
export default function ReportesPage() {
  const { fincaActual, loading } = useFinca()
  const { verDinero, verReportes, verProduccion } = permisos(useRolFinca())
  const [vista, setVista] = useState<EspecieFinca | 'finca' | 'historia' | 'lineas' | 'precio'>('finca')
  if (loading || !fincaActual) return <div className="p-4 md:p-8"><Skeleton className="h-64 rounded-xl" /></div>
  // El operario y el recolector no ven reportes; el zootecnista ve la producción
  // sin la plata, y contabilidad la plata sin el análisis de los galpones
  if (!verReportes) return <div className="p-4 md:p-8"><AccesoRestringido /></div>

  // Finca con datos viejos y sin ventas: el análisis de toda su producción, no el de las últimas semanas
  if (fincaActual.sin_registro_ventas) {
    return (
      <div className="space-y-5 p-4 md:p-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium text-gray-900">Análisis de producción</h1>
          <p className="text-sm text-gray-500">
            {fincaActual.nombre} · datos viejos cargados de Excel, sin ventas: postura, tamaños, mortalidad y alimento de cada lote
          </p>
        </div>
        <AnalisisProduccion key={fincaActual.id} fincaId={fincaActual.id} />
      </div>
    )
  }

  const especies = especiesDeFinca(fincaActual.tipo_produccion)
  const pestanas = [
    // Estas tienen costos, ingresos y utilidad: solo el administrador
    ...(verDinero ? [{ id: 'finca' as const, label: 'Toda la finca', icon: 'casa' as const }] : []),
    ...(verDinero ? especies.map(e => ({ id: e, label: nombreSeccion(e, fincaActual.tipo_produccion), icon: ESPECIES_FINCA.find(x => x.value === e)!.icon })) : []),
    // Toda la historia de los galpones: mejor y peor mes, mortalidad, lotes frente a la guía
    ...(verProduccion && especies.includes('aves_ponedoras') ? [{ id: 'historia' as const, label: 'Análisis de producción', icon: 'tendencia' as const }] : []),
    // Las guías de las líneas entre sí y contra los lotes reales
    // El precio del cerdo en el mercado frente a las ventas propias (tipo trader)
    ...(verDinero && especies.includes('cerdos') ? [{ id: 'precio' as const, label: 'Precio del cerdo', icon: 'precio' as const }] : []),
    ...(verProduccion && especies.includes('aves_ponedoras') ? [{ id: 'lineas' as const, label: 'Comparar líneas', icon: 'gallina' as const }] : []),
  ]
  const actual = pestanas.some(p => p.id === vista) ? vista : pestanas[0]?.id ?? 'finca'

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-medium text-gray-900">Reportes</h1>
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
      {!fincaActual.sin_registro_ventas && <AvisoImportados fincaId={fincaActual.id} />}
      {actual === 'precio' ? (
        <PrecioCerdo key={fincaActual.id} fincaId={fincaActual.id} />
      ) : actual === 'lineas' ? (
        <ComparadorLineas key={fincaActual.id} fincaId={fincaActual.id} />
      ) : actual === 'historia' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Todo lo registrado en los galpones, desde el primer lote: cada mes, cada lote y frente a la guía de la línea.</p>
          <AnalisisFinca key={fincaActual.id} fincaId={fincaActual.id} />
        </div>
      ) : !verDinero ? (
        <p className="text-sm text-gray-500">Sin reportes de producción para esta finca todavía.</p>
      ) : <TableroReportes
        key={actual}
        fincaId={fincaActual.id}
        fincaNombre={fincaActual.nombre}
        especies={especies}
        especie={actual === 'finca' ? null : actual}
      />}
    </div>
  )
}
