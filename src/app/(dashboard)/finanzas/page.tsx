'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BarraExportar, type Vista } from '@/components/ui/barra-exportar'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import RegistrarCostoFincaModal from '@/components/agro/finanzas/RegistrarCostoFincaModal'
import RegistrarVentaAvesModal from '@/components/agro/finanzas/RegistrarVentaAvesModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import CostoHuevoGalpones from '@/components/agro/finanzas/CostoHuevoGalpones'
import { categoriasCosto, categoriaInfo } from '@/lib/costos'
import { CONFIG_ESPECIES, dbGenerico } from '@/lib/especiesConfig'
import type { EspecieFinca } from '@/lib/especies'
import { cop } from '@/lib/huevos'
import {
  cargarFinanzasFinca, tiposIngresoDe, TIPOS_INGRESO,
  type CostoFinca, type Ingreso, type LoteFinanzas, type TipoIngreso, type VentaAvesLote,
} from '@/lib/finanzas'

type Tab = 'general' | 'costos' | 'ventas'

const TABS: { id: Tab; label: string; icon: NombreIcono }[] = [
  { id: 'general', label: 'General', icon: 'dinero' },
  { id: 'costos', label: 'Costos', icon: 'recibo' },
  { id: 'ventas', label: 'Ventas', icon: 'tendencia' },
]

