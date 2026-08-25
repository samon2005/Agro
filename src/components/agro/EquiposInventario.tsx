'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EspecieFinca } from '@/lib/especies'

type EquipoFila = {
  id: string
  nombre: string
  tipo: string
  estado: string
  ubicacion: string | null
  proximo_mantenimiento: string | null
  especie: EspecieFinca
  tabla: 'equipos_aves' | 'equipos_cerdos' | 'equipos_pollo'
}

const ESPECIE_LABEL: Record<EspecieFinca, { label: string; icon: string }> = {
  aves_ponedoras: { label: 'Aves', icon: '🐔' },
  cerdos: { label: 'Cerdos', icon: '🐷' },
  pollo_engorde: { label: 'Pollo', icon: '🐥' },
}

const TIPO_EMOJI: Record<string, string> = {
  ventilador: '💨', banda_recoleccion: '🔄', comedero: '🍽️', comedero_automatico: '🍽️',
  bebedero: '💧', lampara: '💡', calefactor: '🔥', cuenta_huevos: '🥚',
  extractor: '🌀', iluminacion: '💡', bomba_agua: '🚰', otro: '⚙️',
}

function estadoConfig(estado: string) {
  switch (estado) {
    case 'operativo': return { cls: 'border-green-300 bg-green-50', badge: 'bg-green-100 text-green-700', label: 'Activo' }
    case 'falla': return { cls: 'border-red-300 bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Falla' }
    case 'mantenimiento': return { cls: 'border-yellow-300 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', label: 'Mantenimiento' }
    case 'inactivo': return { cls: 'border-gray-200 bg-gray-50', badge: 'bg-gray-100 text-gray-500', label: 'Inactivo' }
    default: return { cls: 'border-gray-200', badge: 'bg-gray-100 text-gray-600', label: estado }
  }
}

