'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import RegistrarVentaModal from './RegistrarVentaModal'
import RegistrarEncargoModal from './RegistrarEncargoModal'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { ajustarHuevos, nombreItemHuevos } from '@/lib/inventario'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']
type Encargo = Database['public']['Tables']['encargos_huevos_aves']['Row']

type SubTab = 'ventas' | 'encargos'

interface Props { loteActual: LoteAves; onLoteUpdated?: (lote: LoteAves) => void }

const TAMANOS_PRECIO = [
  { key: 'precio_huevo_b', label: 'B' },
  { key: 'precio_huevo_a', label: 'A' },
  { key: 'precio_huevo_aa', label: 'AA' },
  { key: 'precio_huevo_aaa', label: 'AAA' },
  { key: 'precio_huevo_jumbo', label: 'JUMBO' },
] as const

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function totalHuevos(v: Venta | Encargo) {
  return v.cantidad_b + v.cantidad_a + v.cantidad_aa + v.cantidad_aaa + v.cantidad_jumbo
}

function totalVenta(v: Venta) {
  return v.cantidad_b * (v.precio_b ?? 0) + v.cantidad_a * (v.precio_a ?? 0) + v.cantidad_aa * (v.precio_aa ?? 0)
    + v.cantidad_aaa * (v.precio_aaa ?? 0) + v.cantidad_jumbo * (v.precio_jumbo ?? 0)
}

