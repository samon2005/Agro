'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import RegistrarCostoModal from './RegistrarCostoModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CATEGORIAS_COSTO, categoriaInfo } from '@/lib/costos'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Costo = Database['public']['Tables']['costos_lote_aves']['Row']

interface Props { loteActual: LoteAves }

export default function TabCostos({ loteActual }: Props) {
  const supabase = createClient()
  const [costos, setCostos] = useState<Costo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [costoEditar, setCostoEditar] = useState<Costo | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [categoriaDialog, setCategoriaDialog] = useState<string | null>(null)
  const [mesFiltro, setMesFiltro] = useState('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('costos_lote_aves').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false })
    setCostos(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetch() }, [fetch])

  async function eliminar(costo: Costo) {
    if (confirmandoEliminar !== costo.id) { setConfirmandoEliminar(costo.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('costos_lote_aves').delete().eq('id', costo.id)
    if (error) { toast.error('Error al eliminar el costo'); return }
    setCostos(prev => prev.filter(c => c.id !== costo.id))
    toast.success('Costo eliminado')
  }

  const mesesDisponibles = Array.from(new Set(costos.map(c => c.fecha.slice(0, 7)))).sort().reverse()
  const costosDelMes = mesFiltro === 'todos' ? costos : costos.filter(c => c.fecha.slice(0, 7) === mesFiltro)
  const costosFiltrados = categoriaFiltro === 'todas'
    ? costosDelMes
    : costosDelMes.filter(c => c.categoria === categoriaFiltro || categoriaInfo(c.categoria)?.value === categoriaFiltro)

  const totalPorCategoria = CATEGORIAS_COSTO.map(cat => ({
    ...cat,
    total: costosDelMes
      .filter(c => c.categoria === cat.value || ('legacy' in cat && cat.legacy?.includes(c.categoria)))
      .reduce((sum, c) => sum + Number(c.monto), 0),
  }))
  const totalGeneral = costosFiltrados.reduce((sum, c) => sum + Number(c.monto), 0)

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  function cop(n: number) {
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-800">Insumos y Costos Operativos</h2>
        <div className="flex items-center gap-2">
          <Select value={mesFiltro} onValueChange={v => setMesFiltro(v ?? 'todos')}>
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
          <Select value={categoriaFiltro} onValueChange={v => setCategoriaFiltro(v ?? 'todas')}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {CATEGORIAS_COSTO.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setCostoEditar(null); setModalOpen(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">
            + Registrar costo
          </Button>
        </div>
      </div>

      {/* Trazabilidad del lote */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-green-700 mb-2">📋 Trazabilidad del Lote</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">Línea genética</p><p className="font-medium">{loteActual.linea_genetica ?? '—'}</p></div>
            <div><p className="text-xs text-gray-500">Inicio del lote</p><p className="font-medium">{fmt(loteActual.fecha_inicio)}</p></div>
            <div><p className="text-xs text-gray-500">Aves iniciales</p><p className="font-medium">{loteActual.aves_iniciales.toLocaleString('es-CO')}</p></div>
            <div><p className="text-xs text-gray-500">Origen</p><p className="font-medium">{loteActual.origen_aves ?? '—'}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen por categoría */}
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

      {/* Tabla de costos */}
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
              <Button onClick={() => setModalOpen(true)} className="mt-4 bg-green-700 hover:bg-green-800 text-white">+ Registrar costo</Button>
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
                            <Button
                              size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500"
                              onClick={() => { setCostoEditar(c); setModalOpen(true) }}
                            >
                              ✏️
                            </Button>
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

      <RegistrarCostoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setCostoEditar(null) }}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        costoExistente={costoEditar}
        onCreated={fetch}
      />

      <Dialog open={categoriaDialog != null} onOpenChange={v => !v && setCategoriaDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {categoriaDialog && (() => {
            const cat = CATEGORIAS_COSTO.find(c => c.value === categoriaDialog)
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
