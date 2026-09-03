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
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type LotePollo = Database['public']['Tables']['lotes_pollo']['Row']
type Equipo = Database['public']['Tables']['equipos_pollo']['Row']

interface Props { loteActual: LotePollo }

const TIPOS = ['ventilador', 'comedero', 'bebedero', 'calefactor', 'lampara', 'aspersores', 'cortina', 'bascula', 'otro']
const ESTADOS: Record<string, { label: string; color: string; border: string }> = {
  operativo:    { label: 'Operativo',    color: 'bg-green-100 text-green-700',  border: 'border-green-300' },
  falla:        { label: 'En falla',     color: 'bg-red-100 text-red-700',      border: 'border-red-400' },
  mantenimiento:{ label: 'Mantenimiento',color: 'bg-yellow-100 text-yellow-700',border: 'border-yellow-300' },
  inactivo:     { label: 'Inactivo',     color: 'bg-gray-100 text-gray-500',    border: 'border-gray-200' },
}

export default function TabEquiposPollo({ loteActual }: Props) {
  const supabase = createClient()
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: '', tipo: '', marca: '', modelo: '', numero_serie: '',
    fecha_instalacion: '', proximo_mantenimiento: '', estado: 'operativo', ubicacion: '', observaciones: '',
  })

  const fetchEquipos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('equipos_pollo').select('*')
      .eq('lote_id', loteActual.id).order('created_at', { ascending: false })
    setEquipos(data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchEquipos() }, [fetchEquipos])

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.tipo) { toast.error('Nombre y tipo son requeridos'); return }
    setSaving(true)
    const { error } = await supabase.from('equipos_pollo').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      nombre: form.nombre, tipo: form.tipo,
      marca: form.marca || null, modelo: form.modelo || null,
      numero_serie: form.numero_serie || null,
      fecha_instalacion: form.fecha_instalacion || null,
      proximo_mantenimiento: form.proximo_mantenimiento || null,
      estado: form.estado as Equipo['estado'],
      ubicacion: form.ubicacion || null,
      observaciones: form.observaciones || null,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Equipo registrado')
    setShowForm(false)
    setForm({ nombre: '', tipo: '', marca: '', modelo: '', numero_serie: '', fecha_instalacion: '', proximo_mantenimiento: '', estado: 'operativo', ubicacion: '', observaciones: '' })
    fetchEquipos()
  }

  async function cambiarEstado(id: string, estado: string) {
    const { error } = await supabase.from('equipos_pollo').update({ estado: estado as Equipo['estado'] }).eq('id', id)
    if (error) { toast.error('Error'); return }
    toast.success('Estado actualizado')
    fetchEquipos()
  }

  const today = hoyLocal()
  const enFalla = equipos.filter(e => e.estado === 'falla').length
  const vencidos = equipos.filter(e => e.proximo_mantenimiento && e.proximo_mantenimiento < today).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Equipos del Galpón</h2>
          <div className="flex gap-2 mt-1">
            {enFalla > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{enFalla} en falla</Badge>}
            {vencidos > 0 && <Badge className="bg-amber-100 text-amber-700 text-xs">{vencidos} mant. vencido</Badge>}
          </div>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm">
          {showForm ? 'Cerrar' : '+ Nuevo equipo'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-yellow-200"><CardContent className="p-4">
          <form onSubmit={handleCrear} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Nombre *</Label><Input placeholder="Ej: Ventilador lateral" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(p => ({ ...p, estado: v ?? '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operativo">Operativo</SelectItem>
                  <SelectItem value="falla">En falla</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Marca</Label><Input value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Modelo</Label><Input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Ubicación en galpón</Label><Input placeholder="Zona norte, entrada..." value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Fecha instalación</Label><Input type="date" value={form.fecha_instalacion} onChange={e => setForm(p => ({ ...p, fecha_instalacion: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Próximo mantenimiento</Label><Input type="date" value={form.proximo_mantenimiento} onChange={e => setForm(p => ({ ...p, proximo_mantenimiento: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">N° serie</Label><Input value={form.numero_serie} onChange={e => setForm(p => ({ ...p, numero_serie: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-3 flex justify-end">
              <Button type="submit" disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white">{saving ? 'Guardando...' : 'Registrar equipo'}</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : equipos.length === 0 ? (
        <div className="py-12 text-center"><p className="text-4xl mb-2">⚙️</p><p className="text-gray-500">Sin equipos registrados</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {equipos.map(eq => {
            const est = ESTADOS[eq.estado] ?? ESTADOS.inactivo
            const vencido = eq.proximo_mantenimiento && eq.proximo_mantenimiento < today
            return (
              <Card key={eq.id} className={`border-2 ${est.border}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{eq.nombre}</p>
                      <p className="text-xs text-gray-400 capitalize">{eq.tipo}{eq.marca ? ` · ${eq.marca}` : ''}{eq.modelo ? ` ${eq.modelo}` : ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`${est.color} text-[10px]`}>
                        {eq.estado === 'falla' && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse" />}
                        {est.label}
                      </Badge>
                      {vencido && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Mant. vencido</Badge>}
                    </div>
                  </div>
                  {eq.ubicacion && <p className="text-xs text-gray-500">📍 {eq.ubicacion}</p>}
                  {eq.proximo_mantenimiento && (
                    <p className={`text-xs ${vencido ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                      🔧 {new Date(eq.proximo_mantenimiento + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {eq.sensor_id
                    ? <p className="text-xs text-blue-600">📡 {eq.sensor_id}</p>
                    : <p className="text-xs text-gray-300">📡 Sin sensor IoT</p>}
                  <div className="flex gap-1.5 pt-1 flex-wrap">
                    {eq.estado !== 'operativo' && <button onClick={() => cambiarEstado(eq.id, 'operativo')} className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200">✓ Operativo</button>}
                    {eq.estado !== 'falla' && <button onClick={() => cambiarEstado(eq.id, 'falla')} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200">✗ Falla</button>}
                    {eq.estado !== 'mantenimiento' && <button onClick={() => cambiarEstado(eq.id, 'mantenimiento')} className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200">⚙ Mant.</button>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="border-dashed border-gray-300 bg-gray-50">
        <CardContent className="p-4 text-center space-y-1">
          <p className="text-xl">🤖</p>
          <p className="font-medium text-gray-600 text-sm">Automatización de Galpón — Próximamente</p>
          <p className="text-xs text-gray-400">Control automático de cortinas, ventiladores y calefactores según T° y HR. Comederos y bebederos con sensores de nivel.</p>
          <div className="flex justify-center gap-2 mt-2">
            {['📡 LoRaWAN', '🔌 Modbus', '📲 Alertas SMS', '📧 Email'].map(b => (
              <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{b}</span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
