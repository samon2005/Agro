'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { recalcularStockAlimentoAves, leerStockAlimentoAves, type StockAlimentoAves } from '@/lib/inventario'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  fincaId: string
}

/**
 * Cómo va el alimento en cada galpón, sin entrar a la sección: qué está comiendo,
 * cuánto al día y para cuántos días alcanza lo que hay en bodega. Es lo que se
 * mira de afán para saber cuándo hay que pedir alimento.
 */
export default function ResumenAlimentoGalpones({ fincaId }: Props) {
  const supabase = createClient()
  const [lotes, setLotes] = useState<LoteAves[]>([])
  const [stock, setStock] = useState<StockAlimentoAves[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    await recalcularStockAlimentoAves(supabase, fincaId)
    const [lotesRes, stockRes] = await Promise.all([
      supabase.from('lotes_aves').select('*').eq('finca_id', fincaId)
        .in('estado', ['activo', 'preparacion']).order('nombre'),
      leerStockAlimentoAves(supabase, fincaId),
    ])
    setLotes(lotesRes.data ?? [])
    setStock(stockRes)
    setLoading(false)
  }, [fincaId, supabase])

  useEffect(() => { cargar() }, [cargar])

  if (loading) {
    return (
      <div className="mb-8 space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    )
  }

  if (lotes.length === 0) return null

  const stockPorTipo = new Map(stock.map(s => [s.tipo_alimento_id, s]))

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Alimento por galpón</h3>
        <Link href="/alimento" className="text-xs text-green-700 hover:underline">Ver alimento</Link>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] gap-3">
        {lotes.map(lote => {
          const s = lote.alimento_activo_id ? stockPorTipo.get(lote.alimento_activo_id) ?? null : null
          const consumoDia = Number(lote.consumo_activo_kg ?? 0)
          const bultosDia = s && consumoDia > 0 ? consumoDia / s.peso_bulto_kg : null
          const dias = s && consumoDia > 0 && s.bultos_disponibles > 0
            ? Math.floor((s.bultos_disponibles * s.peso_bulto_kg) / consumoDia)
            : null
          const sinEntradas = s != null && s.bultos_entrados === 0

          return (
            <Card key={lote.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="truncate">{lote.nombre}</span>
                  <span className="text-xs font-normal text-gray-400">
                    {lote.aves_actuales.toLocaleString('es-CO')} aves
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!s ? (
                  <p className="text-xs text-amber-700">
                    <Ic n="alerta" /> Sin alimento registrado. Regístralo en Alimento para llevar su consumo.
                  </p>
                ) : (
                  <>
                    <p className="truncate text-xs text-gray-500">{s.nombre}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums text-gray-900">
                        {consumoDia.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-xs text-gray-500">
                        kg al día{bultosDia ? ` · ${bultosDia.toFixed(2)} bultos` : ''}
                      </span>
                    </div>
                    {sinEntradas ? (
                      <p className="text-xs font-medium text-red-700">
                        Sin entradas registradas · ya se consumieron {s.bultos_consumidos.toLocaleString('es-CO', { maximumFractionDigits: 1 })} bultos
                      </p>
                    ) : (
                      <p className={`text-xs ${dias != null && dias <= 7 ? 'font-medium text-red-700' : 'text-gray-500'}`}>
                        Quedan {Math.max(0, s.bultos_disponibles).toLocaleString('es-CO', { maximumFractionDigits: 1 })} bultos
                        {dias != null ? ` · alcanzan ${dias} día${dias === 1 ? '' : 's'}` : ''}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