export default function EquiposInventario({ fincaId, especies }: { fincaId: string; especies: EspecieFinca[] }) {
  const [equipos, setEquipos] = useState<EquipoFila[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEspecie, setFiltroEspecie] = useState<string>('todas')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [borrando, setBorrando] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const especiesKey = especies.join(',')

  const fetchEquipos = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const queries: PromiseLike<{ especie: EspecieFinca; tabla: EquipoFila['tabla']; data: EquipoFila[] }>[] = []

    if (especies.includes('aves_ponedoras')) {
      queries.push(
        supabase.from('equipos_aves').select('id, nombre, tipo, estado, ubicacion, proximo_mantenimiento').eq('finca_id', fincaId)
          .then(r => ({ especie: 'aves_ponedoras' as const, tabla: 'equipos_aves' as const, data: (r.data ?? []) as unknown as EquipoFila[] }))
      )
    }
    if (especies.includes('cerdos')) {
      queries.push(
        supabase.from('equipos_cerdos').select('id, nombre, tipo, estado, ubicacion, proximo_mantenimiento').eq('finca_id', fincaId)
          .then(r => ({ especie: 'cerdos' as const, tabla: 'equipos_cerdos' as const, data: (r.data ?? []) as unknown as EquipoFila[] }))
      )
    }
    if (especies.includes('pollo_engorde')) {
      queries.push(
        supabase.from('equipos_pollo').select('id, nombre, tipo, estado, ubicacion, proximo_mantenimiento').eq('finca_id', fincaId)
          .then(r => ({ especie: 'pollo_engorde' as const, tabla: 'equipos_pollo' as const, data: (r.data ?? []) as unknown as EquipoFila[] }))
      )
    }

    const resultados = await Promise.all(queries)
    const combinados = resultados.flatMap(r => r.data.map(e => ({ ...e, especie: r.especie, tabla: r.tabla })))
    setEquipos(combinados)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId, especiesKey])

  useEffect(() => { fetchEquipos() }, [fetchEquipos])

  async function eliminar(equipo: EquipoFila) {
    if (confirmando !== equipo.id) {
      setConfirmando(equipo.id)
      return
    }
    setConfirmando(null)
    setBorrando(equipo.id)
    const supabase = createClient()
    await supabase.from(equipo.tabla).delete().eq('id', equipo.id)
    setEquipos(prev => prev.filter(e => e.id !== equipo.id))
    setBorrando(null)
  }

  const hoy = new Date()
  const en7dias = new Date(); en7dias.setDate(hoy.getDate() + 7)
  function mtoStatus(fecha: string | null) {
    if (!fecha) return null
    const d = new Date(fecha + 'T00:00:00')
    if (d < hoy) return 'vencido'
    if (d <= en7dias) return 'pronto'
    return 'ok'
  }

  const tiposDisponibles = Array.from(new Set(equipos.map(e => e.tipo))).sort()
  const filtrados = equipos.filter(e =>
    (filtroEspecie === 'todas' || e.especie === filtroEspecie) &&
    (filtroEstado === 'todos' || e.estado === filtroEstado)
  )

  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={filtroEspecie} onValueChange={(v: string | null) => setFiltroEspecie(v ?? 'todas')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Especie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las especies</SelectItem>
            {especies.map(esp => <SelectItem key={esp} value={esp}>{ESPECIE_LABEL[esp].icon} {ESPECIE_LABEL[esp].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={(v: string | null) => setFiltroEstado(v ?? 'todos')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="operativo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
            <SelectItem value="falla">Con falla</SelectItem>
            <SelectItem value="mantenimiento">En mantenimiento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tiposDisponibles.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-5xl mb-4">⚙️</p>
          <p className="text-lg font-semibold text-gray-700">Sin equipos registrados</p>
          <p className="text-sm text-gray-400 mt-1">Los equipos se registran desde la pestaña &quot;Equipos&quot; de cada especie (Aves, Cerdos, Pollo)</p>
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Ningún equipo coincide con los filtros seleccionados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map(equipo => {
            const cfg = estadoConfig(equipo.estado)
            const mtoSt = mtoStatus(equipo.proximo_mantenimiento)
            const esp = ESPECIE_LABEL[equipo.especie]
            return (
              <Card key={`${equipo.tabla}-${equipo.id}`} className={`border-2 ${cfg.cls}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{TIPO_EMOJI[equipo.tipo] ?? '⚙️'}</span>
                      <div>
                        <p className="font-semibold text-sm text-gray-800 leading-tight">{equipo.nombre}</p>
                        <p className="text-xs text-gray-400">{esp.icon} {esp.label}{equipo.ubicacion ? ` · ${equipo.ubicacion}` : ''}</p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
                  </div>

                  <div className="text-xs text-gray-500">
                    <span className="text-gray-400">Prox. mtto.: </span>
                    <span className={mtoSt === 'vencido' ? 'text-red-600 font-medium' : mtoSt === 'pronto' ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                      {equipo.proximo_mantenimiento ? new Date(equipo.proximo_mantenimiento + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                    </span>
                    {mtoSt === 'vencido' && <Badge className="ml-1 text-[9px] bg-red-100 text-red-700">Vencido</Badge>}
                    {mtoSt === 'pronto' && <Badge className="ml-1 text-[9px] bg-yellow-100 text-yellow-700">Pronto</Badge>}
                  </div>

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className={confirmando === equipo.id ? 'w-full text-xs text-white bg-red-600 hover:bg-red-700 border-red-600' : 'w-full text-xs text-red-600 border-red-200 hover:bg-red-50'}
                      disabled={borrando === equipo.id}
                      onClick={() => eliminar(equipo)}
                    >
                      {borrando === equipo.id ? 'Eliminando...' : confirmando === equipo.id ? '¿Confirmar eliminación?' : '🗑️ Eliminar'}
                    </Button>
                    {confirmando === equipo.id && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setConfirmando(null)}>Cancelar</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
