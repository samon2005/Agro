'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'

type ResumenEspecie = {
  lotesActivos: number
  animalesActuales: number
}

const COLOR_BORDE: Record<EspecieFinca, string> = {
  aves_ponedoras: 'border-amber-200 bg-amber-50',
  cerdos: 'border-pink-200 bg-pink-50',
  pollo_engorde: 'border-orange-200 bg-orange-50',
}

export default function ResumenEspecies({ fincaId, especies }: { fincaId: string; especies: EspecieFinca[] }) {
  const [resumen, setResumen] = useState<Record<string, ResumenEspecie>>({})
  const [loading, setLoading] = useState(true)
  const especiesKey = especies.join(',')

  useEffect(() => {
    if (especies.length === 0) { setLoading(false); return }
    const supabase = createClient()

    async function cargar() {
      const resultados: Record<string, ResumenEspecie> = {}

      if (especies.includes('aves_ponedoras')) {
        const { data } = await supabase.from('lotes_aves').select('aves_actuales, estado').eq('finca_id', fincaId)
        const activos = (data ?? []).filter(l => l.estado === 'activo')
        resultados.aves_ponedoras = { lotesActivos: activos.length, animalesActuales: activos.reduce((s, l) => s + (l.aves_actuales ?? 0), 0) }
      }
      if (especies.includes('cerdos')) {
        const { data } = await supabase.from('lotes_cerdos').select('animales_actuales, estado').eq('finca_id', fincaId)
        const activos = (data ?? []).filter(l => l.estado === 'activo')
        resultados.cerdos = { lotesActivos: activos.length, animalesActuales: activos.reduce((s, l) => s + (l.animales_actuales ?? 0), 0) }
      }
      if (especies.includes('pollo_engorde')) {
        const { data } = await supabase.from('lotes_pollo').select('pollos_actuales, estado').eq('finca_id', fincaId)
        const activos = (data ?? []).filter(l => l.estado === 'activo')
        resultados.pollo_engorde = { lotesActivos: activos.length, animalesActuales: activos.reduce((s, l) => s + (l.pollos_actuales ?? 0), 0) }
      }

      setResumen(resultados)
      setLoading(false)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId, especiesKey])

  if (especies.length === 0) return null

  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Resumen por especie</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ESPECIES_FINCA.filter(e => especies.includes(e.value)).map(esp => {
          const r = resumen[esp.value]
          return (
            <Link key={esp.value} href={esp.href}>
              <Card className={`border transition-shadow hover:shadow-md ${COLOR_BORDE[esp.value]}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{esp.label}</p>
                      {loading ? (
                        <p className="text-xs text-gray-400 mt-1">Cargando...</p>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-gray-900 mt-1">{r?.animalesActuales ?? 0}</p>
                          <p className="text-xs text-gray-500">
                            {r?.lotesActivos ?? 0} lote{r?.lotesActivos === 1 ? '' : 's'} activo{r?.lotesActivos === 1 ? '' : 's'}
                          </p>
                        </>
                      )}
                    </div>
                    <span className="text-3xl">{esp.icon}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
