'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import { Skeleton } from '@/components/ui/skeleton'
import HuevosFinca from './HuevosFinca'
import VentasFinca from './VentasFinca'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  vista: 'huevos' | 'ventas'
}

/**
 * Los huevos y las ventas son de la finca entera, no de un galpón: por eso tienen
 * su propia página en el menú, con el conteo englobado de todos los galpones.
 */
export default function VistaFincaAves({ vista }: Props) {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const rol = useRol()
  const [lotes, setLotes] = useState<LoteAves[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!fincaActual) return
    let vigente = true
    const supabase = createClient()
    supabase.from('lotes_aves').select('*').eq('finca_id', fincaActual.id)
      .in('estado', ['activo', 'preparacion']).order('nombre')
      .then(({ data }) => {
        if (!vigente) return
        setLotes(data ?? [])
        setLoading(false)
      })
    return () => { vigente = false }
  }, [fincaActual])

  if (fincaLoading || !fincaActual || loading) {
    return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>
  }

  if (vista === 'ventas' && rol === 'trabajador') {
    return <div className="p-8"><AccesoRestringido /></div>
  }

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900">{vista === 'huevos' ? 'Huevos de la finca' : 'Ventas de la finca'}</h1>
        <p className="text-sm text-gray-500">
          {fincaActual.nombre} · {vista === 'huevos' ? 'lo que ponen todos los galpones y lo que hay en bodega' : 'ventas, pagos y encargos de toda la finca'}
        </p>
      </div>
      {vista === 'huevos'
        ? <HuevosFinca fincaId={fincaActual.id} lotes={lotes} />
        : <VentasFinca fincaId={fincaActual.id} lotes={lotes} />}
    </div>
  )
}
