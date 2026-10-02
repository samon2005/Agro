'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EspecieFinca } from '@/lib/especies'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { avisoCostoVinculado } from '@/lib/eliminarConAviso'

type EquipoFila = {
  id: string
  nombre: string
  tipo: string
  estado: string
  lote_id: string
  numero_serie: string | null
  marca: string | null
  proximo_mantenimiento: string | null
}

const TABLAS: Record<EspecieFinca, { equipos: 'equipos_aves' | 'equipos_cerdos' | 'equipos_pollo'; lotes: 'lotes_aves' | 'lotes_cerdos' | 'lotes_pollo'; lugar: string }> = {
  aves_ponedoras: { equipos: 'equipos_aves', lotes: 'lotes_aves', lugar: 'Galpón' },
  pollo_engorde: { equipos: 'equipos_pollo', lotes: 'lotes_pollo', lugar: 'Galpón' },
  cerdos: { equipos: 'equipos_cerdos', lotes: 'lotes_cerdos', lugar: 'Lote' },
}

const TIPO_LABEL: Record<string, { label: string; icon: NombreIcono }> = {
  ventilador: { label: 'Ventilador', icon: 'ventilador' },
  banda_recoleccion: { label: 'Banda de recolección', icon: 'ciclo' },
  comedero: { label: 'Comedero', icon: 'alimento' },
  comedero_automatico: { label: 'Comedero automático', icon: 'alimento' },
  bebedero: { label: 'Bebedero', icon: 'gota' },
  lampara: { label: 'Lámpara / Iluminación', icon: 'idea' },
  calefactor: { label: 'Calefactor', icon: 'fuego' },
  cuenta_huevos: { label: 'Máquina cuenta huevos', icon: 'huevo' },
  extractor: { label: 'Extractor', icon: 'viento' },
  iluminacion: { label: 'Iluminación', icon: 'idea' },
  bomba_agua: { label: 'Bomba de agua', icon: 'agua' },
  otro: { label: 'Otro', icon: 'herramienta' },
}

function tipoInfo(tipo: string) {
  return TIPO_LABEL[tipo] ?? { label: tipo, icon: 'herramienta' as NombreIcono }
}

const ESTADOS: Record<string, { label: string; badge: string }> = {
  operativo: { label: 'Activo', badge: 'bg-green-100 text-green-700' },
  falla: { label: 'Con falla', badge: 'bg-red-100 text-red-700' },
  mantenimiento: { label: 'En mantenimiento', badge: 'bg-yellow-100 text-yellow-700' },
  planificado: { label: 'Planificado', badge: 'bg-blue-100 text-blue-700' },
  inactivo: { label: 'Inactivo', badge: 'bg-gray-100 text-gray-500' },
}

function estadoInfo(estado: string) {
  return ESTADOS[estado] ?? { label: estado, badge: 'bg-gray-100 text-gray-600' }
}

/**
 * Todos los equipos de la finca en una tabla, con el galpón en que está cada uno.
 * Dentro de un galpón solo se ven los suyos; aquí se ven juntos y se filtran por
 * galpón, tipo y estado. Se registran desde la pestaña Equipos de cada galpón.
 */
