'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Indicador } from '@/components/ui/indicador'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import RegistrarVentaModal from '@/components/agro/aves/ventas/RegistrarVentaModal'
import RegistrarPagoModal from '@/components/agro/aves/ventas/RegistrarPagoModal'
import RegistrarEncargoModal from '@/components/agro/aves/ventas/RegistrarEncargoModal'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { ajustarHuevos, nombreItemHuevos } from '@/lib/inventario'
import { TAMANOS_HUEVO, cop, huevosDe, valorVenta, preciosDeFinca, hayPrecios } from '@/lib/huevos'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']
type Encargo = Database['public']['Tables']['encargos_huevos_aves']['Row']
type Pago = Database['public']['Tables']['pagos_ventas_huevos']['Row']

type SubTab = 'ventas' | 'encargos'

interface Props {
  fincaId: string
  lotes: LoteAves[]
}

/**
 * Las ventas de huevo son de la finca, no de un galpón: aquí se ponen los precios
 * (uno solo para toda la finca), se registran y editan las ventas diciendo de qué
 * galpón sale el huevo, se anotan los pagos cuando entra el dinero, y se llevan
 * los encargos futuros.
 */
export default function VentasFinca({ fincaId, lotes }: Props) {
  const supabase = createClient()
  const { fincaActual, refetch: refetchFinca } = useFinca()
  const [subTab, setSubTab] = useState<SubTab>('ventas')
  const [ventas, setVentas] = useState<Venta[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [encargos, setEncargos] = useState<Encargo[]>([])
  const [stockPorLote, setStockPorLote] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  // Precios de la finca
  const precios = preciosDeFinca(fincaActual)
  const preciosListos = hayPrecios(precios)
  const [editandoPrecios, setEditandoPrecios] = useState(false)
  const [formPrecios, setFormPrecios] = useState<Record<string, string>>({})
  const [guardandoPrecios, setGuardandoPrecios] = useState(false)

  // Modales
  const [modalVenta, setModalVenta] = useState(false)
  const [ventaEditar, setVentaEditar] = useState<Venta | null>(null)
  const [ventaPago, setVentaPago] = useState<Venta | null>(null)
  const [modalEncargo, setModalEncargo] = useState(false)
  const [encargoEditar, setEncargoEditar] = useState<Encargo | null>(null)

  const nombrePorLote = new Map(lotes.map(l => [l.id, l.nombre]))
  const lotesKey = lotes.map(l => l.id).join(',')

  const fetchTodo = useCallback(async () => {
    setLoading(true)
    const [ventasRes, pagosRes, encargosRes, inventarioRes] = await Promise.all([
      supabase.from('ventas_huevos_aves').select('*').eq('finca_id', fincaId).order('fecha', { ascending: false }).limit(300),
      supabase.from('pagos_ventas_huevos').select('*').eq('finca_id', fincaId).order('fecha', { ascending: false }),
      supabase.from('encargos_huevos_aves').select('*').eq('finca_id', fincaId).order('fecha_entrega'),
      supabase.from('inventario').select('nombre, cantidad_actual').eq('finca_id', fincaId).like('nombre', 'Huevos — %'),
    ])
    setVentas(ventasRes.data ?? [])
    setPagos(pagosRes.data ?? [])
    setEncargos(encargosRes.data ?? [])
    const porNombre = new Map((inventarioRes.data ?? []).map(i => [i.nombre, Number(i.cantidad_actual)]))
    setStockPorLote(Object.fromEntries(lotes.map(l => [l.id, porNombre.get(nombreItemHuevos(l.nombre)) ?? 0])))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId, lotesKey, supabase])

  useEffect(() => { fetchTodo() }, [fetchTodo])

  useEffect(() => {
    setFormPrecios(Object.fromEntries(TAMANOS_HUEVO.map(t => [t.key, precios[t.key] != null ? String(precios[t.key]) : ''])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaActual?.id, editandoPrecios])

  async function guardarPrecios() {
    setGuardandoPrecios(true)
    const { data: actualizada, error } = await supabase.from('fincas').update({
      precio_huevo_b: formPrecios.b ? Number(formPrecios.b) : null,
      precio_huevo_a: formPrecios.a ? Number(formPrecios.a) : null,
      precio_huevo_aa: formPrecios.aa ? Number(formPrecios.aa) : null,
      precio_huevo_aaa: formPrecios.aaa ? Number(formPrecios.aaa) : null,
      precio_huevo_jumbo: formPrecios.jumbo ? Number(formPrecios.jumbo) : null,
    }).eq('id', fincaId).select('id')
    setGuardandoPrecios(false)
    if (error) { toast.error('Error al guardar los precios'); return }
    if (!actualizada || actualizada.length === 0) { toast.error('Solo el propietario de la finca puede cambiar los precios'); return }
    toast.success('Precios de la finca actualizados')
    setEditandoPrecios(false)
    refetchFinca()
  }

  // ── Pagos: solo lo que ya entró cuenta como ingreso ──
  const pagosPorVenta = new Map<string, Pago[]>()
  for (const p of pagos) {
    const lista = pagosPorVenta.get(p.venta_id) ?? []
    lista.push(p)
    pagosPorVenta.set(p.venta_id, lista)
  }
  function pagadoDe(v: Venta) {
    return (pagosPorVenta.get(v.id) ?? []).reduce((s, p) => s + Number(p.monto), 0)
  }

  const hoyStr = hoyLocal()
  const mesActual = hoyStr.slice(0, 7)
  const cobradoMes = pagos.filter(p => p.fecha.slice(0, 7) === mesActual).reduce((s, p) => s + Number(p.monto), 0)
  const porCobrar = ventas.reduce((s, v) => s + Math.max(0, valorVenta(v) - pagadoDe(v)), 0)
  const huevosMes = ventas.filter(v => v.fecha.slice(0, 7) === mesActual).reduce((s, v) => s + huevosDe(v), 0)
  const encargosPendientes = encargos.filter(e => e.estado !== 'entregado')
  const comprometidos = encargosPendientes.reduce((s, e) => s + huevosDe(e), 0)
  const comprometidoPorLote: Record<string, number> = {}
  for (const e of encargosPendientes) comprometidoPorLote[e.lote_id] = (comprometidoPorLote[e.lote_id] ?? 0) + huevosDe(e)

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function abrirNuevaVenta() {
    if (!preciosListos) {
      toast.error('Primero define los precios del huevo de la finca')
      setEditandoPrecios(true)
      return
    }
    setVentaEditar(null)
    setModalVenta(true)
  }

  async function eliminarVenta(v: Venta) {
    if (confirmandoEliminar !== v.id) { setConfirmandoEliminar(v.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('ventas_huevos_aves').delete().eq('id', v.id)
    if (error) { toast.error('Error al eliminar la venta'); return }
    // El huevo de una venta borrada vuelve a la bodega de su galpón
    const lote = lotes.find(l => l.id === v.lote_id)
    if (lote && huevosDe(v) > 0) await ajustarHuevos(supabase, fincaId, lote.nombre, huevosDe(v))
    toast.success('Venta eliminada')
    fetchTodo()
  }

  async function eliminarEncargo(e: Encargo) {
    if (confirmandoEliminar !== e.id) { setConfirmandoEliminar(e.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('encargos_huevos_aves').delete().eq('id', e.id)
    if (error) { toast.error('Error al eliminar el encargo'); return }
    toast.success('Encargo eliminado')
    fetchTodo()
  }

  /** Al entregarse, el encargo se vuelve venta con los precios de la finca y sale de bodega. */
  async function entregarEncargo(e: Encargo) {
    if (!preciosListos) { toast.error('Primero define los precios del huevo de la finca'); setEditandoPrecios(true); return }
    const { data: venta, error } = await supabase.from('ventas_huevos_aves').insert({
      lote_id: e.lote_id,
      finca_id: fincaId,
      fecha: hoyStr,
      cantidad_b: e.cantidad_b, cantidad_a: e.cantidad_a, cantidad_aa: e.cantidad_aa,
      cantidad_aaa: e.cantidad_aaa, cantidad_jumbo: e.cantidad_jumbo,
      precio_b: precios.b, precio_a: precios.a, precio_aa: precios.aa, precio_aaa: precios.aaa, precio_jumbo: precios.jumbo,
      cliente: e.cliente,
      observaciones: `Entrega del encargo del ${e.fecha_pedido}`,
    }).select('id').single()
    if (error || !venta) { toast.error('Error al convertir el encargo en venta'); return }
    await supabase.from('encargos_huevos_aves').update({ estado: 'entregado', venta_id: venta.id }).eq('id', e.id)
    const lote = lotes.find(l => l.id === e.lote_id)
    if (lote && huevosDe(e) > 0) await ajustarHuevos(supabase, fincaId, lote.nombre, -huevosDe(e))
    toast.success('Encargo entregado y registrado como venta')
    fetchTodo()
  }

  if (loading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Ventas de huevo de la finca</h2>
          <p className="text-xs text-gray-500">Se registran el día que el huevo sale de bodega; el dinero se anota cuando entra.</p>
        </div>
        {subTab === 'ventas' ? (
          <Button onClick={abrirNuevaVenta}><Ic n="mas" /> Registrar venta</Button>
        ) : (
          <Button onClick={() => { setEncargoEditar(null); setModalEncargo(true) }}><Ic n="mas" /> Registrar encargo</Button>
        )}
      </div>

      {/* Precios: uno por tamaño para toda la finca, obligatorios antes de vender */}
      <Card className={!preciosListos ? 'ring-2 ring-amber-300' : undefined}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Precio de venta por tamaño</CardTitle>
            <p className="text-xs text-gray-500">
              {preciosListos
                ? 'Rige para todos los galpones hasta que lo cambies.'
                : 'Define los precios antes de registrar ventas: rigen para todos los galpones hasta que los cambies.'}
            </p>
          </div>
          {!editandoPrecios && (
            <Button size="sm" variant="outline" onClick={() => setEditandoPrecios(true)}>
              <Ic n="editar" /> {preciosListos ? 'Cambiar precios' : 'Definir precios'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editandoPrecios ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                {TAMANOS_HUEVO.map(t => (
                  <div key={t.key} className="space-y-1">
                    <Label className="text-xs">{t.label}</Label>
                    <CurrencyInput placeholder="$" value={formPrecios[t.key] ?? ''} onValueChange={v => setFormPrecios(prev => ({ ...prev, [t.key]: v ?? '' }))} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={guardandoPrecios} onClick={guardarPrecios}>
                  {guardandoPrecios ? 'Guardando...' : 'Guardar precios'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditandoPrecios(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
              {TAMANOS_HUEVO.map(t => (
                <div key={t.key} className="rounded-xl bg-gray-50 py-2.5 text-center">
                  <p className="text-[0.6875rem] font-medium text-gray-500">{t.label}</p>
                  <p className={cn('text-sm font-semibold tabular-nums', precios[t.key] ? 'text-gray-900' : 'text-gray-300')}>
                    {precios[t.key] ? cop(Number(precios[t.key])) : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
        <Indicador tono="green" icono="dinero" etiqueta="Ingresos cobrados (mes)" valor={cobradoMes > 0 ? cop(cobradoMes) : '—'} detalle="Solo lo que ya se pagó" />
        <Indicador
          tono={porCobrar > 0 ? 'red' : 'gray'}
          icono="recibo"
          etiqueta="Por cobrar"
          valor={porCobrar > 0 ? <span className="text-red-700">{cop(porCobrar)}</span> : '—'}
          detalle="Ventas despachadas sin pagar"
        />
        <Indicador tono="amber" icono="huevo" etiqueta="Huevos vendidos (mes)" valor={huevosMes.toLocaleString('es-CO')} />
        <Indicador
          tono={comprometidos > 0 ? 'orange' : 'gray'}
          icono="diario"
          etiqueta="Encargos sin entregar"
          valor={comprometidos.toLocaleString('es-CO')}
          detalle="huevos comprometidos"
        />
      </div>

      {/* Navbar: ventas hechas y encargos futuros */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
        {([
          { id: 'ventas' as const, label: 'Ventas', icono: 'recibo' as const, count: ventas.length },
          { id: 'encargos' as const, label: 'Encargos futuros', icono: 'agenda' as const, count: encargosPendientes.length },
        ]).map(item => (
          <button
            key={item.id}
            onClick={() => setSubTab(item.id)}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors',
              subTab === item.id ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgb(22_35_26/10%)]' : 'text-gray-500 hover:text-gray-800'
            )}
          >
            <Ic n={item.icono} className="size-4" />
            {item.label}
            {item.count > 0 && <span className="rounded-full bg-gray-200/80 px-1.5 text-xs text-gray-600">{item.count}</span>}
          </button>
        ))}
      </div>

      {subTab === 'ventas' ? (
        <Card>
          <CardContent className="p-0">
            {ventas.length === 0 ? (
              <div className="py-12 text-center">
                <Ic n="recibo" className="mx-auto mb-2 size-8 text-gray-300" />
                <p className="font-medium text-gray-700">Sin ventas registradas</p>
                <p className="text-sm text-gray-500">Registra la salida de huevo de bodega con &quot;Registrar venta&quot;.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Salida</TableHead>
                      <TableHead>Galpón</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Huevos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.map(v => {
                      const total = valorVenta(v)
                      const pagado = pagadoDe(v)
                      const debe = Math.max(0, total - pagado)
                      const pagosVenta = pagosPorVenta.get(v.id) ?? []
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="text-sm">{fmt(v.fecha)}</TableCell>
                          <TableCell className="text-sm text-gray-600">{nombrePorLote.get(v.lote_id) ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-600">{v.cliente ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{huevosDe(v).toLocaleString('es-CO')}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{cop(total)}</TableCell>
                          <TableCell className="text-xs">
                            {debe <= 0.5 ? (
                              <span className="inline-flex items-center gap-1 font-medium text-green-700">
                                <Ic n="listo" /> Pagada{pagosVenta[0] ? ` · ${fmt(pagosVenta[0].fecha)}` : ''}
                              </span>
                            ) : pagado > 0 ? (
                              <span className="font-medium text-amber-700">Parcial · deben {cop(debe)}</span>
                            ) : (
                              <span className="font-medium text-red-700">Sin pagar</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {debe > 0.5 && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setVentaPago(v)}>
                                  <Ic n="dinero" /> ¿Ya pagaron?
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setVentaEditar(v); setModalVenta(true) }}><Ic n="editar" /></Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === v.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminarVenta(v)}
                              >
                                {confirmandoEliminar === v.id ? '¿Confirmar?' : <Ic n="borrar" />}
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
      ) : (
        <Card>
          <CardContent className="p-0">
            {encargos.length === 0 ? (
              <div className="py-12 text-center">
                <Ic n="agenda" className="mx-auto mb-2 size-8 text-gray-300" />
                <p className="font-medium text-gray-700">Sin encargos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Galpón</TableHead>
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
                      const faltaStock = !entregado && huevosDe(e) > (stockPorLote[e.lote_id] ?? 0)
                      return (
                        <TableRow key={e.id} className={vencido ? 'bg-red-50' : ''}>
                          <TableCell className="text-sm">{fmt(e.fecha_entrega)}</TableCell>
                          <TableCell className="text-sm text-gray-600">{nombrePorLote.get(e.lote_id) ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-600">{e.cliente ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{huevosDe(e).toLocaleString('es-CO')}</TableCell>
                          <TableCell className="text-xs">
                            {entregado
                              ? <span className="text-green-700"><Ic n="listo" /> Entregado</span>
                              : vencido
                                ? <span className="font-medium text-red-600"><Ic n="reloj" /> Vencido sin entregar</span>
                                : faltaStock
                                  ? <span className="font-medium text-amber-700">Pendiente · aún no hay stock suficiente</span>
                                  : <span className="text-amber-600">Pendiente</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {!entregado && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => entregarEncargo(e)}>
                                  Marcar entregado
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setEncargoEditar(e); setModalEncargo(true) }}><Ic n="editar" /></Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === e.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminarEncargo(e)}
                              >
                                {confirmandoEliminar === e.id ? '¿Confirmar?' : <Ic n="borrar" />}
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
        open={modalVenta}
        onClose={() => { setModalVenta(false); setVentaEditar(null) }}
        fincaId={fincaId}
        lotes={lotes}
        precios={precios}
        stockPorLote={stockPorLote}
        ventaExistente={ventaEditar}
        onCreated={fetchTodo}
      />
      <RegistrarPagoModal
        open={ventaPago != null}
        onClose={() => setVentaPago(null)}
        venta={ventaPago}
        pagos={ventaPago ? (pagosPorVenta.get(ventaPago.id) ?? []) : []}
        onCreated={fetchTodo}
      />
      <RegistrarEncargoModal
        open={modalEncargo}
        onClose={() => { setModalEncargo(false); setEncargoEditar(null) }}
        fincaId={fincaId}
        lotes={lotes}
        encargoExistente={encargoEditar}
        stockPorLote={stockPorLote}
        comprometidoPorLote={comprometidoPorLote}
        onCreated={fetchTodo}
      />
    </div>
  )
}
