'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Vacunacion = Database['public']['Tables']['vacunaciones_cerdos']['Row']
type Desparasitacion = Database['public']['Tables']['desparasitaciones_cerdos']['Row']
type Desinfeccion = Database['public']['Tables']['desinfecciones_cerdos']['Row']

type SubTab = 'vacunas' | 'desparasitaciones' | 'desinfecciones'

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

interface Props { loteActual: LoteCerdos }

const VACUNAS_PORCINAS = ['PCV2 (Circovirus)', 'PRRS', 'Mycoplasma hyopneumoniae', 'Aujeszky', 'Leptospira', 'Parvovirus', 'Influenza porcina', 'E. coli (F4/F18)', 'Otra']
const DESPARASITANTES = ['Ivermectina', 'Doramectina', 'Fenbendazol', 'Flubendazol', 'Levamisol', 'Albendazol', 'Otro']
const VIAS = ['Oral', 'Inyectable SC', 'Inyectable IM', 'Tópico', 'Agua de bebida', 'Alimento']

export default function TabSanitarioCerdos({ loteActual }: Props) {
  const supabase = createClient()
  const [subTab, setSubTab] = useState<SubTab>('vacunas')
  const [vacunas, setVacunas] = useState<Vacunacion[]>([])
  const [desparasitaciones, setDesparasitaciones] = useState<Desparasitacion[]>([])
  const [desinfecciones, setDesinfecciones] = useState<Desinfeccion[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormVac, setShowFormVac] = useState(false)
  const [showFormDesp, setShowFormDesp] = useState(false)
  const [showFormDesinf, setShowFormDesinf] = useState(false)
  const [savingVac, setSavingVac] = useState(false)
  const [savingDesp, setSavingDesp] = useState(false)
  const [savingDesinf, setSavingDesinf] = useState(false)

  const [formVac, setFormVac] = useState({
    fecha_aplicacion: hoyLocal(),
    vacuna: '', vacuna_otra: '', lote_vacuna: '', via_administracion: '',
    dosis: '', laboratorio: '', numero_animales: String(loteActual.animales_actuales),
    costo: '', proxima_dosis: '', veterinario: '', observaciones: '',
  })

  const [formDesp, setFormDesp] = useState({
    fecha: hoyLocal(),
    producto: '', producto_otro: '', principio_activo: '', via_administracion: '',
    dosis: '', numero_animales: String(loteActual.animales_actuales),
    periodo_retiro_dias: '', costo: '', veterinario: '',
    proxima_aplicacion: '', observaciones: '',
  })

  const [formDesinf, setFormDesinf] = useState({
    fecha: hoyLocal(),
    producto: '', previene: '', dosis: '', responsable: '', costo: '', observaciones: '',
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [v, d, desinf] = await Promise.all([
      supabase.from('vacunaciones_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha_aplicacion', { ascending: false }),
      supabase.from('desparasitaciones_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
      supabase.from('desinfecciones_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
    ])
    setVacunas(v.data ?? [])
    setDesparasitaciones(d.data ?? [])
    setDesinfecciones(desinf.data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  const hoy = new Date()
  const en7dias = new Date(); en7dias.setDate(hoy.getDate() + 7)

  async function saveVacuna(e: React.FormEvent) {
    e.preventDefault()
    const vacunaFinal = formVac.vacuna === 'Otra' ? formVac.vacuna_otra : formVac.vacuna
    if (!vacunaFinal) { toast.error('Selecciona la vacuna'); return }
    setSavingVac(true)
    const { error } = await supabase.from('vacunaciones_cerdos').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha_aplicacion: formVac.fecha_aplicacion, vacuna: vacunaFinal,
      lote_vacuna: formVac.lote_vacuna || null, via_administracion: formVac.via_administracion || null,
      dosis: formVac.dosis || null, laboratorio: formVac.laboratorio || null,
      numero_animales: formVac.numero_animales ? Number(formVac.numero_animales) : null,
      costo: formVac.costo ? Number(formVac.costo) : null,
      proxima_dosis: formVac.proxima_dosis || null, veterinario: formVac.veterinario || null,
      observaciones: formVac.observaciones || null,
    })
    setSavingVac(false)
    if (error) { toast.error('Error'); return }
    toast.success('Vacunación registrada')
    setShowFormVac(false)
    fetchAll()
  }

  async function saveDesparasitacion(e: React.FormEvent) {
    e.preventDefault()
    const prodFinal = formDesp.producto === 'Otro' ? formDesp.producto_otro : formDesp.producto
    if (!prodFinal) { toast.error('Selecciona el producto'); return }
    setSavingDesp(true)
    const { error } = await supabase.from('desparasitaciones_cerdos').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha: formDesp.fecha, producto: prodFinal,
      principio_activo: formDesp.principio_activo || null, via_administracion: formDesp.via_administracion || null,
      dosis: formDesp.dosis || null,
      numero_animales: formDesp.numero_animales ? Number(formDesp.numero_animales) : null,
      periodo_retiro_dias: formDesp.periodo_retiro_dias ? Number(formDesp.periodo_retiro_dias) : null,
      costo: formDesp.costo ? Number(formDesp.costo) : null,
      veterinario: formDesp.veterinario || null,
      proxima_aplicacion: formDesp.proxima_aplicacion || null,
      observaciones: formDesp.observaciones || null,
    })
    setSavingDesp(false)
    if (error) { toast.error('Error'); return }
    toast.success('Desparasitación registrada')
    setShowFormDesp(false)
    fetchAll()
  }

  async function saveDesinfeccion(e: React.FormEvent) {
    e.preventDefault()
    if (!formDesinf.producto.trim()) { toast.error('Ingresa el producto usado'); return }
    setSavingDesinf(true)
    const { error } = await supabase.from('desinfecciones_cerdos').insert({
      lote_id: loteActual.id, finca_id: loteActual.finca_id,
      fecha: formDesinf.fecha, producto: formDesinf.producto.trim(),
      previene: formDesinf.previene || null, dosis: formDesinf.dosis || null,
      responsable: formDesinf.responsable || null,
      costo: formDesinf.costo ? Number(formDesinf.costo) : null,
      observaciones: formDesinf.observaciones || null,
    })
    setSavingDesinf(false)
    if (error) { toast.error('Error'); return }
    toast.success('Desinfección registrada')
    setShowFormDesinf(false)
    fetchAll()
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Sanitario y Bioseguridad</h2>
        <div>
          {subTab === 'vacunas' && <Button onClick={() => setShowFormVac(v => !v)} className="bg-green-700 hover:bg-green-800 text-white text-sm">+ Registrar vacuna</Button>}
          {subTab === 'desparasitaciones' && <Button onClick={() => setShowFormDesp(v => !v)} className="bg-green-700 hover:bg-green-800 text-white text-sm">+ Desparasitar</Button>}
          {subTab === 'desinfecciones' && <Button onClick={() => setShowFormDesinf(v => !v)} className="bg-green-700 hover:bg-green-800 text-white text-sm">+ Registrar desinfección</Button>}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {[
          { id: 'vacunas' as const, label: '💉 Vacunaciones', count: vacunas.length },
          { id: 'desparasitaciones' as const, label: '🔬 Desparasitaciones', count: desparasitaciones.length },
          { id: 'desinfecciones' as const, label: '🧴 Desinfección', count: desinfecciones.length },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors', subTab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
            {t.count > 0 && <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {subTab === 'vacunas' && showFormVac && (
        <Card className="border-green-200">
          <CardContent className="p-4">
            <form onSubmit={saveVacuna} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={formVac.fecha_aplicacion} onChange={e => setFormVac(p => ({ ...p, fecha_aplicacion: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Vacuna *</Label>
                <Select value={formVac.vacuna} onValueChange={v => setFormVac(p => ({ ...p, vacuna: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{VACUNAS_PORCINAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {formVac.vacuna === 'Otra' && <div className="space-y-1"><Label className="text-xs">Nombre *</Label><Input value={formVac.vacuna_otra} onChange={e => setFormVac(p => ({ ...p, vacuna_otra: e.target.value }))} /></div>}
              <div className="space-y-1"><Label className="text-xs">Vía</Label>
                <Select value={formVac.via_administracion} onValueChange={v => setFormVac(p => ({ ...p, via_administracion: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Vía..." /></SelectTrigger>
                  <SelectContent>{VIAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Dosis</Label><Input placeholder="Ej: 2 ml/animal" value={formVac.dosis} onChange={e => setFormVac(p => ({ ...p, dosis: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">N° animales</Label><Input type="number" value={formVac.numero_animales} onChange={e => setFormVac(p => ({ ...p, numero_animales: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Costo (COP)</Label><Input type="number" value={formVac.costo} onChange={e => setFormVac(p => ({ ...p, costo: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Próxima dosis</Label><Input type="date" value={formVac.proxima_dosis} onChange={e => setFormVac(p => ({ ...p, proxima_dosis: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Veterinario</Label><Input value={formVac.veterinario} onChange={e => setFormVac(p => ({ ...p, veterinario: e.target.value }))} /></div>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Input placeholder="Observaciones..." value={formVac.observaciones} onChange={e => setFormVac(p => ({ ...p, observaciones: e.target.value }))} />
                <Button type="submit" disabled={savingVac} className="shrink-0 bg-green-700 hover:bg-green-800 text-white">{savingVac ? '...' : 'Guardar'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowFormVac(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {subTab === 'desparasitaciones' && showFormDesp && (
        <Card className="border-purple-200">
          <CardContent className="p-4">
            <form onSubmit={saveDesparasitacion} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={formDesp.fecha} onChange={e => setFormDesp(p => ({ ...p, fecha: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Producto *</Label>
                <Select value={formDesp.producto} onValueChange={v => setFormDesp(p => ({ ...p, producto: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{DESPARASITANTES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {formDesp.producto === 'Otro' && <div className="space-y-1"><Label className="text-xs">Nombre *</Label><Input value={formDesp.producto_otro} onChange={e => setFormDesp(p => ({ ...p, producto_otro: e.target.value }))} /></div>}
              <div className="space-y-1"><Label className="text-xs">Principio activo</Label><Input value={formDesp.principio_activo} onChange={e => setFormDesp(p => ({ ...p, principio_activo: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Vía</Label>
                <Select value={formDesp.via_administracion} onValueChange={v => setFormDesp(p => ({ ...p, via_administracion: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Vía..." /></SelectTrigger>
                  <SelectContent>{VIAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Dosis</Label><Input value={formDesp.dosis} onChange={e => setFormDesp(p => ({ ...p, dosis: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Retiro (días)</Label><Input type="number" value={formDesp.periodo_retiro_dias} onChange={e => setFormDesp(p => ({ ...p, periodo_retiro_dias: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Próxima aplicación</Label><Input type="date" value={formDesp.proxima_aplicacion} onChange={e => setFormDesp(p => ({ ...p, proxima_aplicacion: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Costo (COP)</Label><Input type="number" value={formDesp.costo} onChange={e => setFormDesp(p => ({ ...p, costo: e.target.value }))} /></div>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Input placeholder="Observaciones..." value={formDesp.observaciones} onChange={e => setFormDesp(p => ({ ...p, observaciones: e.target.value }))} />
                <Button type="submit" disabled={savingDesp} className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white">{savingDesp ? '...' : 'Guardar'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowFormDesp(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {subTab === 'desinfecciones' && showFormDesinf && (
        <Card className="border-sky-200">
          <CardContent className="p-4">
            <form onSubmit={saveDesinfeccion} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" value={formDesinf.fecha} onChange={e => setFormDesinf(p => ({ ...p, fecha: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Producto *</Label><Input placeholder="Ej: Amonio cuaternario" value={formDesinf.producto} onChange={e => setFormDesinf(p => ({ ...p, producto: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Qué previene</Label><Input placeholder="Ej: PRRS, parvovirus..." value={formDesinf.previene} onChange={e => setFormDesinf(p => ({ ...p, previene: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Dosis / dilución</Label><Input placeholder="Ej: 1:200" value={formDesinf.dosis} onChange={e => setFormDesinf(p => ({ ...p, dosis: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Responsable</Label><Input value={formDesinf.responsable} onChange={e => setFormDesinf(p => ({ ...p, responsable: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Costo (COP)</Label><Input type="number" value={formDesinf.costo} onChange={e => setFormDesinf(p => ({ ...p, costo: e.target.value }))} /></div>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Input placeholder="Observaciones..." value={formDesinf.observaciones} onChange={e => setFormDesinf(p => ({ ...p, observaciones: e.target.value }))} />
                <Button type="submit" disabled={savingDesinf} className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white">{savingDesinf ? '...' : 'Guardar'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowFormDesinf(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : subTab === 'desinfecciones' ? (
            desinfecciones.length === 0 ? (
              <div className="py-10 text-center"><p className="text-4xl mb-2">🧴</p><p className="text-gray-500">Sin desinfecciones registradas</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Previene</TableHead><TableHead>Dosis</TableHead><TableHead>Responsable</TableHead><TableHead className="text-right">Costo</TableHead></TableRow>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : subTab === 'vacunas' ? (
            vacunas.length === 0 ? (
              <div className="py-10 text-center"><p className="text-4xl mb-2">💉</p><p className="text-gray-500">Sin vacunaciones registradas</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Fecha</TableHead><TableHead>Vacuna</TableHead><TableHead>Vía</TableHead><TableHead className="text-right">N° animales</TableHead><TableHead>Próxima dosis</TableHead><TableHead>Veterinario</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {vacunas.map(v => {
                      const pd = v.proxima_dosis ? new Date(v.proxima_dosis + 'T00:00:00') : null
                      return (
                        <TableRow key={v.id} className={pd && pd < hoy ? 'bg-red-50' : pd && pd <= en7dias ? 'bg-yellow-50' : ''}>
                          <TableCell className="text-sm">{fmt(v.fecha_aplicacion)}</TableCell>
                          <TableCell className="font-medium text-sm">{v.vacuna}</TableCell>
                          <TableCell className="text-sm text-gray-500">{v.via_administracion ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{v.numero_animales?.toLocaleString('es-CO') ?? '—'}</TableCell>
                          <TableCell className="text-sm">{v.proxima_dosis ? <span className={pd && pd < hoy ? 'text-red-600 font-semibold' : pd && pd <= en7dias ? 'text-amber-600 font-semibold' : ''}>{fmt(v.proxima_dosis)}</span> : '—'}</TableCell>
                          <TableCell className="text-sm text-gray-500">{v.veterinario ?? '—'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            desparasitaciones.length === 0 ? (
              <div className="py-10 text-center"><p className="text-4xl mb-2">🔬</p><p className="text-gray-500">Sin desparasitaciones registradas</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Vía</TableHead><TableHead className="text-right">Retiro (días)</TableHead><TableHead>Próxima</TableHead><TableHead className="text-right">Costo</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {desparasitaciones.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{fmt(d.fecha)}</TableCell>
                        <TableCell className="font-medium text-sm">{d.producto}</TableCell>
                        <TableCell className="text-sm text-gray-500">{d.via_administracion ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{d.periodo_retiro_dias ?? '—'}</TableCell>
                        <TableCell className="text-sm">{d.proxima_aplicacion ? fmt(d.proxima_aplicacion) : '—'}</TableCell>
                        <TableCell className="text-right text-sm">{d.costo ? Number(d.costo).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
