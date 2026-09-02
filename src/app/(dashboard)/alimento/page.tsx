'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { cn } from '@/lib/utils'
import TabAlimentoAves from '@/components/agro/alimento/aves/TabAlimentoAves'
import TabAlimentoGenerico from '@/components/agro/comun/TabAlimentoGenerico'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import { CONFIG_ESPECIES } from '@/lib/especiesConfig'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type LoteSimple = { id: string; finca_id: string; nombre: string }

export default function AlimentoPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const supabase = createClient()

  const especies = (fincaActual?.tipo_produccion ?? []) as EspecieFinca[]
  const [especieActiva, setEspecieActiva] = useState<EspecieFinca | null>(null)
  const [lotesAves, setLotesAves] = useState<LoteAves[]>([])
  const [lotesCerdos, setLotesCerdos] = useState<LoteSimple[]>([])
  const [lotesPollo, setLotesPollo] = useState<LoteSimple[]>([])
  const [loadingLotes, setLoadingLotes] = useState(true)

  useEffect(() => {
    if (especies.length > 0 && !especieActiva) setEspecieActiva(especies[0])
  }, [especies, especieActiva])

  const fetchLotes = useCallback(async () => {
    if (!fincaActual) return
    setLoadingLotes(true)
    const [avesRes, cerdosRes, polloRes] = await Promise.all([
      supabase.from('lotes_aves').select('*').eq('finca_id', fincaActual.id)
        .in('estado', ['activo', 'preparacion']).order('created_at', { ascending: false }),
      supabase.from('lotes_cerdos').select('id, finca_id, nombre').eq('finca_id', fincaActual.id)
        .eq('estado', 'activo').order('created_at', { ascending: false }),
      supabase.from('lotes_pollo').select('id, finca_id, nombre').eq('finca_id', fincaActual.id)
        .eq('estado', 'activo').order('created_at', { ascending: false }),
    ])
    setLotesAves(avesRes.data ?? [])
    setLotesCerdos(cerdosRes.data ?? [])
    setLotesPollo(polloRes.data ?? [])
    setLoadingLotes(false)
  }, [fincaActual, supabase])

  useEffect(() => { fetchLotes() }, [fetchLotes])

  if (fincaLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (!fincaActual || especies.length === 0) {
    return (
      <div className="p-8">
        <Card className="border-dashed border-gray-300">
          <CardContent className="py-16 text-center">
            <p className="text-4xl mb-2">🌾</p>
            <p className="text-gray-600 font-medium">Sin especies configuradas</p>
            <p className="text-sm text-gray-400">Configura las especies de tu finca para ver esta sección</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>🌾</span> Alimento
        </h2>
        <p className="text-gray-500 mt-1">Consumo, costos y balance nutricional por especie</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {ESPECIES_FINCA.filter(e => especies.includes(e.value)).map(esp => (
          <button
            key={esp.value}
            onClick={() => setEspecieActiva(esp.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              especieActiva === esp.value ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {esp.icon} {esp.label}
          </button>
        ))}
      </div>

      {especieActiva === 'aves_ponedoras' && (
        loadingLotes ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : (
          <TabAlimentoAves lotes={lotesAves} />
        )
      )}

      {especieActiva === 'cerdos' && (
        loadingLotes ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : (
          <TabAlimentoGenerico lotes={lotesCerdos} config={CONFIG_ESPECIES.cerdos} />
        )
      )}

      {especieActiva === 'pollo_engorde' && (
        loadingLotes ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : (
          <TabAlimentoGenerico lotes={lotesPollo} config={CONFIG_ESPECIES.pollo_engorde} />
        )
      )}
    </div>
  )
}
