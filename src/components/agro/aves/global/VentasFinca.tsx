'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BarraExportar } from '@/components/ui/barra-exportar'
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
import ClientesHuevos from '@/components/agro/aves/ventas/ClientesHuevos'
import { useRol } from '@/components/agro/RolProvider'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { TAMANOS_HUEVO, cop, huevosDe, valorVenta, preciosDeFinca, hayPrecios } from '@/lib/huevos'
import { CERO, cantidadesDe, cargarHuevosFinca, preciosParaCliente, totalTamanos, type ClienteHuevos, type PorTamano } from '@/lib/huevosFinca'
import { costoGramoFinca } from '@/lib/costoHuevo'
import { cargarSemanasLote } from '@/lib/useResumenSemanal'
import { PESO_HUEVO_G } from '@/lib/resumenSemanal'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']
type Encargo = Database['public']['Tables']['encargos_huevos_aves']['Row']
type Pago = Database['public']['Tables']['pagos_ventas_huevos']['Row']

type SubTab = 'ventas' | 'encargos' | 'clientes'

interface Props {
  fincaId: string
  lotes: LoteAves[]
}

/**
 * Las ventas de huevo son de la finca, no de un galpón: aquí se ponen los precios
 * (uno solo para toda la finca, o el propio de cada cliente), se registran las
 * ventas del huevo de toda la finca, se anotan los pagos cuando entra el dinero,
 * se llevan los encargos futuros y los clientes.
 */
