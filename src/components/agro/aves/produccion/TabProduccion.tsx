'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import RegistrarProduccionModal from './RegistrarProduccionModal'
import ConfigurarGalponModal from './ConfigurarGalponModal'
import HorariosAlimentacion from './HorariosAlimentacion'
import HorariosRecoleccion from './HorariosRecoleccion'
import RevisionCalidadHuevo from './RevisionCalidadHuevo'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']

interface Props {
  loteActual: LoteAves
  onLoteUpdated: (lote?: LoteAves) => void
}

const MS_DIA = 24 * 60 * 60 * 1000
const UMBRAL_POSTURA_OK = 80

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

const CAUSAS_LABEL: Record<string, string> = {
  'Marek': 'Marek', 'Newcastle': 'Newcastle', 'Bronquitis': 'Bronquitis',
  'Gumboro': 'Gumboro', 'Laringotraqueitis': 'Laringotraqueítis',
  'Coccidiosis': 'Coccidiosis', 'Micoplasmosis': 'Micoplasmosis',
  'Accidente': 'Accidente', 'Estrés calórico': 'Estrés calórico', 'Otra': 'Otra'
}

export default function TabProduccion({ loteActual, onLoteUpdated }: Props) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<ProduccionDiaria[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

  const fetchRegistros = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('produccion_diaria_aves')
      .select('*')
      .eq('lote_id', loteActual.id)
      .order('fecha', { ascending: false })
      .limit(60)
    setRegistros(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchRegistros() }, [fetchRegistros])

  const hoy = registros[0]
  const ultimos30 = registros.slice(0, 30)

  const posturaHoy = hoy && hoy.aves_en_dia && hoy.aves_en_dia > 0
    ? ((hoy.huevos_totales / hoy.aves_en_dia) * 100).toFixed(1)
    : null

  const totalHuevos30 = ultimos30.reduce((s, r) => s + r.huevos_totales, 0)
  const totalAlimento30 = ultimos30.reduce((s, r) => s + Number(r.alimento_kg), 0)
  const ica = totalHuevos30 > 0 ? (totalAlimento30 / (totalHuevos30 / 12)).toFixed(2) : null

  const mortAcum = registros.reduce((s, r) => s + r.muertes, 0)
  const mortPct = loteActual.aves_iniciales > 0
    ? ((mortAcum / loteActual.aves_iniciales) * 100).toFixed(1)
    : '0.0'

  // ── Ciclo de postura ──
  const metaPostura = loteActual.meta_postura_pct ?? 90
  const hoyDate = new Date()
  let semanaPostura: number | null = null
  let fechaFinEstimada: Date | null = null
  if (loteActual.fecha_inicio_postura) {
    const inicio = new Date(loteActual.fecha_inicio_postura + 'T00:00:00')
    semanaPostura = Math.max(1, Math.floor((hoyDate.getTime() - inicio.getTime()) / (7 * MS_DIA)) + 1)
    if (loteActual.semanas_ciclo_postura) {
      fechaFinEstimada = new Date(inicio.getTime() + loteActual.semanas_ciclo_postura * 7 * MS_DIA)
    }
  }

  // ── Huevos perdidos por postura bajo la meta (últimos 30 días) ──
  const precioHuevo = loteActual.precio_huevo ?? 0
  let huevosPerdidos30 = 0
  for (const r of ultimos30) {
    if (!r.aves_en_dia) continue
    const esperados = r.aves_en_dia * (metaPostura / 100)
    huevosPerdidos30 += Math.max(0, esperados - r.huevos_totales)
  }
  const valorPerdido30 = huevosPerdidos30 * precioHuevo
  const perdidaHoy = hoy && hoy.aves_en_dia
    ? Math.max(0, hoy.aves_en_dia * (metaPostura / 100) - hoy.huevos_totales)
    : 0
  const valorPerdidoHoy = perdidaHoy * precioHuevo

  // ── Alimento: costo del día y bultos consumidos ──
  const precioGramo = loteActual.precio_gramo_alimento ?? 0
  const pesoBulto = loteActual.peso_bulto_alimento_kg ?? 40
  const costoAlimentoHoy = hoy ? Number(hoy.alimento_kg) * 1000 * precioGramo : 0
  const bultosHoy = hoy ? Number(hoy.alimento_kg) / pesoBulto : 0
  const kgTotalHoy = hoy ? Number(hoy.alimento_kg) : null
  const gramosGallinaHoy = hoy && hoy.aves_en_dia && hoy.aves_en_dia > 0
    ? (Number(hoy.alimento_kg) * 1000) / hoy.aves_en_dia
    : null

  // ── Densidad ──
  const densidad = loteActual.area_galpon_m2 && loteActual.area_galpon_m2 > 0
    ? (loteActual.aves_actuales / loteActual.area_galpon_m2).toFixed(1)
    : null

  // ── Meta de huevos diaria ──
  const metaHuevosDiaria = loteActual.meta_huevos_diaria ?? null
  const cumplimientoMeta = hoy && metaHuevosDiaria
    ? ((hoy.huevos_totales / metaHuevosDiaria) * 100).toFixed(0)
    : null

  // ── Estado del lote: preparación (levante) vs activo (en postura) ──
  const semanasEnGalpon = Math.max(0, Math.floor(
    (hoyDate.getTime() - new Date(loteActual.fecha_inicio + 'T00:00:00').getTime()) / (7 * MS_DIA)
  ))

  async function marcarInicioPostura() {
    const hoyStr = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('lotes_aves')
      .update({ estado: 'activo', fecha_inicio_postura: loteActual.fecha_inicio_postura ?? hoyStr })
      .eq('id', loteActual.id)
      .select()
      .single()
    if (error) { toast.error('Error al actualizar el lote'); return }
    toast.success('Lote marcado como activo en producción')
    onLoteUpdated(data)
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Producción y Crecimiento</h2>
        <div className="flex gap-2">
          <Button onClick={() => setConfigOpen(true)} variant="outline" className="text-sm">
            ⚙️ Configurar galpón
          </Button>
          <Button onClick={() => setModalOpen(true)} className="bg-green-700 hover:bg-green-800 text-white text-sm">
            + Registrar día
          </Button>
        </div>
      </div>

      {loteActual.estado === 'preparacion' && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-blue-200 bg-blue-50">
          <div>
            <p className="text-sm font-semibold text-blue-800">🐣 Lote en preparación (levante)</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {semanasEnGalpon} semana{semanasEnGalpon === 1 ? '' : 's'} desde su entrada al galpón · aún no inicia postura
            </p>
          </div>
          <Button size="sm" onClick={marcarInicioPostura} className="bg-blue-700 hover:bg-blue-800 text-white text-xs">
            Marcar inicio de postura
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-xs text-yellow-700 font-medium">Huevos puestos hoy</p>
            <p className="text-2xl font-bold text-yellow-800">{hoy ? hoy.huevos_totales.toLocaleString('es-CO') : '—'}</p>
            <p className="text-xs text-yellow-600 mt-0.5">Comerciales: {hoy ? (hoy.huevos_totales - hoy.huevos_rotos - hoy.huevos_sucios - hoy.huevos_deformes).toLocaleString('es-CO') : '—'}</p>
          </CardContent>
        </Card>
        <Card className={metaHuevosDiaria && hoy && hoy.huevos_totales < metaHuevosDiaria ? 'border-red-200 bg-red-50' : 'border-teal-200 bg-teal-50'}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium ${metaHuevosDiaria && hoy && hoy.huevos_totales < metaHuevosDiaria ? 'text-red-700' : 'text-teal-700'}`}>Meta de huevos/día</p>
            <p className={`text-2xl font-bold ${metaHuevosDiaria && hoy && hoy.huevos_totales < metaHuevosDiaria ? 'text-red-800' : 'text-teal-800'}`}>{metaHuevosDiaria ? metaHuevosDiaria.toLocaleString('es-CO') : '—'}</p>
            <p className="text-xs mt-0.5 text-gray-500">{cumplimientoMeta ? `${cumplimientoMeta}% cumplido hoy` : metaHuevosDiaria ? 'Sin registro de hoy' : 'Configura la meta en "Configurar galpón"'}</p>
          </CardContent>
        </Card>
        <Card className={posturaHoy && Number(posturaHoy) < UMBRAL_POSTURA_OK ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium ${posturaHoy && Number(posturaHoy) < UMBRAL_POSTURA_OK ? 'text-red-700' : 'text-green-700'}`}>% Postura hoy</p>
            <p className={`text-2xl font-bold ${posturaHoy && Number(posturaHoy) < UMBRAL_POSTURA_OK ? 'text-red-800' : 'text-green-800'}`}>{posturaHoy ? `${posturaHoy}%` : '—'}</p>
            <p className={`text-xs mt-0.5 ${posturaHoy && Number(posturaHoy) < UMBRAL_POSTURA_OK ? 'text-red-600' : 'text-green-600'}`}>Meta lote: {metaPostura}%</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 font-medium">ICA (últimos 30d)</p>
            <p className="text-2xl font-bold text-blue-800">{ica ?? '—'}</p>
            <p className="text-xs text-blue-600 mt-0.5">kg alim / docena</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-700 font-medium">Mortalidad acum.</p>
            <p className="text-2xl font-bold text-gray-800">{mortAcum}</p>
            <p className="text-xs text-gray-600 mt-0.5">{mortPct}% del lote inicial</p>
          </CardContent>
        </Card>
      </div>

      {/* Ciclo de postura y densidad */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <p className="text-xs text-purple-700 font-medium">Semana de postura</p>
            <p className="text-2xl font-bold text-purple-800">{semanaPostura ?? '—'}</p>
            <p className="text-xs text-purple-600 mt-0.5">
              {fechaFinEstimada ? `Fin est.: ${fechaFinEstimada.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Sin fecha de inicio'}
            </p>
          </CardContent>
        </Card>
        <Card className={valorPerdidoHoy > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium ${valorPerdidoHoy > 0 ? 'text-red-700' : 'text-gray-500'}`}>Pérdida por baja postura (hoy)</p>
            <p className={`text-2xl font-bold ${valorPerdidoHoy > 0 ? 'text-red-800' : 'text-gray-700'}`}>{valorPerdidoHoy > 0 ? cop(valorPerdidoHoy) : '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{Math.round(perdidaHoy)} huevos bajo la meta</p>
          </CardContent>
        </Card>
        <Card className={valorPerdido30 > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium ${valorPerdido30 > 0 ? 'text-red-700' : 'text-gray-500'}`}>Pérdida acumulada (30d)</p>
            <p className={`text-2xl font-bold ${valorPerdido30 > 0 ? 'text-red-800' : 'text-gray-700'}`}>{valorPerdido30 > 0 ? cop(valorPerdido30) : '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{Math.round(huevosPerdidos30).toLocaleString('es-CO')} huevos bajo la meta</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-xs text-orange-700 font-medium">Densidad</p>
            <p className="text-2xl font-bold text-orange-800">{densidad ?? '—'}</p>
            <p className="text-xs text-orange-600 mt-0.5">aves / m²</p>
          </CardContent>
        </Card>
      </div>

      {/* Alimento: costo, bultos, gramos/gallina y kg totales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 font-medium">Costo de alimento hoy</p>
            <p className="text-2xl font-bold text-amber-800">{costoAlimentoHoy > 0 ? cop(costoAlimentoHoy) : '—'}</p>
            <p className="text-xs text-amber-600 mt-0.5">{hoy ? `${Number(hoy.alimento_kg).toFixed(1)} kg consumidos` : 'Sin registro de hoy'}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 font-medium">Bultos consumidos hoy</p>
            <p className="text-2xl font-bold text-amber-800">{bultosHoy > 0 ? bultosHoy.toFixed(2) : '—'}</p>
            <p className="text-xs text-amber-600 mt-0.5">Bulto de {pesoBulto} kg</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 font-medium">Alimento por gallina</p>
            <p className="text-2xl font-bold text-amber-800">{gramosGallinaHoy != null ? gramosGallinaHoy.toFixed(0) : '—'}</p>
            <p className="text-xs text-amber-600 mt-0.5">gramos / gallina / día</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 font-medium">Alimento total del galpón</p>
            <p className="text-2xl font-bold text-amber-800">{kgTotalHoy != null ? kgTotalHoy.toFixed(1) : '—'}</p>
            <p className="text-xs text-amber-600 mt-0.5">kg / día</p>
          </CardContent>
        </Card>
      </div>

      <HorariosAlimentacion loteId={loteActual.id} fincaId={loteActual.finca_id} />
      <HorariosRecoleccion loteId={loteActual.id} fincaId={loteActual.finca_id} />
      <RevisionCalidadHuevo loteId={loteActual.id} fincaId={loteActual.finca_id} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial de Producción</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : registros.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-2">🥚</p>
              <p className="text-gray-600 font-medium">Sin registros de producción</p>
              <p className="text-sm text-gray-400 mb-4">Registra el primer día de postura</p>
              <Button onClick={() => setModalOpen(true)} className="bg-green-700 hover:bg-green-800 text-white">
                + Registrar día
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Huevos</TableHead>
                    <TableHead className="text-right">% Postura</TableHead>
                    <TableHead className="text-right">Rotos</TableHead>
                    <TableHead className="text-right">Sucios</TableHead>
                    <TableHead className="text-right">Deformes</TableHead>
                    <TableHead className="text-right">Alimento kg</TableHead>
                    <TableHead className="text-right">Muertes</TableHead>
                    <TableHead>Causa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map(r => {
                    const pct = r.aves_en_dia && r.aves_en_dia > 0
                      ? ((r.huevos_totales / r.aves_en_dia) * 100).toFixed(1)
                      : null
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{formatDate(r.fecha)}</TableCell>
                        <TableCell className="text-right">{r.huevos_totales.toLocaleString('es-CO')}</TableCell>
                        <TableCell className="text-right">
                          {pct ? (
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${Number(pct) >= UMBRAL_POSTURA_OK ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {pct}%
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-red-600">{r.huevos_rotos || '—'}</TableCell>
                        <TableCell className="text-right text-orange-600">{r.huevos_sucios || '—'}</TableCell>
                        <TableCell className="text-right text-amber-600">{r.huevos_deformes || '—'}</TableCell>
                        <TableCell className="text-right">{Number(r.alimento_kg) > 0 ? Number(r.alimento_kg).toFixed(1) : '—'}</TableCell>
                        <TableCell className="text-right">
                          {r.muertes > 0 ? <Badge variant="destructive" className="text-xs">{r.muertes}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{r.causa_muerte ? CAUSAS_LABEL[r.causa_muerte] ?? r.causa_muerte : '—'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RegistrarProduccionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        avesActuales={loteActual.aves_actuales}
        onCreated={() => { fetchRegistros(); onLoteUpdated() }}
      />

      <ConfigurarGalponModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        lote={loteActual}
        onUpdated={updated => onLoteUpdated(updated)}
      />
    </div>
  )
}
