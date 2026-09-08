'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import RegistrarDiaCerdosModal from './RegistrarDiaCerdosModal'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type NutricionDiaria = Database['public']['Tables']['nutricion_diaria_cerdos']['Row']
type Mortalidad = Database['public']['Tables']['mortalidad_cerdos']['Row']

interface Props {
  loteActual: LoteCerdos
  onLoteUpdated: () => void
}

/**
 * El día a día del lote en un solo lugar: lo que hay que anotar cada jornada
 * (alimento, agua y mortalidad) y el historial de lo anotado.
 */
export default function TabDiarioCerdos({ loteActual, onLoteUpdated }: Props) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<NutricionDiaria[]>([])
  const [mortalidad, setMortalidad] = useState<Mortalidad[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [registroEditar, setRegistroEditar] = useState<NutricionDiaria | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [diarios, morts] = await Promise.all([
      supabase.from('nutricion_diaria_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(60),
      supabase.from('mortalidad_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
    ])
    setRegistros(diarios.data ?? [])
    setMortalidad(morts.data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function eliminarRegistro(r: NutricionDiaria) {
    if (confirmandoEliminar !== r.id) { setConfirmandoEliminar(r.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('nutricion_diaria_cerdos').delete().eq('id', r.id)
    if (error) { toast.error('Error al eliminar el registro'); return }
    toast.success('Registro eliminado')
    fetchAll()
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const hoyStr = hoyLocal()
  const registroHoy = registros.find(r => r.fecha === hoyStr)
  const sinAlimento = loteActual.alimento_activo_id == null

  // Mortalidad indexada por fecha, para verla junto al día que le corresponde
  const mortPorFecha = new Map<string, Mortalidad[]>()
  for (const m of mortalidad) {
    const lista = mortPorFecha.get(m.fecha) ?? []
    lista.push(m)
    mortPorFecha.set(m.fecha, lista)
  }

  const ultimos7 = registros.slice(0, 7)
  const alimento7 = ultimos7.reduce((s, r) => s + Number(r.alimento_kg), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Diario del lote</h2>
          <p className="text-xs text-gray-400">Lo que se registra todos los días: alimento, agua y mortalidad.</p>
        </div>
        <Button
          onClick={() => { setRegistroEditar(null); setModalOpen(true) }}
          disabled={sinAlimento}
          className="bg-orange-600 hover:bg-orange-700 text-white text-sm"
        >
          + Registrar día
        </Button>
      </div>

      {sinAlimento && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          ⚠️ Este lote no tiene alimento asignado. Regístralo en la pestaña Nutrición para poder
          llevar el diario.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className={registroHoy ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium ${registroHoy ? 'text-green-700' : 'text-amber-700'}`}>Hoy</p>
            <p className={`text-lg font-bold ${registroHoy ? 'text-green-800' : 'text-amber-800'}`}>
              {registroHoy ? `${Number(registroHoy.alimento_kg).toFixed(1)} kg registrados` : 'Sin registrar'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Alimento últimos 7 días</p>
            <p className="text-2xl font-bold text-gray-800">{alimento7.toFixed(1)} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Días registrados</p>
            <p className="text-2xl font-bold text-gray-800">{registros.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial diario</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : registros.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-2">📋</p>
              <p className="text-gray-600 font-medium">Sin días registrados</p>
              <p className="text-sm text-gray-400 mb-4">Empieza a llevar el día a día del lote</p>
              <Button
                onClick={() => { setRegistroEditar(null); setModalOpen(true) }}
                disabled={sinAlimento}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                + Registrar día
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Alimento kg</TableHead>
                    <TableHead className="text-right">Agua L</TableHead>
                    <TableHead className="text-right">Muertes</TableHead>
                    <TableHead>Causa</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map(r => {
                    const morts = mortPorFecha.get(r.fecha) ?? []
                    const totalMuertes = morts.reduce((s, m) => s + m.cantidad, 0)
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{fmt(r.fecha)}</TableCell>
                        <TableCell className="text-right text-sm">{Number(r.alimento_kg).toFixed(1)}</TableCell>
                        <TableCell className="text-right text-sm text-gray-500">{r.agua_litros != null ? Number(r.agua_litros).toFixed(0) : '—'}</TableCell>
                        <TableCell className="text-right">
                          {totalMuertes > 0 ? <Badge variant="destructive" className="text-xs">{totalMuertes}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {morts.length > 0 ? morts.map(m => m.causa ?? '—').join(' · ') : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[180px] truncate">{r.observaciones ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setRegistroEditar(r); setModalOpen(true) }}>✏️</Button>
                            <Button
                              size="sm" variant="ghost"
                              className={confirmandoEliminar === r.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                              onClick={() => eliminarRegistro(r)}
                            >
                              {confirmandoEliminar === r.id ? '¿Confirmar?' : '🗑️'}
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

      <RegistrarDiaCerdosModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setRegistroEditar(null) }}
        lote={loteActual}
        registroExistente={registroEditar}
        onCreated={() => { fetchAll(); onLoteUpdated() }}
      />
    </div>
  )
}
