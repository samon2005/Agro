'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import type { Database } from '@/types/database'

type Macho = Database['public']['Tables']['machos_cerdos']['Row']

export const FUNCION_MACHO: Record<string, string> = {
  celador: 'Celador (calentador)',
  reproductor: 'Reproductor',
  celador_reproductor: 'Celador y se le recoge semen',
}

const VACIO = { nombre: '', funcion: 'celador', linea_genetica: '', fecha_nacimiento: '', fecha_ingreso: '', observaciones: '' }

/**
 * Los machos de la finca: los celadores que se pasan por el pasillo para detectar
 * el celo y los reproductores. José los nombra por nombre propio. El semen propio
 * se registra en el servicio con el macho y la fecha de recolección.
 */
export default function MachosModal({ open, onClose, fincaId }: { open: boolean; onClose: () => void; fincaId: string }) {
  const [machos, setMachos] = useState<Macho[]>([])
  const [usos, setUsos] = useState<Record<string, { servicios: number; partos: number; vivos: number }>>({})
  const [form, setForm] = useState(VACIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!open) return
    let vigente = true
    const supabase = createClient()
    Promise.all([
      supabase.from('machos_cerdos').select('*').eq('finca_id', fincaId).order('activo', { ascending: false }).order('nombre'),
      supabase.from('servicios_cerdos').select('id, macho_id, estado').eq('finca_id', fincaId).not('macho_id', 'is', null),
      supabase.from('partos_cerdos').select('servicio_id, nacidos_vivos').eq('finca_id', fincaId).not('servicio_id', 'is', null),
    ]).then(([m, s, p]) => {
      if (!vigente) return
      setMachos(m.data ?? [])
      // Lo que ha dado cada macho: servicios, partos que salieron de ellos y lechones vivos
      const partoDe = new Map((p.data ?? []).map(x => [x.servicio_id, x.nacidos_vivos]))
      const cuenta: Record<string, { servicios: number; partos: number; vivos: number }> = {}
      for (const x of s.data ?? []) {
        if (!x.macho_id) continue
        const c = (cuenta[x.macho_id] ??= { servicios: 0, partos: 0, vivos: 0 })
        c.servicios += 1
        if (partoDe.has(x.id)) { c.partos += 1; c.vivos += partoDe.get(x.id) ?? 0 }
      }
      setUsos(cuenta)
    })
    return () => { vigente = false }
  }, [open, fincaId, version])

  const set = (k: keyof typeof VACIO, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('Escribe el nombre del macho'); return }
    setGuardando(true)
    const supabase = createClient()
    const datos = {
      nombre: form.nombre.trim(),
      funcion: form.funcion,
      linea_genetica: form.linea_genetica.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      fecha_ingreso: form.fecha_ingreso || null,
      observaciones: form.observaciones.trim() || null,
    }
    const { error } = editando
      ? await supabase.from('machos_cerdos').update(datos).eq('id', editando)
      : await supabase.from('machos_cerdos').insert({ ...datos, finca_id: fincaId })
    setGuardando(false)
    if (error) { toast.error('No se pudo guardar el macho'); return }
    toast.success(editando ? 'Macho actualizado' : `${datos.nombre} registrado`)
    setForm(VACIO); setEditando(null); setVersion(v => v + 1)
  }

  async function alternarActivo(m: Macho) {
    const { error } = await createClient().from('machos_cerdos').update({ activo: !m.activo }).eq('id', m.id)
    if (error) { toast.error('No se pudo cambiar'); return }
    setVersion(v => v + 1)
  }

  function editar(m: Macho) {
    setEditando(m.id)
    setForm({
      nombre: m.nombre, funcion: m.funcion, linea_genetica: m.linea_genetica ?? '',
      fecha_nacimiento: m.fecha_nacimiento ?? '', fecha_ingreso: m.fecha_ingreso ?? '', observaciones: m.observaciones ?? '',
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ic n="cerdo" /> Machos y celadores</DialogTitle>
          <p className="text-sm text-gray-500">Los celadores detectan el celo en el pasillo; a algunos se les recoge semen. Se eligen al registrar el servicio.</p>
        </DialogHeader>

        {machos.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {machos.map(m => (
              <li key={m.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 text-sm ${m.activo ? '' : 'text-gray-400'}`}>
                <span className="font-medium">{m.nombre}</span>
                <span className="text-xs text-gray-500">{FUNCION_MACHO[m.funcion] ?? m.funcion}{m.linea_genetica ? ` · ${m.linea_genetica}` : ''}</span>
                <span className="text-xs text-gray-500">
                  · {usos[m.id]?.servicios ?? 0} servicios
                  {usos[m.id]?.servicios ? ` · ${Math.round((usos[m.id].partos / usos[m.id].servicios) * 100)} % parieron` : ''}
                  {usos[m.id]?.partos ? ` · ${(usos[m.id].vivos / usos[m.id].partos).toFixed(1)} vivos por parto` : ''}
                </span>
                {!m.activo && <span className="rounded-full bg-gray-100 px-2 text-xs">Retirado</span>}
                <span className="ml-auto flex gap-2 text-xs">
                  <button type="button" onClick={() => editar(m)} className="text-gray-500 hover:text-gray-800">Editar</button>
                  <button type="button" onClick={() => alternarActivo(m)} className="text-gray-500 hover:text-gray-800">{m.activo ? 'Retirar' : 'Volver a activar'}</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={guardar} className="space-y-3 rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-700">{editando ? 'Editar macho' : 'Nuevo macho'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input className="bg-white" placeholder="Ej: Tornado" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Función</Label>
              <select value={form.funcion} onChange={e => set('funcion', e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                {Object.entries(FUNCION_MACHO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Línea genética</Label>
              <Input className="bg-white" placeholder="Ej: PIC" value={form.linea_genetica} onChange={e => set('linea_genetica', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nació</Label>
              <Input className="bg-white" type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Llegó a la finca</Label>
              <Input className="bg-white" type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input className="bg-white" value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editando && <Button type="button" variant="ghost" onClick={() => { setEditando(null); setForm(VACIO) }}>Cancelar</Button>}
            <Button type="submit" disabled={guardando} className="bg-pink-600 text-white hover:bg-pink-700">
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar macho'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
