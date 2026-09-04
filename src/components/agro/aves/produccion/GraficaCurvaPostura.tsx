'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { Database } from '@/types/database'

type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']

interface Props {
  fincaId: string
  /** Fecha de entrada al galpón: la semana 1 se cuenta desde aquí */
  fechaInicioLote: string
  registros: Pick<ProduccionDiaria, 'fecha' | 'huevos_totales' | 'aves_en_dia'>[]
}

const MS_SEMANA = 7 * 24 * 60 * 60 * 1000

type PuntoCurva = { semana: number; postura_pct: number | null }

export default function GraficaCurvaPostura({ fincaId, fechaInicioLote, registros }: Props) {
  const [referencia, setReferencia] = useState<PuntoCurva[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('curvas_referencia')
      .select('semana, postura_pct, finca_id')
      .eq('especie', 'aves_ponedoras')
      .not('postura_pct', 'is', null)
      .order('semana')
      .then(({ data }) => {
        const filas = data ?? []
        // Si la finca definió su propia curva, esa manda sobre la plantilla
        const propias = filas.filter(f => f.finca_id === fincaId)
        const base = propias.length > 0 ? propias : filas.filter(f => f.finca_id === null)
        setReferencia(base.map(f => ({ semana: f.semana ?? 0, postura_pct: f.postura_pct })))
      })
  }, [fincaId])

  // % de postura real del lote, promediado por semana de vida
  const inicio = new Date(fechaInicioLote + 'T00:00:00').getTime()
  const porSemana = new Map<number, { suma: number; dias: number }>()
  for (const r of registros) {
    if (!r.aves_en_dia || r.aves_en_dia <= 0 || r.huevos_totales <= 0) continue
    const semana = Math.floor((new Date(r.fecha + 'T00:00:00').getTime() - inicio) / MS_SEMANA) + 1
    if (semana < 1) continue
    const pct = (r.huevos_totales / r.aves_en_dia) * 100
    const acum = porSemana.get(semana) ?? { suma: 0, dias: 0 }
    porSemana.set(semana, { suma: acum.suma + pct, dias: acum.dias + 1 })
  }

  const semanasReal = [...porSemana.keys()]
  const semanaMax = Math.max(
    referencia.length > 0 ? Math.max(...referencia.map(r => r.semana)) : 0,
    semanasReal.length > 0 ? Math.max(...semanasReal) : 0,
  )

  const datos = referencia.length === 0 && semanasReal.length === 0
    ? []
    : Array.from({ length: semanaMax }, (_, i) => {
        const semana = i + 1
        const ref = referencia.find(r => r.semana === semana)
        const real = porSemana.get(semana)
        return {
          semana,
          objetivo: ref?.postura_pct ?? null,
          real: real ? Number((real.suma / real.dias).toFixed(1)) : null,
        }
      })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">📈 Curva de postura</CardTitle>
        <p className="text-xs text-gray-400">
          % producido contra semanas de vida. La línea gris es la curva de referencia; la roja, lo que
          realmente está poniendo el lote.
        </p>
      </CardHeader>
      <CardContent>
        {datos.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Aún no hay datos para dibujar la curva</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="semana"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'SEMANAS', position: 'insideBottom', offset: -2, fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  label={{ value: '% PRODUCIDO', angle: -90, position: 'insideLeft', fontSize: 11 }}
                />
                <Tooltip
                  formatter={((value: unknown, name: unknown) =>
                    [`${Number(value ?? 0).toFixed(1)}%`, name === 'objetivo' ? 'Referencia' : 'Real']
                  ) as (v: unknown, n: unknown) => [string, string]}
                  labelFormatter={label => `Semana ${label}`}
                />
                <Legend
                  formatter={value => (value === 'objetivo' ? 'Referencia' : 'Real del lote')}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line type="monotone" dataKey="objetivo" stroke="#9CA3AF" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="real" stroke="#DC2626" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
