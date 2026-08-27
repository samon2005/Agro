'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import RegistrarInventarioModal from '@/components/agro/RegistrarInventarioModal'
import EquiposInventario from '@/components/agro/EquiposInventario'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { EspecieFinca } from '@/lib/especies'

type Item = {
  id: string
  nombre: string
  descripcion: string | null
  unidad_medida: string | null
  cantidad_actual: number
  cantidad_minima: number
  precio_unitario: number | null
  proveedor: string | null
  fecha_vencimiento: string | null
  inventario_categorias: { nombre: string; color: string } | null
}

export default function InventarioPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [tab, setTab] = useState<'insumos' | 'equipos'>('insumos')
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  async function fetchInventario() {
    if (!fincaActual) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('inventario')
      .select('*, inventario_categorias(nombre, color)')
      .eq('finca_id', fincaActual.id)
      .order('nombre')
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchInventario() }, [fincaActual])

  async function eliminarItem(id: string) {
    if (confirmandoId !== id) {
      setConfirmandoId(id)
      return
    }
    setConfirmandoId(null)
    setBorrandoId(id)
    const item = items.find(i => i.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('inventario').delete().eq('id', id)
    if (error) {
      toast.error('Error al eliminar el ítem')
    } else {
      setItems(prev => prev.filter(i => i.id !== id))
      toast.success(`Ítem eliminado del inventario: ${item?.nombre ?? ''}`)
    }
    setBorrandoId(null)
  }

  const stockBajo = items.filter(i => i.cantidad_actual <= i.cantidad_minima && i.cantidad_minima > 0)
  const porVencer = items.filter(i => {
    if (!i.fecha_vencimiento) return false
    const diff = (new Date(i.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff <= 30 && diff >= 0
  })

  if (fincaLoading) return <PageSkeleton />

  return (
    <>
      <RegistrarInventarioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        fincaId={fincaActual?.id ?? ''}
        onCreated={fetchInventario}
      />

      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>📦</span> Gestión de Inventario
            </h2>
            <p className="text-gray-500 mt-1">
              {fincaActual ? `Finca: ${fincaActual.nombre}` : 'Selecciona una finca'}
            </p>
          </div>
          {tab === 'insumos' && (
            <Button
              className="bg-green-700 hover:bg-green-800 text-white"
              onClick={() => setModalOpen(true)}
              disabled={!fincaActual}
            >
              + Agregar Ítem
            </Button>
          )}
        </div>

        <div className="flex gap-2 border-b border-gray-200 mb-6">
          {([
            { id: 'insumos' as const, label: '📦 Insumos' },
            { id: 'equipos' as const, label: '⚙️ Equipos' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'equipos' ? (
          fincaActual ? (
            <EquiposInventario fincaId={fincaActual.id} especies={(fincaActual.tipo_produccion ?? []) as EspecieFinca[]} />
          ) : null
        ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4 pb-4 flex justify-between items-center">
              <span className="text-sm text-blue-700 font-medium">Total Ítems</span>
              <Badge className="bg-blue-700 text-white">{items.length}</Badge>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 pb-4 flex justify-between items-center">
              <span className="text-sm text-red-700 font-medium">Stock Bajo</span>
              <Badge className="bg-red-600 text-white">{stockBajo.length}</Badge>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4 pb-4 flex justify-between items-center">
              <span className="text-sm text-orange-700 font-medium">Por Vencer (30 días)</span>
              <Badge className="bg-orange-600 text-white">{porVencer.length}</Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventario General</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-5xl mb-4">📦</span>
                <p className="text-lg font-semibold text-gray-700">Inventario vacío</p>
                <p className="text-sm text-gray-400 mt-1 mb-6">Registra los insumos y materiales de tu finca</p>
                <Button className="bg-green-700 hover:bg-green-800 text-white" onClick={() => setModalOpen(true)}>
                  Agregar Primer Ítem
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Precio Unit.</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => {
                    const bajo = item.cantidad_actual <= item.cantidad_minima && item.cantidad_minima > 0
                    const venceProximo = item.fecha_vencimiento && (() => {
                      const diff = (new Date(item.fecha_vencimiento!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      return diff <= 30 && diff >= 0
                    })()

                    return (
                      <TableRow key={item.id} className={bajo ? 'bg-red-50' : ''}>
                        <TableCell>
                          <p className="font-medium">{item.nombre}</p>
                          {item.descripcion && <p className="text-xs text-gray-400">{item.descripcion}</p>}
                        </TableCell>
                        <TableCell>
                          {item.inventario_categorias ? (
                            <Badge variant="secondary">{item.inventario_categorias.nombre}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className={`font-semibold ${bajo ? 'text-red-600' : 'text-gray-900'}`}>
                          {item.cantidad_actual} {item.unidad_medida ?? ''}
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {item.cantidad_minima} {item.unidad_medida ?? ''}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.precio_unitario ? `$${item.precio_unitario.toLocaleString('es-CO')}` : '—'}
                        </TableCell>
                        <TableCell className={`text-sm ${venceProximo ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                          {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString('es-CO') : '—'}
                        </TableCell>
                        <TableCell>
                          {bajo ? (
                            <Badge className="bg-red-100 text-red-700">Stock bajo</Badge>
                          ) : venceProximo ? (
                            <Badge className="bg-orange-100 text-orange-700">Por vencer</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {confirmandoId === item.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={borrandoId === item.id} onClick={() => eliminarItem(item.id)}>
                                Confirmar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmandoId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                              onClick={() => eliminarItem(item.id)}
                            >
                              🗑️
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </>
        )}
      </div>
    </>
  )
}

function PageSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
