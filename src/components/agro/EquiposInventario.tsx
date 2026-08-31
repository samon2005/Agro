'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
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
  lote_id: string
  numero_serie: string | null
  marca: string | null
  proximo_mantenimiento: string | null
  especie: EspecieFinca
  tabla: 'equipos_aves' | 'equipos_cerdos' | 'equipos_pollo'
}

const ESPECIE_LABEL: Record<EspecieFinca, { label: string; icon: string }> = {
  aves_ponedoras: { label: 'Aves', icon: '🐔' },
  cerdos: { label: 'Cerdos', icon: '🐷' },
  pollo_engorde: { label: 'Pollo', icon: '🐥' },
}

const TIPO_LABEL: Record<string, { label: string; icon: string }> = {
  ventilador: { label: 'Ventilador', icon: '💨' },
  banda_recoleccion: { label: 'Banda de recolección', icon: '🔄' },
  comedero: { label: 'Comedero', icon: '🍽️' },
  comedero_automatico: { label: 'Comedero automático', icon: '🍽️' },
  bebedero: { label: 'Bebedero', icon: '💧' },
  lampara: { label: 'Lámpara / Iluminación', icon: '💡' },
  calefactor: { label: 'Calefactor', icon: '🔥' },
  cuenta_huevos: { label: 'Máquina cuenta huevos', icon: '🥚' },
  extractor: { label: 'Extractor', icon: '🌀' },
  iluminacion: { label: 'Iluminación', icon: '💡' },
  bomba_agua: { label: 'Bomba de agua', icon: '🚰' },
  otro: { label: 'Otro', icon: '⚙️' },
}

