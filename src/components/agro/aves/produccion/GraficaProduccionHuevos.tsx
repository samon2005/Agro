'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { Database } from '@/types/database'

type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']

interface Props {
  registros: ProduccionDiaria[]
  semanasFaltantesPostura: number | null
  enPreparacion: boolean
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function GraficaProduccionHuevos({ registros, semanasFaltantesPostura, enPreparacion }: Props) {
  const datos = [...registros]
    .filter(r => r.huevos_totales > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(r => ({ fecha: r.fecha, label: formatDate(r.fecha), huevos: r.huevos_totales }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">🥚 Huevos puestos por día</CardTitle>
      </CardHeader>
      <CardContent>
        {enPreparacion || datos.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            {enPreparacion
              ? semanasFaltantesPostura != null
                ? `Faltan ${semanasFaltantesPostura} semana${semanasFaltantesPostura === 1 ? '' : 's'} para que comience la postura`
                : 'El lote sigue en preparación — todavía no hay postura'
              : 'Aún no hay registros de huevos para graficar'}
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value => [Number(Array.isArray(value) ? value[0] : value ?? 0).toLocaleString('es-CO'), 'Huevos']) as (v: unknown) => [string, string]}
                  labelFormatter={label => `Día: ${label}`}
                />
                <Line type="monotone" dataKey="huevos" stroke="#ca8a04" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 mt-1">Pasa el cursor sobre dos puntos distintos para comparar los valores entre días.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
