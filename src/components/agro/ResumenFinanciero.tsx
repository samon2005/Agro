'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import { CONFIG_ESPECIES, dbGenerico, totalVentaAnimales, type VentaGenerica } from '@/lib/especiesConfig'

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

/** La venta de huevos se cobra por tamaño, no por kg ni por animal. */
type VentaHuevos = {
  fecha: string
  cantidad_b: number; cantidad_a: number; cantidad_aa: number; cantidad_aaa: number; cantidad_jumbo: number
  precio_b: number | null; precio_a: number | null; precio_aa: number | null; precio_aaa: number | null; precio_jumbo: number | null
}

function totalVentaHuevos(v: VentaHuevos) {
  return v.cantidad_b * (v.precio_b ?? 0) + v.cantidad_a * (v.precio_a ?? 0) + v.cantidad_aa * (v.precio_aa ?? 0)
    + v.cantidad_aaa * (v.precio_aaa ?? 0) + v.cantidad_jumbo * (v.precio_jumbo ?? 0)
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
    const db = dbGenerico(createClient())
    const resultado: Record<string, ResumenEspecie> = {}

    await Promise.all(especies.map(async especie => {
      const config = CONFIG_ESPECIES[especie]
      const [costosRes, ventasRes] = await Promise.all([
        db.from(config.tablas.costos).select('fecha, monto').eq('finca_id', fincaId),
        db.from(config.tablas.ventas).select('*').eq('finca_id', fincaId),
      ])

      const costos: Movimiento[] = (costosRes.data ?? []).map((c: { fecha: string; monto: number }) => ({
        fecha: c.fecha, monto: Number(c.monto),
      }))

      const ingresos: Movimiento[] = especie === 'aves_ponedoras'
        ? (ventasRes.data ?? []).map((v: VentaHuevos) => ({ fecha: v.fecha, monto: totalVentaHuevos(v) }))
        : (ventasRes.data ?? []).map((v: VentaGenerica) => ({ fecha: v.fecha, monto: totalVentaAnimales(v) }))

      resultado[especie] = { ingresos, costos }
    }))

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
        <h3 className="text-sm font-semibold text-gray-600">Finanzas de todas las especies</h3>
        <div className="flex items-center gap-2">
          <Select
            value={anioFiltro}
            onValueChange={v => { setAnioFiltro(v ?? 'todos'); setMesFiltro('todos') }}
            items={{ todos: 'Todos los años', ...Object.fromEntries(aniosDisponibles.map(a => [a, a])) }}
          >
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
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
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-6">
                <p className="text-xs text-emerald-700 font-medium">Ingresos totales</p>
                <p className="text-2xl font-bold text-emerald-800">{cop(totalIngresos)}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-xs text-red-700 font-medium">Costos totales</p>
                <p className="text-2xl font-bold text-red-800">{cop(totalCostos)}</p>
              </CardContent>
            </Card>
            <Card className={totalUtilidad >= 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
              <CardContent className="pt-6">
                <p className={`text-xs font-medium ${totalUtilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>Utilidad total</p>
                <p className={`text-2xl font-bold ${totalUtilidad >= 0 ? 'text-green-800' : 'text-red-800'}`}>{cop(totalUtilidad)}</p>
              </CardContent>
            </Card>
          </div>

          {porEspecie.length > 1 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Desglose por especie</p>
                {porEspecie.map(e => (
                  <div key={e.especie} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium text-gray-700">{e.info.icon} {e.info.label}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-emerald-700">{cop(e.ingresos)}</span>
                      <span className="text-red-700">− {cop(e.costos)}</span>
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
