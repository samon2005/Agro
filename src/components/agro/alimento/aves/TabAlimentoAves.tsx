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
import CrearTipoAlimentoModal from './CrearTipoAlimentoModal'
import EditarRequerimientosModal from './EditarRequerimientosModal'
import RegistrarConsumoAlimentoModal from './RegistrarConsumoAlimentoModal'
import HorariosAlimentacion from './HorariosAlimentacion'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']
type TipoAlimento = Database['public']['Tables']['tipos_alimento_aves']['Row']
type Requerimientos = Database['public']['Tables']['requerimientos_nutricionales_aves']['Row']

interface Props { lotes: LoteAves[] }

type SubTab = 'alimento' | 'balance'

const DEFAULTS = {
  mant_proteina_g: 9, mant_calcio_g: 0.3, mant_fosforo_g: 0.25, mant_grasa_g: 1.5,
  prod_proteina_g: 0, prod_calcio_g: 0, prod_fosforo_g: 0, prod_grasa_g: 0,
}

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CATEGORIA_LABEL: Record<string, string> = {
  levante: 'Levante',
  pollitas_ponedoras: 'Pollitas ponedoras',
  otros: 'Otros',
}

const NUTRIENTES = [
  { key: 'proteina', label: 'Proteína bruta', pctKey: 'proteina_bruta_pct' as const, mantKey: 'mant_proteina_g' as const, prodKey: 'prod_proteina_g' as const },
  { key: 'grasa', label: 'Grasa', pctKey: 'grasa_pct' as const, mantKey: 'mant_grasa_g' as const, prodKey: 'prod_grasa_g' as const },
  { key: 'calcio', label: 'Calcio', pctKey: 'calcio_pct' as const, mantKey: 'mant_calcio_g' as const, prodKey: 'prod_calcio_g' as const },
  { key: 'fosforo', label: 'Fósforo', pctKey: 'fosforo_pct' as const, mantKey: 'mant_fosforo_g' as const, prodKey: 'prod_fosforo_g' as const },
]

