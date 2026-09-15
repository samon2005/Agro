'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import CrearFincaModal from '@/components/agro/CrearFincaModal'
import ResumenEspecies from '@/components/agro/ResumenEspecies'
import ResumenFinanciero from '@/components/agro/ResumenFinanciero'
import EditarFincaModal from '@/components/agro/EditarFincaModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { EspecieFinca } from '@/lib/especies'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { Indicador } from '@/components/ui/indicador'

type Stats = {
  totalAnimales: number
  totalInventario: number
  animalesBajos: number
}

export default function DashboardPage() {
  const { fincas, fincaActual, loading, refetch } = useFinca()
  const [stats, setStats] = useState<Stats | null>(null)
  const [userName, setUserName] = useState('')
  const [fincaAEditar, setFincaAEditar] = useState<typeof fincas[number] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name = (user?.user_metadata?.full_name as string)?.split(' ')[0] ?? 'Zootecnista'
      setUserName(name)
    })
  }, [])

  useEffect(() => {
    if (!fincaActual) return
    const supabase = createClient()

    Promise.all([
      supabase.from('animales').select('id', { count: 'exact' }).eq('finca_id', fincaActual.id).eq('estado', 'activo'),
      supabase.from('inventario').select('id', { count: 'exact' }).eq('finca_id', fincaActual.id),
      supabase.from('inventario').select('id', { count: 'exact' }).eq('finca_id', fincaActual.id)
        .lte('cantidad_actual', supabase.rpc as unknown as number),
    ]).then(async () => {
      const [animalesRes, inventarioRes] = await Promise.all([
        supabase.from('animales').select('id', { count: 'exact', head: true }).eq('finca_id', fincaActual.id).eq('estado', 'activo'),
        supabase.from('inventario').select('id', { count: 'exact', head: true }).eq('finca_id', fincaActual.id),
      ])

      const { count: bajos } = await supabase
        .from('inventario')
        .select('id', { count: 'exact', head: true })
        .eq('finca_id', fincaActual.id)
        .filter('cantidad_actual', 'lte', 'cantidad_minima')

      setStats({
        totalAnimales: animalesRes.count ?? 0,
        totalInventario: inventarioRes.count ?? 0,
        animalesBajos: bajos ?? 0,
      })
    })
  }, [fincaActual])

  useEffect(() => {
    if (!fincaActual) return
    fetchStats()
  }, [fincaActual])

  async function fetchStats() {
    if (!fincaActual) return
    const supabase = createClient()
    const [animalesRes, inventarioRes] = await Promise.all([
      supabase.from('animales').select('id', { count: 'exact', head: true }).eq('finca_id', fincaActual.id).eq('estado', 'activo'),
      supabase.from('inventario').select('id', { count: 'exact', head: true }).eq('finca_id', fincaActual.id),
    ])
    setStats({
      totalAnimales: animalesRes.count ?? 0,
      totalInventario: inventarioRes.count ?? 0,
      animalesBajos: 0,
    })
  }

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

      <div className="p-8">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-medium text-gray-900">
            Bienvenido, {userName}
          </h2>
          {fincaActual && (
            <p className="text-gray-500 mt-1">
              Finca: <span className="font-medium text-green-700">{fincaActual.nombre}</span>
              {fincaActual.municipio && ` · ${fincaActual.municipio}, ${fincaActual.departamento}`}
            </p>
          )}
        </div>

        {fincaActual && (
          <ResumenEspecies fincaId={fincaActual.id} especies={(fincaActual.tipo_produccion ?? []) as EspecieFinca[]} />
        )}

        {fincaActual && (
          <ResumenFinanciero fincaId={fincaActual.id} especies={(fincaActual.tipo_produccion ?? []) as EspecieFinca[]} />
        )}

        <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
          <StatCard title="Total Animales" value={stats?.totalAnimales ?? '—'} icon="ganado" description="Animales activos" color="green" />
          <StatCard title="Ítems en Inventario" value={stats?.totalInventario ?? '—'} icon="caja" description="Insumos registrados" color="blue" />
          <StatCard title="Fincas" value={fincas.length} icon="hoja" description="Registradas" color="yellow" />
          <StatCard title="Alertas Stock" value={stats?.animalesBajos ?? '—'} icon="alerta" description="Por debajo del mínimo" color="red" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ic n="hoja" className="size-4 text-green-700" /> Tus Fincas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fincas.length === 0 ? (
                <EmptyState message="No hay fincas registradas" hint="Se abrirá el formulario de creación" />
              ) : (
                <div className="space-y-2">
                  {fincas.map(f => (
                    <div key={f.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                      <div>
                        <p className="font-medium text-green-900">{f.nombre}</p>
                        {f.municipio && <p className="text-xs text-gray-500">{f.municipio}, {f.departamento}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {f.area_valor && <Badge variant="secondary">{f.area_valor} {f.area_unidad === 'ha' ? 'ha' : f.area_unidad === 'm2' ? 'm²' : f.area_unidad}</Badge>}
                        <button
                          type="button"
                          onClick={() => setFincaAEditar(f)}
                          className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 bg-white"
                        >
                          <Ic n="ajustes" /> Configurar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span><Ic n="diario" /></span> Guía de Inicio Rápido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {[
                  { step: '1', text: 'Crea tu finca', done: fincas.length > 0 },
                  { step: '2', text: 'Registra tus animales', done: (stats?.totalAnimales ?? 0) > 0 },
                  { step: '3', text: 'Agrega inventario', done: (stats?.totalInventario ?? 0) > 0 },
                  { step: '4', text: 'Registra producción diaria', done: false },
                ].map(item => (
                  <li key={item.step} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${item.done ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {item.done ? '' : item.step}
                    </span>
                    <span className={item.done ? 'line-through text-gray-400' : 'text-gray-700'}>{item.text}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function StatCard({ title, value, icon, description, color }: {
  title: string; value: number | string; icon: NombreIcono; description: string; color: 'green' | 'blue' | 'yellow' | 'red'
}) {
  const tono = { green: 'green', blue: 'blue', yellow: 'amber', red: 'red' } as const
  return <Indicador tono={tono[color]} icono={icon} etiqueta={title} valor={value} detalle={description} />
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