export default function EquiposInventario({ fincaId, especie, onConteo }: {
  fincaId: string
  especie: EspecieFinca
  /** Cuántos equipos tiene la finca, para la pestaña y la vista general */
  onConteo?: (total: number) => void
}) {
  const [equipos, setEquipos] = useState<EquipoFila[]>([])
  const [lotesNombre, setLotesNombre] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtroLugar, setFiltroLugar] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [borrando, setBorrando] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const tablas = TABLAS[especie]

  const fetchEquipos = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: eq }, { data: lotes }] = await Promise.all([
      supabase.from(tablas.equipos)
        .select('id, nombre, tipo, estado, lote_id, numero_serie, marca, proximo_mantenimiento')
        .eq('finca_id', fincaId),
      supabase.from(tablas.lotes).select('id, nombre').eq('finca_id', fincaId),
    ])
    const filas = (eq ?? []) as unknown as EquipoFila[]
    setEquipos(filas)
    setLotesNombre(Object.fromEntries(((lotes ?? []) as { id: string; nombre: string }[]).map(l => [l.id, l.nombre])))
    onConteo?.(filas.length)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId, especie])

  useEffect(() => { fetchEquipos() }, [fetchEquipos])

  async function eliminar(equipo: EquipoFila) {
    if (confirmando !== equipo.id) {
      setConfirmando(equipo.id)
      // Igual que en el galpón: si el equipo tiene un costo en Finanzas, se va con él
      if (especie === 'aves_ponedoras') {
        const aviso = await avisoCostoVinculado(createClient(), 'equipo_id', equipo.id)
        if (aviso) toast.warning(aviso)
      }
      return
    }
    setConfirmando(null)
    setBorrando(equipo.id)
    const supabase = createClient()
    const { error } = await supabase.from(tablas.equipos).delete().eq('id', equipo.id)
    if (error) {
      toast.error('Error al eliminar el equipo')
    } else {
      const quedan = equipos.filter(e => e.id !== equipo.id)
      setEquipos(quedan)
      onConteo?.(quedan.length)
      toast.success(`Equipo eliminado: ${equipo.nombre}`)
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

  // Varios lotes pueden haber pasado por el mismo galpón: se filtra por su nombre
  const lugarDe = (e: EquipoFila) => lotesNombre[e.lote_id] ?? 'Sin galpón'
  const lugares = [...new Set(equipos.map(lugarDe))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const tipos = [...new Set(equipos.map(e => e.tipo))].sort((a, b) => tipoInfo(a).label.localeCompare(tipoInfo(b).label))
  const estados = [...new Set(equipos.map(e => e.estado))]

  const filtrados = equipos
    .filter(e =>
      (filtroLugar === 'todos' || lugarDe(e) === filtroLugar) &&
      (filtroTipo === 'todos' || e.tipo === filtroTipo) &&
      (filtroEstado === 'todos' || e.estado === filtroEstado))
    .sort((a, b) => lugarDe(a).localeCompare(lugarDe(b), 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre))

  const conFalla = filtrados.filter(e => e.estado === 'falla').length
  const mtoVencido = filtrados.filter(e => mtoStatus(e.proximo_mantenimiento) === 'vencido').length

  if (loading) {
    return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  }

  if (equipos.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-5xl text-gray-300"><Ic n="ajustes" /></p>
        <p className="text-lg font-semibold text-gray-700">Sin equipos registrados</p>
        <p className="mt-1 text-sm text-gray-400">Los equipos se registran en la pestaña &quot;Equipos&quot; de cada {tablas.lugar.toLowerCase()}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filtroLugar}
          onValueChange={(v: string | null) => setFiltroLugar(v ?? 'todos')}
          items={{ todos: `Todos los ${tablas.lugar === 'Galpón' ? 'galpones' : 'lotes'}`, ...Object.fromEntries(lugares.map(l => [l, l])) }}
        >
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los {tablas.lugar === 'Galpón' ? 'galpones' : 'lotes'}</SelectItem>
            {lugares.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={filtroTipo}
          onValueChange={(v: string | null) => setFiltroTipo(v ?? 'todos')}
          items={{ todos: 'Todos los tipos', ...Object.fromEntries(tipos.map(t => [t, tipoInfo(t).label])) }}
        >
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {tipos.map(t => <SelectItem key={t} value={t}>{tipoInfo(t).label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={filtroEstado}
          onValueChange={(v: string | null) => setFiltroEstado(v ?? 'todos')}
          items={{ todos: 'Todos los estados', ...Object.fromEntries(estados.map(s => [s, estadoInfo(s).label])) }}
        >
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {estados.map(s => <SelectItem key={s} value={s}>{estadoInfo(s).label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="ml-auto text-sm text-gray-500">
          {filtrados.length} de {equipos.length} equipos
          {conFalla > 0 && <span className="ml-2 font-medium text-red-600">· {conFalla} con falla</span>}
          {mtoVencido > 0 && <span className="ml-2 font-medium text-amber-700">· {mtoVencido} con mantenimiento vencido</span>}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Ningún equipo coincide con los filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tablas.lugar}</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Próx. mantenimiento</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map(equipo => {
                    const est = estadoInfo(equipo.estado)
                    const tipo = tipoInfo(equipo.tipo)
                    const mto = mtoStatus(equipo.proximo_mantenimiento)
                    return (
                      <TableRow key={equipo.id}>
                        <TableCell className="py-2 text-sm font-medium text-gray-800">{lugarDe(equipo)}</TableCell>
                        <TableCell className="py-2">
                          <p className="text-sm font-medium text-gray-800">{equipo.nombre}</p>
                          <p className="text-xs text-gray-400">
                            {equipo.numero_serie ? `S/N ${equipo.numero_serie}` : 'Sin N° de serie'}
                            {equipo.marca ? ` · ${equipo.marca}` : ''}
                          </p>
                        </TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">
                          <span className="inline-flex items-center gap-1.5"><Ic n={tipo.icon} className="size-4 text-gray-400" /> {tipo.label}</span>
                        </TableCell>
                        <TableCell className="py-2"><Badge className={`text-[10px] ${est.badge}`}>{est.label}</Badge></TableCell>
                        <TableCell className="py-2 text-sm">
                          <span className={mto === 'vencido' ? 'font-medium text-red-600' : mto === 'pronto' ? 'font-medium text-amber-600' : 'text-gray-700'}>
                            {equipo.proximo_mantenimiento
                              ? new Date(equipo.proximo_mantenimiento + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </span>
                          {mto === 'vencido' && <Badge className="ml-1 bg-red-100 text-[9px] text-red-700">Vencido</Badge>}
                          {mto === 'pronto' && <Badge className="ml-1 bg-yellow-100 text-[9px] text-yellow-700">Pronto</Badge>}
                        </TableCell>
                        <TableCell className="py-2 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className={confirmando === equipo.id ? 'border-red-600 bg-red-600 text-xs text-white hover:bg-red-700' : 'border-red-200 text-xs text-red-600 hover:bg-red-50'}
                            disabled={borrando === equipo.id}
                            onClick={() => eliminar(equipo)}
                          >
                            {borrando === equipo.id ? 'Eliminando...' : confirmando === equipo.id ? '¿Confirmar?' : 'Eliminar'}
                          </Button>
                          {confirmando === equipo.id && (
                            <Button size="sm" variant="outline" className="ml-1.5 text-xs" onClick={() => setConfirmando(null)}>Cancelar</Button>
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
    </div>
  )
}