export default function TabAlimentoAves({ lotes }: Props) {
  const supabase = createClient()
  const rol = useRol()
  const puedeVerCostos = rol !== 'trabajador'
  const [subTab, setSubTab] = useState<SubTab>('alimento')
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '')
  const [hoy, setHoy] = useState<ProduccionDiaria | null>(null)
  const [alimentoActivo, setAlimentoActivo] = useState<{ alimento_activo_id: string | null; consumo_activo_kg: number | null } | null>(null)
  const [consumos, setConsumos] = useState<ProduccionDiaria[]>([])
  const [tipos, setTipos] = useState<TipoAlimento[]>([])
  const [requerimientosHistorial, setRequerimientosHistorial] = useState<Requerimientos[]>([])
  const [loading, setLoading] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditar, setTipoEditar] = useState<TipoAlimento | null>(null)
  const [modalRequerimientos, setModalRequerimientos] = useState(false)
  const [modalConsumo, setModalConsumo] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const lote = lotes.find(l => l.id === loteId) ?? lotes[0] ?? null

  const fetchAll = useCallback(async () => {
    if (!lote) { setLoading(false); return }
    setLoading(true)
    const [prod, consumosRes, tiposRes, reqRes, loteRes] = await Promise.all([
      supabase.from('produccion_diaria_aves').select('*').eq('lote_id', lote.id).order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('produccion_diaria_aves').select('*').eq('lote_id', lote.id).gt('alimento_kg', 0).order('fecha', { ascending: false }).limit(30),
      supabase.from('tipos_alimento_aves').select('*').eq('finca_id', lote.finca_id).order('nombre'),
      supabase.from('requerimientos_nutricionales_aves').select('*').eq('lote_id', lote.id).order('vigente_desde', { ascending: false }),
      supabase.from('lotes_aves').select('alimento_activo_id, consumo_activo_kg').eq('id', lote.id).single(),
    ])
    setHoy(prod.data ?? null)
    setConsumos(consumosRes.data ?? [])
    setTipos(tiposRes.data ?? [])
    setRequerimientosHistorial(reqRes.data ?? [])
    setAlimentoActivo(loteRes.data ?? null)
    setLoading(false)
  }, [lote, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleActivo(tipo: TipoAlimento) {
    const { error } = await supabase.from('tipos_alimento_aves').update({ activo: !tipo.activo }).eq('id', tipo.id)
    if (error) { toast.error('Error al actualizar el alimento'); return }
    toast.success(tipo.activo ? 'Alimento desactivado' : 'Alimento reactivado')
    fetchAll()
  }

  async function eliminarTipo(tipo: TipoAlimento) {
    if (confirmandoEliminar !== tipo.id) {
      setConfirmandoEliminar(tipo.id)
      const aviso = await avisoCostoVinculado(supabase, 'tipo_alimento_id', tipo.id)
      if (aviso) toast.warning(aviso)
      return
    }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('tipos_alimento_aves').delete().eq('id', tipo.id)
    if (error) { toast.error('Error al eliminar el alimento'); return }
    toast.success(`Alimento "${tipo.nombre}" eliminado`)
    fetchAll()
  }

  async function quitarConsumo(registro: ProduccionDiaria) {
    const { error } = await supabase.from('produccion_diaria_aves').update({ alimento_kg: 0, tipo_alimento_id: null }).eq('id', registro.id)
    if (error) { toast.error('Error al quitar el consumo'); return }

    if (lote) {
      const { data: ultimo } = await supabase
        .from('produccion_diaria_aves')
        .select('tipo_alimento_id, alimento_kg')
        .eq('lote_id', lote.id)
        .gt('alimento_kg', 0)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()
      await supabase.from('lotes_aves').update({
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
          <p className="text-gray-600 font-medium">No hay lotes de aves ponedoras activos</p>
          <p className="text-sm text-gray-400">Crea un lote en la sección Galpones para ver su alimentación</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>

  const tiposActivos = tipos.filter(t => t.activo)
  const hoyStr = new Date().toISOString().split('T')[0]
  const requerimientos = requerimientosHistorial.find(r => r.vigente_desde <= hoyStr) ?? null
  const req = requerimientos ?? { ...DEFAULTS, lote_id: lote!.id, finca_id: lote!.finca_id, id: '', vigente_desde: '', created_at: '' }
  const avesEnDia = hoy?.aves_en_dia ?? lote?.aves_actuales ?? 0
  const alimentoKgHoy = alimentoActivo?.consumo_activo_kg != null ? Number(alimentoActivo.consumo_activo_kg) : 0
  const posturaFraccion = hoy && hoy.aves_en_dia && hoy.aves_en_dia > 0 ? hoy.huevos_totales / hoy.aves_en_dia : 0
  const tipoActual = tipos.find(t => t.id === alimentoActivo?.alimento_activo_id) ?? null

  const pesoBulto = tipoActual?.peso_bulto_kg ?? 40
  const bultosHoy = alimentoKgHoy / pesoBulto
  const costoHoy = tipoActual?.precio_bulto ? bultosHoy * tipoActual.precio_bulto : null

  const subTabItems: { id: SubTab; label: string }[] = [
    { id: 'alimento', label: '🌾 Alimento' },
    { id: 'balance', label: '⚖️ Balance' },
  ]

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
          <Button className="bg-green-700 hover:bg-green-800 text-white text-sm" onClick={() => { setTipoEditar(null); setModalTipo(true) }}>
            + Tipo de alimento
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="text-sm" onClick={() => setModalRequerimientos(true)}>🎯 Requerimientos</Button>
            <Button className="bg-green-700 hover:bg-green-800 text-white text-sm" onClick={() => setModalConsumo(true)}>+ Registrar consumo</Button>
          </div>
        )}
      </div>

      {/* Mini-tabs */}
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

      {subTab === 'alimento' ? (
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
                        <TableCell className="text-sm text-gray-600">{t.tipo_alimento_categoria ? CATEGORIA_LABEL[t.tipo_alimento_categoria] ?? t.tipo_alimento_categoria : '—'}</TableCell>
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
      ) : null}

      {subTab === 'alimento' && lote && (
        <HorariosAlimentacion loteId={lote.id} fincaId={lote.finca_id} />
      )}

      {subTab === 'balance' && (
        <>
          {!hoy && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              ⚠️ Este lote no tiene registro de producción reciente. Los cálculos usan las aves activas del lote pero no hay consumo de alimento registrado.
            </div>
          )}

          {/* Tipo de alimento y costos activos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-lime-200 bg-lime-50">
              <CardContent className="p-4">
                <p className="text-xs text-lime-700 font-medium">Tipo de alimento (activo)</p>
                <p className="text-lg font-bold text-lime-900 truncate">{tipoActual?.nombre ?? 'Sin especificar'}</p>
                <p className="text-xs text-lime-600 mt-0.5">{tipoActual ? `Bulto de ${pesoBulto} kg` : 'Registra el consumo'}</p>
              </CardContent>
            </Card>
            {puedeVerCostos && (
              <Card className="border-lime-200 bg-lime-50">
                <CardContent className="p-4">
                  <p className="text-xs text-lime-700 font-medium">Precio del bulto</p>
                  <p className="text-lg font-bold text-lime-900">{tipoActual?.precio_bulto ? cop(tipoActual.precio_bulto) : '—'}</p>
                </CardContent>
              </Card>
            )}
            <Card className="border-lime-200 bg-lime-50">
              <CardContent className="p-4">
                <p className="text-xs text-lime-700 font-medium">Bultos (consumo activo)</p>
                <p className="text-lg font-bold text-lime-900">{alimentoKgHoy > 0 ? bultosHoy.toFixed(2) : '—'}</p>
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

          {/* Balance nutricional */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Balance Nutricional del Día</CardTitle>
              <p className="text-xs text-gray-400">
                <strong>Requerimiento</strong> = lo que el ave necesita (mantenimiento + producción según % de postura).{' '}
                <strong>Consumo registrado</strong> = lo que realmente comió, calculado del alimento consumido × su composición.
              </p>
              {requerimientos ? (
                <p className="text-xs text-gray-400">Requerimiento vigente desde {fmt(requerimientos.vigente_desde)}</p>
              ) : (
                <p className="text-xs text-amber-600">Usando valores por defecto — configúralos en &quot;🎯 Requerimientos&quot;</p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nutriente</TableHead>
                      <TableHead className="text-right">Requerimiento de mantenimiento</TableHead>
                      <TableHead className="text-right">Requerimiento de producción</TableHead>
                      <TableHead className="text-right">Requerimiento total</TableHead>
                      <TableHead className="text-right">Consumo registrado</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {NUTRIENTES.map(n => {
                      const mant = req[n.mantKey]
                      const prod = req[n.prodKey] * posturaFraccion
                      const total = mant + prod
                      const pctAlimento = tipoActual?.[n.pctKey] ?? null
                      const consumoGalpon = pctAlimento != null ? alimentoKgHoy * 1000 * (pctAlimento / 100) : null
                      const consumoAve = consumoGalpon != null && avesEnDia > 0 ? consumoGalpon / avesEnDia : null
                      const diferencia = consumoAve != null ? consumoAve - total : null
                      const bien = diferencia != null && diferencia >= 0
                      const sinDatos = diferencia == null

                      return (
                        <TableRow key={n.key}>
                          <TableCell className="font-medium text-sm">{n.label}</TableCell>
                          <TableCell className="text-right text-sm text-gray-600">{mant.toFixed(2)} g</TableCell>
                          <TableCell className="text-right text-sm text-gray-600">{prod.toFixed(2)} g</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-gray-800">{total.toFixed(2)} g/ave</TableCell>
                          <TableCell className="text-right text-sm">{consumoAve != null ? `${consumoAve.toFixed(2)} g/ave` : '—'}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${sinDatos ? 'text-gray-400' : bien ? 'text-green-700' : 'text-red-700'}`}>
                            {diferencia != null ? `${diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)} g/ave` : '—'}
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
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Historial de consumo */}
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
          <CrearTipoAlimentoModal
            open={modalTipo}
            onClose={() => { setModalTipo(false); setTipoEditar(null) }}
            fincaId={lote.finca_id}
            loteId={lote.id}
            tipoExistente={tipoEditar}
            onCreated={fetchAll}
          />
          <EditarRequerimientosModal
            open={modalRequerimientos}
            onClose={() => setModalRequerimientos(false)}
            loteId={lote.id}
            fincaId={lote.finca_id}
            actual={requerimientos}
            historial={requerimientosHistorial}
            fechaInicioPostura={lote.fecha_inicio_postura}
            onUpdated={fetchAll}
          />
          <RegistrarConsumoAlimentoModal
            open={modalConsumo}
            onClose={() => setModalConsumo(false)}
            loteId={lote.id}
            fincaId={lote.finca_id}
            tiposAlimento={tiposActivos}
            onCreated={fetchAll}
          />
        </>
      )}
    </div>
  )
}
