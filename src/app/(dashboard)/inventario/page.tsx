'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import RegistrarInventarioModal from '@/components/agro/RegistrarInventarioModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
          <Button
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={() => setModalOpen(true)}
            disabled={!fincaActual}
          >
            + Agregar Ítem
          </Button>
        </div>

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
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
