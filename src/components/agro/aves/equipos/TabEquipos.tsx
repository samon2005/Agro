'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import CrearEquipoModal from './CrearEquipoModal'
import RegistrarLogEquipoModal from './RegistrarLogEquipoModal'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Equipo = Database['public']['Tables']['equipos_aves']['Row']

interface Props { loteActual: LoteAves }

const TIPO_EMOJI: Record<string, string> = {
  ventilador: '💨', banda_recoleccion: '🔄', comedero: '🍽️',
  bebedero: '💧', lampara: '💡', calefactor: '🔥', cuenta_huevos: '🥚', otro: '⚙️'
}

function estadoConfig(estado: string) {
  switch (estado) {
    case 'operativo': return { cls: 'border-green-300 bg-green-50', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'Operativo' }
    case 'falla': return { cls: 'border-red-300 bg-red-50', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500 animate-pulse', label: 'Falla' }
    case 'mantenimiento': return { cls: 'border-yellow-300 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', label: 'Mantenimiento' }
    case 'inactivo': return { cls: 'border-gray-200 bg-gray-50', badge: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', label: 'Inactivo' }
    default: return { cls: 'border-gray-200', badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: estado }
  }
}

export default function TabEquipos({ loteActual }: Props) {
  const supabase = createClient()
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalCrear, setModalCrear] = useState(false)
  const [logEquipo, setLogEquipo] = useState<Equipo | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('equipos_aves')
      .select('*')
      .eq('lote_id', loteActual.id)
      .order('created_at')
    setEquipos(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetch() }, [fetch])

  const hoy = new Date()
  const en7dias = new Date(); en7dias.setDate(hoy.getDate() + 7)
  const equiposEnFalla = equipos.filter(e => e.estado === 'falla')

  function mtoStatus(fecha: string | null) {
    if (!fecha) return null
    const d = new Date(fecha + 'T00:00:00')
    if (d < hoy) return 'vencido'
    if (d <= en7dias) return 'pronto'
    return 'ok'
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Estado de Equipos</h2>
        <Button onClick={() => setModalCrear(true)} className="bg-green-700 hover:bg-green-800 text-white text-sm">
          + Registrar equipo
        </Button>
      </div>

      {equiposEnFalla.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
          🚨 <strong>Equipos con falla:</strong> {equiposEnFalla.map(e => e.nombre).join(', ')}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : equipos.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-4xl mb-2">⚙️</p>
          <p className="text-gray-600 font-medium">Sin equipos registrados</p>
          <p className="text-sm text-gray-400 mb-4">Registra los equipos del galpón para hacer seguimiento</p>
          <Button onClick={() => setModalCrear(true)} className="bg-green-700 hover:bg-green-800 text-white">+ Registrar equipo</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {equipos.map(equipo => {
            const cfg = estadoConfig(equipo.estado)
            const mtoSt = mtoStatus(equipo.proximo_mantenimiento)
            return (
              <Card key={equipo.id} className={`border-2 ${cfg.cls}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{TIPO_EMOJI[equipo.tipo] ?? '⚙️'}</span>
                      <div>
                        <p className="font-semibold text-sm text-gray-800 leading-tight">{equipo.nombre}</p>
                        {equipo.ubicacion && <p className="text-xs text-gray-400">{equipo.ubicacion}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <Badge className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                    <div>
                      <span className="text-gray-400">Horas acum.: </span>
                      <span className="font-medium text-gray-700">{equipo.horas_operacion ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Última rev.: </span>
                      <span className="font-medium text-gray-700">{equipo.ultima_revision ? fmt(equipo.ultima_revision) : '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">Prox. mtto.: </span>
                      <span className={`font-medium ${mtoSt === 'vencido' ? 'text-red-600' : mtoSt === 'pronto' ? 'text-amber-600' : 'text-gray-700'}`}>
                        {equipo.proximo_mantenimiento ? fmt(equipo.proximo_mantenimiento) : '—'}
                        {mtoSt === 'vencido' && <Badge className="ml-1 text-[9px] bg-red-100 text-red-700">Vencido</Badge>}
                        {mtoSt === 'pronto' && <Badge className="ml-1 text-[9px] bg-yellow-100 text-yellow-700">Pronto</Badge>}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-gray-400">Sensor IoT: </span>
                      <span className="italic text-gray-400">{equipo.sensor_id ?? '—'}</span>
                      <Badge variant="outline" className="text-[9px] ml-1">Pendiente</Badge>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => setLogEquipo(equipo)}
                  >
                    📋 Registrar estado
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* IoT Placeholder */}
      <Card className="border-dashed border-gray-300 bg-gray-50">
        <CardContent className="p-5 text-center space-y-2">
          <p className="text-2xl">🤖</p>
          <p className="font-semibold text-gray-600">Automatización y Alertas IoT — Próximamente</p>
          <p className="text-sm text-gray-400">
            Conecta PLCs y relés inteligentes para monitoreo automático.<br/>
            Reglas configurables: <em>IF temperatura &gt; 30°C AND postura &lt; 70% → Notificar veterinario</em>
          </p>
          <div className="flex justify-center gap-2 mt-2">
            <Badge variant="outline">Planned v2.0</Badge>
            <Badge variant="outline">MQTT / Modbus</Badge>
            <Badge variant="outline">Alertas SMS/Email</Badge>
          </div>
        </CardContent>
      </Card>

      <CrearEquipoModal
        open={modalCrear}
        onClose={() => setModalCrear(false)}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        onCreated={fetch}
      />
      {logEquipo && (
        <RegistrarLogEquipoModal
          open={!!logEquipo}
          onClose={() => setLogEquipo(null)}
          equipoId={logEquipo.id}
          equipoNombre={logEquipo.nombre}
          fincaId={loteActual.finca_id}
          onCreated={fetch}
        />
      )}
    </div>
  )
}
