'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import CrearFincaModal from '@/components/agro/CrearFincaModal'
import EditarFincaModal from '@/components/agro/EditarFincaModal'
import TableroInicio from '@/components/agro/resumen/TableroInicio'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const { fincas, fincaActual, loading, refetch } = useFinca()
  const [userName, setUserName] = useState('')
  const [fincaAEditar, setFincaAEditar] = useState<typeof fincas[number] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name = (user?.user_metadata?.full_name as string)?.split(' ')[0] ?? 'Zootecnista'
      setUserName(name)
    })
  }, [])

  if (loading) return <DashboardSkeleton />

  return (
    <>
      {fincaAEditar && (
        <EditarFincaModal
          open={!!fincaAEditar}
          onClose={() => setFincaAEditar(null)}
          finca={fincaAEditar}
          onUpdated={refetch}
          onDeleted={() => setFincaAEditar(null)}
        />
      )}

      <CrearFincaModal open={!loading && fincas.length === 0} onCreated={refetch} />

      <div className="p-4 md:p-8">
        <div className="mb-5">
          <h2 className="font-heading text-3xl font-medium text-gray-900">
            Bienvenido, {userName}
          </h2>
          {fincaActual && (
            <p className="mt-1 text-gray-500">
              Finca <span className="font-medium text-green-700">{fincaActual.nombre}</span> · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
        </div>

        {fincaActual ? (
          <TableroInicio
            finca={fincaActual}
            fincas={fincas}
            onEditarFinca={() => setFincaAEditar(fincaActual)}
            onEditarOtra={f => setFincaAEditar(f)}
          />
        ) : (
          <EmptyState message="No hay fincas registradas" hint="Se abrirá el formulario de creación" />
        )}
      </div>
    </>
  )
}

function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <Badge variant="secondary" className="mb-2 text-xs">Sin datos</Badge>
      <p className="text-sm font-medium text-gray-600">{message}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  )
}
