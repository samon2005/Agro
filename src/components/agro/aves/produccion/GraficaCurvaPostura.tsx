'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceDot, ResponsiveContainer,
} from 'recharts'
import type { Database } from '@/types/database'

type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']

interface Props {
  /** Fecha de entrada al galpón: la semana 1 se cuenta desde aquí */
  fechaInicioLote: string
  /** % de postura que se puso como meta o pico esperado del lote */
  metaPosturaPct?: number | null
  /** Semana en que se espera el pico, si se puede calcular */
  semanaPico?: number | null
  registros: Pick<ProduccionDiaria, 'fecha' | 'huevos_totales' | 'aves_en_dia'>[]
}

const MS_SEMANA = 7 * 24 * 60 * 60 * 1000

export default function GraficaCurvaPostura({ fechaInicioLote, metaPosturaPct, semanaPico, registros }: Props) {
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

  const datos = [...porSemana.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semana, v]) => ({ semana, real: Number((v.suma / v.dias).toFixed(1)) }))

  // El pico esperado: el % meta del lote, en la semana en que se alcanzaría
  const meta = metaPosturaPct != null ? Number(metaPosturaPct) : null
  const semanaDelPico = semanaPico ?? (datos.length > 0
    ? datos.reduce((mejor, d) => (d.real > mejor.real ? d : mejor), datos[0]).semana
    : null)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">📈 Curva de postura</CardTitle>
        <p className="text-xs text-gray-400">
          % producido contra semanas de vida del lote.
          {meta != null && ' El punto marca el pico esperado que configuraste.'}
        </p>
      </CardHeader>
      <CardContent>
        {datos.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Aún no hay postura registrada para dibujar la curva</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datos} margin={{ top: 10, right: 24, left: 0, bottom: 5 }}>
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
                  formatter={((value: unknown) => [`${Number(value ?? 0).toFixed(1)}%`, 'Postura']) as (v: unknown) => [string, string]}
                  labelFormatter={label => `Semana ${label}`}
                />
                <Legend formatter={() => 'Postura del lote'} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="real" stroke="#DC2626" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                {meta != null && semanaDelPico != null && (
                  <ReferenceDot
                    x={semanaDelPico}
                    y={meta}
                    r={6}
                    fill="#16A34A"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    label={{ value: `Pico ${meta}%`, position: 'top', fontSize: 11, fill: '#16A34A' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
