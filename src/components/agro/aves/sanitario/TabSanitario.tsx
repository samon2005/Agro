'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { calcularFechaLiberacion } from '@/lib/sanitario'
import RegistrarVacunacionModal from './RegistrarVacunacionModal'
import RegistrarMedicacionModal from './RegistrarMedicacionModal'
import RegistrarEventoClinicoModal from './RegistrarEventoClinicoModal'
import RegistrarDesinfeccionModal from './RegistrarDesinfeccionModal'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Vacunacion = Database['public']['Tables']['vacunaciones_aves']['Row']
type Medicacion = Database['public']['Tables']['medicaciones_aves']['Row']
type EventoClinico = Database['public']['Tables']['eventos_clinicos_aves']['Row']
type Desinfeccion = Database['public']['Tables']['desinfecciones_aves']['Row']
type Recordatorio = Database['public']['Tables']['recordatorios_medicacion_aves']['Row']

type SubTab = 'vacunas' | 'medicaciones' | 'eventos' | 'desinfecciones'

interface Props { loteActual: LoteAves }

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

const TIPO_LABELS: Record<string, string> = {
  respiratorio: '🫁 Respiratorio', locomotor: '🦴 Locomotor', digestivo: '🫃 Digestivo',
  reproductivo: '🥚 Reproductivo', nervioso: '🧠 Nervioso', piel: '🐾 Piel/Plumas', otro: '❓ Otro'
}