function tipoInfo(tipo: string) {
  return TIPO_LABEL[tipo] ?? { label: tipo, icon: '⚙️' }
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
  const [lotesNombre, setLotesNombre] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtroEspecie, setFiltroEspecie] = useState<string>('todas')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [borrando, setBorrando] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null)
  const especiesKey = especies.join(',')

  const fetchEquipos = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const queries: PromiseLike<{ especie: EspecieFinca; tabla: EquipoFila['tabla']; data: EquipoFila[] }>[] = []
    const loteQueries: PromiseLike<{ data: { id: string; nombre: string }[] | null }>[] = []

    if (especies.includes('aves_ponedoras')) {
      queries.push(
        supabase.from('equipos_aves').select('id, nombre, tipo, estado, lote_id, numero_serie, marca, proximo_mantenimiento').eq('finca_id', fincaId)
          .then(r => ({ especie: 'aves_ponedoras' as const, tabla: 'equipos_aves' as const, data: (r.data ?? []) as unknown as EquipoFila[] }))
      )
      loteQueries.push(supabase.from('lotes_aves').select('id, nombre').eq('finca_id', fincaId))
    }
    if (especies.includes('cerdos')) {
      queries.push(
        supabase.from('equipos_cerdos').select('id, nombre, tipo, estado, lote_id, numero_serie, marca, proximo_mantenimiento').eq('finca_id', fincaId)
          .then(r => ({ especie: 'cerdos' as const, tabla: 'equipos_cerdos' as const, data: (r.data ?? []) as unknown as EquipoFila[] }))
      )
      loteQueries.push(supabase.from('lotes_cerdos').select('id, nombre').eq('finca_id', fincaId))
    }
    if (especies.includes('pollo_engorde')) {
      queries.push(
        supabase.from('equipos_pollo').select('id, nombre, tipo, estado, lote_id, numero_serie, marca, proximo_mantenimiento').eq('finca_id', fincaId)
          .then(r => ({ especie: 'pollo_engorde' as const, tabla: 'equipos_pollo' as const, data: (r.data ?? []) as unknown as EquipoFila[] }))
      )
      loteQueries.push(supabase.from('lotes_pollo').select('id, nombre').eq('finca_id', fincaId))
    }

    const [resultados, lotesResultados] = await Promise.all([Promise.all(queries), Promise.all(loteQueries)])
    const combinados = resultados.flatMap(r => r.data.map(e => ({ ...e, especie: r.especie, tabla: r.tabla })))
    const nombres: Record<string, string> = {}
    for (const lr of lotesResultados) for (const l of lr.data ?? []) nombres[l.id] = l.nombre
    setEquipos(combinados)
    setLotesNombre(nombres)
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
    const { error } = await supabase.from(equipo.tabla).delete().eq('id', equipo.id)
    if (error) {
      toast.error('Error al eliminar el equipo')
    } else {
      setEquipos(prev => prev.filter(e => e.id !== equipo.id))
      toast.success(`Equipo eliminado: ${tipoInfo(equipo.tipo).label}${equipo.numero_serie ? ` (S/N ${equipo.numero_serie})` : ''}`)
    }
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

  const filtrados = equipos.filter(e =>
    (filtroEspecie === 'todas' || e.especie === filtroEspecie) &&
    (filtroEstado === 'todos' || e.estado === filtroEstado)
  )

  const grupos = Object.values(
    filtrados.reduce<Record<string, { tipo: string; especie: EspecieFinca; total: number; operativos: number; falla: number; mantenimiento: number; inactivo: number }>>((acc, e) => {
      const key = `${e.especie}-${e.tipo}`
      if (!acc[key]) acc[key] = { tipo: e.tipo, especie: e.especie, total: 0, operativos: 0, falla: 0, mantenimiento: 0, inactivo: 0 }
      acc[key].total++
      if (e.estado === 'operativo') acc[key].operativos++
      if (e.estado === 'falla') acc[key].falla++
      if (e.estado === 'mantenimiento') acc[key].mantenimiento++
      if (e.estado === 'inactivo') acc[key].inactivo++
      return acc
    }, {})
  ).sort((a, b) => tipoInfo(a.tipo).label.localeCompare(tipoInfo(b.tipo).label))

  const equiposDeCategoria = categoriaSeleccionada
    ? filtrados.filter(e => `${e.especie}-${e.tipo}` === categoriaSeleccionada)
    : []

  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <Select
          value={filtroEspecie}
          onValueChange={(v: string | null) => { setFiltroEspecie(v ?? 'todas'); setCategoriaSeleccionada(null) }}
          items={{ todas: 'Todas las especies', ...Object.fromEntries(especies.map(esp => [esp, `${ESPECIE_LABEL[esp].icon} ${ESPECIE_LABEL[esp].label}`])) }}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Especie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las especies</SelectItem>
            {especies.map(esp => <SelectItem key={esp} value={esp}>{ESPECIE_LABEL[esp].icon} {ESPECIE_LABEL[esp].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={filtroEstado}
          onValueChange={(v: string | null) => { setFiltroEstado(v ?? 'todos'); setCategoriaSeleccionada(null) }}
          items={{ todos: 'Todos los estados', operativo: 'Activos', inactivo: 'Inactivos', falla: 'Con falla', mantenimiento: 'En mantenimiento' }}
        >
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

      {grupos.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-5xl mb-4">⚙️</p>
          <p className="text-lg font-semibold text-gray-700">Sin equipos registrados</p>
          <p className="text-sm text-gray-400 mt-1">Los equipos se registran desde la pestaña &quot;Equipos&quot; de cada especie (Aves, Cerdos, Pollo)</p>
        </div>
      ) : categoriaSeleccionada == null ? (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categorías de equipo</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {grupos.map(g => {
              const info = tipoInfo(g.tipo)
              const esp = ESPECIE_LABEL[g.especie]
              return (
                <Card
                  key={`${g.especie}-${g.tipo}`}
                  className="border-gray-200 cursor-pointer hover:border-green-400 transition-colors"
                  onClick={() => setCategoriaSeleccionada(`${g.especie}-${g.tipo}`)}
                >
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{info.icon}</span>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{info.label}</p>
                        <p className="text-xs text-gray-400">{esp.icon} {esp.label}</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{g.total}</p>
                    <div className="flex flex-wrap gap-1">
                      {g.operativos > 0 && <Badge className="text-[10px] bg-green-100 text-green-700">{g.operativos} activos</Badge>}
                      {g.falla > 0 && <Badge className="text-[10px] bg-red-100 text-red-700">{g.falla} con falla</Badge>}
                      {g.mantenimiento > 0 && <Badge className="text-[10px] bg-yellow-100 text-yellow-700">{g.mantenimiento} en mtto.</Badge>}
                      {g.inactivo > 0 && <Badge className="text-[10px] bg-gray-100 text-gray-500">{g.inactivo} inactivos</Badge>}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setCategoriaSeleccionada(null)}>
            ← Todas las categorías
          </Button>
          {equiposDeCategoria.map(equipo => {
            const cfg = estadoConfig(equipo.estado)
            const mtoSt = mtoStatus(equipo.proximo_mantenimiento)
            const esp = ESPECIE_LABEL[equipo.especie]
            return (
              <Card key={`${equipo.tabla}-${equipo.id}`} className={`border-2 ${cfg.cls}`}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div>
                      <p className="font-semibold text-sm text-gray-800 leading-tight">{equipo.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {equipo.numero_serie ? `S/N: ${equipo.numero_serie}` : 'Sin N° de serie'}
                        {equipo.marca ? ` · ${equipo.marca}` : ''}
                      </p>
                      <p className="text-xs text-gray-400">{esp.icon} {esp.label} · 🏠 {lotesNombre[equipo.lote_id] ?? 'Galpón'}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
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
                      className={confirmando === equipo.id ? 'text-xs text-white bg-red-600 hover:bg-red-700 border-red-600' : 'text-xs text-red-600 border-red-200 hover:bg-red-50'}
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
