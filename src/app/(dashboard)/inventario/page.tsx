'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
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
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { recalcularStockAlimentoAves, leerStockAlimentoAves, type StockAlimentoAves } from '@/lib/inventario'

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
  tipo_alimento_aves_id: string | null
  tipo_alimento_cerdos_id: string | null
  tipo_alimento_pollo_id: string | null
  inventario_categorias: { nombre: string; color: string } | null
}

type Tab = 'general' | 'alimento' | 'huevos' | 'farmacos' | 'equipos'
type Categoria = Exclude<Tab, 'general' | 'equipos'> | 'otros'

const TABLA_EQUIPOS: Record<EspecieFinca, 'equipos_aves' | 'equipos_cerdos' | 'equipos_pollo'> = {
  aves_ponedoras: 'equipos_aves',
  cerdos: 'equipos_cerdos',
  pollo_engorde: 'equipos_pollo',
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  alimento: 'Alimento', huevos: 'Huevos', farmacos: 'Fármacos', otros: 'Otros',
}

function normaliza(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function categoriaDe(i: Item): Categoria {
  const cat = i.inventario_categorias?.nombre ? normaliza(i.inventario_categorias.nombre) : ''
  if (cat === 'alimento') return 'alimento'
  if (cat === 'huevos') return 'huevos'
  if (cat === 'farmacos' || cat === 'medicamentos') return 'farmacos'
  return 'otros'
}

/** El alimento lo lleva la base (entradas menos consumo) y el huevo la producción y las ventas: no se tocan a mano */
function esAutomatico(i: Item) {
  const c = categoriaDe(i)
  const ligadoAAlimento = i.tipo_alimento_aves_id != null || i.tipo_alimento_cerdos_id != null || i.tipo_alimento_pollo_id != null
  return (c === 'alimento' && ligadoAAlimento) || c === 'huevos'
}

function venceEn30(i: Item) {
  if (!i.fecha_vencimiento) return false
  const diff = (new Date(i.fecha_vencimiento + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff <= 30 && diff >= 0
}

function stockBajo(i: Item) {
  return i.cantidad_minima > 0 && i.cantidad_actual <= i.cantidad_minima
}

export default function InventarioPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const [items, setItems] = useState<Item[]>([])
  // Stock de cada alimento de aves, para saber cuál está en uso y cuánto queda
  const [stockAlimento, setStockAlimento] = useState<StockAlimentoAves[]>([])
  const [equipos, setEquipos] = useState<{ total: number; falla: number }>({ total: 0, falla: 0 })
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('general')
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  const especie = (fincaActual?.tipo_produccion?.[0] ?? null) as EspecieFinca | null

  async function fetchInventario() {
    if (!fincaActual) return
    setLoading(true)
    const supabase = createClient()
    // Antes de mostrar el stock, se descuenta el alimento que ya se comieron los galpones
    await recalcularStockAlimentoAves(supabase, fincaActual.id)
    const [{ data }, stock, eq] = await Promise.all([
      supabase
        .from('inventario')
        .select('*, inventario_categorias(nombre, color)')
        .eq('finca_id', fincaActual.id)
        .order('nombre'),
      leerStockAlimentoAves(supabase, fincaActual.id),
      especie
        ? supabase.from(TABLA_EQUIPOS[especie]).select('estado').eq('finca_id', fincaActual.id)
        : Promise.resolve({ data: [] as { estado: string }[] }),
    ])
    setItems(data ?? [])
    setStockAlimento(stock)
    const filasEq = (eq.data ?? []) as { estado: string }[]
    setEquipos({ total: filasEq.length, falla: filasEq.filter(e => e.estado === 'falla').length })
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchInventario() }, [fincaActual])

  async function eliminarItem(id: string) {
    if (confirmandoId !== id) { setConfirmandoId(id); return }
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

  // Del alimento se muestra lo que algún galpón come hoy o lo que aún queda en bodega;
  // un alimento sin consumo y sin bultos ya solo es parte del catálogo.
  const alimentosEnUso = new Set(stockAlimento.filter(s => s.activo_en_algun_lote).map(s => s.tipo_alimento_id))
  const itemsVisibles = items.filter(i =>
    categoriaDe(i) !== 'alimento' || !i.tipo_alimento_aves_id
    || alimentosEnUso.has(i.tipo_alimento_aves_id) || Number(i.cantidad_actual) > 0)

  const porCategoria = (c: Categoria) => itemsVisibles.filter(i => categoriaDe(i) === c)
  const bultosEnBodega = porCategoria('alimento').reduce((s, i) => s + Math.max(0, Number(i.cantidad_actual)), 0)
  const huevosEnBodega = porCategoria('huevos').reduce((s, i) => s + Number(i.cantidad_actual), 0)

  const itemsVista = tab === 'general' || tab === 'equipos' ? itemsVisibles : porCategoria(tab)
  const bajos = itemsVista.filter(stockBajo)
  const porVencer = itemsVista.filter(venceEn30)

  const conteo: Record<Tab, number> = {
    general: itemsVisibles.length + equipos.total,
    alimento: porCategoria('alimento').length,
    huevos: porCategoria('huevos').length,
    farmacos: porCategoria('farmacos').length,
    equipos: equipos.total,
  }

  const TABS: { id: Tab; label: string; icon: NombreIcono }[] = [
    { id: 'general', label: 'General', icon: 'inventario' },
    { id: 'alimento', label: 'Alimento', icon: 'alimento' },
    ...(especie === 'aves_ponedoras' ? [{ id: 'huevos' as const, label: 'Huevos', icon: 'huevo' as const }] : []),
    { id: 'farmacos', label: 'Fármacos', icon: 'medicamento' },
    { id: 'equipos', label: 'Equipos', icon: 'ajustes' },
  ]

  // Alimento y huevo no se agregan aquí: entran por sus propios registros
  const puedeAgregar = tab === 'general' || tab === 'farmacos'
  const categoriaSugerida = tab === 'farmacos' ? 'Fármacos' : undefined

  if (fincaLoading) return <PageSkeleton />

  return (
    <>
      <RegistrarInventarioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        fincaId={fincaActual?.id ?? ''}
        categoriaSugerida={categoriaSugerida}
        onCreated={fetchInventario}
      />

      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-3xl font-medium text-gray-900">Gestión de Inventario</h2>
            <p className="mt-1 text-gray-500">
              {fincaActual ? `Finca: ${fincaActual.nombre}` : 'Selecciona una finca'}
            </p>
          </div>
          {puedeAgregar && (
            <Button className="bg-green-700 text-white hover:bg-green-800" onClick={() => setModalOpen(true)} disabled={!fincaActual}>
              + Agregar ítem
            </Button>
          )}
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-gray-200 [scrollbar-width:none]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setConfirmandoId(null) }}
              className={cn(
                '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t.id ? 'border-green-700 text-green-900' : 'border-transparent text-gray-500 hover:text-gray-800'
              )}
            >
              <Ic n={t.icon} className={cn('size-4', tab === t.id ? 'text-green-700' : 'text-gray-400')} />
              {t.label}
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', tab === t.id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500')}>
                {loading ? '…' : conteo[t.id]}
              </span>
            </button>
          ))}
        </div>

        {tab === 'equipos' ? (
          fincaActual && especie ? (
            <EquiposInventario
              fincaId={fincaActual.id}
              especie={especie}
              onConteo={total => setEquipos(prev => ({ ...prev, total }))}
            />
          ) : null
        ) : (
        <>
        {tab === 'general' && (
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
            <TarjetaCategoria
              icono="alimento" titulo="Alimento" onClick={() => setTab('alimento')} cargando={loading}
              valor={`${bultosEnBodega.toLocaleString('es-CO', { maximumFractionDigits: 1 })} bultos`}
              detalle={`${conteo.alimento} alimento${conteo.alimento === 1 ? '' : 's'} en bodega`}
            />
            {especie === 'aves_ponedoras' && (
              <TarjetaCategoria
                icono="huevo" titulo="Huevos" onClick={() => setTab('huevos')} cargando={loading}
                valor={`${huevosEnBodega.toLocaleString('es-CO')} huevos`}
                detalle="sin vender, de todos los galpones"
              />
            )}
            <TarjetaCategoria
              icono="medicamento" titulo="Fármacos" onClick={() => setTab('farmacos')} cargando={loading}
              valor={`${conteo.farmacos} ítem${conteo.farmacos === 1 ? '' : 's'}`}
              detalle={porCategoria('farmacos').filter(stockBajo).length > 0
                ? <span className="text-red-600">{porCategoria('farmacos').filter(stockBajo).length} con stock bajo</span>
                : 'stock al día'}
            />
            <TarjetaCategoria
              icono="ajustes" titulo="Equipos" onClick={() => setTab('equipos')} cargando={loading}
              valor={`${equipos.total} equipo${equipos.total === 1 ? '' : 's'}`}
              detalle={equipos.falla > 0 ? <span className="text-red-600">{equipos.falla} con falla</span> : 'ninguno con falla'}
            />
          </div>
        )}

        {tab === 'alimento' && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            El alimento se calcula solo: bultos que entraron menos lo que comen los galpones.
            Las entradas se registran en <Link href="/alimento" className="font-medium underline">Alimento</Link>.
          </p>
        )}
        {tab === 'huevos' && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            El huevo entra con la producción de cada galpón y sale con las <Link href="/ventas" className="font-medium underline">ventas</Link>.
          </p>
        )}

        <div className="mb-6 flex flex-wrap gap-2 text-sm">
          <Badge className="bg-blue-50 px-3 py-1 text-blue-700">{itemsVista.length} ítem{itemsVista.length === 1 ? '' : 's'}</Badge>
          <Badge className={cn('px-3 py-1', bajos.length > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500')}>{bajos.length} con stock bajo</Badge>
          <Badge className={cn('px-3 py-1', porVencer.length > 0 ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-500')}>{porVencer.length} por vencer en 30 días</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tab === 'general' ? 'Todo el inventario' : `${CATEGORIA_LABEL[tab]} en inventario`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : itemsVista.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <span className="mb-4 text-5xl text-gray-300"><Ic n="caja" /></span>
                <p className="text-lg font-semibold text-gray-700">Sin ítems</p>
                {puedeAgregar && (
                  <Button className="mt-5 bg-green-700 text-white hover:bg-green-800" onClick={() => setModalOpen(true)}>
                    Agregar ítem
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    {tab === 'general' && <TableHead>Categoría</TableHead>}
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Precio unit.</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsVista.map(item => {
                    const bajo = stockBajo(item)
                    const vence = venceEn30(item)
                    return (
                      <TableRow key={item.id} className={bajo ? 'bg-red-50' : ''}>
                        <TableCell>
                          <p className="font-medium">{item.nombre}</p>
                          {item.descripcion && <p className="text-xs text-gray-400">{item.descripcion}</p>}
                        </TableCell>
                        {tab === 'general' && (
                          <TableCell><Badge variant="secondary">{CATEGORIA_LABEL[categoriaDe(item)]}</Badge></TableCell>
                        )}
                        <TableCell className={`font-semibold tabular-nums ${bajo || item.cantidad_actual < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {Number(item.cantidad_actual).toLocaleString('es-CO', { maximumFractionDigits: 2 })} {item.unidad_medida ?? ''}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {item.cantidad_minima > 0 ? `${item.cantidad_minima} ${item.unidad_medida ?? ''}` : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.precio_unitario ? `$${item.precio_unitario.toLocaleString('es-CO')}` : '—'}
                        </TableCell>
                        <TableCell className={`text-sm ${vence ? 'font-medium text-orange-600' : 'text-gray-600'}`}>
                          {item.fecha_vencimiento ? new Date(item.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CO') : '—'}
                        </TableCell>
                        <TableCell>
                          {item.cantidad_actual < 0 ? (
                            <Badge className="bg-red-100 text-red-700" title="Salió más de lo registrado: faltan entradas o días de producción">Faltan registros</Badge>
                          ) : bajo ? (
                            <Badge className="bg-red-100 text-red-700">Stock bajo</Badge>
                          ) : vence ? (
                            <Badge className="bg-orange-100 text-orange-700">Por vencer</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {esAutomatico(item) ? null : confirmandoId === item.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={borrandoId === item.id} onClick={() => eliminarItem(item.id)}>
                                Confirmar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmandoId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => eliminarItem(item.id)}>
                              <Ic n="borrar" />
                            </Button>
                          )}
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
        </>
        )}
      </div>
    </>
  )
}

function TarjetaCategoria({ icono, titulo, valor, detalle, onClick, cargando }: {
  icono: NombreIcono
  titulo: string
  valor: string
  detalle: ReactNode
  onClick: () => void
  cargando: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="superficie flex flex-col rounded-2xl p-4 text-left transition-colors hover:ring-1 hover:ring-green-300"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600"><Ic n={icono} className="size-4" /></span>
        {titulo}
      </span>
      {cargando
        ? <Skeleton className="mt-3 h-7 w-24" />
        : <span className="mt-3 text-xl font-semibold text-gray-900 tabular-nums">{valor}</span>}
      <span className="mt-0.5 text-xs text-gray-500">{detalle}</span>
    </button>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6 p-8">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
