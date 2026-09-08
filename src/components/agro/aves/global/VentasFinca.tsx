'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']
type Encargo = Database['public']['Tables']['encargos_huevos_aves']['Row']

interface Props {
  fincaId: string
  lotes: LoteAves[]
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function huevosDe(v: Venta | Encargo) {
  return v.cantidad_b + v.cantidad_a + v.cantidad_aa + v.cantidad_aaa + v.cantidad_jumbo
}

function totalVenta(v: Venta) {
  return v.cantidad_b * (v.precio_b ?? 0) + v.cantidad_a * (v.precio_a ?? 0) + v.cantidad_aa * (v.precio_aa ?? 0)
    + v.cantidad_aaa * (v.precio_aaa ?? 0) + v.cantidad_jumbo * (v.precio_jumbo ?? 0)
}

/**
 * Todas las ventas de huevo de la finca en un solo lugar, sin tener que entrar
 * galpón por galpón. Cada venta que se registra aquí ya descontó del huevo
 * disponible, así que las dos vistas siempre cuadran.
 */
export default function VentasFinca({ fincaId, lotes }: Props) {
  const supabase = createClient()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [encargos, setEncargos] = useState<Encargo[]>([])
  const [loading, setLoading] = useState(true)

  const nombrePorLote = new Map(lotes.map(l => [l.id, l.nombre]))

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    const [ventasRes, encargosRes] = await Promise.all([
      supabase.from('ventas_huevos_aves').select('*').eq('finca_id', fincaId).order('fecha', { ascending: false }).limit(200),
      supabase.from('encargos_huevos_aves').select('*').eq('finca_id', fincaId).neq('estado', 'entregado').order('fecha_entrega'),
    ])
    setVentas(ventasRes.data ?? [])
    setEncargos(encargosRes.data ?? [])
    setLoading(false)
  }, [fincaId, supabase])

  useEffect(() => { fetchVentas() }, [fetchVentas])

  const hoyStr = hoyLocal()
  const mesActual = hoyStr.slice(0, 7)
  const ventasMes = ventas.filter(v => v.fecha.slice(0, 7) === mesActual)
  const ingresoMes = ventasMes.reduce((s, v) => s + totalVenta(v), 0)
  const ingresoTotal = ventas.reduce((s, v) => s + totalVenta(v), 0)
  const huevosMes = ventasMes.reduce((s, v) => s + huevosDe(v), 0)
  const comprometidos = encargos.reduce((s, e) => s + huevosDe(e), 0)

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-800">🧾 Ventas de huevo de la finca</h2>
        <p className="text-xs text-gray-400">
          Todas las ventas de todos los galpones. Cada venta descuenta del huevo disponible que
          se ve en la pestaña Huevos. Para registrar una venta entra al galpón que la despacha.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Ingreso del mes</p>
            <p className="text-2xl font-bold text-emerald-800">{ingresoMes > 0 ? cop(ingresoMes) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Ingreso acumulado</p>
            <p className="text-2xl font-bold text-emerald-800">{ingresoTotal > 0 ? cop(ingresoTotal) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Huevos vendidos (mes)</p>
            <p className="text-2xl font-bold text-gray-800">{huevosMes.toLocaleString('es-CO')}</p>
          </CardContent>
        </Card>
        <Card className={comprometidos > 0 ? 'border-amber-200 bg-amber-50' : ''}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium ${comprometidos > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
              Encargos sin entregar
            </p>
            <p className={`text-2xl font-bold ${comprometidos > 0 ? 'text-amber-800' : 'text-gray-800'}`}>
              {comprometidos.toLocaleString('es-CO')}
            </p>
            <p className="text-xs text-gray-400">huevos comprometidos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial de ventas (toda la finca)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ventas.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-2">🧾</p>
              <p className="text-gray-600 font-medium">Sin ventas registradas</p>
              <p className="text-sm text-gray-400">Las ventas se registran desde el galpón que despacha el huevo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Galpón</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Huevos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="text-sm">{fmt(v.fecha)}</TableCell>
                      <TableCell className="text-sm text-gray-600">🐔 {nombrePorLote.get(v.lote_id) ?? '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{v.cliente ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{huevosDe(v).toLocaleString('es-CO')}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{cop(totalVenta(v))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {encargos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Encargos pendientes (toda la finca)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Galpón</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Huevos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {encargos.map(e => (
                    <TableRow key={e.id} className={e.fecha_entrega < hoyStr ? 'bg-red-50' : ''}>
                      <TableCell className="text-sm">{fmt(e.fecha_entrega)}</TableCell>
                      <TableCell className="text-sm text-gray-600">🐔 {nombrePorLote.get(e.lote_id) ?? '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{e.cliente ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{huevosDe(e).toLocaleString('es-CO')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
