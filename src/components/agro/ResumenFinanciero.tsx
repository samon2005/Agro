'use client'

import { Indicador } from '@/components/ui/indicador'
import { Ic } from '@/components/ui/icon'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import { cargarFinanzasFinca } from '@/lib/finanzas'

interface Props {
  fincaId: string
  especies: EspecieFinca[]
}

type Movimiento = { fecha: string; monto: number }

type ResumenEspecie = {
  ingresos: Movimiento[]
  costos: Movimiento[]
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

export default function ResumenFinanciero({ fincaId, especies }: Props) {
  const [datos, setDatos] = useState<Record<string, ResumenEspecie>>({})
  const [loading, setLoading] = useState(true)
  const [anioFiltro, setAnioFiltro] = useState('todos')
  const [mesFiltro, setMesFiltro] = useState('todos')
  const especiesKey = especies.join(',')

  const cargar = useCallback(async () => {
    if (especies.length === 0) { setLoading(false); return }
    setLoading(true)
    // La misma cuenta que Finanzas: el huevo cuenta cuando se paga, y entran
    // también las ventas de aves, gallinaza y otros, y los gastos de la finca.
    const { costos, ingresos } = await cargarFinanzasFinca(createClient(), fincaId, especies)
    const resultado: Record<string, ResumenEspecie> = {}
    for (const especie of especies) {
      resultado[especie] = {
        ingresos: ingresos.filter(i => i.especie === especie).map(i => ({ fecha: i.fecha, monto: i.monto })),
        costos: costos.filter(c => c.especie === especie).map(c => ({ fecha: c.fecha, monto: Number(c.monto) })),
      }
    }

    setDatos(resultado)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId, especiesKey])

  useEffect(() => { cargar() }, [cargar])

  const todos = Object.values(datos).flatMap(d => [...d.ingresos, ...d.costos])
  const aniosDisponibles = Array.from(new Set(todos.map(m => m.fecha.slice(0, 4)))).sort().reverse()
  const mesesDisponibles = Array.from(new Set(
    todos.filter(m => anioFiltro === 'todos' || m.fecha.slice(0, 4) === anioFiltro).map(m => m.fecha.slice(0, 7))
  )).sort().reverse()

  function enPeriodo(m: Movimiento) {
    if (anioFiltro !== 'todos' && m.fecha.slice(0, 4) !== anioFiltro) return false
    if (mesFiltro !== 'todos' && m.fecha.slice(0, 7) !== mesFiltro) return false
    return true
  }

  const porEspecie = especies.map(especie => {
    const d = datos[especie] ?? { ingresos: [], costos: [] }
    const ingresos = d.ingresos.filter(enPeriodo).reduce((s, m) => s + m.monto, 0)
    const costos = d.costos.filter(enPeriodo).reduce((s, m) => s + m.monto, 0)
    return {
      especie,
      info: ESPECIES_FINCA.find(e => e.value === especie)!,
      ingresos,
      costos,
      utilidad: ingresos - costos,
    }
  })

  const totalIngresos = porEspecie.reduce((s, e) => s + e.ingresos, 0)
  const totalCostos = porEspecie.reduce((s, e) => s + e.costos, 0)
  const totalUtilidad = totalIngresos - totalCostos

  if (especies.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{porEspecie.length > 1 ? 'Finanzas de todas las especies' : 'Finanzas de la finca'}</h3>
        <div className="flex items-center gap-2">
          <Select
            value={anioFiltro}
            onValueChange={v => { setAnioFiltro(v ?? 'todos'); setMesFiltro('todos') }}
            items={{ todos: 'Todos los años', ...Object.fromEntries(aniosDisponibles.map(a => [a, a])) }}
          >
            <SelectTrigger className="w-36 h-8 bg-white text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los años</SelectItem>
              {aniosDisponibles.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={mesFiltro}
            onValueChange={v => setMesFiltro(v ?? 'todos')}
            items={{ todos: 'Todos los meses', ...Object.fromEntries(mesesDisponibles.map(m => [m, new Date(m + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })])) }}
          >
            <SelectTrigger className="w-40 h-8 bg-white text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los meses</SelectItem>
              {mesesDisponibles.map(m => (
                <SelectItem key={m} value={m}>
                  {new Date(m + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Indicador tono="green" icono="tendencia" etiqueta="Ingresos totales" valor={cop(totalIngresos)} />
            <Indicador tono="orange" icono="recibo" etiqueta="Costos totales" valor={cop(totalCostos)} />
            <Indicador
              tono={totalUtilidad >= 0 ? 'green' : 'red'}
              icono="dinero"
              etiqueta="Utilidad total"
              valor={<span className={totalUtilidad < 0 ? 'text-red-700' : undefined}>{cop(totalUtilidad)}</span>}
              detalle={totalUtilidad < 0 ? 'Los costos superan los ingresos' : totalIngresos > 0 ? 'Ingresos menos costos' : undefined}
            />
          </div>

          {porEspecie.length > 1 && (
            <Card>
              <CardContent className="space-y-1">
                <p className="pb-1 text-sm font-semibold text-gray-800">Desglose por especie</p>
                {porEspecie.map(e => (
                  <div key={e.especie} className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Ic n={e.info.icon} className="size-4 text-gray-400" /> {e.info.labelNav ?? e.info.label}</span>
                    <div className="flex items-center gap-5 text-xs tabular-nums">
                      <span className="text-gray-500">{cop(e.ingresos)}</span>
                      <span className="text-gray-500">− {cop(e.costos)}</span>
                      <span className={`font-semibold text-sm ${e.utilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {cop(e.utilidad)}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
