'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRol } from '@/components/agro/RolProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { avisoCostoVinculado } from '@/lib/eliminarConAviso'
import CrearTipoAlimentoGenericoModal, { type TipoAlimentoGenerico } from './CrearTipoAlimentoGenericoModal'
import EditarRequerimientosGenericoModal, { type RequerimientoGenerico } from './EditarRequerimientosGenericoModal'
import RegistrarConsumoGenericoModal from './RegistrarConsumoGenericoModal'
import HorariosAlimentacionGenerico from './HorariosAlimentacionGenerico'
import { dbGenerico, type ConfigEspecie } from '@/lib/especiesConfig'

interface LoteMinimo {
  id: string
  finca_id: string
  nombre: string
}

interface Props {
  lotes: LoteMinimo[]
  config: ConfigEspecie
}

type SubTab = 'alimento' | 'balance'

interface RegistroConsumo {
  id: string
  fecha: string
  alimento_kg: number
  tipo_alimento_id: string | null
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Nutrientes que se comparan entre lo que pide la dieta y lo que trae el alimento. */
const NUTRIENTES = [
  { key: 'proteina', label: 'Proteína bruta', pctAlimento: 'proteina_bruta_pct', pctRequerido: 'proteina_pct', unidad: '%' },
  { key: 'lisina', label: 'Lisina', pctAlimento: 'lisina_pct', pctRequerido: 'lisina_pct', unidad: '%' },
  { key: 'calcio', label: 'Calcio', pctAlimento: 'calcio_pct', pctRequerido: 'calcio_pct', unidad: '%' },
  { key: 'fosforo', label: 'Fósforo', pctAlimento: 'fosforo_pct', pctRequerido: 'fosforo_pct', unidad: '%' },
  { key: 'energia', label: 'Energía', pctAlimento: 'energia_kcal_kg', pctRequerido: 'energia_kcal_kg', unidad: 'kcal/kg' },
] as const

export default function TabAlimentoGenerico({ lotes, config }: Props) {
  const supabase = createClient()
  const rol = useRol()
  const puedeVerCostos = rol !== 'trabajador'
  const [subTab, setSubTab] = useState<SubTab>('alimento')
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '')
  const [tipos, setTipos] = useState<TipoAlimentoGenerico[]>([])
  const [consumos, setConsumos] = useState<RegistroConsumo[]>([])
  const [requerimientosHistorial, setRequerimientosHistorial] = useState<RequerimientoGenerico[]>([])
  const [alimentoActivo, setAlimentoActivo] = useState<{ alimento_activo_id: string | null; consumo_activo_kg: number | null } | null>(null)
  const [animalesActuales, setAnimalesActuales] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditar, setTipoEditar] = useState<TipoAlimentoGenerico | null>(null)
  const [modalRequerimientos, setModalRequerimientos] = useState(false)
  const [modalConsumo, setModalConsumo] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const lote = lotes.find(l => l.id === loteId) ?? lotes[0] ?? null

  const fetchAll = useCallback(async () => {
    if (!lote) { setLoading(false); return }
    setLoading(true)
    const db = dbGenerico(supabase)
    const [tiposRes, consumosRes, reqRes, loteRes] = await Promise.all([
      db.from(config.tablas.tiposAlimento).select('*').eq('finca_id', lote.finca_id).order('nombre'),
      db.from(config.tablas.registroDiario).select('id, fecha, alimento_kg, tipo_alimento_id')
        .eq('lote_id', lote.id).gt('alimento_kg', 0).order('fecha', { ascending: false }).limit(30),
      db.from(config.tablas.requerimientos).select('*').eq('lote_id', lote.id).order('vigente_desde', { ascending: false }),
      db.from(config.tablas.lotes).select('*').eq('id', lote.id).single(),
    ])
    setTipos((tiposRes.data ?? []) as TipoAlimentoGenerico[])
    setConsumos((consumosRes.data ?? []) as RegistroConsumo[])
    setRequerimientosHistorial((reqRes.data ?? []) as RequerimientoGenerico[])
    const loteData = (loteRes.data ?? null) as Record<string, unknown> | null
    setAlimentoActivo(loteData ? {
      alimento_activo_id: (loteData.alimento_activo_id as string | null) ?? null,
      consumo_activo_kg: (loteData.consumo_activo_kg as number | null) ?? null,
    } : null)
    setAnimalesActuales(Number(loteData?.[config.campoActuales] ?? 0))
    setLoading(false)
  }, [lote, supabase, config])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleActivo(tipo: TipoAlimentoGenerico) {
    const { error } = await dbGenerico(supabase).from(config.tablas.tiposAlimento).update({ activo: !tipo.activo }).eq('id', tipo.id)
    if (error) { toast.error('Error al actualizar el alimento'); return }
    toast.success(tipo.activo ? 'Alimento desactivado' : 'Alimento reactivado')
    fetchAll()
  }

  async function eliminarTipo(tipo: TipoAlimentoGenerico) {
    if (confirmandoEliminar !== tipo.id) {
      setConfirmandoEliminar(tipo.id)
      const aviso = await avisoCostoVinculado(dbGenerico(supabase), 'tipo_alimento_id', tipo.id, config.tablas.costos)
      if (aviso) toast.warning(aviso)
      return
    }
    setConfirmandoEliminar(null)
    const { error } = await dbGenerico(supabase).from(config.tablas.tiposAlimento).delete().eq('id', tipo.id)
    if (error) { toast.error('Error al eliminar el alimento'); return }
    toast.success(`Alimento "${tipo.nombre}" eliminado`)
    fetchAll()
  }

  /** Quitar un consumo también recalcula el alimento activo del lote. */
  async function quitarConsumo(registro: RegistroConsumo) {
    const db = dbGenerico(supabase)
    const { error } = await db.from(config.tablas.registroDiario)
      .update({ alimento_kg: 0, tipo_alimento_id: null }).eq('id', registro.id)
    if (error) { toast.error('Error al quitar el consumo'); return }

    if (lote) {
      const { data: ultimo } = await db.from(config.tablas.registroDiario)
        .select('tipo_alimento_id, alimento_kg').eq('lote_id', lote.id).gt('alimento_kg', 0)
        .order('fecha', { ascending: false }).limit(1).maybeSingle()
      await db.from(config.tablas.lotes).update({
        alimento_activo_id: ultimo?.tipo_alimento_id ?? null,
        consumo_activo_kg: ultimo ? Number(ultimo.alimento_kg) : null,
      }).eq('id', lote.id)
    }

    toast.success('Consumo eliminado')
    fetchAll()
  }

  if (lotes.length === 0) {
    return (
      <Card className="border-dashed border-gray-300">
        <CardContent className="py-16 text-center">
          <p className="text-4xl mb-2">🌾</p>
          <p className="text-gray-600 font-medium">No hay lotes de {config.label.toLowerCase()} activos</p>
          <p className="text-sm text-gray-400">Crea un lote en su sección para ver su alimentación</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>

  const nutri = config.nutricion
  const tiposActivos = tipos.filter(t => t.activo)
  const hoyStr = new Date().toISOString().split('T')[0]
  const requerimientos = requerimientosHistorial.find(r => r.vigente_desde <= hoyStr) ?? null
  const tipoActual = tipos.find(t => t.id === alimentoActivo?.alimento_activo_id) ?? null
  const alimentoKgHoy = alimentoActivo?.consumo_activo_kg != null ? Number(alimentoActivo.consumo_activo_kg) : 0

  const pesoBulto = tipoActual?.peso_bulto_kg ?? 40
  const bultosHoy = alimentoKgHoy / pesoBulto
  const costoHoy = tipoActual?.precio_bulto ? bultosHoy * tipoActual.precio_bulto : null

  // Consumo real por animal, en la unidad que usa la especie
  const consumoPorAnimalKg = animalesActuales > 0 ? alimentoKgHoy / animalesActuales : 0
  const consumoPorAnimal = nutri.unidadConsumo === 'g' ? consumoPorAnimalKg * 1000 : consumoPorAnimalKg
  const consumoObjetivo = requerimientos ? Number(requerimientos[nutri.campoConsumo] ?? 0) : 0
  const cumplimientoConsumo = consumoObjetivo > 0 ? (consumoPorAnimal / consumoObjetivo) * 100 : null

  const subTabItems: { id: SubTab; label: string }[] = [
    { id: 'alimento', label: '🌾 Alimento' },
    { id: 'balance', label: '⚖️ Balance' },
  ]

  const categoriaLabel = Object.fromEntries(nutri.categoriasAlimento.map(c => [c.value, c.label]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Lote:</span>
          <select
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
            value={loteId || lote?.id}
            onChange={e => setLoteId(e.target.value)}
          >
            {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
        {subTab === 'alimento' ? (
          <Button className={cn('text-sm', config.botonClase)} onClick={() => { setTipoEditar(null); setModalTipo(true) }}>
            + Tipo de alimento
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="text-sm" onClick={() => setModalRequerimientos(true)}>🎯 Requerimientos</Button>
            <Button className={cn('text-sm', config.botonClase)} onClick={() => setModalConsumo(true)}>+ Registrar consumo</Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {subTabItems.map(item => (
          <button
            key={item.id}
            onClick={() => setSubTab(item.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              subTab === item.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {subTab === 'alimento' && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Tipos de alimento registrados</CardTitle>
              <p className="text-xs text-gray-400">El catálogo creado aquí es el que se selecciona al registrar consumo en Balance</p>
            </CardHeader>
            <CardContent className="p-0">
              {tipos.length === 0 ? (
                <p className="text-sm text-gray-400 p-4">Aún no has registrado ningún tipo de alimento. Usa &quot;+ Tipo de alimento&quot; arriba.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Proteína</TableHead>
                        {puedeVerCostos && <TableHead className="text-right">Precio/bulto</TableHead>}
                        <TableHead className="text-right">Última entrada</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tipos.map(t => (
                        <TableRow key={t.id} className={t.activo ? '' : 'opacity-50'}>
                          <TableCell className="font-medium text-sm">{t.nombre}</TableCell>
                          <TableCell className="text-sm text-gray-600">{t.marca || '—'}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {t.tipo_alimento_categoria ? categoriaLabel[t.tipo_alimento_categoria] ?? t.tipo_alimento_categoria : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm">{t.proteina_bruta_pct != null ? `${t.proteina_bruta_pct}%` : '—'}</TableCell>
                          {puedeVerCostos && <TableCell className="text-right text-sm">{t.precio_bulto ? cop(t.precio_bulto) : '—'}</TableCell>}
                          <TableCell className="text-right text-xs text-gray-500">
                            {t.cantidad_entrada && t.fecha_entrada
                              ? `${t.cantidad_entrada} bultos · ${new Date(t.fecha_entrada + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setTipoEditar(t); setModalTipo(true) }}>✏️</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-500" onClick={() => toggleActivo(t)}>
                                {t.activo ? 'Desactivar' : 'Reactivar'}
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === t.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminarTipo(t)}
                              >
                                {confirmandoEliminar === t.id ? '¿Confirmar?' : '🗑️ Eliminar'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {lote && <HorariosAlimentacionGenerico loteId={lote.id} fincaId={lote.finca_id} config={config} onConsumoCambiado={fetchAll} />}
        </>
      )}

      {subTab === 'balance' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-lime-200 bg-lime-50">
              <CardContent className="p-4">
                <p className="text-xs text-lime-700 font-medium">Tipo de alimento (activo)</p>
                <p className="text-lg font-bold text-lime-900 truncate">{tipoActual?.nombre ?? 'Sin especificar'}</p>
                <p className="text-xs text-lime-600 mt-0.5">{tipoActual ? `Bulto de ${pesoBulto} kg` : 'Registra el consumo'}</p>
              </CardContent>
            </Card>
            <Card className="border-lime-200 bg-lime-50">
              <CardContent className="p-4">
                <p className="text-xs text-lime-700 font-medium">Consumo por {config.animalSingular}</p>
                <p className="text-lg font-bold text-lime-900">
                  {consumoPorAnimal > 0 ? `${consumoPorAnimal.toFixed(nutri.unidadConsumo === 'g' ? 0 : 2)} ${nutri.unidadConsumo}` : '—'}
                </p>
                <p className="text-xs text-lime-600 mt-0.5">
                  {consumoObjetivo > 0 ? `Objetivo: ${consumoObjetivo} ${nutri.unidadConsumo}` : 'Sin objetivo configurado'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-lime-200 bg-lime-50">
              <CardContent className="p-4">
                <p className="text-xs text-lime-700 font-medium">Bultos (consumo activo)</p>
                <p className="text-lg font-bold text-lime-900">{alimentoKgHoy > 0 ? bultosHoy.toFixed(2) : '—'}</p>
                <p className="text-xs text-lime-600 mt-0.5">{alimentoKgHoy > 0 ? `${alimentoKgHoy.toFixed(1)} kg del galpón` : 'Sin consumo registrado'}</p>
              </CardContent>
            </Card>
            {puedeVerCostos && (
              <Card className="border-lime-200 bg-lime-50">
                <CardContent className="p-4">
                  <p className="text-xs text-lime-700 font-medium">Costo de alimento (activo)</p>
                  <p className="text-lg font-bold text-lime-900">{costoHoy ? cop(costoHoy) : '—'}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Balance Nutricional del Día</CardTitle>
              <p className="text-xs text-gray-400">
                Compara lo que <strong>pide la dieta</strong> de la etapa actual contra lo que <strong>trae el alimento</strong> que se está dando.
              </p>
              {requerimientos ? (
                <p className="text-xs text-gray-400">
                  Requerimiento vigente desde {fmt(requerimientos.vigente_desde)} · {String(requerimientos[nutri.campoEtapa] ?? '')}
                </p>
              ) : (
                <p className="text-xs text-amber-600">Sin requerimientos configurados — defínelos en &quot;🎯 Requerimientos&quot;</p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nutriente</TableHead>
                      <TableHead className="text-right">Requerido en la dieta</TableHead>
                      <TableHead className="text-right">Aporta el alimento</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {NUTRIENTES.map(n => {
                      const requerido = requerimientos ? Number(requerimientos[n.pctRequerido] ?? 0) : 0
                      const aporta = tipoActual ? Number(tipoActual[n.pctAlimento as keyof TipoAlimentoGenerico] ?? 0) : null
                      const diferencia = aporta != null && requerido > 0 ? aporta - requerido : null
                      const bien = diferencia != null && diferencia >= 0
                      const sinDatos = diferencia == null

                      return (
                        <TableRow key={n.key}>
                          <TableCell className="font-medium text-sm">{n.label}</TableCell>
                          <TableCell className="text-right text-sm text-gray-600">{requerido > 0 ? `${requerido} ${n.unidad}` : '—'}</TableCell>
                          <TableCell className="text-right text-sm">{aporta != null && aporta > 0 ? `${aporta} ${n.unidad}` : '—'}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${sinDatos ? 'text-gray-400' : bien ? 'text-green-700' : 'text-red-700'}`}>
                            {diferencia != null ? `${diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)} ${n.unidad}` : '—'}
                          </TableCell>
                          <TableCell>
                            {sinDatos ? (
                              <Badge variant="outline" className="text-[10px]">Sin datos</Badge>
                            ) : bien ? (
                              <Badge className="bg-green-100 text-green-700 text-[10px]">✓ Suficiente</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 text-[10px]">⚠ Insuficiente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="bg-gray-50">
                      <TableCell className="font-medium text-sm">Consumo por {config.animalSingular}</TableCell>
                      <TableCell className="text-right text-sm text-gray-600">
                        {consumoObjetivo > 0 ? `${consumoObjetivo} ${nutri.unidadConsumo}/día` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {consumoPorAnimal > 0 ? `${consumoPorAnimal.toFixed(nutri.unidadConsumo === 'g' ? 0 : 2)} ${nutri.unidadConsumo}/día` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {cumplimientoConsumo != null && consumoPorAnimal > 0 ? `${cumplimientoConsumo.toFixed(0)}%` : '—'}
                      </TableCell>
                      <TableCell>
                        {cumplimientoConsumo == null || consumoPorAnimal === 0 ? (
                          <Badge variant="outline" className="text-[10px]">Sin datos</Badge>
                        ) : cumplimientoConsumo >= 95 ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px]">✓ En objetivo</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px]">⚠ Por debajo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Consumo registrado</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {consumos.length === 0 ? (
                <p className="text-sm text-gray-400 p-4">Sin consumo registrado. Usa &quot;+ Registrar consumo&quot; arriba.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Alimento</TableHead>
                        <TableHead className="text-right">Kg consumidos</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consumos.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">{fmt(c.fecha)}</TableCell>
                          <TableCell className="text-sm text-gray-600">{tipos.find(t => t.id === c.tipo_alimento_id)?.nombre ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{Number(c.alimento_kg).toFixed(1)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={() => quitarConsumo(c)}>Quitar</Button>
                          </TableCell>
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

      {lote && (
        <>
          <CrearTipoAlimentoGenericoModal
            open={modalTipo}
            onClose={() => { setModalTipo(false); setTipoEditar(null) }}
            fincaId={lote.finca_id}
            loteId={lote.id}
            config={config}
            tipoExistente={tipoEditar}
            onCreated={fetchAll}
          />
          <EditarRequerimientosGenericoModal
            open={modalRequerimientos}
            onClose={() => setModalRequerimientos(false)}
            loteId={lote.id}
            fincaId={lote.finca_id}
            config={config}
            actual={requerimientos}
            historial={requerimientosHistorial}
            onUpdated={fetchAll}
          />
          <RegistrarConsumoGenericoModal
            open={modalConsumo}
            onClose={() => setModalConsumo(false)}
            loteId={lote.id}
            fincaId={lote.finca_id}
            config={config}
            tiposAlimento={tiposActivos}
            onCreated={fetchAll}
          />
        </>
      )}
    </div>
  )
}