export default function VentasFinca({ fincaId, lotes }: Props) {
  const supabase = createClient()
  const { fincaActual, refetch: refetchFinca } = useFinca()
  const [subTab, setSubTab] = useState<SubTab>('ventas')
  const [ventas, setVentas] = useState<Venta[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [encargos, setEncargos] = useState<Encargo[]>([])
  // Huevo de toda la finca por tamaño (puesto menos vendido)
  const [disponible, setDisponible] = useState<PorTamano>(CERO)
  const [clientes, setClientes] = useState<ClienteHuevos[]>([])
  // Costo por gramo de huevo de la finca, para estimar la utilidad de cada venta
  const [costoGramo, setCostoGramo] = useState<number | null>(null)
  const puedeVerCostos = useRol() !== 'trabajador'
  const refVentas = useRef<HTMLDivElement>(null)
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

  // Las ventas de antes decían de qué galpón salía el huevo (también lotes que ya salieron)
  const [nombrePorLote, setNombrePorLote] = useState<Map<string, string>>(new Map())
  const lotesKey = lotes.map(l => l.id).join(',')

  const fetchTodo = useCallback(async () => {
    setLoading(true)
    const [ventasRes, pagosRes, encargosRes, huevos, clientesRes, lotesRes] = await Promise.all([
      supabase.from('ventas_huevos_aves').select('*').eq('finca_id', fincaId).order('fecha', { ascending: false }).limit(500),
      supabase.from('pagos_ventas_huevos').select('*').eq('finca_id', fincaId).order('fecha', { ascending: false }),
      supabase.from('encargos_huevos_aves').select('*').eq('finca_id', fincaId).order('fecha_entrega'),
      cargarHuevosFinca(supabase, fincaId),
      supabase.from('clientes_huevos').select('*').eq('finca_id', fincaId).order('nombre'),
      supabase.from('lotes_aves').select('id, nombre').eq('finca_id', fincaId),
    ])
    setVentas(ventasRes.data ?? [])
    setPagos(pagosRes.data ?? [])
    setEncargos(encargosRes.data ?? [])
    setDisponible(huevos.disponible)
    setClientes(clientesRes.data ?? [])
    setNombrePorLote(new Map((lotesRes.data ?? []).map(l => [l.id, l.nombre])))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId, lotesKey, supabase])

  useEffect(() => { fetchTodo() }, [fetchTodo])

  const clavePrecios = JSON.stringify(precios)
  useEffect(() => {
    if (!puedeVerCostos) return
    let vigente = true
    costoGramoFinca(supabase, fincaId, JSON.parse(clavePrecios), lote => cargarSemanasLote(supabase, lote))
      .then(c => { if (vigente) setCostoGramo(c) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId, clavePrecios, puedeVerCostos])

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
  const comprometido: PorTamano = { ...CERO }
  for (const e of encargosPendientes) {
    const c = cantidadesDe(e)
    for (const t of TAMANOS_HUEVO) comprometido[t.key] += c[t.key]
  }
  const enBodega = totalTamanos(disponible)
  const hayVentasConGalpon = ventas.some(v => v.lote_id)

  /** Lo que costó producir el huevo de una venta, con el costo por gramo de la finca */
  function costoDeVenta(v: Venta) {
    if (costoGramo == null) return null
    const c = cantidadesDe(v)
    return TAMANOS_HUEVO.reduce((s, t) => s + c[t.key] * PESO_HUEVO_G[t.key] * costoGramo, 0)
  }

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
    // Si la venta salió de un encargo, el encargo vuelve a quedar pendiente
    await supabase.from('encargos_huevos_aves').update({ estado: 'pendiente', venta_id: null }).eq('venta_id', v.id)
    const { error } = await supabase.from('ventas_huevos_aves').delete().eq('id', v.id)
    if (error) { toast.error('Error al eliminar la venta'); return }
    // El huevo de una venta borrada vuelve solo a la bodega de la finca
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
    // Se encarga sin tener el huevo, pero para entregarlo tiene que estar en la bodega de la finca
    const pide = cantidadesDe(e)
    const falta = TAMANOS_HUEVO.filter(t => pide[t.key] > Math.max(0, disponible[t.key]))
    if (falta.length > 0) {
      toast.error(`En la finca no hay suficiente huevo ${falta.map(t => `${t.label} (hay ${Math.max(0, disponible[t.key]).toLocaleString('es-CO')}, piden ${pide[t.key].toLocaleString('es-CO')})`).join(', ')}. Registra la producción de esos días antes de entregarlo.`, { duration: 8000 })
      return
    }
    const cliente = clientes.find(c => c.id === e.cliente_id) ?? null
    const p = preciosParaCliente(precios, cliente, hoyStr)
    const sinPrecio = TAMANOS_HUEVO.filter(t => pide[t.key] > 0 && !(Number(p[t.key] ?? 0) > 0))
    if (sinPrecio.length > 0) { toast.error(`El tamaño ${sinPrecio.map(t => t.label).join(', ')} no tiene precio`); return }
    const { data: venta, error } = await supabase.from('ventas_huevos_aves').insert({
      lote_id: null,
      finca_id: fincaId,
      fecha: hoyStr,
      cantidad_b: e.cantidad_b, cantidad_a: e.cantidad_a, cantidad_aa: e.cantidad_aa,
      cantidad_aaa: e.cantidad_aaa, cantidad_jumbo: e.cantidad_jumbo,
      precio_b: p.b, precio_a: p.a, precio_aa: p.aa, precio_aaa: p.aaa, precio_jumbo: p.jumbo,
      cliente: e.cliente,
      cliente_id: e.cliente_id,
      observaciones: `Entrega del encargo del ${e.fecha_pedido}`,
    }).select('id').single()
    if (error || !venta) { toast.error('Error al convertir el encargo en venta'); return }
    await supabase.from('encargos_huevos_aves').update({ estado: 'entregado', venta_id: venta.id }).eq('id', e.id)
    toast.success('Encargo entregado y registrado como venta')
    fetchTodo()
  }

  if (loading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Ventas de huevo de la finca</h2>
        <p className="text-xs text-gray-500">Se registran el día que el huevo sale de bodega; el dinero se anota cuando entra.</p>
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
        <Indicador
          tono="amber" icono="huevo" etiqueta="Huevo en bodega"
          valor={enBodega.toLocaleString('es-CO')}
          detalle={`De toda la finca · ${huevosMes.toLocaleString('es-CO')} vendidos este mes`}
        />
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
          { id: 'clientes' as const, label: 'Clientes', icono: 'operario' as const, count: clientes.filter(c => c.activo).length },
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
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Ventas registradas</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <BarraExportar
                titulo={`Ventas de huevo ${fincaActual?.nombre ?? ''}`}
                imprimir={refVentas}
                hojas={() => [{
                  nombre: 'Ventas de huevo',
                  columnas: ['Fecha', 'Cliente', ...TAMANOS_HUEVO.map(t => `Huevos ${t.label}`), ...TAMANOS_HUEVO.map(t => `Precio ${t.label}`), 'Huevos', 'Total', 'Pagado', 'Debe', 'Origen'],
                  filas: ventas.map(v => [
                    v.fecha, v.cliente,
                    ...TAMANOS_HUEVO.map(t => Number(v[`cantidad_${t.key}` as keyof Venta] ?? 0)),
                    ...TAMANOS_HUEVO.map(t => v[`precio_${t.key}` as keyof Venta] as number | null),
                    huevosDe(v), valorVenta(v), pagadoDe(v), Math.max(0, valorVenta(v) - pagadoDe(v)),
                    v.lote_id ? nombrePorLote.get(v.lote_id) ?? 'Galpón' : 'Finca',
                  ]),
                }]}
              />
              <Button size="sm" onClick={abrirNuevaVenta}><Ic n="mas" /> Registrar venta</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0" ref={refVentas}>
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
                      {hayVentasConGalpon && <TableHead>Origen</TableHead>}
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Huevos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {puedeVerCostos && costoGramo != null && (
                        <TableHead className="text-right" title="Total menos lo que costó producir ese huevo (costo por gramo de la última semana de los galpones)">Utilidad est.</TableHead>
                      )}
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
                          {hayVentasConGalpon && (
                            <TableCell className="text-sm text-gray-600">{v.lote_id ? nombrePorLote.get(v.lote_id) ?? 'Galpón' : 'Finca'}</TableCell>
                          )}
                          <TableCell className="text-sm text-gray-600">{v.cliente ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{huevosDe(v).toLocaleString('es-CO')}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{cop(total)}</TableCell>
                          {puedeVerCostos && costoGramo != null && (() => {
                            const util = total - (costoDeVenta(v) ?? 0)
                            return <TableCell className={cn('text-right text-sm', util >= 0 ? 'text-green-700' : 'text-red-700')}>{cop(util)}</TableCell>
                          })()}
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
      ) : subTab === 'clientes' ? (
        <ClientesHuevos fincaId={fincaId} clientes={clientes} ventas={ventas} precios={precios} onCambio={fetchTodo} />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Encargos futuros</CardTitle>
            <Button size="sm" onClick={() => { setEncargoEditar(null); setModalEncargo(true) }}><Ic n="mas" /> Registrar encargo</Button>
          </CardHeader>
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
                      const pide = cantidadesDe(e)
                      const faltaStock = !entregado && TAMANOS_HUEVO.some(t => pide[t.key] > Math.max(0, disponible[t.key]))
                      return (
                        <TableRow key={e.id} className={vencido ? 'bg-red-50' : ''}>
                          <TableCell className="text-sm">{fmt(e.fecha_entrega)}</TableCell>
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
        precios={precios}
        disponible={disponible}
        clientes={clientes}
        nombreGalpon={id => nombrePorLote.get(id) ?? 'anterior'}
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
        encargoExistente={encargoEditar}
        disponible={disponible}
        comprometido={comprometido}
        clientes={clientes}
        onCreated={fetchTodo}
      />
    </div>
  )
}
