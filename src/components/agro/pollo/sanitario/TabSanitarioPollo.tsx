'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'

type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']
type Vacuna = Database['public']['Tables']['vacunaciones_pollo']['Row']
type Medicacion = Database['public']['Tables']['medicaciones_pollo']['Row']
type Evento = Database['public']['Tables']['eventos_clinicos_pollo']['Row']
type Desinfeccion = Database['public']['Tables']['desinfecciones_pollo']['Row']

interface Props { loteActual: LotePollo }

type SubTab = 'vacunas' | 'medicaciones' | 'eventos' | 'desinfecciones'

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

const VACUNAS_BROILER = ['Newcastle (La Sota)', 'Newcastle (Clon 30)', 'Gumboro (cepa intermedia)', 'Gumboro (cepa intermedia plus)', 'Bronquitis infecciosa (Ma5)', 'Bronquitis infecciosa (4/91)', 'Marek', 'Anemia infecciosa aviar', 'Síndrome de cabeza hinchada (SHS)', 'Viruela aviar']
const VIAS = ['Ocular', 'Nasal', 'Agua de bebida', 'Spray', 'Subcutánea', 'Intramuscular', 'In ovo']
const TIPOS_EVENTO = ['Respiratorio', 'Digestivo', 'Nervioso', 'Locomotor', 'Dérmico', 'Sistémico', 'Otro']

