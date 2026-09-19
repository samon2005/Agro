'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRol } from '@/components/agro/RolProvider'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import RegistrarCostoFincaModal, { type LoteFinanzas } from '@/components/agro/finanzas/RegistrarCostoFincaModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Indicador } from '@/components/ui/indicador'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { CATEGORIAS_COSTO, categoriaInfo, type CategoriaCosto } from '@/lib/costos'
import { CONFIG_ESPECIES, dbGenerico, totalVentaAnimales, type CostoGenerico, type VentaGenerica } from '@/lib/especiesConfig'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import { cop } from '@/lib/huevos'

type Costo = CostoGenerico & { especie: EspecieFinca }
/** Dinero que entró: pagos de huevo (aves) y ventas de animales (cerdos, pollo). */
interface Ingreso { id: string; fecha: string; monto: number; lote_id: string; especie: EspecieFinca; concepto: string }

const CATEGORIAS_TODAS: CategoriaCosto[] = [
  ...CATEGORIAS_COSTO,
  { value: 'lechones', label: 'Lechones', emoji: '', color: 'bg-pink-100 text-pink-700' },
  { value: 'pollitos', label: 'Pollitos', emoji: '', color: 'bg-yellow-100 text-yellow-700' },
]

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function nombreMes(m: string) {
  return new Date(m + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

/**
 * Finanzas de toda la finca: ingresos que ya entraron, costos y utilidad, con filtro
 * por animal y por galpón o corral. Los costos se cargan siempre a un lote.
 */
export default function FinanzasPage() {
  const supabase = createClient()
  const { fincaActual, loading: fincaLoading } = useFinca()
  const rol = useRol()

  const [lotes, setLotes] = useState<LoteFinanzas[]>([])
  const [costos, setCostos] = useState<Costo[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loading, setLoading] = useState(true)

  const [especieFiltro, setEspecieFiltro] = useState<'todas' | EspecieFinca>('todas')
  const [loteFiltro, setLoteFiltro] = useState('todos')
  const [anioFiltro, setAnioFiltro] = useState('todos')
  const [mesFiltro, setMesFiltro] = useState('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')

  const [modalOpen, setModalOpen] = useState(false)
  const [costoEditar, setCostoEditar] = useState<Costo | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [categoriaDialog, setCategoriaDialog] = useState<string | null>(null)

  const especiesFinca = ESPECIES_FINCA.filter(e => (fincaActual?.tipo_produccion ?? []).includes(e.value))
  const especiesKey = especiesFinca.map(e => e.value).join(',')

  const fetchTodo = useCallback(async () => {
    if (!fincaActual) return
    setLoading(true)
    const db = dbGenerico(supabase)
    const especies = especiesKey ? (especiesKey.split(',') as EspecieFinca[]) : []

    const porEspecie = await Promise.all(especies.map(async especie => {
      const t = CONFIG_ESPECIES[especie].tablas
      const [lotesRes, costosRes, ventasRes, pagosRes] = await Promise.all([
        db.from(t.lotes).select('id, nombre').eq('finca_id', fincaActual.id).order('created_at', { ascending: false }),
        db.from(t.costos).select('*').eq('finca_id', fincaActual.id).order('fecha', { ascending: false }),
        db.from(t.ventas).select('*').eq('finca_id', fincaActual.id),
        especie === 'aves_ponedoras'
          ? db.from('pagos_ventas_huevos').select('*').eq('finca_id', fincaActual.id)
          : Promise.resolve({ data: [] }),
      ])
      const lotesEsp: LoteFinanzas[] = ((lotesRes.data ?? []) as { id: string; nombre: string }[])
        .map(l => ({ id: l.id, nombre: l.nombre, especie }))
      const costosEsp: Costo[] = ((costosRes.data ?? []) as CostoGenerico[]).map(c => ({ ...c, especie }))

      let ingresosEsp: Ingreso[]
      if (especie === 'aves_ponedoras') {
        // En huevo solo cuenta lo que ya se pagó, en la fecha en que entró el dinero
        const loteDeVenta = new Map(((ventasRes.data ?? []) as { id: string; lote_id: string }[]).map(v => [v.id, v.lote_id]))
        ingresosEsp = ((pagosRes.data ?? []) as { id: string; venta_id: string; fecha: string; monto: number; titular: string }[])
          .filter(p => loteDeVenta.has(p.venta_id))
          .map(p => ({ id: p.id, fecha: p.fecha, monto: Number(p.monto), lote_id: loteDeVenta.get(p.venta_id)!, especie, concepto: `Pago de huevo · ${p.titular}` }))
      } else {
        ingresosEsp = ((ventasRes.data ?? []) as VentaGenerica[])
          .map(v => ({ id: v.id, fecha: v.fecha, monto: totalVentaAnimales(v), lote_id: v.lote_id, especie, concepto: `Venta de ${v.cantidad} ${CONFIG_ESPECIES[especie].animalPlural}` }))
      }
      return { lotesEsp, costosEsp, ingresosEsp }
    }))

    setLotes(porEspecie.flatMap(p => p.lotesEsp))
    setCostos(porEspecie.flatMap(p => p.costosEsp).sort((a, b) => b.fecha.localeCompare(a.fecha)))
    setIngresos(porEspecie.flatMap(p => p.ingresosEsp))
    setLoading(false)
  }, [fincaActual, especiesKey, supabase])

  useEffect(() => { fetchTodo() }, [fetchTodo])

  if (fincaLoading) return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>
  if (rol === 'trabajador') return <div className="p-8"><AccesoRestringido /></div>

  const nombreLote = new Map(lotes.map(l => [l.id, l.nombre]))
  const lotesDeEspecie = especieFiltro === 'todas' ? lotes : lotes.filter(l => l.especie === especieFiltro)

  // ── Filtros: animal → galpón → año → mes (la categoría solo aplica a costos) ──
  function pasaFiltros<T extends { fecha: string; lote_id: string; especie: EspecieFinca }>(x: T) {
    if (especieFiltro !== 'todas' && x.especie !== especieFiltro) return false
    if (loteFiltro !== 'todos' && x.lote_id !== loteFiltro) return false
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
  const mismaCategoria = (c: Costo, cat: string) => c.categoria === cat || categoriaInfo(c.categoria)?.value === cat
  const costosFiltrados = categoriaFiltro === 'todas' ? costosPeriodo : costosPeriodo.filter(c => mismaCategoria(c, categoriaFiltro))

  const totalIngresos = ingresosPeriodo.reduce((s, i) => s + i.monto, 0)
  const totalCostos = costosPeriodo.reduce((s, c) => s + Number(c.monto), 0)
  const utilidad = totalIngresos - totalCostos

  // Categorías que aplican a los animales que se están viendo
  const criasVisibles = new Set(
    (especieFiltro === 'todas' ? especiesFinca.map(e => e.value) : [especieFiltro]).map(e => CONFIG_ESPECIES[e].categoriaCria)
  )
  const categoriasVisibles = CATEGORIAS_TODAS.filter(c => !['pollitas', 'lechones', 'pollitos'].includes(c.value) || criasVisibles.has(c.value))
  const totalPorCategoria = categoriasVisibles
    .filter(c => categoriaFiltro === 'todas' || c.value === categoriaFiltro)
    .map(cat => ({ ...cat, total: costosPeriodo.filter(c => mismaCategoria(c, cat.value)).reduce((s, c) => s + Number(c.monto), 0) }))

  const loteSeleccionado = loteFiltro !== 'todos' ? loteFiltro : null
  const etiquetaPeriodo = mesFiltro !== 'todos' ? nombreMes(mesFiltro) : anioFiltro !== 'todos' ? anioFiltro : 'Todo el tiempo'

  async function eliminar(c: Costo) {
    if (confirmandoEliminar !== c.id) { setConfirmandoEliminar(c.id); return }
    setConfirmandoEliminar(null)
    const { error } = await dbGenerico(supabase).from(CONFIG_ESPECIES[c.especie].tablas.costos).delete().eq('id', c.id)
    if (error) { toast.error('Error al eliminar el costo'); return }
    setCostos(prev => prev.filter(x => x.id !== c.id))
    toast.success('Costo eliminado')
  }

  const itemsEspecie = { todas: 'Todos los animales', ...Object.fromEntries(especiesFinca.map(e => [e.value, e.labelNav ?? e.label])) }
  const itemsLote = { todos: 'Todos los galpones', ...Object.fromEntries(lotesDeEspecie.map(l => [l.id, l.nombre])) }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl font-medium text-gray-900">Finanzas</h2>
          <p className="mt-1 text-gray-500">
            {fincaActual ? `${fincaActual.nombre} · ingresos, costos y utilidad de toda la finca` : 'Selecciona una finca'}
          </p>
        </div>
        <Button onClick={() => { setCostoEditar(null); setModalOpen(true) }} disabled={lotes.length === 0}>
          <Ic n="mas" /> Registrar costo
        </Button>
      </div>

      {/* Filtros */}
      <div className="superficie flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <Select
          value={especieFiltro}
          onValueChange={v => { setEspecieFiltro((v ?? 'todas') as 'todas' | EspecieFinca); setLoteFiltro('todos') }}
          items={itemsEspecie}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Animal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los animales</SelectItem>
            {especiesFinca.map(e => <SelectItem key={e.value} value={e.value}>{e.labelNav ?? e.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={loteFiltro} onValueChange={v => setLoteFiltro(v ?? 'todos')} items={itemsLote}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Galpón" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los galpones</SelectItem>
            {lotesDeEspecie.map(l => <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={anioFiltro}
          onValueChange={v => { setAnioFiltro(v ?? 'todos'); setMesFiltro('todos') }}
          items={{ todos: 'Todos los años', ...Object.fromEntries(aniosDisponibles.map(a => [a, a])) }}
        >
          <SelectTrigger className="w-36"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los años</SelectItem>
            {aniosDisponibles.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={mesFiltro}
          onValueChange={v => setMesFiltro(v ?? 'todos')}
          items={{ todos: 'Todos los meses', ...Object.fromEntries(mesesDisponibles.map(m => [m, nombreMes(m)])) }}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {mesesDisponibles.map(m => <SelectItem key={m} value={m}>{nombreMes(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={categoriaFiltro}
          onValueChange={v => setCategoriaFiltro(v ?? 'todas')}
          items={{ todas: 'Todas las categorías', ...Object.fromEntries(categoriasVisibles.map(c => [c.value, c.label])) }}
        >
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categoriasVisibles.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Indicador tono="green" icono="tendencia" etiqueta="Ingresos" valor={cop(totalIngresos)} detalle={`${etiquetaPeriodo} · solo dinero que ya entró`} />
            <Indicador tono="orange" icono="recibo" etiqueta="Costos" valor={cop(totalCostos)} detalle={etiquetaPeriodo} />
            <Indicador
              tono={utilidad >= 0 ? 'green' : 'red'}
              icono="dinero"
              etiqueta="Utilidad"
              valor={<span className={utilidad < 0 ? 'text-red-700' : undefined}>{cop(utilidad)}</span>}
              detalle={utilidad < 0 ? 'Los costos superan los ingresos' : etiquetaPeriodo}
            />
          </div>

          {/* Costos por categoría */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {totalPorCategoria.map(cat => (
              <Card
                key={cat.value}
                className={cn('cursor-pointer transition-shadow hover:shadow-md', cat.total > 0 ? '' : '[&_p]:text-gray-400')}
                onClick={() => setCategoriaDialog(cat.value)}
              >
                <CardContent className="p-3">
                  <p className="text-xs text-gray-500">{cat.label}</p>
                  <p className="mt-0.5 text-base font-semibold text-gray-800 tabular-nums">{cat.total > 0 ? cop(cat.total) : '—'}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detalle de costos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Detalle de costos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {costosFiltrados.length === 0 ? (
                <div className="py-10 text-center">
                  <Ic n="dinero" className="mx-auto mb-2 size-8 text-gray-300" />
                  <p className="font-medium text-gray-600">Sin costos con estos filtros</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Galpón</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costosFiltrados.map(c => {
                        const cat = categoriaInfo(c.categoria)
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-sm">{fmt(c.fecha)}</TableCell>
                            <TableCell className="text-sm">
                              <span className="font-medium text-gray-800">{nombreLote.get(c.lote_id) ?? '—'}</span>
                              {especieFiltro === 'todas' && especiesFinca.length > 1 && (
                                <span className="block text-[0.6875rem] text-gray-500">{CONFIG_ESPECIES[c.especie].label}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${cat?.color ?? 'bg-gray-100 text-gray-600'}`}>{cat?.label ?? c.categoria}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{c.descripcion}</TableCell>
                            <TableCell className="text-sm text-gray-500">{c.proveedor ?? '—'}</TableCell>
                            <TableCell className="text-right text-sm font-semibold tabular-nums">{cop(Number(c.monto))}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setCostoEditar(c); setModalOpen(true) }}>
                                  <Ic n="editar" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className={cn('h-7 px-2 text-xs', confirmandoEliminar === c.id ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600')}
                                  onClick={() => eliminar(c)}
                                >
                                  {confirmandoEliminar === c.id ? '¿Confirmar?' : <Ic n="borrar" />}
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

          {/* Ingresos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Ingresos</CardTitle>
              <p className="text-xs text-gray-500">En huevo cuenta el día en que entró el pago; las ventas sin pagar no suman.</p>
            </CardHeader>
            <CardContent className="p-0">
              {ingresosPeriodo.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">Sin ingresos con estos filtros</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Galpón</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...ingresosPeriodo].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(i => (
                        <TableRow key={i.id}>
                          <TableCell className="text-sm">{fmt(i.fecha)}</TableCell>
                          <TableCell className="text-sm font-medium text-gray-800">{nombreLote.get(i.lote_id) ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-600">{i.concepto}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-green-700 tabular-nums">{cop(i.monto)}</TableCell>
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

      {fincaActual && (
        <RegistrarCostoFincaModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setCostoEditar(null) }}
          fincaId={fincaActual.id}
          lotes={lotesDeEspecie.length > 0 ? lotesDeEspecie : lotes}
          loteInicial={loteSeleccionado}
          costoExistente={costoEditar}
          onCreated={fetchTodo}
        />
      )}

      <Dialog open={categoriaDialog != null} onOpenChange={v => !v && setCategoriaDialog(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          {categoriaDialog && (() => {
            const cat = CATEGORIAS_TODAS.find(c => c.value === categoriaDialog)
            const items = costosPeriodo.filter(c => mismaCategoria(c, categoriaDialog))
            const total = items.reduce((s, c) => s + Number(c.monto), 0)
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{cat?.label ?? categoriaDialog}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
                  <span className="text-sm font-medium text-green-800">Total · {etiquetaPeriodo}</span>
                  <span className="text-lg font-semibold text-green-800 tabular-nums">{cop(total)}</span>
                </div>
                {items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-500">Sin costos en esta categoría</p>
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto">
                    {items.map(c => (
                      <div key={c.id} className="flex items-center justify-between border-b border-gray-100 pb-1.5 text-sm">
                        <div>
                          <p className="font-medium">{c.descripcion}</p>
                          <p className="text-xs text-gray-400">{fmt(c.fecha)} · {nombreLote.get(c.lote_id) ?? '—'}{c.proveedor ? ` · ${c.proveedor}` : ''}</p>
                        </div>
                        <span className="font-semibold tabular-nums">{cop(Number(c.monto))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
