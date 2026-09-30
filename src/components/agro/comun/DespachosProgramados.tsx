'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import { diasHasta } from '@/lib/crecimiento'
import type { Database } from '@/types/database'
import type { EspecieFinca } from '@/lib/especies'

type Despacho = Database['public']['Tables']['despachos_programados']['Row']

interface Props {
  loteId: string
  fincaId: string
  especie: Extract<EspecieFinca, 'cerdos' | 'pollo_engorde'>
  /** Animales que hay hoy en el lote, para avisar si se programa de más */
  animalesActuales: number
  /** Peso al que se espera vender, para proponerlo */
  pesoObjetivo?: number | null
  precioKgObjetivo?: number | null
  /** Se llama al despachar, para que la pestaña de ventas se actualice */
  onDespachado?: () => void
  /** Abre el registro de la venta del despacho que sale hoy */
  onRegistrarVenta?: (despacho: Despacho) => void
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formVacio(pesoObjetivo?: number | null, precio?: number | null) {
  return {
    fecha_programada: '',
    cantidad: '',
    peso_estimado_kg: pesoObjetivo != null ? String(pesoObjetivo) : '',
    precio_kg: precio != null ? String(precio) : '',
    cliente: '',
    destino: '',
    observaciones: '',
  }
}

/**
 * Las ventas no salen de un día para otro: se programan. Aquí queda el despacho
 * con su fecha, cuántos animales salen y a qué peso, y cuando llega el día se
 * registra la venta contra ese despacho.
 */
export default function DespachosProgramados({
  loteId, fincaId, especie, animalesActuales, pesoObjetivo, precioKgObjetivo, onDespachado, onRegistrarVenta,
}: Props) {
  const supabase = createClient()
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editar, setEditar] = useState<Despacho | null>(null)
  const [form, setForm] = useState(() => formVacio(pesoObjetivo, precioKgObjetivo))
  const [guardando, setGuardando] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const fetchDespachos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('despachos_programados')
      .select('*')
      .eq('lote_id', loteId)
      .order('fecha_programada')
    setDespachos(data ?? [])
    setLoading(false)
  }, [loteId, supabase])

  useEffect(() => { fetchDespachos() }, [fetchDespachos])

  function abrir(despacho: Despacho | null) {
    setEditar(despacho)
    setForm(despacho
      ? {
          fecha_programada: despacho.fecha_programada,
          cantidad: String(despacho.cantidad),
          peso_estimado_kg: despacho.peso_estimado_kg != null ? String(despacho.peso_estimado_kg) : '',
          precio_kg: despacho.precio_kg != null ? String(despacho.precio_kg) : '',
          cliente: despacho.cliente ?? '',
          destino: despacho.destino ?? '',
          observaciones: despacho.observaciones ?? '',
        }
      : formVacio(pesoObjetivo, precioKgObjetivo))
    setModal(true)
  }

  const pendientes = despachos.filter(d => d.estado === 'programado')
  const comprometidos = pendientes.reduce((s, d) => s + d.cantidad, 0)
  const cantidad = Number(form.cantidad) || 0
  // Lo que ya está comprometido en otros despachos no se puede volver a prometer
  const yaComprometido = comprometidos - (editar && editar.estado === 'programado' ? editar.cantidad : 0)
  const libres = Math.max(0, animalesActuales - yaComprometido)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha_programada) { toast.error('Ingresa la fecha del despacho'); return }
    if (cantidad <= 0) { toast.error('Ingresa cuántos animales salen'); return }

    setGuardando(true)
    const datos = {
      fecha_programada: form.fecha_programada,
      cantidad,
      peso_estimado_kg: form.peso_estimado_kg ? Number(form.peso_estimado_kg) : null,
      precio_kg: form.precio_kg ? Number(form.precio_kg) : null,
      cliente: form.cliente || null,
      destino: form.destino || null,
      observaciones: form.observaciones || null,
    }
    const { error } = editar
      ? await supabase.from('despachos_programados').update(datos).eq('id', editar.id)
      : await supabase.from('despachos_programados').insert({ ...datos, finca_id: fincaId, lote_id: loteId, especie })
    setGuardando(false)
    if (error) { toast.error('Error al guardar el despacho'); return }

    if (cantidad > libres) {
      toast.warning(
        `Despacho guardado. Para el ${fmt(form.fecha_programada)} hacen falta ${cantidad} animales y hoy quedan ${libres} sin comprometer.`,
        { duration: 9000 },
      )
    } else {
      toast.success(editar ? 'Despacho actualizado' : 'Despacho programado')
    }
    setModal(false)
    setEditar(null)
    fetchDespachos()
  }

  async function eliminar(despacho: Despacho) {
    if (confirmando !== despacho.id) { setConfirmando(despacho.id); return }
    setConfirmando(null)
    const { error } = await supabase.from('despachos_programados').delete().eq('id', despacho.id)
    if (error) { toast.error('Error al eliminar el despacho'); return }
    toast.success('Despacho eliminado')
    fetchDespachos()
  }

  /** Cuando el camión sale, el despacho queda cumplido y se registra la venta. */
  async function marcarDespachado(despacho: Despacho) {
    const { error } = await supabase.from('despachos_programados')
      .update({ estado: 'despachado' })
      .eq('id', despacho.id)
    if (error) { toast.error('Error al marcar el despacho'); return }
    toast.success('Despacho cumplido: ahora registra la venta con lo que realmente salió')
    fetchDespachos()
    onDespachado?.()
    onRegistrarVenta?.(despacho)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Despachos programados</CardTitle>
          <p className="text-xs text-gray-500">
            Lo que ya está comprometido para salir. {comprometidos > 0
              ? `${comprometidos} animales comprometidos de ${animalesActuales} en el lote.`
              : 'Todavía no hay nada programado.'}
          </p>
        </div>
        <Button size="sm" onClick={() => abrir(null)}><Ic n="mas" /> Programar despacho</Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-4 text-sm text-gray-400">Cargando…</p>
        ) : despachos.length === 0 ? (
          <div className="py-10 text-center">
            <Ic n="calendario" className="mx-auto mb-2 size-8 text-gray-300" />
            <p className="font-medium text-gray-700">Sin despachos programados</p>
            <p className="text-sm text-gray-500">Programa la salida para saber qué sale esta semana y con cuánto peso.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Animales</TableHead>
                  <TableHead className="text-right">Peso estimado</TableHead>
                  <TableHead>Cliente y destino</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despachos.map(d => {
                  const faltan = diasHasta(d.fecha_programada)
                  const vencido = d.estado === 'programado' && faltan < 0
                  return (
                    <TableRow key={d.id} className={vencido ? 'bg-red-50' : undefined}>
                      <TableCell className="py-2 text-sm">
                        {fmt(d.fecha_programada)}
                        {d.estado === 'programado' && (
                          <span className={cn('block text-[0.6875rem]', vencido ? 'font-medium text-red-600' : 'text-gray-400')}>
                            {faltan === 0 ? 'Sale hoy' : faltan > 0 ? `Faltan ${faltan} día${faltan === 1 ? '' : 's'}` : `Atrasado ${Math.abs(faltan)} día${Math.abs(faltan) === 1 ? '' : 's'}`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm font-semibold">{d.cantidad}</TableCell>
                      <TableCell className="py-2 text-right text-sm">
                        {d.peso_estimado_kg != null ? `${Number(d.peso_estimado_kg).toFixed(1)} kg` : '—'}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-gray-600">
                        {d.cliente ?? '—'}
                        {d.destino && <span className="block text-[0.6875rem] text-gray-400">{d.destino}</span>}
                      </TableCell>
                      <TableCell className="py-2">
                        {d.estado === 'despachado'
                          ? <Badge className="bg-green-100 text-[10px] text-green-700">Despachado</Badge>
                          : d.estado === 'cancelado'
                            ? <Badge className="bg-gray-100 text-[10px] text-gray-600">Cancelado</Badge>
                            : <Badge className="bg-amber-100 text-[10px] text-amber-700">Programado</Badge>}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          {d.estado === 'programado' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => marcarDespachado(d)}>
                              Ya salió
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => abrir(d)}>
                            <Ic n="editar" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className={confirmando === d.id ? 'h-7 bg-red-600 px-2 text-xs text-white hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                            onClick={() => eliminar(d)}
                          >
                            {confirmando === d.id ? '¿Confirmar?' : <Ic n="borrar" />}
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

      <Dialog open={modal} onOpenChange={v => !v && setModal(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editar ? 'Editar despacho' : 'Programar despacho'}</DialogTitle>
            <p className="text-sm text-gray-500">
              El despacho se programa antes; la venta se registra el día que los animales salen.
            </p>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Fecha del despacho *</Label>
                <Input type="date" min={hoyLocal()} value={form.fecha_programada} onChange={e => setForm(p => ({ ...p, fecha_programada: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Animales que salen *</Label>
                <Input type="number" min="1" placeholder="0" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Peso estimado por animal (kg)</Label>
                <Input type="number" min="0" step="0.1" value={form.peso_estimado_kg} onChange={e => setForm(p => ({ ...p, peso_estimado_kg: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Precio por kilo</Label>
                <CurrencyInput placeholder="0" value={form.precio_kg} onValueChange={v => setForm(p => ({ ...p, precio_kg: v ?? '' }))} />
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input placeholder="¿Quién lo compra?" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Destino</Label>
                <Input placeholder="Planta, plaza..." value={form.destino} onChange={e => setForm(p => ({ ...p, destino: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Observaciones</Label>
                <Input placeholder="Notas del despacho..." value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
              </div>
            </div>

            {cantidad > libres && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Ic n="alerta" /> El lote tiene {animalesActuales} animales
                {yaComprometido > 0 && `, ${yaComprometido} ya comprometidos en otros despachos`}: quedan {libres} sin comprometer.
                Puedes programarlo igual, pero para ese día tienen que estar.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : editar ? 'Guardar cambios' : 'Programar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