export default function TabSanitarioPollo({ loteActual }: Props) {
  const supabase = createClient()
  const [subTab, setSubTab] = useState<SubTab>('vacunas')
  const [vacunas, setVacunas] = useState<Vacuna[]>([])
  const [medicaciones, setMedicaciones] = useState<Medicacion[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [desinfecciones, setDesinfecciones] = useState<Desinfeccion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [fVacuna, setFVacuna] = useState({ fecha_aplicacion: new Date().toISOString().split('T')[0], vacuna: '', lote_vacuna: '', via_administracion: '', dosis: '', laboratorio: '', numero_aves: '', costo: '', proxima_dosis: '', veterinario: '', observaciones: '' })
  const [fMed, setFMed] = useState({ fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '', medicamento: '', principio_activo: '', via_administracion: '', dosis: '', periodo_retiro_dias: '', motivo: '', costo: '', veterinario: '', observaciones: '' })
  const [fEvento, setFEvento] = useState({ fecha: new Date().toISOString().split('T')[0], tipo_evento: '', descripcion: '', aves_afectadas: '', aves_muertas: '', accion_tomada: '', veterinario: '', observaciones: '' })
  const [fDesinf, setFDesinf] = useState({ fecha: new Date().toISOString().split('T')[0], producto: '', previene: '', dosis: '', responsable: '', costo: '', observaciones: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [v, m, ev, d] = await Promise.all([
      supabase.from('vacunaciones_pollo').select('*').eq('lote_id', loteActual.id).order('fecha_aplicacion', { ascending: false }),
      supabase.from('medicaciones_pollo').select('*').eq('lote_id', loteActual.id).order('fecha_inicio', { ascending: false }),
      supabase.from('eventos_clinicos_pollo').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
      supabase.from('desinfecciones_pollo').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
    ])
    setVacunas(v.data ?? [])
    setMedicaciones(m.data ?? [])
    setEventos(ev.data ?? [])
    setDesinfecciones(d.data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function guardarVacuna(e: React.FormEvent) {
    e.preventDefault()
    if (!fVacuna.vacuna) { toast.error('Selecciona una vacuna'); return }
    setSaving(true)
    const { error } = await supabase.from('vacunaciones_pollo').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha_aplicacion: fVacuna.fecha_aplicacion, vacuna: fVacuna.vacuna,
      lote_vacuna: fVacuna.lote_vacuna || null, via_administracion: fVacuna.via_administracion || null,
      dosis: fVacuna.dosis || null, laboratorio: fVacuna.laboratorio || null,
      numero_aves: fVacuna.numero_aves ? Number(fVacuna.numero_aves) : null,
      costo: fVacuna.costo ? Number(fVacuna.costo) : null,
      proxima_dosis: fVacuna.proxima_dosis || null, veterinario: fVacuna.veterinario || null,
      observaciones: fVacuna.observaciones || null,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Vacunación registrada')
    setShowForm(false)
    fetchData()
  }

  async function guardarMedicacion(e: React.FormEvent) {
    e.preventDefault()
    if (!fMed.medicamento) { toast.error('Ingresa el medicamento'); return }
    setSaving(true)
    const { error } = await supabase.from('medicaciones_pollo').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha_inicio: fMed.fecha_inicio, fecha_fin: fMed.fecha_fin || null,
      medicamento: fMed.medicamento, principio_activo: fMed.principio_activo || null,
      via_administracion: fMed.via_administracion || null, dosis: fMed.dosis || null,
      periodo_retiro_dias: fMed.periodo_retiro_dias ? Number(fMed.periodo_retiro_dias) : 0,
      motivo: fMed.motivo || null, costo: fMed.costo ? Number(fMed.costo) : null,
      veterinario: fMed.veterinario || null, observaciones: fMed.observaciones || null,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Medicación registrada')
    setShowForm(false)
    fetchData()
  }

  async function guardarEvento(e: React.FormEvent) {
    e.preventDefault()
    if (!fEvento.tipo_evento || !fEvento.descripcion) { toast.error('Tipo y descripción requeridos'); return }
    setSaving(true)
    const { error } = await supabase.from('eventos_clinicos_pollo').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha: fEvento.fecha, tipo_evento: fEvento.tipo_evento, descripcion: fEvento.descripcion,
      aves_afectadas: fEvento.aves_afectadas ? Number(fEvento.aves_afectadas) : null,
      aves_muertas: fEvento.aves_muertas ? Number(fEvento.aves_muertas) : null,
      accion_tomada: fEvento.accion_tomada || null, veterinario: fEvento.veterinario || null,
      observaciones: fEvento.observaciones || null, resuelto: false,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Evento registrado')
    setShowForm(false)
    fetchData()
  }

  async function guardarDesinfeccion(e: React.FormEvent) {
    e.preventDefault()
    if (!fDesinf.producto.trim()) { toast.error('Ingresa el producto usado'); return }
    setSaving(true)
    const { error } = await supabase.from('desinfecciones_pollo').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha: fDesinf.fecha, producto: fDesinf.producto.trim(),
      previene: fDesinf.previene || null, dosis: fDesinf.dosis || null,
      responsable: fDesinf.responsable || null,
      costo: fDesinf.costo ? Number(fDesinf.costo) : null,
      observaciones: fDesinf.observaciones || null,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Desinfección registrada')
    setShowForm(false)
    fetchData()
  }

  async function marcarResuelto(id: string) {
    await supabase.from('eventos_clinicos_pollo').update({ resuelto: true }).eq('id', id)
    fetchData()
  }

  const today = new Date().toISOString().split('T')[0]
  const enRetiro = medicaciones.filter(m => {
    if (!m.fecha_fin || !m.periodo_retiro_dias) return false
    const lib = new Date(m.fecha_fin); lib.setDate(lib.getDate() + m.periodo_retiro_dias)
    return lib.toISOString().split('T')[0] >= today
  })

  function fmt(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) }

  return (
    <div className="space-y-4">
      {enRetiro.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          ⚠️ <strong>Período de retiro activo:</strong> {enRetiro.map(m => m.medicamento).join(', ')} — pollos no aptos para faena
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['vacunas', 'medicaciones', 'eventos', 'desinfecciones'] as SubTab[]).map(t => (
            <button key={t} onClick={() => { setSubTab(t); setShowForm(false) }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${subTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'vacunas' ? '💉 Vacunas' : t === 'medicaciones' ? '💊 Medicaciones' : t === 'eventos' ? '🩺 Eventos' : '🧴 Desinfección'}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm">
          {showForm ? 'Cerrar' : `+ Registrar`}
        </Button>
      </div>

      {/* Formularios */}
      {showForm && subTab === 'vacunas' && (
        <Card className="border-yellow-200"><CardContent className="p-4">
          <form onSubmit={guardarVacuna} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Fecha *</Label><Input type="date" value={fVacuna.fecha_aplicacion} onChange={e => setFVacuna(p => ({ ...p, fecha_aplicacion: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Vacuna *</Label>
              <Select value={fVacuna.vacuna} onValueChange={v => setFVacuna(p => ({ ...p, vacuna: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vacuna" /></SelectTrigger>
                <SelectContent>{VACUNAS_BROILER.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vía</Label>
              <Select value={fVacuna.via_administracion} onValueChange={v => setFVacuna(p => ({ ...p, via_administracion: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Vía" /></SelectTrigger>
                <SelectContent>{VIAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Dosis</Label><Input placeholder="Ej: 1 dosis/ave" value={fVacuna.dosis} onChange={e => setFVacuna(p => ({ ...p, dosis: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Laboratorio</Label><Input value={fVacuna.laboratorio} onChange={e => setFVacuna(p => ({ ...p, laboratorio: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Lote vacuna</Label><Input value={fVacuna.lote_vacuna} onChange={e => setFVacuna(p => ({ ...p, lote_vacuna: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">N° aves</Label><Input type="number" value={fVacuna.numero_aves} onChange={e => setFVacuna(p => ({ ...p, numero_aves: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Próxima dosis</Label><Input type="date" value={fVacuna.proxima_dosis} onChange={e => setFVacuna(p => ({ ...p, proxima_dosis: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Costo (COP)</Label><Input type="number" value={fVacuna.costo} onChange={e => setFVacuna(p => ({ ...p, costo: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-3 flex justify-end">
              <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Guardando...' : 'Registrar vacunación'}</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {showForm && subTab === 'medicaciones' && (
        <Card className="border-yellow-200"><CardContent className="p-4">
          <form onSubmit={guardarMedicacion} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Fecha inicio *</Label><Input type="date" value={fMed.fecha_inicio} onChange={e => setFMed(p => ({ ...p, fecha_inicio: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Fecha fin</Label><Input type="date" value={fMed.fecha_fin} onChange={e => setFMed(p => ({ ...p, fecha_fin: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Retiro (días)</Label><Input type="number" min="0" value={fMed.periodo_retiro_dias} onChange={e => setFMed(p => ({ ...p, periodo_retiro_dias: e.target.value }))} /></div>
            {fMed.fecha_fin && fMed.periodo_retiro_dias && (
              <div className="col-span-2 md:col-span-3 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                ⚠️ Liberación: {(() => { const d = new Date(fMed.fecha_fin); d.setDate(d.getDate() + Number(fMed.periodo_retiro_dias)); return d.toLocaleDateString('es-CO') })()}
              </div>
            )}
            <div className="col-span-2 space-y-1"><Label className="text-xs">Medicamento *</Label><Input placeholder="Nombre comercial" value={fMed.medicamento} onChange={e => setFMed(p => ({ ...p, medicamento: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Principio activo</Label><Input value={fMed.principio_activo} onChange={e => setFMed(p => ({ ...p, principio_activo: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Vía</Label><Input value={fMed.via_administracion} onChange={e => setFMed(p => ({ ...p, via_administracion: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Dosis</Label><Input value={fMed.dosis} onChange={e => setFMed(p => ({ ...p, dosis: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Motivo</Label><Input value={fMed.motivo} onChange={e => setFMed(p => ({ ...p, motivo: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Costo (COP)</Label><Input type="number" value={fMed.costo} onChange={e => setFMed(p => ({ ...p, costo: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-3 flex justify-end">
              <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Guardando...' : 'Registrar medicación'}</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {showForm && subTab === 'eventos' && (
        <Card className="border-yellow-200"><CardContent className="p-4">
          <form onSubmit={guardarEvento} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Fecha *</Label><Input type="date" value={fEvento.fecha} onChange={e => setFEvento(p => ({ ...p, fecha: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={fEvento.tipo_evento} onValueChange={v => setFEvento(p => ({ ...p, tipo_evento: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>{TIPOS_EVENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Aves afectadas</Label><Input type="number" value={fEvento.aves_afectadas} onChange={e => setFEvento(p => ({ ...p, aves_afectadas: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Descripción *</Label><Input value={fEvento.descripcion} onChange={e => setFEvento(p => ({ ...p, descripcion: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Aves muertas</Label><Input type="number" value={fEvento.aves_muertas} onChange={e => setFEvento(p => ({ ...p, aves_muertas: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Acción tomada</Label><Input value={fEvento.accion_tomada} onChange={e => setFEvento(p => ({ ...p, accion_tomada: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Veterinario</Label><Input value={fEvento.veterinario} onChange={e => setFEvento(p => ({ ...p, veterinario: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-3 flex justify-end">
              <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Guardando...' : 'Registrar evento'}</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {showForm && subTab === 'desinfecciones' && (
        <Card className="border-yellow-200"><CardContent className="p-4">
          <form onSubmit={guardarDesinfeccion} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={fDesinf.fecha} onChange={e => setFDesinf(p => ({ ...p, fecha: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Producto *</Label><Input placeholder="Ej: Amonio cuaternario" value={fDesinf.producto} onChange={e => setFDesinf(p => ({ ...p, producto: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Qué previene</Label><Input placeholder="Ej: Newcastle, Gumboro..." value={fDesinf.previene} onChange={e => setFDesinf(p => ({ ...p, previene: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Dosis / dilución</Label><Input placeholder="Ej: 1:200" value={fDesinf.dosis} onChange={e => setFDesinf(p => ({ ...p, dosis: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Responsable</Label><Input value={fDesinf.responsable} onChange={e => setFDesinf(p => ({ ...p, responsable: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Costo (COP)</Label><Input type="number" value={fDesinf.costo} onChange={e => setFDesinf(p => ({ ...p, costo: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-3 flex justify-end">
              <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Guardando...' : 'Registrar desinfección'}</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {/* Tablas de historial */}
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : subTab === 'vacunas' ? (
          vacunas.length === 0 ? <div className="py-8 text-center text-gray-400"><p className="text-3xl mb-2">💉</p><p>Sin vacunaciones</p></div> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Vacuna</TableHead><TableHead>Vía</TableHead><TableHead>Laboratorio</TableHead><TableHead>Próxima dosis</TableHead></TableRow></TableHeader>
              <TableBody>{vacunas.map(v => {
                const vencida = v.proxima_dosis && v.proxima_dosis < today
                const proxima = v.proxima_dosis && !vencida && new Date(v.proxima_dosis).getTime() - Date.now() < 7 * 86400000
                return (
                  <TableRow key={v.id} className={vencida ? 'bg-red-50' : proxima ? 'bg-yellow-50' : ''}>
                    <TableCell className="text-sm">{fmt(v.fecha_aplicacion)}</TableCell>
                    <TableCell className="text-sm font-medium">{v.vacuna}</TableCell>
                    <TableCell className="text-sm text-gray-500">{v.via_administracion ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{v.laboratorio ?? '—'}</TableCell>
                    <TableCell className="text-sm">{v.proxima_dosis ? <span className={vencida ? 'text-red-600 font-semibold' : proxima ? 'text-amber-600' : ''}>{fmt(v.proxima_dosis)}</span> : '—'}</TableCell>
                  </TableRow>
                )
              })}</TableBody>
            </Table></div>
          )
        ) : subTab === 'medicaciones' ? (
          medicaciones.length === 0 ? <div className="py-8 text-center text-gray-400"><p className="text-3xl mb-2">💊</p><p>Sin medicaciones</p></div> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Medicamento</TableHead><TableHead>Vía</TableHead><TableHead className="text-right">Retiro (d)</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
              <TableBody>{medicaciones.map(m => {
                let liberacion: string | null = null
                if (m.fecha_fin && m.periodo_retiro_dias) {
                  const d = new Date(m.fecha_fin); d.setDate(d.getDate() + m.periodo_retiro_dias)
                  liberacion = d.toISOString().split('T')[0]
                }
                const enRetiro = liberacion && liberacion >= today
                return (
                  <TableRow key={m.id} className={enRetiro ? 'bg-amber-50' : ''}>
                    <TableCell className="text-sm">{fmt(m.fecha_inicio)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{m.fecha_fin ? fmt(m.fecha_fin) : '—'}</TableCell>
                    <TableCell className="text-sm font-medium">{m.medicamento}</TableCell>
                    <TableCell className="text-sm text-gray-500">{m.via_administracion ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{m.periodo_retiro_dias ?? 0}</TableCell>
                    <TableCell>{enRetiro ? <Badge className="bg-amber-100 text-amber-700 text-[10px]">⚠ Retiro hasta {liberacion && fmt(liberacion)}</Badge> : <Badge className="bg-green-100 text-green-700 text-[10px]">✓ OK</Badge>}</TableCell>
                  </TableRow>
                )
              })}</TableBody>
            </Table></div>
          )
        ) : subTab === 'desinfecciones' ? (
          desinfecciones.length === 0 ? <div className="py-8 text-center text-gray-400"><p className="text-3xl mb-2">🧴</p><p>Sin desinfecciones registradas</p></div> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Previene</TableHead><TableHead>Dosis</TableHead><TableHead>Responsable</TableHead><TableHead className="text-right">Costo</TableHead></TableRow></TableHeader>
              <TableBody>{desinfecciones.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">{fmt(d.fecha)}</TableCell>
                  <TableCell className="text-sm font-medium">{d.producto}</TableCell>
                  <TableCell className="text-sm text-gray-500">{d.previene ?? '—'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{d.dosis ?? '—'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{d.responsable ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm">{d.costo ? cop(d.costo) : '—'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
          )
        ) : (
          eventos.length === 0 ? <div className="py-8 text-center text-gray-400"><p className="text-3xl mb-2">🩺</p><p>Sin eventos clínicos</p></div> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Afectadas</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
              <TableBody>{eventos.map(ev => (
                <TableRow key={ev.id} className={!ev.resuelto ? 'bg-red-50' : ''}>
                  <TableCell className="text-sm">{fmt(ev.fecha)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{ev.tipo_evento}</Badge></TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{ev.descripcion}</TableCell>
                  <TableCell className="text-right text-sm">{ev.aves_afectadas ?? '—'}</TableCell>
                  <TableCell>
                    {ev.resuelto ? <Badge className="bg-green-100 text-green-700 text-[10px]">✓ Resuelto</Badge>
                      : <button onClick={() => marcarResuelto(ev.id)} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700">Pendiente → Resolver</button>}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
          )
        )}
      </CardContent></Card>
    </div>
  )
}
