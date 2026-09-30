'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Indicador } from '@/components/ui/indicador'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import type { Database } from '@/types/database'
import type { ConfigEspecie } from '@/lib/especiesConfig'
import type { TipoAlimentoGenerico } from './CrearTipoAlimentoGenericoModal'

type Entrada = Database['public']['Tables']['entradas_alimento_lote']['Row']

/** Lo que hay de un alimento: lo que entró menos lo que se comieron los lotes. */
interface StockAlimento {
  tipo_alimento_id: string
  nombre: string
  peso_bulto_kg: number
  bultos_entrados: number
  kg_consumidos: number
  bultos_consumidos: number
  bultos_disponibles: number
  ultima_entrada: string | null
}

interface Props {
  loteId: string
  fincaId: string
  config: ConfigEspecie
  tiposAlimento: TipoAlimentoGenerico[]
  /** Alimento que el lote está consumiendo hoy */
  alimentoActivoId: string | null
  /** Kg que come el lote al día, para decir cuántos días alcanza */
  consumoDiarioKg: number
  puedeVerCostos: boolean
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function formVacio(tipoId: string | null) {
  return {
    tipo_alimento_id: tipoId ?? '',
    fecha: hoyLocal(),
    cantidad_bultos: '',
    precio_bulto: '',
    proveedor: '',
    fecha_vencimiento: '',
    observaciones: '',
  }
}

/**
 * Inventario del alimento del lote, igual que en ponedoras: se registra lo que
 * entra y el stock se calcula solo restando lo que se ha consumido día a día.
 */
export default function InventarioAlimentoGenerico({
  loteId, fincaId, config, tiposAlimento, alimentoActivoId, consumoDiarioKg, puedeVerCostos,
}: Props) {
  const supabase = createClient()
  const db = supabase as unknown as SupabaseClient
  const especie = config.especie === 'cerdos' ? 'cerdos' : 'pollo_engorde'
  const funcionStock = config.especie === 'cerdos' ? 'recalcular_stock_alimento_cerdos' : 'recalcular_stock_alimento_pollo'

  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [stock, setStock] = useState<StockAlimento[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editar, setEditar] = useState<Entrada | null>(null)
  const [form, setForm] = useState(() => formVacio(alimentoActivoId))
  const [guardando, setGuardando] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const fetchTodo = useCallback(async () => {
    setLoading(true)
    await db.rpc(funcionStock, { p_finca: fincaId })
    const [entradasRes, stockRes] = await Promise.all([
      db.from('entradas_alimento_lote').select('*').eq('finca_id', fincaId).eq('especie', especie)
        .order('fecha', { ascending: false }).limit(50),
      db.from('stock_alimento_lote').select('*').eq('finca_id', fincaId).eq('especie', especie),
    ])
    setEntradas((entradasRes.data ?? []) as Entrada[])
    setStock(((stockRes.data ?? []) as StockAlimento[]).map(s => ({
      ...s,
      peso_bulto_kg: Number(s.peso_bulto_kg),
      bultos_entrados: Number(s.bultos_entrados),
      kg_consumidos: Number(s.kg_consumidos),
      bultos_consumidos: Number(s.bultos_consumidos),
      bultos_disponibles: Number(s.bultos_disponibles),
    })))
    setLoading(false)
  }, [db, fincaId, especie, funcionStock])

  useEffect(() => { fetchTodo() }, [fetchTodo])

  const stockActivo = stock.find(s => s.tipo_alimento_id === alimentoActivoId) ?? null
  const entradasVisibles = stockActivo
    ? entradas.filter(e => e.tipo_alimento_id === stockActivo.tipo_alimento_id)
    : entradas
  const diasQueAlcanza = stockActivo && consumoDiarioKg > 0 && stockActivo.bultos_disponibles > 0
    ? Math.floor((stockActivo.bultos_disponibles * stockActivo.peso_bulto_kg) / consumoDiarioKg)
    : null
  const tipoElegido = tiposAlimento.find(t => t.id === form.tipo_alimento_id) ?? null

  function abrir(entrada: Entrada | null) {
    setEditar(entrada)
    setForm(entrada
      ? {
          tipo_alimento_id: entrada.tipo_alimento_id,
          fecha: entrada.fecha,
          cantidad_bultos: String(entrada.cantidad_bultos),
          precio_bulto: entrada.precio_bulto != null ? String(entrada.precio_bulto) : '',
          proveedor: entrada.proveedor ?? '',
          fecha_vencimiento: entrada.fecha_vencimiento ?? '',
          observaciones: entrada.observaciones ?? '',
        }
      : formVacio(alimentoActivoId))
    setModal(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo_alimento_id) { toast.error('Elige el tipo de alimento'); return }
    const bultos = Number(form.cantidad_bultos) || 0
    if (bultos <= 0) { toast.error('Ingresa cuántos bultos entraron'); return }

    setGuardando(true)
    const datos = {
      tipo_alimento_id: form.tipo_alimento_id,
      fecha: form.fecha,
      cantidad_bultos: bultos,
      precio_bulto: form.precio_bulto ? Number(form.precio_bulto) : null,
      proveedor: form.proveedor || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      observaciones: form.observaciones || null,
    }
    const { data: entrada, error } = editar
      ? await db.from('entradas_alimento_lote').update(datos).eq('id', editar.id).select('id').single()
      : await db.from('entradas_alimento_lote').insert({ ...datos, finca_id: fincaId, especie, lote_id: loteId }).select('id').single()

    // La entrada es un costo del lote, igual que en ponedoras
    const precio = form.precio_bulto ? Number(form.precio_bulto) : (tipoElegido?.precio_bulto ?? 0)
    if (!error && entrada && !editar && precio > 0) {
      await db.from(config.tablas.costos).insert({
        lote_id: loteId,
        finca_id: fincaId,
        fecha: form.fecha,
        categoria: 'alimento',
        descripcion: `Entrada de alimento: ${tipoElegido?.nombre ?? ''} (${bultos} bultos)`,
        monto: precio * bultos,
        proveedor: form.proveedor || null,
      })
    }

    setGuardando(false)
    if (error) { toast.error('Error al guardar la entrada'); return }
    toast.success(editar ? 'Entrada actualizada' : `${bultos} bultos agregados al stock`)
    setModal(false)
    setEditar(null)
    fetchTodo()
  }

  async function eliminar(entrada: Entrada) {
    if (confirmando !== entrada.id) { setConfirmando(entrada.id); return }
    setConfirmando(null)
    const { error } = await db.from('entradas_alimento_lote').delete().eq('id', entrada.id)
    if (error) { toast.error('Error al eliminar la entrada'); return }
    toast.success('Entrada eliminada')
    fetchTodo()
  }

  return (
    <div className="space-y-4">
      {stockActivo ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
          <Indicador
            tono={diasQueAlcanza != null && diasQueAlcanza <= 7 ? 'red' : 'amber'}
            icono="alimento"
            etiqueta={stockActivo.nombre}
            valor={<>{stockActivo.bultos_disponibles.toLocaleString('es-CO', { maximumFractionDigits: 1 })} <span className="text-base font-medium text-gray-500">bultos</span></>}
            detalle={
              stockActivo.bultos_disponibles <= 0
                ? <span className="font-medium text-red-700">Se consumió más de lo que entró: registra la entrada que falta</span>
                : diasQueAlcanza != null
                  ? <span className={diasQueAlcanza <= 7 ? 'font-medium text-red-700' : undefined}>Alcanza para {diasQueAlcanza} día{diasQueAlcanza === 1 ? '' : 's'} en este lote</span>
                  : 'Este lote todavía no registra consumo'
            }
          />
          <Indicador
            tono="gray" icono="caja" etiqueta="Entró en total"
            valor={<>{stockActivo.bultos_entrados.toLocaleString('es-CO', { maximumFractionDigits: 1 })} <span className="text-base font-medium text-gray-500">bultos</span></>}
            detalle={stockActivo.ultima_entrada ? `Última entrada el ${fmt(stockActivo.ultima_entrada)}` : 'Sin entradas registradas'}
          />
          <Indicador
            tono="orange" icono="alimento" etiqueta="Ya se consumió"
            valor={<>{stockActivo.bultos_consumidos.toLocaleString('es-CO', { maximumFractionDigits: 1 })} <span className="text-base font-medium text-gray-500">bultos</span></>}
            detalle={`${stockActivo.kg_consumidos.toLocaleString('es-CO', { maximumFractionDigits: 0 })} kg en todos los lotes que lo usan`}
          />
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Este lote todavía no tiene alimento en uso. Registra su consumo y aquí aparecerá su stock.
        </div>
      )}
      <p className="-mt-1 text-xs text-gray-400">
        El stock se calcula solo: bultos que entraron menos lo que se consumió día a día, según lo registrado.
      </p>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Entradas de {stockActivo ? stockActivo.nombre : 'alimento'}</CardTitle>
            <p className="text-xs text-gray-500">Cada entrada suma al stock y queda registrada como costo en Finanzas.</p>
          </div>
          <Button size="sm" disabled={tiposAlimento.length === 0} onClick={() => abrir(null)}>
            <Ic n="mas" /> Registrar entrada
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-gray-400">Cargando…</p>
          ) : entradasVisibles.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">Sin entradas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Alimento</TableHead>
                    <TableHead className="text-right">Bultos</TableHead>
                    {puedeVerCostos && <TableHead className="text-right">Precio por bulto</TableHead>}
                    {puedeVerCostos && <TableHead className="text-right">Costo</TableHead>}
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entradasVisibles.map(e => {
                    const tipo = tiposAlimento.find(t => t.id === e.tipo_alimento_id)
                    const precio = e.precio_bulto ?? tipo?.precio_bulto ?? 0
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="py-2 text-sm">{fmt(e.fecha)}</TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">{tipo?.nombre ?? '—'}</TableCell>
                        <TableCell className="py-2 text-right text-sm">{Number(e.cantidad_bultos).toLocaleString('es-CO')}</TableCell>
                        {puedeVerCostos && (
                          <TableCell className="py-2 text-right text-sm">{precio > 0 ? cop(Number(precio)) : '—'}</TableCell>
                        )}
                        {puedeVerCostos && (
                          <TableCell className="py-2 text-right text-sm font-medium">
                            {precio > 0 ? cop(Number(e.cantidad_bultos) * Number(precio)) : '—'}
                          </TableCell>
                        )}
                        <TableCell className="py-2 text-sm text-gray-500">{e.proveedor ?? '—'}</TableCell>
                        <TableCell className="py-2 text-sm text-gray-500">{e.fecha_vencimiento ? fmt(e.fecha_vencimiento) : '—'}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => abrir(e)}>
                              <Ic n="editar" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className={confirmando === e.id ? 'h-7 bg-red-600 px-2 text-xs text-white hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                              onClick={() => eliminar(e)}
                            >
                              {confirmando === e.id ? '¿Confirmar?' : <Ic n="borrar" />}
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

      <Dialog open={modal} onOpenChange={v => !v && setModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editar ? 'Editar entrada' : 'Registrar entrada de alimento'}</DialogTitle>
            <p className="text-sm text-gray-500">Lo que entra a la bodega. Suma al stock y queda como costo.</p>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-1">
              <Label>Tipo de alimento *</Label>
              <Select
                value={form.tipo_alimento_id}
                onValueChange={v => setForm(p => ({ ...p, tipo_alimento_id: v ?? '' }))}
                items={Object.fromEntries(tiposAlimento.map(t => [t.id, t.nombre]))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {tiposAlimento.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Cantidad (bultos) *</Label>
                <Input type="number" min="0" step="0.5" placeholder="Ej: 20" value={form.cantidad_bultos} onChange={e => setForm(p => ({ ...p, cantidad_bultos: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Fecha de entrada</Label>
                <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Precio por bulto</Label>
                <CurrencyInput placeholder={tipoElegido?.precio_bulto ? String(tipoElegido.precio_bulto) : '0'} value={form.precio_bulto} onValueChange={v => setForm(p => ({ ...p, precio_bulto: v ?? '' }))} />
              </div>
              <div className="space-y-1">
                <Label>Vencimiento</Label>
                <Input type="date" value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Proveedor</Label>
                <Input placeholder="¿Dónde se compró?" value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Observaciones</Label>
                <Input placeholder="Notas de la entrada..." value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : editar ? 'Guardar cambios' : 'Registrar entrada'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
