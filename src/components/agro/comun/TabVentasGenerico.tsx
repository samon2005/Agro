'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import RegistrarVentaGenericaModal from './RegistrarVentaGenericaModal'
import {
  dbGenerico, kilosVenta, totalVentaAnimales,
  type ConfigEspecie, type VentaGenerica,
} from '@/lib/especiesConfig'

interface Props {
  loteId: string
  fincaId: string
  config: ConfigEspecie
  animalesActuales: number
  precioKgObjetivo?: number | null
  onLoteCambiado?: () => void
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TabVentasGenerico({ loteId, fincaId, config, animalesActuales, precioKgObjetivo, onLoteCambiado }: Props) {
  const supabase = createClient()
  const [ventas, setVentas] = useState<VentaGenerica[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [ventaEditar, setVentaEditar] = useState<VentaGenerica | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    const { data } = await dbGenerico(supabase)
      .from(config.tablas.ventas).select('*').eq('lote_id', loteId)
      .order('fecha', { ascending: false }).limit(60)
    setVentas((data ?? []) as VentaGenerica[])
    setLoading(false)
  }, [loteId, supabase, config.tablas.ventas])

  useEffect(() => { fetchVentas() }, [fetchVentas])

  async function eliminar(v: VentaGenerica) {
    if (confirmandoEliminar !== v.id) { setConfirmandoEliminar(v.id); return }
    setConfirmandoEliminar(null)
    const db = dbGenerico(supabase)
    const { error } = await db.from(config.tablas.ventas).delete().eq('id', v.id)
    if (error) { toast.error('Error al eliminar la venta'); return }
    // Al deshacer la venta, los animales vuelven al lote
    await db.from(config.tablas.lotes)
      .update({ [config.campoActuales]: animalesActuales + v.cantidad })
      .eq('id', loteId)
    toast.success('Venta eliminada')
    fetchVentas()
    onLoteCambiado?.()
  }

  const hoyStr = new Date().toISOString().split('T')[0]
  const mesActual = hoyStr.slice(0, 7)
  const ventasMes = ventas.filter(v => v.fecha.slice(0, 7) === mesActual)
  const ingresoMes = ventasMes.reduce((s, v) => s + totalVentaAnimales(v), 0)
  const animalesVendidosMes = ventasMes.reduce((s, v) => s + v.cantidad, 0)
  const kilosMes = ventasMes.reduce((s, v) => s + kilosVenta(v), 0)
  const precioPromedioKg = kilosMes > 0 ? ingresoMes / kilosMes : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Ventas de {config.animalPlural}</h2>
        <Button onClick={() => { setVentaEditar(null); setModalOpen(true) }} className={cn('text-sm', config.botonClase)}>
          + Registrar venta
        </Button>
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
            <p className="text-xs text-emerald-700 font-medium">{config.animalPlural} vendidos (mes)</p>
            <p className="text-2xl font-bold text-emerald-800">{animalesVendidosMes.toLocaleString('es-CO')}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Kilos vendidos (mes)</p>
            <p className="text-2xl font-bold text-emerald-800">{kilosMes > 0 ? kilosMes.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Precio promedio / kg</p>
            <p className="text-2xl font-bold text-emerald-800">{precioPromedioKg > 0 ? cop(precioPromedioKg) : '—'}</p>
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
              <Button onClick={() => setModalOpen(true)} className={cn('mt-4', config.botonClase)}>+ Registrar venta</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Peso prom.</TableHead>
                    <TableHead className="text-right">Kilos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="text-sm">{fmt(v.fecha)}</TableCell>
                      <TableCell className="text-sm text-gray-600">{v.cliente ?? '—'}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${v.tipo_venta === 'canal' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {v.tipo_venta === 'canal' ? 'Canal' : 'En pie'}
                        </Badge>
                        <span className="ml-1 text-[10px] text-gray-400">
                          {v.modo_precio === 'animal' ? 'por animal' : 'por kg'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">{v.cantidad.toLocaleString('es-CO')}</TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {v.peso_promedio_kg ? `${Number(v.peso_promedio_kg).toLocaleString('es-CO')} kg` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {kilosVenta(v) > 0 ? kilosVenta(v).toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">{cop(totalVentaAnimales(v))}</TableCell>
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

      <RegistrarVentaGenericaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setVentaEditar(null) }}
        loteId={loteId}
        fincaId={fincaId}
        config={config}
        animalesActuales={animalesActuales}
        precioKgObjetivo={precioKgObjetivo}
        ventaExistente={ventaEditar}
        onCreated={() => { fetchVentas(); onLoteCambiado?.() }}
      />
    </div>
  )
}
