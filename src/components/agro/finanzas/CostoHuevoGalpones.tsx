'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { cop, preciosDeFinca, type PreciosHuevo } from '@/lib/huevos'
import { cargarSemanasLote } from '@/lib/useResumenSemanal'
import { cargarDatosCostos, costosDeLote, ultimaSemanaPostura, type CostoSemana } from '@/lib/costoHuevo'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Fila { lote: LoteAves; ultima: CostoSemana | null }

const n1 = (v: number) => v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pesos1 = (v: number) => `$ ${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })}`

/**
 * El costo del huevo de cada galpón en postura, en su última semana completa,
 * frente al precio promedio de la finca y su punto de equilibrio.
 */
export default function CostoHuevoGalpones({ finca }: {
  finca: { id: string; precio_huevo_b?: number | null; precio_huevo_a?: number | null; precio_huevo_aa?: number | null; precio_huevo_aaa?: number | null; precio_huevo_jumbo?: number | null }
}) {
  const [filas, setFilas] = useState<{ fincaId: string; lista: Fila[] } | null>(null)
  const precios: PreciosHuevo = preciosDeFinca(finca)
  const clavePrecios = JSON.stringify(precios)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    const fincaId = finca.id
    const p = JSON.parse(clavePrecios) as PreciosHuevo
    supabase.from('lotes_aves').select('*').eq('finca_id', fincaId).eq('estado', 'activo').order('nombre').then(async ({ data }) => {
      const lista = await Promise.all((data ?? []).map(async lote => {
        const [semanas, datos] = await Promise.all([cargarSemanasLote(supabase, lote), cargarDatosCostos(supabase, lote)])
        return { lote, ultima: ultimaSemanaPostura(costosDeLote(lote, semanas, datos, p).semanas) }
      }))
      if (vigente) setFilas({ fincaId, lista })
    })
    return () => { vigente = false }
  }, [finca.id, clavePrecios])

  const lista = filas?.fincaId === finca.id ? filas.lista : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">Costo por huevo de cada galpón</CardTitle>
        <p className="text-xs text-gray-400">
          Última semana completa de postura: alimento consumido, costos del galpón, su parte de los de la finca y la inversión en
          las aves repartida. El detalle está en la pestaña Rentabilidad de cada galpón.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {lista == null ? (
          <div className="space-y-2 p-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
        ) : lista.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">No hay galpones en postura</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Galpón</th>
                  <th className="px-3 py-2 text-right font-medium">Postura</th>
                  <th className="px-3 py-2 text-right font-medium">Costo/huevo</th>
                  <th className="px-3 py-2 text-right font-medium">Precio prom.</th>
                  <th className="px-3 py-2 text-right font-medium">Utilidad semana</th>
                  <th className="px-3 py-2 text-right font-medium">Equilibrio</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(({ lote, ultima: u }) => {
                  const pierde = u?.equilibrioPct != null && u.posturaPct != null && u.posturaPct < u.equilibrioPct
                  return (
                    <tr key={lote.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {lote.nombre}
                        {u && <span className="block text-xs font-normal text-gray-400">semana {u.semana} de postura</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{u?.posturaPct != null ? `${n1(u.posturaPct)} %` : '—'}</td>
                      <td className="px-3 py-2 text-right">{u?.costoHuevo != null ? pesos1(u.costoHuevo) : '—'}</td>
                      <td className="px-3 py-2 text-right">{u?.precioPromedio != null ? pesos1(u.precioPromedio) : '—'}</td>
                      <td className={cn('px-3 py-2 text-right', u?.utilidad == null ? '' : u.utilidad >= 0 ? 'text-green-700' : 'text-red-700')}>
                        {u?.utilidad != null ? cop(Math.round(u.utilidad)) : '—'}
                      </td>
                      <td className={cn('px-3 py-2 text-right', pierde && 'font-semibold text-red-700')}>
                        {u?.equilibrioPct != null ? `${n1(u.equilibrioPct)} %` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