export default function TabVentas({ loteActual, onLoteUpdated }: Props) {
  const supabase = createClient()
  const [subTab, setSubTab] = useState<SubTab>('ventas')
  const [ventas, setVentas] = useState<Venta[]>([])
  const [encargos, setEncargos] = useState<Encargo[]>([])
  const [modalEncargo, setModalEncargo] = useState(false)
  const [encargoEditar, setEncargoEditar] = useState<Encargo | null>(null)
  const [huevosInventario, setHuevosInventario] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [ventaEditar, setVentaEditar] = useState<Venta | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [editandoPrecios, setEditandoPrecios] = useState(false)
  const [precios, setPrecios] = useState<Record<string, string>>({})
  const [guardandoPrecios, setGuardandoPrecios] = useState(false)

  useEffect(() => {
    setPrecios(Object.fromEntries(TAMANOS_PRECIO.map(t => [t.key, loteActual[t.key] != null ? String(loteActual[t.key]) : ''])))
  }, [loteActual])

  async function guardarPrecios() {
    setGuardandoPrecios(true)
    const payload: Database['public']['Tables']['lotes_aves']['Update'] = {
      precio_huevo_b: precios.precio_huevo_b ? Number(precios.precio_huevo_b) : null,
      precio_huevo_a: precios.precio_huevo_a ? Number(precios.precio_huevo_a) : null,
      precio_huevo_aa: precios.precio_huevo_aa ? Number(precios.precio_huevo_aa) : null,
      precio_huevo_aaa: precios.precio_huevo_aaa ? Number(precios.precio_huevo_aaa) : null,
      precio_huevo_jumbo: precios.precio_huevo_jumbo ? Number(precios.precio_huevo_jumbo) : null,
    }
    const { data, error } = await supabase.from('lotes_aves').update(payload).eq('id', loteActual.id).select().single()
    setGuardandoPrecios(false)
    if (error) { toast.error('Error al guardar los precios'); return }
    toast.success('Precios de venta actualizados')
    setEditandoPrecios(false)
    onLoteUpdated?.(data)
  }

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    const [ventasRes, encargosRes, inventarioRes] = await Promise.all([
      supabase.from('ventas_huevos_aves').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(60),
      supabase.from('encargos_huevos_aves').select('*').eq('lote_id', loteActual.id).order('fecha_entrega', { ascending: true }).limit(60),
      supabase.from('inventario').select('cantidad_actual').eq('finca_id', loteActual.finca_id).eq('nombre', nombreItemHuevos(loteActual.nombre)).maybeSingle(),
    ])
    setVentas(ventasRes.data ?? [])
    setEncargos(encargosRes.data ?? [])
    setHuevosInventario(Number(inventarioRes.data?.cantidad_actual ?? 0))
    setLoading(false)
  }, [loteActual.id, loteActual.finca_id, loteActual.nombre, supabase])

  useEffect(() => { fetchVentas() }, [fetchVentas])

  async function eliminarEncargo(e: Encargo) {
    if (confirmandoEliminar !== e.id) { setConfirmandoEliminar(e.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('encargos_huevos_aves').delete().eq('id', e.id)
    if (error) { toast.error('Error al eliminar el encargo'); return }
    toast.success('Encargo eliminado')
    fetchVentas()
  }

  /**
   * Al entregar un encargo se convierte en venta con los precios vigentes del galpón:
   * así el huevo comprometido sale del inventario una sola vez, al entregarse.
   */
  async function entregarEncargo(e: Encargo) {
    const { data: venta, error } = await supabase.from('ventas_huevos_aves').insert({
      lote_id: loteActual.id,
      finca_id: loteActual.finca_id,
      fecha: hoyLocal(),
      cantidad_b: e.cantidad_b, cantidad_a: e.cantidad_a, cantidad_aa: e.cantidad_aa,
      cantidad_aaa: e.cantidad_aaa, cantidad_jumbo: e.cantidad_jumbo,
      precio_b: loteActual.precio_huevo_b, precio_a: loteActual.precio_huevo_a,
      precio_aa: loteActual.precio_huevo_aa, precio_aaa: loteActual.precio_huevo_aaa,
      precio_jumbo: loteActual.precio_huevo_jumbo,
      cliente: e.cliente,
      observaciones: `Entrega del encargo del ${e.fecha_pedido}`,
    }).select('id').single()

    if (error || !venta) { toast.error('Error al convertir el encargo en venta'); return }

    await supabase.from('encargos_huevos_aves').update({ estado: 'entregado', venta_id: venta.id }).eq('id', e.id)
    if (totalHuevos(e) > 0) {
      await ajustarHuevos(supabase, loteActual.finca_id, loteActual.nombre, -totalHuevos(e))
    }
    toast.success('Encargo entregado y registrado como venta')
    fetchVentas()
  }

  async function eliminar(v: Venta) {
    if (confirmandoEliminar !== v.id) { setConfirmandoEliminar(v.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('ventas_huevos_aves').delete().eq('id', v.id)
    if (error) { toast.error('Error al eliminar la venta'); return }
    // Los huevos de una venta borrada vuelven al inventario del galpón
    if (totalHuevos(v) > 0) {
      await ajustarHuevos(supabase, loteActual.finca_id, loteActual.nombre, totalHuevos(v))
    }
    toast.success('Venta eliminada')
    fetchVentas()
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const hoyStr = hoyLocal()
  const mesActual = hoyStr.slice(0, 7)
  const ventasHoy = ventas.filter(v => v.fecha === hoyStr)
  const ventasMes = ventas.filter(v => v.fecha.slice(0, 7) === mesActual)
  const ingresoHoy = ventasHoy.reduce((s, v) => s + totalVenta(v), 0)
  const ingresoMes = ventasMes.reduce((s, v) => s + totalVenta(v), 0)
  const huevosVendidosMes = ventasMes.reduce((s, v) => s + totalHuevos(v), 0)
  const encargosPendientes = encargos.filter(e => e.estado !== 'entregado')
  const comprometidos = encargosPendientes.reduce((s, e) => s + totalHuevos(e), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Ventas de Huevo</h2>
        {subTab === 'ventas' ? (
          <Button onClick={() => { setVentaEditar(null); setModalOpen(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">
            + Registrar venta
          </Button>
        ) : (
          <Button onClick={() => { setEncargoEditar(null); setModalEncargo(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">
            + Registrar encargo
          </Button>
        )}
      </div>

      {/* Un navbar para lo ya vendido y otro para lo que está comprometido a futuro */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {([
          { id: 'ventas' as const, label: '🧾 Ventas', count: ventas.length },
          { id: 'encargos' as const, label: '📋 Encargos futuros', count: encargosPendientes.length },
        ]).map(item => (
          <button
            key={item.id}
            onClick={() => setSubTab(item.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              subTab === item.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {item.label}
            {item.count > 0 && <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{item.count}</span>}
          </button>
        ))}
      </div>

      {subTab === 'ventas' && (
      <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">💲 Precio de venta por tamaño de huevo</CardTitle>
          {!editandoPrecios && (
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditandoPrecios(true)}>Editar precios</Button>
          )}
        </CardHeader>
        <CardContent>
          {editandoPrecios ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {TAMANOS_PRECIO.map(t => (
                  <div key={t.key} className="space-y-1">
                    <Label className="text-xs">{t.label}</Label>
                    <CurrencyInput placeholder="$" value={precios[t.key] ?? ''} onValueChange={v => setPrecios(prev => ({ ...prev, [t.key]: v ?? '' }))} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={guardandoPrecios} className="bg-green-700 hover:bg-green-800 text-white text-xs" onClick={guardarPrecios}>
                  {guardandoPrecios ? 'Guardando...' : 'Guardar precios'}
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditandoPrecios(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {TAMANOS_PRECIO.map(t => (
                <div key={t.key} className="bg-gray-50 rounded-lg border border-gray-100 py-2 text-center">
                  <p className="text-[10px] text-gray-500 font-medium">{t.label}</p>
                  <p className="text-sm font-bold text-gray-800">{loteActual[t.key] ? cop(Number(loteActual[t.key])) : '—'}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
      </>
      )}

      {subTab === 'encargos' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">📋 Encargos futuros</CardTitle>
            <p className="text-xs text-gray-400">
              Huevo ya comprometido con un cliente que todavía no se entrega. Al marcarlo como
              entregado se convierte en venta y se descuenta del inventario.
              {huevosInventario > 0 && ` Hoy hay ${huevosInventario.toLocaleString('es-CO')} huevos en inventario.`}
            </p>
            {comprometidos > 0 && (
              <p className="text-xs text-amber-600">
                ⚠️ Comprometidos sin entregar: {comprometidos.toLocaleString('es-CO')} huevos
                {huevosInventario > 0 && comprometidos > huevosInventario && ' — más de lo que hay hoy en inventario'}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : encargos.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-2">📋</p>
                <p className="text-gray-600 font-medium">Sin encargos registrados</p>
                <Button onClick={() => { setEncargoEditar(null); setModalEncargo(true) }} className="mt-4 bg-green-700 hover:bg-green-800 text-white">
                  + Registrar encargo
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Huevos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {encargos.map(e => {
                      const entregado = e.estado === 'entregado'
                      const vencido = !entregado && e.fecha_entrega < hoyStr
                      return (
                        <TableRow key={e.id} className={vencido ? 'bg-red-50' : ''}>
                          <TableCell className="text-sm">{fmt(e.fecha_entrega)}</TableCell>
                          <TableCell className="text-sm text-gray-600">{e.cliente ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{totalHuevos(e).toLocaleString('es-CO')}</TableCell>
                          <TableCell className="text-xs">
                            {entregado
                              ? <span className="text-green-700">✓ Entregado</span>
                              : vencido
                                ? <span className="text-red-600 font-medium">⏰ Vencido sin entregar</span>
                                : <span className="text-amber-600">Pendiente</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {!entregado && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => entregarEncargo(e)}>
                                  Marcar entregado
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setEncargoEditar(e); setModalEncargo(true) }}>✏️</Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === e.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminarEncargo(e)}
                              >
                                {confirmandoEliminar === e.id ? '¿Confirmar?' : '🗑️'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <RegistrarVentaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setVentaEditar(null) }}
        lote={loteActual}
        ventaExistente={ventaEditar}
        onCreated={fetchVentas}
      />
      <RegistrarEncargoModal
        open={modalEncargo}
        onClose={() => { setModalEncargo(false); setEncargoEditar(null) }}
        lote={loteActual}
        encargoExistente={encargoEditar}
        huevosEnInventario={huevosInventario}
        onCreated={fetchVentas}
      />
    </div>
  )
}
