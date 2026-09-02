'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import RegistrarCostoGenericoModal from './RegistrarCostoGenericoModal'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { categoriasCosto, categoriasCostoItems, categoriaInfo } from '@/lib/costos'
import {
  dbGenerico, totalVentaAnimales,
  type ConfigEspecie, type CostoGenerico, type VentaGenerica,
} from '@/lib/especiesConfig'

interface Props {
  loteId: string
  fincaId: string
  config: ConfigEspecie
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TabCostosGenerico({ loteId, fincaId, config }: Props) {
  const supabase = createClient()
  const [costos, setCostos] = useState<CostoGenerico[]>([])
  const [ventas, setVentas] = useState<VentaGenerica[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [costoEditar, setCostoEditar] = useState<CostoGenerico | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [categoriaDialog, setCategoriaDialog] = useState<string | null>(null)
  const [anioFiltro, setAnioFiltro] = useState('todos')
  const [mesFiltro, setMesFiltro] = useState('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [soloUtilidad, setSoloUtilidad] = useState(false)

  const categorias = categoriasCosto(config.categoriaCria)

  const fetchDatos = useCallback(async () => {
    setLoading(true)
    const db = dbGenerico(supabase)
    const [costosRes, ventasRes] = await Promise.all([
      db.from(config.tablas.costos).select('*').eq('lote_id', loteId).order('fecha', { ascending: false }),
      db.from(config.tablas.ventas).select('*').eq('lote_id', loteId),
    ])
    setCostos((costosRes.data ?? []) as CostoGenerico[])
    setVentas((ventasRes.data ?? []) as VentaGenerica[])
    setLoading(false)
  }, [loteId, supabase, config.tablas.costos, config.tablas.ventas])

  useEffect(() => { fetchDatos() }, [fetchDatos])

  async function eliminar(costo: CostoGenerico) {
    if (confirmandoEliminar !== costo.id) { setConfirmandoEliminar(costo.id); return }
    setConfirmandoEliminar(null)
    const { error } = await dbGenerico(supabase).from(config.tablas.costos).delete().eq('id', costo.id)
    if (error) { toast.error('Error al eliminar el costo'); return }
    setCostos(prev => prev.filter(c => c.id !== costo.id))
    toast.success('Costo eliminado')
  }

  const aniosDisponibles = Array.from(new Set(costos.map(c => c.fecha.slice(0, 4)))).sort().reverse()
  const costosDelAnio = anioFiltro === 'todos' ? costos : costos.filter(c => c.fecha.slice(0, 4) === anioFiltro)
  const mesesDisponibles = Array.from(new Set(costosDelAnio.map(c => c.fecha.slice(0, 7)))).sort().reverse()
  const costosDelMes = mesFiltro === 'todos' ? costosDelAnio : costosDelAnio.filter(c => c.fecha.slice(0, 7) === mesFiltro)
  const costosFiltrados = categoriaFiltro === 'todas'
    ? costosDelMes
    : costosDelMes.filter(c => c.categoria === categoriaFiltro || categoriaInfo(c.categoria)?.value === categoriaFiltro)

  const categoriasAMostrar = categoriaFiltro === 'todas' ? categorias : categorias.filter(c => c.value === categoriaFiltro)
  const totalPorCategoria = categoriasAMostrar.map(cat => ({
    ...cat,
    total: costosDelMes
      .filter(c => c.categoria === cat.value || cat.legacy?.includes(c.categoria))
      .reduce((sum, c) => sum + Number(c.monto), 0),
  }))
  const totalGeneral = costosFiltrados.reduce((sum, c) => sum + Number(c.monto), 0)

  const ventasDelAnio = anioFiltro === 'todos' ? ventas : ventas.filter(v => v.fecha.slice(0, 4) === anioFiltro)
  const ventasDelMes = mesFiltro === 'todos' ? ventasDelAnio : ventasDelAnio.filter(v => v.fecha.slice(0, 7) === mesFiltro)
  const ingresoTotal = ventasDelMes.reduce((s, v) => s + totalVentaAnimales(v), 0)
  const costoTotalPeriodo = costosDelMes.reduce((s, c) => s + Number(c.monto), 0)
  const utilidad = ingresoTotal - costoTotalPeriodo

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h2 className="text-base font-semibold text-gray-800">Resumen Financiero</h2>
          <button
            type="button"
            onClick={() => setSoloUtilidad(v => !v)}
            className={`text-xs rounded-full px-2.5 py-1 border ${soloUtilidad ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            {soloUtilidad ? '✓ Solo utilidad' : 'Ver solo utilidad'}
          </button>
        </div>
        <div className={soloUtilidad ? 'grid grid-cols-1' : 'grid grid-cols-3 gap-3'}>
          {!soloUtilidad && (
            <>
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="p-4">
                  <p className="text-xs text-emerald-700 font-medium">Ingresos por ventas</p>
                  <p className="text-xl font-bold text-emerald-800">{cop(ingresoTotal)}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <p className="text-xs text-red-700 font-medium">Costos</p>
                  <p className="text-xl font-bold text-red-800">{cop(costoTotalPeriodo)}</p>
                </CardContent>
              </Card>
            </>
          )}
          <Card className={utilidad >= 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
            <CardContent className="p-4">
              <p className={`text-xs font-medium ${utilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>Utilidad</p>
              <p className={`text-xl font-bold ${utilidad >= 0 ? 'text-green-800' : 'text-red-800'}`}>{cop(utilidad)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-800">Insumos y Costos Operativos</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={anioFiltro}
            onValueChange={v => { setAnioFiltro(v ?? 'todos'); setMesFiltro('todos') }}
            items={{ todos: 'Todos los años', ...Object.fromEntries(aniosDisponibles.map(a => [a, a])) }}
          >
            <SelectTrigger className="w-32"><SelectValue placeholder="Año" /></SelectTrigger>
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
            <SelectTrigger className="w-40"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los meses</SelectItem>
              {mesesDisponibles.map(m => (
                <SelectItem key={m} value={m}>
                  {new Date(m + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoriaFiltro}
            onValueChange={v => setCategoriaFiltro(v ?? 'todas')}
            items={{ todas: 'Todas las categorías', ...categoriasCostoItems(config.categoriaCria) }}
          >
            <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setCostoEditar(null); setModalOpen(true) }} className={cn('text-sm', config.botonClase)}>
            + Registrar costo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {totalPorCategoria.map(cat => (
          <Card
            key={cat.value}
            className={cn('cursor-pointer hover:border-green-400 transition-colors', cat.total > 0 ? '' : 'opacity-50')}
            onClick={() => setCategoriaDialog(cat.value)}
          >
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">{cat.emoji} {cat.label}</p>
              <p className="text-base font-bold text-gray-800 mt-0.5">{cat.total > 0 ? cop(cat.total) : '—'}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-green-300 bg-green-50 col-span-2 md:col-span-4">
          <CardContent className="p-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-green-800">💰 Total Acumulado</p>
            <p className="text-xl font-bold text-green-800">{cop(totalGeneral)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Detalle de Costos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : costosFiltrados.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-4xl mb-2">💰</p>
              <p className="text-gray-600 font-medium">Sin costos registrados{mesFiltro !== 'todos' ? ' en este mes' : ''}</p>
              <Button onClick={() => setModalOpen(true)} className={cn('mt-4', config.botonClase)}>+ Registrar costo</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
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
                        <TableCell>
                          <Badge
                            className={`text-[10px] cursor-pointer ${cat?.color ?? 'bg-gray-100 text-gray-600'}`}
                            onClick={() => setCategoriaDialog(cat?.value ?? c.categoria)}
                          >
                            {cat?.emoji} {cat?.label ?? c.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{c.descripcion}</TableCell>
                        <TableCell className="text-sm text-gray-500">{c.proveedor ?? '—'}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{cop(Number(c.monto))}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setCostoEditar(c); setModalOpen(true) }}>✏️</Button>
                            <Button
                              size="sm" variant="ghost"
                              className={cn('h-7 px-2 text-xs', confirmandoEliminar === c.id ? 'text-white bg-red-600 hover:bg-red-700' : 'text-red-600')}
                              onClick={() => eliminar(c)}
                            >
                              {confirmandoEliminar === c.id ? '¿Confirmar?' : '🗑️'}
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

      <RegistrarCostoGenericoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setCostoEditar(null) }}
        loteId={loteId}
        fincaId={fincaId}
        config={config}
        costoExistente={costoEditar}
        onCreated={fetchDatos}
      />

      <Dialog open={categoriaDialog != null} onOpenChange={v => !v && setCategoriaDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {categoriaDialog && (() => {
            const cat = categorias.find(c => c.value === categoriaDialog)
            const items = costosDelMes.filter(c => c.categoria === categoriaDialog || categoriaInfo(c.categoria)?.value === categoriaDialog)
            const total = items.reduce((s, c) => s + Number(c.monto), 0)
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{cat?.emoji} {cat?.label ?? categoriaDialog}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm font-medium text-green-800">Total {mesFiltro === 'todos' ? '' : 'del mes'}</span>
                  <span className="text-lg font-bold text-green-800">{cop(total)}</span>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Sin costos en esta categoría</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {items.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-1.5">
                        <div>
                          <p className="font-medium">{c.descripcion}</p>
                          <p className="text-xs text-gray-400">{fmt(c.fecha)}{c.proveedor ? ` · ${c.proveedor}` : ''}</p>
                        </div>
                        <span className="font-semibold">{cop(Number(c.monto))}</span>
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
