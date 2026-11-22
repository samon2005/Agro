'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import type { Database } from '@/types/database'

type Visita = Database['public']['Tables']['visitas_finca']['Row']

const VACIO = { fecha: hoyLocal(), hora: '', nombre: '', empresa: '', motivo: '', areas: '', ducha: false, cambio_ropa: false, desinfeccion: false, ultimo_contacto: '', observaciones: '' }

/** Días entre el último contacto con otros animales y la visita; menos de 2 es riesgo */
function diasSinContacto(v: { fecha: string; ultimo_contacto_animales: string | null }) {
  if (!v.ultimo_contacto_animales) return null
  return Math.round((new Date(v.fecha + 'T00:00:00').getTime() - new Date(v.ultimo_contacto_animales + 'T00:00:00').getTime()) / 86400000)
}

/**
 * Control de visitas (bioseguridad, José): quién entró, a qué, a qué áreas, si
 * se duchó, cambió de ropa y se desinfectó, y cuándo estuvo con otros animales.
 * Sirve para todas las especies.
 */
export default function VisitasModal({ open, onClose, fincaId }: { open: boolean; onClose: () => void; fincaId: string }) {
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [form, setForm] = useState(VACIO)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!open) return
    let vigente = true
    createClient().from('visitas_finca').select('*').eq('finca_id', fincaId).order('fecha', { ascending: false }).limit(30)
      .then(({ data }) => { if (vigente) setVisitas(data ?? []) })
    return () => { vigente = false }
  }, [open, fincaId, version])

  const set = <K extends keyof typeof VACIO>(k: K, v: (typeof VACIO)[K]) => setForm(p => ({ ...p, [k]: v }))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('Escribe quién visitó'); return }
    const { error } = await createClient().from('visitas_finca').insert({
      finca_id: fincaId, fecha: form.fecha, hora: form.hora || null, nombre: form.nombre.trim(), empresa: form.empresa.trim() || null,
      motivo: form.motivo.trim() || null, areas: form.areas.trim() || null, ducha: form.ducha, cambio_ropa: form.cambio_ropa,
      desinfeccion: form.desinfeccion, ultimo_contacto_animales: form.ultimo_contacto || null, observaciones: form.observaciones.trim() || null,
    })
    if (error) { toast.error('No se pudo guardar la visita'); return }
    toast.success('Visita anotada')
    setForm(VACIO); setVersion(v => v + 1)
  }

  const chk = (k: 'ducha' | 'cambio_ropa' | 'desinfeccion', t: string) => (
    <label className="flex items-center gap-1.5 text-sm text-gray-700">
      <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} /> {t}
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ic n="desinfeccion" /> Visitas a la finca</DialogTitle>
          <p className="text-sm text-gray-500">Bioseguridad: cada persona que entra queda anotada, con lo que hizo antes de entrar.</p>
        </DialogHeader>
        <form onSubmit={guardar} className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-3">
          <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" className="bg-white" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Hora</Label><Input type="time" className="bg-white" value={form.hora} onChange={e => set('hora', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Quién *</Label><Input className="bg-white" value={form.nombre} onChange={e => set('nombre', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Empresa</Label><Input className="bg-white" placeholder="Ej: proveedor de alimento" value={form.empresa} onChange={e => set('empresa', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Motivo</Label><Input className="bg-white" value={form.motivo} onChange={e => set('motivo', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Áreas que visitó</Label><Input className="bg-white" placeholder="Ej: precebo, bodega" value={form.areas} onChange={e => set('areas', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Último contacto con otros animales</Label><Input type="date" className="bg-white" value={form.ultimo_contacto} onChange={e => set('ultimo_contacto', e.target.value)} /></div>
          <div className="flex flex-wrap items-end gap-3 sm:col-span-2">{chk('ducha', 'Se duchó')}{chk('cambio_ropa', 'Cambió de ropa')}{chk('desinfeccion', 'Desinfección')}</div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Observaciones</Label><Input className="bg-white" value={form.observaciones} onChange={e => set('observaciones', e.target.value)} /></div>
          <div className="flex items-end justify-end"><Button type="submit" size="sm">Anotar visita</Button></div>
        </form>
        {visitas.length > 0 && (
          <ul className="divide-y divide-gray-100 text-sm">
            {visitas.map(v => {
              const d = diasSinContacto(v)
              const completo = v.ducha && v.cambio_ropa && v.desinfeccion
              return (
                <li key={v.id} className="flex flex-wrap items-baseline gap-2 py-1.5">
                  <span className="font-medium">{v.nombre}</span>
                  <span className="text-xs text-gray-500">{v.fecha}{v.hora ? ` ${v.hora.slice(0, 5)}` : ''}{v.empresa ? ` · ${v.empresa}` : ''}{v.motivo ? ` · ${v.motivo}` : ''}{v.areas ? ` · ${v.areas}` : ''}</span>
                  <span className={`ml-auto rounded-full px-2 text-xs ${completo ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {completo ? 'Protocolo completo' : `Faltó: ${[!v.ducha && 'ducha', !v.cambio_ropa && 'ropa', !v.desinfeccion && 'desinfección'].filter(Boolean).join(', ')}`}
                  </span>
                  {d != null && d < 2 && <span className="rounded-full bg-red-100 px-2 text-xs text-red-700">estuvo con animales hace {d} {d === 1 ? 'día' : 'días'}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
