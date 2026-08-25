'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import RegistrarAmbientalModal from './RegistrarAmbientalModal'
import { getClimaActual, recomendacionesAmbientales, type ClimaActual } from '@/lib/clima'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Parametro = Database['public']['Tables']['parametros_ambientales_aves']['Row']

type Finca = {
  altitud_msnm: number | null
  velocidad_viento_kmh: number | null
  clima_predominante: string | null
  temperatura_promedio_ext: number | null
  latitud: number | null
  longitud: number | null
}

interface Props { loteActual: LoteAves; finca?: Finca | null }

const CLIMA_LABEL: Record<string, string> = {
  calido: 'Cálido', templado: 'Templado', frio: 'Frío', paramo: 'Páramo',
}

function AlertaBanner({ tipo, mensaje }: { tipo: 'danger' | 'warning'; mensaje: string }) {
  const cls = tipo === 'danger'
    ? 'bg-red-50 border-red-300 text-red-800'
    : 'bg-amber-50 border-amber-300 text-amber-800'
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${cls}`}>
      <span>{tipo === 'danger' ? '🚨' : '⚠️'}</span>
      {mensaje}
    </div>
  )
}

function StatCard({ label, value, unit, warning }: { label: string; value: string | null; unit: string; warning?: boolean }) {
  return (
    <Card className={warning ? 'border-red-300 bg-red-50' : 'border-gray-200'}>
      <CardContent className="p-3">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className={`text-xl font-bold ${warning ? 'text-red-700' : 'text-gray-800'}`}>{value ?? '—'}</p>
        <p className="text-xs text-gray-400">{unit}</p>
      </CardContent>
    </Card>
  )
}

export default function TabAmbiental({ loteActual, finca }: Props) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<Parametro[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [climaExterior, setClimaExterior] = useState<ClimaActual | null>(null)
  const [climaLoading, setClimaLoading] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('parametros_ambientales_aves')
      .select('*')
      .eq('lote_id', loteActual.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)
    setRegistros(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (finca?.latitud == null || finca?.longitud == null) return
    setClimaLoading(true)
    getClimaActual(finca.latitud, finca.longitud).then(c => { setClimaExterior(c); setClimaLoading(false) })
  }, [finca?.latitud, finca?.longitud])

  const ultimo = registros[0]
  const alertas: { tipo: 'danger' | 'warning'; mensaje: string }[] = []
  if (ultimo) {
    if (ultimo.temperatura_interior && ultimo.temperatura_interior > 30)
      alertas.push({ tipo: 'danger', mensaje: `Temperatura interior: ${ultimo.temperatura_interior}°C — supera el límite de 30°C` })
    if (ultimo.nh3_ppm && ultimo.nh3_ppm > 25)
      alertas.push({ tipo: 'danger', mensaje: `NH₃: ${ultimo.nh3_ppm} ppm — supera 25 ppm (riesgo respiratorio)` })
    if (ultimo.co2_ppm && ultimo.co2_ppm > 3000)
      alertas.push({ tipo: 'danger', mensaje: `CO₂: ${ultimo.co2_ppm} ppm — supera 3000 ppm` })
    if (ultimo.humedad_interior && (ultimo.humedad_interior > 85 || ultimo.humedad_interior < 40))
      alertas.push({ tipo: 'warning', mensaje: `Humedad interior: ${ultimo.humedad_interior}% — fuera del rango óptimo (40–75%)` })
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Parámetros Ambientales</h2>
        <Button onClick={() => setModalOpen(true)} className="bg-green-700 hover:bg-green-800 text-white text-sm">
          + Registrar lectura
        </Button>
      </div>

      {finca && (finca.altitud_msnm || finca.velocidad_viento_kmh || finca.clima_predominante || finca.temperatura_promedio_ext) && (
        <div className="flex flex-wrap gap-4 px-4 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-800">
          <span className="font-semibold">📍 Finca:</span>
          {finca.altitud_msnm != null && <span>⛰️ {finca.altitud_msnm} msnm</span>}
          {finca.velocidad_viento_kmh != null && <span>💨 {finca.velocidad_viento_kmh} km/h</span>}
          {finca.clima_predominante && <span>☁️ {CLIMA_LABEL[finca.clima_predominante] ?? finca.clima_predominante}</span>}
          {finca.temperatura_promedio_ext != null && <span>🌡️ {finca.temperatura_promedio_ext}°C promedio</span>}
        </div>
      )}

      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => <AlertaBanner key={i} tipo={a.tipo} mensaje={a.mensaje} />)}
        </div>
      )}

      {/* Clima real (Open-Meteo) y recomendaciones */}
      {finca?.latitud != null && finca?.longitud != null && (
        <Card className="border-sky-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              🌤️ Clima exterior ahora {climaLoading && <span className="text-xs text-gray-400 font-normal">(actualizando...)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {climaExterior ? (
              <div className="flex gap-6">
                <div>
                  <p className="text-2xl font-bold text-sky-800">{climaExterior.temperatura.toFixed(1)}°C</p>
                  <p className="text-xs text-gray-400">Temperatura real</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-sky-800">{climaExterior.humedad.toFixed(0)}%</p>
                  <p className="text-xs text-gray-400">Humedad relativa</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin datos de clima disponibles todavía.</p>
            )}
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">Recomendaciones</p>
              {recomendacionesAmbientales({
                tempInterior: ultimo?.temperatura_interior ?? null,
                tempExterior: ultimo?.temperatura_exterior ?? null,
                humedadInterior: ultimo?.humedad_interior ?? null,
                nh3: ultimo?.nh3_ppm ?? null,
                co2: ultimo?.co2_ppm ?? null,
                climaExterior,
              }).map((r, i) => (
                <p key={i} className="text-sm text-gray-700">{r}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Última lectura */}
      {ultimo && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Última lectura: {fmt(ultimo.fecha)} {ultimo.hora ?? ''} — <Badge variant="secondary" className="text-[10px]">{ultimo.fuente === 'sensor' ? '📡 Sensor' : '✍️ Manual'}</Badge></p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="🌡️ Temp. interior" value={ultimo.temperatura_interior?.toFixed(1) ?? null} unit="°C" warning={!!ultimo.temperatura_interior && ultimo.temperatura_interior > 30} />
            <StatCard label="🌡️ Temp. exterior" value={ultimo.temperatura_exterior?.toFixed(1) ?? null} unit="°C" />
            <StatCard label="💧 Humedad int." value={ultimo.humedad_interior?.toFixed(1) ?? null} unit="%" warning={!!ultimo.humedad_interior && (ultimo.humedad_interior > 85 || ultimo.humedad_interior < 40)} />
            <StatCard label="💧 Humedad ext." value={ultimo.humedad_exterior?.toFixed(1) ?? null} unit="%" />
            <StatCard label="🌬️ NH₃" value={ultimo.nh3_ppm?.toFixed(1) ?? null} unit="ppm" warning={!!ultimo.nh3_ppm && ultimo.nh3_ppm > 25} />
            <StatCard label="🌬️ CO₂" value={ultimo.co2_ppm?.toFixed(0) ?? null} unit="ppm" warning={!!ultimo.co2_ppm && ultimo.co2_ppm > 3000} />
            <StatCard label="💡 Luminosidad" value={ultimo.lux_intensidad?.toFixed(1) ?? null} unit="lux" />
          </div>
        </div>
      )}

      {/* Historial */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial de lecturas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : registros.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-4xl mb-2">🌡️</p>
              <p className="text-gray-600 font-medium">Sin lecturas ambientales</p>
              <p className="text-sm text-gray-400 mb-4">Registra los parámetros del galpón</p>
              <Button onClick={() => setModalOpen(true)} className="bg-green-700 hover:bg-green-800 text-white">+ Registrar lectura</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead className="text-right">T° int (°C)</TableHead>
                    <TableHead className="text-right">T° ext (°C)</TableHead>
                    <TableHead className="text-right">HR int (%)</TableHead>
                    <TableHead className="text-right">NH₃ (ppm)</TableHead>
                    <TableHead className="text-right">CO₂ (ppm)</TableHead>
                    <TableHead className="text-right">Lux</TableHead>
                    <TableHead>Fuente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map(r => (
                    <TableRow key={r.id} className={r.temperatura_interior && r.temperatura_interior > 30 ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium text-sm">{fmt(r.fecha)}</TableCell>
                      <TableCell className="text-sm text-gray-500">{r.hora ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.temperatura_interior && r.temperatura_interior > 30 ? 'text-red-600 font-semibold' : ''}`}>{r.temperatura_interior?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.temperatura_exterior?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.humedad_interior && (r.humedad_interior > 85 || r.humedad_interior < 40) ? 'text-amber-600 font-semibold' : ''}`}>{r.humedad_interior?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.nh3_ppm && r.nh3_ppm > 25 ? 'text-red-600 font-semibold' : ''}`}>{r.nh3_ppm?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm ${r.co2_ppm && r.co2_ppm > 3000 ? 'text-red-600 font-semibold' : ''}`}>{r.co2_ppm?.toFixed(0) ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.lux_intensidad?.toFixed(0) ?? '—'}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{r.fuente === 'sensor' ? '📡 Sensor' : '✍️ Manual'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IoT Placeholder */}
      <Card className="border-dashed border-gray-300 bg-gray-50">
        <CardContent className="p-5 text-center space-y-2">
          <p className="text-2xl">📡</p>
          <p className="font-semibold text-gray-600">Integración con Sensores IoT — Próximamente</p>
          <p className="text-sm text-gray-400">Conecta sensores SHT40 (temperatura/humedad), MH-Z19B (CO₂) y MQ-135 (NH₃) para registro automático en tiempo real.</p>
          <div className="flex justify-center gap-2 mt-2">
            <Badge variant="outline">Planned v2.0</Badge>
            <Badge variant="outline">MQTT / HTTP</Badge>
          </div>
        </CardContent>
      </Card>

      <RegistrarAmbientalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        onCreated={fetch}
      />
    </div>
  )
}