export default function TabSanitario({ loteActual }: Props) {
  const supabase = createClient()
  const [subTab, setSubTab] = useState<SubTab>('vacunas')
  const [vacunas, setVacunas] = useState<Vacunacion[]>([])
  const [medicaciones, setMedicaciones] = useState<Medicacion[]>([])
  const [eventos, setEventos] = useState<EventoClinico[]>([])
  const [desinfecciones, setDesinfecciones] = useState<Desinfeccion[]>([])
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVacuna, setModalVacuna] = useState(false)
  const [modalMed, setModalMed] = useState(false)
  const [modalEvento, setModalEvento] = useState(false)
  const [modalDesinfeccion, setModalDesinfeccion] = useState(false)
  const [eventoClinicoIdActivo, setEventoClinicoIdActivo] = useState<string | null>(null)
  const [vacunaEditar, setVacunaEditar] = useState<Vacunacion | null>(null)
  const [medEditar, setMedEditar] = useState<Medicacion | null>(null)
  const [eventoEditar, setEventoEditar] = useState<EventoClinico | null>(null)
  const [desinfeccionEditar, setDesinfeccionEditar] = useState<Desinfeccion | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [v, m, ev, d, r] = await Promise.all([
      supabase.from('vacunaciones_aves').select('*').eq('lote_id', loteActual.id).order('fecha_aplicacion', { ascending: false }),
      supabase.from('medicaciones_aves').select('*').eq('lote_id', loteActual.id).order('fecha_inicio', { ascending: false }),
      supabase.from('eventos_clinicos_aves').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
      supabase.from('desinfecciones_aves').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
      supabase.from('recordatorios_medicacion_aves').select('*').eq('lote_id', loteActual.id).eq('completado', false).order('fecha'),
    ])
    setVacunas(v.data ?? [])
    setMedicaciones(m.data ?? [])
    setEventos(ev.data ?? [])
    setDesinfecciones(d.data ?? [])
    setRecordatorios(r.data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  async function completarRecordatorio(id: string) {
    await supabase.from('recordatorios_medicacion_aves').update({ completado: true }).eq('id', id)
    setRecordatorios(prev => prev.filter(r => r.id !== id))
  }

  async function eliminar(tabla: 'vacunaciones_aves' | 'medicaciones_aves' | 'eventos_clinicos_aves' | 'desinfecciones_aves', id: string) {
    const key = `${tabla}-${id}`
    if (confirmandoEliminar !== key) { setConfirmandoEliminar(key); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) { toast.error('Error al eliminar el registro'); return }
    toast.success('Registro eliminado')
    fetchAll()
  }

  useEffect(() => { fetchAll() }, [fetchAll])

  const hoy = new Date()
  const en7dias = new Date(); en7dias.setDate(hoy.getDate() + 7)

  const enRetiro = medicaciones.filter(m => {
    if (!m.periodo_retiro_dias || !m.fecha_fin) return false
    return calcularFechaLiberacion(m.fecha_fin, m.periodo_retiro_dias) >= hoy
  })

  const eventosConTratamiento = new Set(medicaciones.filter(m => m.evento_clinico_id).map(m => m.evento_clinico_id))

  const medicamentoPorId = new Map(medicaciones.map(m => [m.id, m.medicamento]))
  const hoyStr = hoy.toISOString().split('T')[0]
  const recordatoriosVisibles = recordatorios.slice(0, 5)

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function vacunaRowClass(v: Vacunacion) {
    if (!v.proxima_dosis) return ''
    const pd = new Date(v.proxima_dosis + 'T00:00:00')
    if (pd < hoy) return 'bg-red-50'
    if (pd <= en7dias) return 'bg-yellow-50'
    return ''
  }

  const subTabItems: { id: SubTab; label: string; count: number }[] = [
    { id: 'vacunas', label: '💉 Vacunaciones', count: vacunas.length },
    { id: 'medicaciones', label: '💊 Tratamientos', count: medicaciones.length },
    { id: 'eventos', label: '🏥 Eventos Clínicos', count: eventos.length },
    { id: 'desinfecciones', label: '🧴 Desinfección', count: desinfecciones.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Sanitario y Bioseguridad</h2>
        <div>
          {subTab === 'vacunas' && <Button onClick={() => { setVacunaEditar(null); setModalVacuna(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">+ Registrar vacuna</Button>}
          {subTab === 'medicaciones' && <Button onClick={() => { setEventoClinicoIdActivo(null); setMedEditar(null); setModalMed(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">+ Registrar tratamiento</Button>}
          {subTab === 'eventos' && <Button onClick={() => { setEventoEditar(null); setModalEvento(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">+ Registrar evento</Button>}
          {subTab === 'desinfecciones' && <Button onClick={() => { setDesinfeccionEditar(null); setModalDesinfeccion(true) }} className="bg-green-700 hover:bg-green-800 text-white text-sm">+ Registrar desinfección</Button>}
        </div>
      </div>

      {enRetiro.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          ⚠️ <strong>Período de retiro activo:</strong> {enRetiro.map(m => {
            const fin = calcularFechaLiberacion(m.fecha_fin!, m.periodo_retiro_dias!)
            return `${m.medicamento} (hasta ${fin.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })})`
          }).join(', ')} — Huevos no comercializables
        </div>
      )}

      {recordatorios.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg space-y-2">
          <p className="text-sm font-semibold text-blue-800">🔔 Recordatorios de tratamiento</p>
          <div className="space-y-1.5">
            {recordatoriosVisibles.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className={cn(r.fecha <= hoyStr ? 'text-red-700 font-medium' : 'text-blue-700')}>
                  {r.fecha <= hoyStr ? '⏰' : '📅'} Aplicar <strong>{medicamentoPorId.get(r.medicacion_id) ?? 'medicamento'}</strong> — {fmt(r.fecha)}{r.hora ? ` a las ${r.hora}` : ''}
                </span>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => completarRecordatorio(r.id)}>
                  ✓ Hecho
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini-tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {subTabItems.map(item => (
          <button
            key={item.id}
            onClick={() => setSubTab(item.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              subTab === item.id
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {item.label}
            {item.count > 0 && <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{item.count}</span>}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : subTab === 'vacunas' ? (
            vacunas.length === 0 ? (
              <EmptyState emoji="💉" label="Sin vacunaciones registradas" action={() => setModalVacuna(true)} actionLabel="+ Registrar vacuna" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vacuna</TableHead>
                      <TableHead>Vía</TableHead>
                      <TableHead>Lote vacuna</TableHead>
                      <TableHead className="text-right">N° aves</TableHead>
                      <TableHead>Próxima vacunación</TableHead>
                      <TableHead>Encargado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vacunas.map(v => (
                      <TableRow key={v.id} className={vacunaRowClass(v)}>
                        <TableCell className="text-sm">{fmt(v.fecha_aplicacion)}</TableCell>
                        <TableCell className="font-medium text-sm">{v.vacuna}</TableCell>
                        <TableCell className="text-sm text-gray-500">{v.via_administracion ?? '—'}</TableCell>
                        <TableCell className="text-sm font-mono text-gray-500">{v.lote_vacuna ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{v.numero_aves?.toLocaleString('es-CO') ?? '—'}</TableCell>
                        <TableCell className="text-sm">
                          {v.proxima_dosis ? (
                            <span className={new Date(v.proxima_dosis + 'T00:00:00') < hoy ? 'text-red-600 font-semibold' : new Date(v.proxima_dosis + 'T00:00:00') <= en7dias ? 'text-amber-600 font-semibold' : ''}>
                              {fmt(v.proxima_dosis)}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{v.veterinario ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setVacunaEditar(v); setModalVacuna(true) }}>✏️</Button>
                            <Button
                              size="sm" variant="ghost"
                              className={confirmandoEliminar === `vacunaciones_aves-${v.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                              onClick={() => eliminar('vacunaciones_aves', v.id)}
                            >
                              {confirmandoEliminar === `vacunaciones_aves-${v.id}` ? '¿Confirmar?' : '🗑️'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : subTab === 'medicaciones' ? (
            medicaciones.length === 0 ? (
              <EmptyState emoji="💊" label="Sin tratamientos registrados" action={() => { setEventoClinicoIdActivo(null); setModalMed(true) }} actionLabel="+ Registrar tratamiento" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Medicamento</TableHead>
                      <TableHead>Principio activo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Retiro (días)</TableHead>
                      <TableHead>Liberación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medicaciones.map(m => {
                      const activo = enRetiro.some(r => r.id === m.id)
                      const sinRetiro = m.periodo_retiro_dias === 0
                      const liberacion = m.fecha_fin && m.periodo_retiro_dias
                        ? calcularFechaLiberacion(m.fecha_fin, m.periodo_retiro_dias)
                        : null
                      return (
                        <TableRow key={m.id} className={activo ? 'bg-amber-50' : ''}>
                          <TableCell className="text-sm">{fmt(m.fecha_inicio)}</TableCell>
                          <TableCell className="text-sm">{m.fecha_fin ? fmt(m.fecha_fin) : '—'}</TableCell>
                          <TableCell className="font-medium text-sm">{m.medicamento}</TableCell>
                          <TableCell className="text-sm text-gray-500">{m.principio_activo ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-500">{m.motivo ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{m.periodo_retiro_dias ?? '—'}</TableCell>
                          <TableCell className="text-sm font-medium text-amber-700">
                            {sinRetiro ? '—' : liberacion ? liberacion.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                          </TableCell>
                          <TableCell>
                            {activo ? (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">En retiro</Badge>
                            ) : sinRetiro ? (
                              <Badge className="text-[10px] bg-green-100 text-green-700 border-green-300">Comercializable</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">—</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setEventoClinicoIdActivo(m.evento_clinico_id); setMedEditar(m); setModalMed(true) }}>✏️</Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === `medicaciones_aves-${m.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminar('medicaciones_aves', m.id)}
                              >
                                {confirmandoEliminar === `medicaciones_aves-${m.id}` ? '¿Confirmar?' : '🗑️'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : subTab === 'eventos' ? (
            eventos.length === 0 ? (
              <EmptyState emoji="🏥" label="Sin eventos clínicos" action={() => setModalEvento(true)} actionLabel="+ Registrar evento" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Afectadas</TableHead>
                      <TableHead className="text-right">Muertas</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map(ev => {
                      const tieneTratamiento = eventosConTratamiento.has(ev.id)
                      return (
                        <TableRow key={ev.id}>
                          <TableCell className="text-sm">{fmt(ev.fecha)}</TableCell>
                          <TableCell className="text-sm">{TIPO_LABELS[ev.tipo_evento] ?? ev.tipo_evento}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{ev.descripcion}</TableCell>
                          <TableCell className="text-right text-sm">{ev.aves_afectadas ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{ev.aves_muertas || '—'}</TableCell>
                          <TableCell className="text-sm text-gray-500 max-w-[150px] truncate">{ev.accion_tomada ?? '—'}</TableCell>
                          <TableCell>
                            <Badge className={tieneTratamiento ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}>
                              {tieneTratamiento ? 'En tratamiento' : 'Sin tratamiento'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => { setEventoClinicoIdActivo(ev.id); setMedEditar(null); setModalMed(true) }}
                              >
                                + Tratamiento
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setEventoEditar(ev); setModalEvento(true) }}>✏️</Button>
                              <Button
                                size="sm" variant="ghost"
                                className={confirmandoEliminar === `eventos_clinicos_aves-${ev.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                                onClick={() => eliminar('eventos_clinicos_aves', ev.id)}
                              >
                                {confirmandoEliminar === `eventos_clinicos_aves-${ev.id}` ? '¿Confirmar?' : '🗑️'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            desinfecciones.length === 0 ? (
              <EmptyState emoji="🧴" label="Sin desinfecciones registradas" action={() => setModalDesinfeccion(true)} actionLabel="+ Registrar desinfección" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Previene</TableHead>
                      <TableHead>Dosis</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {desinfecciones.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{fmt(d.fecha)}</TableCell>
                        <TableCell className="font-medium text-sm">{d.producto}</TableCell>
                        <TableCell className="text-sm text-gray-500">{d.previene ?? '—'}</TableCell>
                        <TableCell className="text-sm text-gray-500">{d.dosis ?? '—'}</TableCell>
                        <TableCell className="text-sm text-gray-500">{d.responsable ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{d.costo ? cop(d.costo) : '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setDesinfeccionEditar(d); setModalDesinfeccion(true) }}>✏️</Button>
                            <Button
                              size="sm" variant="ghost"
                              className={confirmandoEliminar === `desinfecciones_aves-${d.id}` ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                              onClick={() => eliminar('desinfecciones_aves', d.id)}
                            >
                              {confirmandoEliminar === `desinfecciones_aves-${d.id}` ? '¿Confirmar?' : '🗑️'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <RegistrarVacunacionModal
        open={modalVacuna}
        onClose={() => { setModalVacuna(false); setVacunaEditar(null) }}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        vacunacionExistente={vacunaEditar}
        onCreated={fetchAll}
      />
      <RegistrarMedicacionModal
        open={modalMed}
        onClose={() => { setModalMed(false); setEventoClinicoIdActivo(null); setMedEditar(null) }}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        eventoClinicoId={eventoClinicoIdActivo}
        medicacionExistente={medEditar}
        onCreated={fetchAll}
      />
      <RegistrarEventoClinicoModal
        open={modalEvento}
        onClose={() => { setModalEvento(false); setEventoEditar(null) }}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        eventoExistente={eventoEditar}
        onCreated={eventoId => {
          fetchAll()
          if (!eventoEditar) { setEventoClinicoIdActivo(eventoId); setMedEditar(null); setSubTab('medicaciones'); setModalMed(true) }
        }}
      />
      <RegistrarDesinfeccionModal
        open={modalDesinfeccion}
        onClose={() => { setModalDesinfeccion(false); setDesinfeccionEditar(null) }}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        desinfeccionExistente={desinfeccionEditar}
        onCreated={fetchAll}
      />
    </div>
  )
}

function EmptyState({ emoji, label, action, actionLabel }: { emoji: string; label: string; action: () => void; actionLabel: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-4xl mb-2">{emoji}</p>
      <p className="text-gray-600 font-medium">{label}</p>
      <Button onClick={action} className="mt-4 bg-green-700 hover:bg-green-800 text-white">{actionLabel}</Button>
    </div>
  )
}