const FINCA = 'finca'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function nombreMes(m: string) {
  const texto = new Date(m + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
function pct(parte: number, todo: number) {
  return todo > 0 ? `${((parte / todo) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %` : '—'
}

/**
 * Finanzas de la finca, como un control de costos: General con la utilidad (mes a
 * mes y por galpón), Costos con todos los gastos por categoría, y Ventas con lo
 * que entró por huevo, aves y demás. Año, mes y galpón filtran las tres.
 */
export default function FinanzasPage() {
  const supabase = createClient()
  const { fincaActual, loading: fincaLoading } = useFinca()
  const rol = useRol()

  const [lotes, setLotes] = useState<LoteFinanzas[]>([])
  const [costos, setCostos] = useState<CostoFinca[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<Tab>('general')
  const [loteFiltro, setLoteFiltro] = useState('todos')
  const [anioFiltro, setAnioFiltro] = useState('todos')
  const [mesFiltro, setMesFiltro] = useState('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)
  // Vistas e impresión de cada tabla
  const [vistaMes, setVistaMes] = useState<Vista>('tabla')
  const refMes = useRef<HTMLDivElement>(null)
  const refCostos = useRef<HTMLDivElement>(null)
  const refVentas = useRef<HTMLDivElement>(null)
  const [tipoVentaFiltro, setTipoVentaFiltro] = useState<TipoIngreso | null>(null)

  const [modalCosto, setModalCosto] = useState(false)
  const [costoEditar, setCostoEditar] = useState<CostoFinca | null>(null)
  const [modalVenta, setModalVenta] = useState(false)
  const [ventaEditar, setVentaEditar] = useState<VentaAvesLote | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  // Una finca es de una sola especie
  const especie = (fincaActual?.tipo_produccion?.[0] ?? null) as EspecieFinca | null

  const fetchTodo = useCallback(async () => {
    if (!fincaActual) return
    setLoading(true)
    const datos = await cargarFinanzasFinca(supabase, fincaActual.id, especie ? [especie] : [])
    setLotes(datos.lotes)
    setCostos(datos.costos)
    setIngresos(datos.ingresos)
    setLoading(false)
  }, [fincaActual, especie, supabase])

  useEffect(() => { fetchTodo() }, [fetchTodo])

  if (fincaLoading) return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>
  if (rol === 'trabajador') return <div className="p-8"><AccesoRestringido /></div>

  const lugar = especie ? CONFIG_ESPECIES[especie].loteLabel : 'galpón'
  const lugares = lugar === 'corral' ? 'corrales' : 'galpones'
  const nombreLote = new Map(lotes.map(l => [l.id, l.nombre]))
  const nombreDe = (id: string | null) => (id ? nombreLote.get(id) ?? '—' : 'Toda la finca')

  // ── Filtros comunes: galpón → año → mes ──
  function pasaFiltros(x: { fecha: string; lote_id: string | null }) {
    if (loteFiltro === FINCA && x.lote_id !== null) return false
    if (loteFiltro !== 'todos' && loteFiltro !== FINCA && x.lote_id !== loteFiltro) return false
    if (anioFiltro !== 'todos' && x.fecha.slice(0, 4) !== anioFiltro) return false
    if (mesFiltro !== 'todos' && x.fecha.slice(0, 7) !== mesFiltro) return false
    return true
  }
  const fechas = [...costos.map(c => c.fecha), ...ingresos.map(i => i.fecha)]
  const aniosDisponibles = Array.from(new Set(fechas.map(f => f.slice(0, 4)))).sort().reverse()
  const mesesDisponibles = Array.from(new Set(
    fechas.filter(f => anioFiltro === 'todos' || f.slice(0, 4) === anioFiltro).map(f => f.slice(0, 7))
  )).sort().reverse()

  const costosPeriodo = costos.filter(pasaFiltros)
  const ingresosPeriodo = ingresos.filter(pasaFiltros)
  const totalIngresos = ingresosPeriodo.reduce((s, i) => s + i.monto, 0)
  const totalCostos = costosPeriodo.reduce((s, c) => s + Number(c.monto), 0)
  const utilidad = totalIngresos - totalCostos
  const etiquetaPeriodo = mesFiltro !== 'todos' ? nombreMes(mesFiltro) : anioFiltro !== 'todos' ? anioFiltro : 'Todo el tiempo'

  // ── General: mes a mes y por galpón ──
  const meses = Array.from(new Set([...costosPeriodo, ...ingresosPeriodo].map(x => x.fecha.slice(0, 7)))).sort().reverse()
  const porMes = meses.map(m => {
    const ing = ingresosPeriodo.filter(i => i.fecha.startsWith(m)).reduce((s, i) => s + i.monto, 0)
    const cos = costosPeriodo.filter(c => c.fecha.startsWith(m)).reduce((s, c) => s + Number(c.monto), 0)
    return { mes: m, ingresos: ing, costos: cos, utilidad: ing - cos }
  })
  const clavesLote = Array.from(new Set([...costosPeriodo, ...ingresosPeriodo].map(x => x.lote_id ?? FINCA)))
  const porLote = clavesLote.map(k => {
    const id = k === FINCA ? null : k
    const ing = ingresosPeriodo.filter(i => i.lote_id === id).reduce((s, i) => s + i.monto, 0)
    const cos = costosPeriodo.filter(c => c.lote_id === id).reduce((s, c) => s + Number(c.monto), 0)
    return { clave: k, nombre: nombreDe(id), ingresos: ing, costos: cos, utilidad: ing - cos }
  }).sort((a, b) => (a.clave === FINCA ? 1 : b.clave === FINCA ? -1 : a.nombre.localeCompare(b.nombre, 'es', { numeric: true })))

  // ── Costos por categoría ──
  const categoriaDe = (c: CostoFinca) => categoriaInfo(c.categoria)?.value ?? c.categoria
  const categorias = especie ? categoriasCosto(CONFIG_ESPECIES[especie].categoriaCria) : categoriasCosto()
  const totalPorCategoria = categorias
    .map(cat => ({ ...cat, total: costosPeriodo.filter(c => categoriaDe(c) === cat.value).reduce((s, c) => s + Number(c.monto), 0) }))
  const costosTabla = categoriaFiltro ? costosPeriodo.filter(c => categoriaDe(c) === categoriaFiltro) : costosPeriodo

  // ── Ventas por tipo ──
  const tiposVenta = tiposIngresoDe(especie)
  const totalPorTipo = tiposVenta.map(t => ({ tipo: t, ...TIPOS_INGRESO[t], total: ingresosPeriodo.filter(i => i.tipo === t).reduce((s, i) => s + i.monto, 0) }))
  const ventasTabla = tipoVentaFiltro ? ingresosPeriodo.filter(i => i.tipo === tipoVentaFiltro) : ingresosPeriodo

  async function eliminarCosto(c: CostoFinca) {
    if (confirmandoEliminar !== c.id) { setConfirmandoEliminar(c.id); return }
    setConfirmandoEliminar(null)
    const { error } = await dbGenerico(supabase).from(CONFIG_ESPECIES[c.especie].tablas.costos).delete().eq('id', c.id)
    if (error) { toast.error('Error al eliminar el costo'); return }
    setCostos(prev => prev.filter(x => x.id !== c.id))
    toast.success('Costo eliminado')
  }

  async function eliminarVenta(v: VentaAvesLote) {
    if (confirmandoEliminar !== v.id) { setConfirmandoEliminar(v.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('ventas_aves_lote').delete().eq('id', v.id)
    if (error) {
      toast.error(error.hint === 'lote_cerrado' ? error.message : 'Error al eliminar la venta')
      return
    }
    toast.success(v.tipo === 'descarte' || v.tipo === 'pollas' ? 'Venta eliminada: las aves volvieron al galpón' : 'Venta eliminada')
    fetchTodo()
  }

  const opcionesLote = {
    todos: `Todos los ${lugares}`,
    [FINCA]: 'Solo gastos de la finca',
    ...Object.fromEntries(lotes.map(l => [l.id, l.estado === 'activo' || l.estado === 'preparacion' ? l.nombre : `${l.nombre} (cerrado)`])),
  }

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl font-medium text-gray-900">Finanzas</h2>
          <p className="mt-1 text-gray-500">
            {fincaActual ? `${fincaActual.nombre} · control de costos, ventas y utilidad` : 'Selecciona una finca'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab !== 'ventas' && (
            <Button onClick={() => { setCostoEditar(null); setModalCosto(true) }} disabled={!especie}>
              <Ic n="mas" /> Registrar costo
            </Button>
          )}
          {tab !== 'costos' && especie === 'aves_ponedoras' && (
            <Button variant={tab === 'ventas' ? 'default' : 'outline'} onClick={() => { setVentaEditar(null); setModalVenta(true) }}>
              <Ic n="mas" /> Registrar venta
            </Button>
          )}
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 [scrollbar-width:none]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setConfirmandoEliminar(null) }}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.id ? 'border-green-700 text-green-900' : 'border-transparent text-gray-500 hover:text-gray-800'
            )}
          >
            <Ic n={t.icon} className={cn('size-4', tab === t.id ? 'text-green-700' : 'text-gray-400')} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros: los mismos para las tres pestañas */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={anioFiltro} onValueChange={v => { setAnioFiltro(v ?? 'todos'); setMesFiltro('todos') }}
          items={{ todos: 'Todos los años', ...Object.fromEntries(aniosDisponibles.map(a => [a, a])) }}>
          <SelectTrigger className="h-8 w-36 bg-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los años</SelectItem>
            {aniosDisponibles.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mesFiltro} onValueChange={v => setMesFiltro(v ?? 'todos')}
          items={{ todos: 'Todos los meses', ...Object.fromEntries(mesesDisponibles.map(m => [m, nombreMes(m)])) }}>
          <SelectTrigger className="h-8 w-44 bg-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {mesesDisponibles.map(m => <SelectItem key={m} value={m}>{nombreMes(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={loteFiltro} onValueChange={v => setLoteFiltro(v ?? 'todos')} items={opcionesLote}>
          <SelectTrigger className="h-8 w-48 bg-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {Object.entries(opcionesLote).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-gray-500">{etiquetaPeriodo}</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Cifras del período, pequeñas como en un control de costos */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cifra etiqueta="Ventas" valor={cop(totalIngresos)} tono="text-green-700" />
            <Cifra etiqueta="Costos" valor={cop(totalCostos)} tono="text-orange-700" />
            <Cifra etiqueta="Utilidad" valor={cop(utilidad)} tono={utilidad < 0 ? 'text-red-700' : 'text-gray-900'} />
            <Cifra etiqueta="Margen" valor={pct(utilidad, totalIngresos)} tono={utilidad < 0 ? 'text-red-700' : 'text-gray-900'}
              detalle={totalIngresos > 0 ? 'utilidad sobre ventas' : 'sin ventas en el período'} />
          </div>

          {tab === 'general' && (
            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Utilidad mes a mes</CardTitle>
                  <BarraExportar
                    titulo={`Utilidad mes a mes ${fincaActual?.nombre ?? ''}`}
                    imprimir={refMes}
                    vista={vistaMes}
                    onVista={setVistaMes}
                    hojas={() => [{
                      nombre: 'Utilidad por mes',
                      columnas: ['Mes', 'Ventas', 'Costos', 'Utilidad', 'Margen %'],
                      filas: porMes.map(m => [nombreMes(m.mes), m.ingresos, m.costos, m.utilidad, m.ingresos > 0 ? Math.round((m.utilidad / m.ingresos) * 1000) / 10 : null]),
                    }]}
                  />
                </CardHeader>
                <CardContent className="p-0" ref={refMes}>
                  {porMes.length === 0 ? <Vacio texto="Sin movimientos con estos filtros" /> : vistaMes === 'grafica' ? (
                    <div className="h-72 p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...porMes].reverse().map(m => ({ mes: nombreMes(m.mes), Ventas: m.ingresos, Costos: m.costos, Utilidad: m.utilidad }))} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(Number(v) / 1000).toLocaleString('es-CO')}k`} />
                          <Tooltip formatter={v => cop(Number(v))} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Ventas" fill="#86EFAC" />
                          <Bar dataKey="Costos" fill="#FCA5A5" />
                          <Bar dataKey="Utilidad" fill="#15803D" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mes</TableHead>
                            <TableHead className="text-right">Ventas</TableHead>
                            <TableHead className="text-right">Costos</TableHead>
                            <TableHead className="text-right">Utilidad</TableHead>
                            <TableHead className="text-right">Margen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {porMes.map(m => (
                            <TableRow key={m.mes}>
                              <TableCell className="py-2 text-sm">{nombreMes(m.mes)}</TableCell>
                              <TableCell className="py-2 text-right text-sm tabular-nums">{cop(m.ingresos)}</TableCell>
                              <TableCell className="py-2 text-right text-sm tabular-nums">{cop(m.costos)}</TableCell>
                              <TableCell className={cn('py-2 text-right text-sm font-semibold tabular-nums', m.utilidad < 0 && 'text-red-700')}>{cop(m.utilidad)}</TableCell>
                              <TableCell className="py-2 text-right text-sm text-gray-500 tabular-nums">{pct(m.utilidad, m.ingresos)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell className="py-2 text-sm font-semibold">Total</TableCell>
                            <TableCell className="py-2 text-right text-sm font-semibold tabular-nums">{cop(totalIngresos)}</TableCell>
                            <TableCell className="py-2 text-right text-sm font-semibold tabular-nums">{cop(totalCostos)}</TableCell>
                            <TableCell className={cn('py-2 text-right text-sm font-semibold tabular-nums', utilidad < 0 && 'text-red-700')}>{cop(utilidad)}</TableCell>
                            <TableCell className="py-2 text-right text-sm text-gray-500 tabular-nums">{pct(utilidad, totalIngresos)}</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Por {lugar}</CardTitle>
                  <p className="text-xs text-gray-400">Los gastos de toda la finca van aparte: no son de un {lugar} en particular.</p>
                </CardHeader>
                <CardContent className="p-0">
                  {porLote.length === 0 ? <Vacio texto="Sin movimientos con estos filtros" /> : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="capitalize">{lugar}</TableHead>
                            <TableHead className="text-right">Ventas</TableHead>
                            <TableHead className="text-right">Costos</TableHead>
                            <TableHead className="text-right">Utilidad</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {porLote.map(l => (
                            <TableRow key={l.clave}>
                              <TableCell className={cn('py-2 text-sm font-medium', l.clave === FINCA ? 'text-gray-500' : 'text-gray-800')}>{l.nombre}</TableCell>
                              <TableCell className="py-2 text-right text-sm tabular-nums">{cop(l.ingresos)}</TableCell>
                              <TableCell className="py-2 text-right text-sm tabular-nums">{cop(l.costos)}</TableCell>
                              <TableCell className={cn('py-2 text-right text-sm font-semibold tabular-nums', l.utilidad < 0 && 'text-red-700')}>{cop(l.utilidad)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {especie === 'aves_ponedoras' && fincaActual && (
                <div className="xl:col-span-2"><CostoHuevoGalpones finca={fincaActual} /></div>
              )}
            </div>
          )}

          {tab === 'costos' && (
            <>
              <div className="flex flex-wrap gap-2">
                {totalPorCategoria.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategoriaFiltro(prev => prev === cat.value ? null : cat.value)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition-colors',
                      categoriaFiltro === cat.value ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300',
                    )}
                  >
                    <p className="text-[0.6875rem] text-gray-500">{cat.label}</p>
                    <p className={cn('text-sm font-semibold tabular-nums', cat.total > 0 ? 'text-gray-900' : 'text-gray-300')}>{cat.total > 0 ? cop(cat.total) : '—'}</p>
                    {cat.total > 0 && <p className="text-[0.625rem] text-gray-400">{pct(cat.total, totalCostos)} del total</p>}
                  </button>
                ))}
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">
                    {categoriaFiltro ? `Costos · ${categorias.find(c => c.value === categoriaFiltro)?.label}` : 'Todos los costos'}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {categoriaFiltro && (
                      <button onClick={() => setCategoriaFiltro(null)} className="text-xs text-green-700 hover:underline">Ver todas las categorías</button>
                    )}
                    <BarraExportar
                      titulo={`Costos ${fincaActual?.nombre ?? ''}`}
                      imprimir={refCostos}
                      hojas={() => [{
                        nombre: 'Costos',
                        columnas: ['Fecha', lugar, 'Categoría', 'Descripción', 'Proveedor', 'Monto'],
                        filas: costosTabla.map(c => [c.fecha, nombreDe(c.lote_id), categoriaInfo(c.categoria)?.label ?? c.categoria, c.descripcion, c.proveedor, Number(c.monto)]),
                      }]}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0" ref={refCostos}>
                  {costosTabla.length === 0 ? <Vacio texto="Sin costos con estos filtros" /> : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="capitalize">{lugar}</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {costosTabla.map(c => {
                            const cat = categoriaInfo(c.categoria)
                            return (
                              <TableRow key={c.id}>
                                <TableCell className="py-2 text-sm whitespace-nowrap">{fmt(c.fecha)}</TableCell>
                                <TableCell className={cn('py-2 text-sm', c.lote_id ? 'font-medium text-gray-800' : 'text-gray-500')}>{nombreDe(c.lote_id)}</TableCell>
                                <TableCell className="py-2"><Badge className={`text-[10px] ${cat?.color ?? 'bg-gray-100 text-gray-600'}`}>{cat?.label ?? c.categoria}</Badge></TableCell>
                                <TableCell className="py-2 text-sm">{c.descripcion}</TableCell>
                                <TableCell className="py-2 text-sm text-gray-500">{c.proveedor ?? '—'}</TableCell>
                                <TableCell className="py-2 text-right text-sm font-semibold tabular-nums">{cop(Number(c.monto))}</TableCell>
                                <TableCell className="py-2">
                                  <Acciones
                                    confirmando={confirmandoEliminar === c.id}
                                    onEditar={() => { setCostoEditar(c); setModalCosto(true) }}
                                    onEliminar={() => eliminarCosto(c)}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={5} className="py-2 text-sm font-semibold">Total · {costosTabla.length} costo{costosTabla.length === 1 ? '' : 's'}</TableCell>
                            <TableCell className="py-2 text-right text-sm font-semibold tabular-nums">{cop(costosTabla.reduce((s, c) => s + Number(c.monto), 0))}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'ventas' && (
            <>
              <div className="flex flex-wrap gap-2">
                {totalPorTipo.map(t => (
                  <button
                    key={t.tipo}
                    onClick={() => setTipoVentaFiltro(prev => prev === t.tipo ? null : t.tipo)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition-colors',
                      tipoVentaFiltro === t.tipo ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300',
                    )}
                  >
                    <p className="text-[0.6875rem] text-gray-500">{t.label}</p>
                    <p className={cn('text-sm font-semibold tabular-nums', t.total > 0 ? 'text-gray-900' : 'text-gray-300')}>{t.total > 0 ? cop(t.total) : '—'}</p>
                    {t.total > 0 && <p className="text-[0.625rem] text-gray-400">{pct(t.total, totalIngresos)} de las ventas</p>}
                  </button>
                ))}
              </div>

              {especie === 'aves_ponedoras' && (
                <p className="text-xs text-gray-500">
                  El huevo cuenta el día en que entró el pago; las ventas y cobros de huevo se registran en{' '}
                  <Link href="/ventas" className="font-medium text-green-700 hover:underline">Ventas de la finca</Link>.
                  Al vender gallinas o pollas, salen del galpón.
                </p>
              )}

              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">
                    {tipoVentaFiltro ? `Ventas · ${TIPOS_INGRESO[tipoVentaFiltro].label}` : 'Todas las ventas'}
                  </CardTitle>
                  <BarraExportar
                    titulo={`Ventas ${fincaActual?.nombre ?? ''}`}
                    imprimir={refVentas}
                    hojas={() => [{
                      nombre: 'Ventas',
                      columnas: ['Fecha', lugar, 'Qué se vendió', 'Detalle', 'Monto'],
                      filas: ventasTabla.map(i => [i.fecha, nombreDe(i.lote_id), TIPOS_INGRESO[i.tipo].label, i.concepto, i.monto]),
                    }]}
                  />
                </CardHeader>
                <CardContent className="p-0" ref={refVentas}>
                  {ventasTabla.length === 0 ? <Vacio texto="Sin ventas con estos filtros" /> : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="capitalize">{lugar}</TableHead>
                            <TableHead>Qué se vendió</TableHead>
                            <TableHead>Detalle</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ventasTabla.map(i => (
                            <TableRow key={`${i.tipo}-${i.id}`}>
                              <TableCell className="py-2 text-sm whitespace-nowrap">{fmt(i.fecha)}</TableCell>
                              <TableCell className={cn('py-2 text-sm', i.lote_id ? 'font-medium text-gray-800' : 'text-gray-500')}>{nombreDe(i.lote_id)}</TableCell>
                              <TableCell className="py-2"><Badge className={`text-[10px] ${TIPOS_INGRESO[i.tipo].color}`}>{TIPOS_INGRESO[i.tipo].label}</Badge></TableCell>
                              <TableCell className="py-2 text-sm text-gray-600">{i.concepto}</TableCell>
                              <TableCell className="py-2 text-right text-sm font-semibold text-green-700 tabular-nums">{cop(i.monto)}</TableCell>
                              <TableCell className="py-2">
                                {i.ventaAves && (
                                  <Acciones
                                    confirmando={confirmandoEliminar === i.id}
                                    onEditar={() => { setVentaEditar(i.ventaAves!); setModalVenta(true) }}
                                    onEliminar={() => eliminarVenta(i.ventaAves!)}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={4} className="py-2 text-sm font-semibold">Total · {ventasTabla.length} venta{ventasTabla.length === 1 ? '' : 's'}</TableCell>
                            <TableCell className="py-2 text-right text-sm font-semibold tabular-nums">{cop(ventasTabla.reduce((s, i) => s + i.monto, 0))}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {fincaActual && especie && (
        <RegistrarCostoFincaModal
          open={modalCosto}
          onClose={() => { setModalCosto(false); setCostoEditar(null) }}
          fincaId={fincaActual.id}
          especie={especie}
          lotes={lotes}
          loteInicial={loteFiltro === 'todos' ? null : loteFiltro}
          costoExistente={costoEditar}
          onCreated={fetchTodo}
        />
      )}

      {fincaActual && especie === 'aves_ponedoras' && (
        <RegistrarVentaAvesModal
          open={modalVenta}
          onClose={() => { setModalVenta(false); setVentaEditar(null) }}
          fincaId={fincaActual.id}
          ventaExistente={ventaEditar}
          nombreLote={id => nombreLote.get(id) ?? '—'}
          onGuardado={fetchTodo}
        />
      )}
    </div>
  )
}

function Cifra({ etiqueta, valor, tono, detalle }: { etiqueta: string; valor: string; tono: string; detalle?: ReactNode }) {
  return (
    <div className="superficie rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className={cn('mt-0.5 text-lg font-semibold tabular-nums', tono)}>{valor}</p>
      {detalle && <p className="text-[0.6875rem] text-gray-400">{detalle}</p>}
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="py-10 text-center">
      <Ic n="dinero" className="mx-auto mb-2 size-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">{texto}</p>
    </div>
  )
}

function Acciones({ confirmando, onEditar, onEliminar }: { confirmando: boolean; onEditar: () => void; onEliminar: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={onEditar} title="Editar">
        <Ic n="editar" />
      </Button>
      <Button
        size="sm" variant="ghost"
        className={cn('h-7 px-2 text-xs', confirmando ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600')}
        onClick={onEliminar}
        title="Eliminar"
      >
        {confirmando ? '¿Confirmar?' : <Ic n="borrar" />}
      </Button>
    </div>
  )
}
