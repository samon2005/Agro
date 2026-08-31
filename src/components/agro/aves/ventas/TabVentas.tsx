'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import RegistrarVentaModal from './RegistrarVentaModal'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']

interface Props { loteActual: LoteAves }

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function totalHuevos(v: Venta) {
  return v.cantidad_b + v.cantidad_a + v.cantidad_aa + v.cantidad_aaa + v.cantidad_jumbo
}

function totalVenta(v: Venta) {
  return v.cantidad_b * (v.precio_b ?? 0) + v.cantidad_a * (v.precio_a ?? 0) + v.cantidad_aa * (v.precio_aa ?? 0)
    + v.cantidad_aaa * (v.precio_aaa ?? 0) + v.cantidad_jumbo * (v.precio_jumbo ?? 0)
}

export default function TabVentas({ loteActual }: Props) {
  const supabase = createClient()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [ventaEditar, setVentaEditar] = useState<Venta | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('ventas_huevos_aves').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(60)
    setVentas(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchVentas() }, [fetchVentas])

  async function eliminar(v: Venta) {
    if (confirmandoEliminar !== v.id) { setConfirmandoEliminar(v.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('ventas_huevos_aves').delete().eq('id', v.id)
    if (error) { toast.error('Error al eliminar la venta'); return }
    toast.success('Venta eliminada')
    fetchVentas()
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const hoyStr = new Date().toISOString().split('T')[0]
  const mesActual = hoyStr.slice(0, 7)
  const ventasHoy = ventas.filter(v => v.fecha === hoyStr)
  const ventasMes = ventas.filter(v => v.fecha.slice(0, 7) === mesActual)
  const ingresoHoy = ventasHoy.reduce((s, v) => s + totalVenta(v), 0)
  const ingresoMes = ventasMes.reduce((s, v) => s + totalVenta(v), 0)
  const huevosVendidosMes = ventasMes.reduce((s, v) => s + totalHuevos(v), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Ventas de Huevo</h2>
        <Button onClick={() => { setVentaEditar(null); setModalOpen(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">
          + Registrar venta
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Ingreso por ventas (hoy)</p>
            <p className="text-2xl font-bold text-emerald-800">{ingresoHoy > 0 ? cop(ingresoHoy) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Ingreso por ventas (mes)</p>
            <p className="text-2xl font-bold text-emerald-800">{ingresoMes > 0 ? cop(ingresoMes) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Huevos vendidos (mes)</p>
            <p className="text-2xl font-bold text-emerald-800">{huevosVendidosMes.toLocaleString('es-CO')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial de Ventas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : ventas.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-2">🧾</p>
              <p className="text-gray-600 font-medium">Sin ventas registradas</p>
              <Button onClick={() => setModalOpen(true)} className="mt-4 bg-green-700 hover:bg-green-800 text-white">+ Registrar venta</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Huevos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="text-sm">{fmt(v.fecha)}</TableCell>
                      <TableCell className="text-sm text-gray-600">{v.cliente ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{totalHuevos(v).toLocaleString('es-CO')}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{cop(totalVenta(v))}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setVentaEditar(v); setModalOpen(true) }}>✏️</Button>
                          <Button
                            size="sm" variant="ghost"
                            className={confirmandoEliminar === v.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                            onClick={() => eliminar(v)}
                          >
                            {confirmandoEliminar === v.id ? '¿Confirmar?' : '🗑️'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RegistrarVentaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setVentaEditar(null) }}
        lote={loteActual}
        ventaExistente={ventaEditar}
        onCreated={fetchVentas}
      />
    </div>
  )
}
