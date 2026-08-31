'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { avisoCostoVinculado } from '@/lib/eliminarConAviso'
import CrearEquipoModal from './CrearEquipoModal'
import RegistrarLogEquipoModal from './RegistrarLogEquipoModal'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Equipo = Database['public']['Tables']['equipos_aves']['Row']

interface Props { loteActual: LoteAves }

const TIPO_LABEL: Record<string, { label: string; icon: string }> = {
  ventilador: { label: 'Ventilador', icon: '💨' },
  banda_recoleccion: { label: 'Banda de recolección', icon: '🔄' },
  comedero: { label: 'Comedero', icon: '🍽️' },
  bebedero: { label: 'Bebedero', icon: '💧' },
  lampara: { label: 'Lámpara / Iluminación', icon: '💡' },
  calefactor: { label: 'Calefactor', icon: '🔥' },
  cuenta_huevos: { label: 'Máquina cuenta huevos', icon: '🥚' },
  otro: { label: 'Otro', icon: '⚙️' },
}

function tipoInfo(tipo: string) {
  return TIPO_LABEL[tipo] ?? { label: tipo, icon: '⚙️' }
}

function estadoConfig(estado: string) {
  switch (estado) {
    case 'operativo': return { cls: 'border-green-300 bg-green-50', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'Operativo' }
    case 'falla': return { cls: 'border-red-300 bg-red-50', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500 animate-pulse', label: 'Falla' }
    case 'mantenimiento': return { cls: 'border-yellow-300 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', label: 'Mantenimiento' }
    case 'inactivo': return { cls: 'border-gray-200 bg-gray-50', badge: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', label: 'Inactivo' }
    case 'planificado': return { cls: 'border-indigo-200 bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400', label: 'Planificado' }
    default: return { cls: 'border-gray-200', badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: estado }
  }
}

export default function TabEquipos({ loteActual }: Props) {
  const supabase = createClient()
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalCrear, setModalCrear] = useState(false)
  const [logEquipo, setLogEquipo] = useState<Equipo | null>(null)
  const [equipoEditar, setEquipoEditar] = useState<Equipo | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('equipos_aves').select('*').eq('lote_id', loteActual.id).order('created_at')
    setEquipos(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetch() }, [fetch])

  async function eliminarEquipo(equipo: Equipo) {
    if (confirmandoEliminar !== equipo.id) {
      setConfirmandoEliminar(equipo.id)
      const aviso = await avisoCostoVinculado(supabase, 'equipo_id', equipo.id)
      if (aviso) toast.warning(aviso)
      return
    }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('equipos_aves').delete().eq('id', equipo.id)
    if (error) { toast.error('Error al eliminar el equipo'); return }
    setEquipos(prev => prev.filter(e => e.id !== equipo.id))
    toast.success('Equipo eliminado')
  }

  const hoy = new Date()
  const en7dias = new Date(); en7dias.setDate(hoy.getDate() + 7)
  const equiposEnFalla = equipos.filter(e => e.estado === 'falla')

  const categorias = Array.from(new Set(equipos.map(e => e.tipo))).map(tipo => {
    const items = equipos.filter(e => e.tipo === tipo)
    return {
      tipo,
      info: tipoInfo(tipo),
      total: items.length,
      operativos: items.filter(e => e.estado === 'operativo').length,
      falla: items.filter(e => e.estado === 'falla').length,
      mantenimiento: items.filter(e => e.estado === 'mantenimiento').length,
      planificado: items.filter(e => e.estado === 'planificado').length,
    }
  })
  const equiposDeCategoria = categoriaSeleccionada ? equipos.filter(e => e.tipo === categoriaSeleccionada) : []

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
        <Button onClick={() => { setEquipoEditar(null); setModalCrear(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">
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
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : equipos.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-4xl mb-2">⚙️</p>
          <p className="text-gray-600 font-medium">Sin equipos registrados</p>
          <p className="text-sm text-gray-400 mb-4">Registra los equipos del galpón para hacer seguimiento</p>
          <Button onClick={() => setModalCrear(true)} className="bg-green-700 hover:bg-green-800 text-white">+ Registrar equipo</Button>
        </div>
      ) : categoriaSeleccionada == null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categorias.map(cat => (
            <Card
              key={cat.tipo}
              className="cursor-pointer hover:border-green-400 transition-colors"
              onClick={() => setCategoriaSeleccionada(cat.tipo)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{cat.info.icon}</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-800 leading-tight">{cat.info.label}</p>
                    <p className="text-xs text-gray-400">{cat.total} equipo{cat.total === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cat.operativos > 0 && <Badge className="text-[10px] bg-green-100 text-green-700">{cat.operativos} operativo{cat.operativos === 1 ? '' : 's'}</Badge>}
                  {cat.falla > 0 && <Badge className="text-[10px] bg-red-100 text-red-700">{cat.falla} con falla</Badge>}
                  {cat.mantenimiento > 0 && <Badge className="text-[10px] bg-yellow-100 text-yellow-700">{cat.mantenimiento} en mtto.</Badge>}
                  {cat.planificado > 0 && <Badge className="text-[10px] bg-indigo-100 text-indigo-700">{cat.planificado} planificado{cat.planificado === 1 ? '' : 's'}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setCategoriaSeleccionada(null)}>
            ← Todas las categorías
          </Button>
          {equiposDeCategoria.map(equipo => {
            const cfg = estadoConfig(equipo.estado)
            const mtoSt = mtoStatus(equipo.proximo_mantenimiento)
            return (
              <Card key={equipo.id} className={`border-2 ${cfg.cls}`}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <div>
                      <p className="font-semibold text-sm text-gray-800 leading-tight">{equipo.nombre}</p>
                      <p className="text-xs text-gray-400">{equipo.numero_serie ? `S/N: ${equipo.numero_serie}` : 'Sin N° de serie'}{equipo.marca ? ` · ${equipo.marca}` : ''}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
                  <div className="text-xs text-gray-500">
                    <span className="text-gray-400">Última rev.: </span>
                    <span className="font-medium text-gray-700">{equipo.ultima_revision ? fmt(equipo.ultima_revision) : '—'}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-400">Prox. mtto.: </span>
                    <span className={`font-medium ${mtoSt === 'vencido' ? 'text-red-600' : mtoSt === 'pronto' ? 'text-amber-600' : 'text-gray-700'}`}>
                      {equipo.proximo_mantenimiento ? fmt(equipo.proximo_mantenimiento) : '—'}
                      {mtoSt === 'vencido' && <Badge className="ml-1 text-[9px] bg-red-100 text-red-700">Vencido</Badge>}
                      {mtoSt === 'pronto' && <Badge className="ml-1 text-[9px] bg-yellow-100 text-yellow-700">Pronto</Badge>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setLogEquipo(equipo)}>📋 Registrar estado</Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-500" onClick={() => { setEquipoEditar(equipo); setModalCrear(true) }}>✏️</Button>
                    <Button
                      size="sm" variant="ghost"
                      className={confirmandoEliminar === equipo.id ? 'h-8 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-8 px-2 text-xs text-red-600'}
                      onClick={() => eliminarEquipo(equipo)}
                    >
                      {confirmandoEliminar === equipo.id ? '¿Confirmar?' : '🗑️'}
                    </Button>
                  </div>
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
        onClose={() => { setModalCrear(false); setEquipoEditar(null) }}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        equipoExistente={equipoEditar}
        onCreated={fetch}
      />
      {logEquipo && (
        <RegistrarLogEquipoModal
          open={!!logEquipo}
          onClose={() => setLogEquipo(null)}
          equipoId={logEquipo.id}
          equipoNombre={`${tipoInfo(logEquipo.tipo).label}${logEquipo.numero_serie ? ` — S/N ${logEquipo.numero_serie}` : ''}`}
          fincaId={loteActual.finca_id}
          onCreated={fetch}
        />
      )}
    </div>
  )
}
