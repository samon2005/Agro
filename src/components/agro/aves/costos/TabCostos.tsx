'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import RegistrarCostoModal from './RegistrarCostoModal'
import CostosPredefinidosPanel from './CostosPredefinidosPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Costo = Database['public']['Tables']['costos_lote_aves']['Row']

interface Props { loteActual: LoteAves }

const CATEGORIAS = [
  { value: 'pollitas', label: 'Pollitas', emoji: '🐣', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'alimento', label: 'Alimento', emoji: '🌾', color: 'bg-orange-100 text-orange-700' },
  { value: 'servicios_publicos', label: 'Servicios públicos', emoji: '💡', color: 'bg-blue-100 text-blue-700', legacy: ['agua', 'energia'] },
  { value: 'mantenimiento', label: 'Mantenimiento', emoji: '🔧', color: 'bg-gray-100 text-gray-700' },
  { value: 'sanitario', label: 'Sanitario', emoji: '💉', color: 'bg-purple-100 text-purple-700' },
  { value: 'otro', label: 'Otro', emoji: '📋', color: 'bg-gray-100 text-gray-500' },
]

function categoriaInfo(categoria: string) {
  return CATEGORIAS.find(c => c.value === categoria || ('legacy' in c && c.legacy?.includes(categoria)))
}

export default function TabCostos({ loteActual }: Props) {
  const supabase = createClient()
  const [costos, setCostos] = useState<Costo[]>([])
  const [predefinidos, setPredefinidos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [mesFiltro, setMesFiltro] = useState('todos')

  const fetch = useCallback(async () => {
    setLoading(true)
    const [costosRes, predefRes] = await Promise.all([
      supabase.from('costos_lote_aves').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
      supabase.from('costos_predefinidos_aves').select('categoria, monto_referencia').eq('finca_id', loteActual.finca_id),
    ])
    setCostos(costosRes.data ?? [])
    setPredefinidos(Object.fromEntries((predefRes.data ?? []).map(p => [p.categoria, Number(p.monto_referencia)])))
    setLoading(false)
  }, [loteActual.id, loteActual.finca_id, supabase])

  useEffect(() => { fetch() }, [fetch])

  const mesesDisponibles = Array.from(new Set(costos.map(c => c.fecha.slice(0, 7)))).sort().reverse()
  const costosFiltrados = mesFiltro === 'todos' ? costos : costos.filter(c => c.fecha.slice(0, 7) === mesFiltro)

  const totalPorCategoria = CATEGORIAS.map(cat => ({
    ...cat,
    total: costosFiltrados
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
          <Button onClick={() => setModalOpen(true)} className="bg-green-700 hover:bg-green-800 text-white text-sm">
            + Registrar costo
          </Button>
        </div>
      </div>

      <CostosPredefinidosPanel
        fincaId={loteActual.finca_id}
        valores={predefinidos}
        onUpdated={(categoria, monto) => setPredefinidos(prev => ({ ...prev, [categoria]: monto }))}
      />

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
          <Card key={cat.value} className={cat.total > 0 ? '' : 'opacity-50'}>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costosFiltrados.map(c => {
                    const cat = categoriaInfo(c.categoria)
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{fmt(c.fecha)}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${cat?.color ?? 'bg-gray-100 text-gray-600'}`}>
                            {cat?.emoji} {cat?.label ?? c.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{c.descripcion}</TableCell>
                        <TableCell className="text-sm text-gray-500">{c.proveedor ?? '—'}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{cop(Number(c.monto))}</TableCell>
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
        onClose={() => setModalOpen(false)}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        costosPredefinidos={predefinidos}
        onCreated={fetch}
      />
    </div>
  )
}
