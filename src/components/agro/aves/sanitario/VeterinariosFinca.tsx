'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Ic } from '@/components/ui/icon'
import { cargarVeterinarios, normalizarNombre, type Veterinario, type VeterinarioConHistorial } from '@/lib/veterinarios'

const VACIO = { nombre: '', telefono: '', correo: '', tarjeta_profesional: '', especialidad: '', notas: '' }
const TIPO_CASO = { evento: 'Evento', tratamiento: 'Tratamiento', vacuna: 'Vacuna' } as const
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * Los veterinarios de la finca y los casos que ha atendido cada uno (eventos,
 * tratamientos y vacunas donde aparece como encargado), para saber a quién
 * llamar y con qué experiencia en la finca.
 */
export default function VeterinariosFinca({ fincaId }: { fincaId: string }) {
  const supabase = createClient()
  const [vets, setVets] = useState<VeterinarioConHistorial[] | null>(null)
  const [editando, setEditando] = useState<Veterinario | 'nuevo' | null>(null)
  const [form, setForm] = useState(VACIO)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Nombre de cada galpón (también de los lotes que ya salieron)
  const [lotes, setLotes] = useState<Record<string, string>>({})
  const nombreLote = (id: string) => lotes[id] ?? '—'

  const cargar = useCallback(async () => {
    setVets(await cargarVeterinarios(supabase, fincaId))
  }, [supabase, fincaId])

  useEffect(() => {
    let vigente = true
    cargarVeterinarios(supabase, fincaId).then(v => { if (vigente) setVets(v) })
    supabase.from('lotes_aves').select('id, nombre, fecha_inicio').eq('finca_id', fincaId).then(({ data }) => {
      if (vigente) setLotes(Object.fromEntries((data ?? []).map(l => [l.id, `${l.nombre} (${new Date(l.fecha_inicio + 'T00:00:00').getFullYear()})`])))
    })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId])

  function abrir(v: Veterinario | 'nuevo') {
    setEditando(v)
    setForm(v === 'nuevo' ? VACIO : {
      nombre: v.nombre, telefono: v.telefono ?? '', correo: v.correo ?? '', tarjeta_profesional: v.tarjeta_profesional ?? '',
      especialidad: v.especialidad ?? '', notas: v.notas ?? '',
    })
  }

  async function guardar() {
    const nombre = form.nombre.trim()
    if (!nombre) { toast.error('Escribe el nombre del veterinario'); return }
    if (form.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) { toast.error('El correo no es válido'); return }
    const repetido = (vets ?? []).some(v => normalizarNombre(v.nombre) === normalizarNombre(nombre) && (editando === 'nuevo' || v.id !== editando?.id))
    if (repetido) { toast.error(`Ya hay un veterinario llamado ${nombre}`); return }
    const payload = {
      nombre,
      telefono: form.telefono.trim() || null,
      correo: form.correo.trim() || null,
      tarjeta_profesional: form.tarjeta_profesional.trim() || null,
      especialidad: form.especialidad.trim() || null,
      notas: form.notas.trim() || null,
    }
    setGuardando(true)
    const { error } = editando === 'nuevo'
      ? await supabase.from('veterinarios').insert({ ...payload, finca_id: fincaId })
      : await supabase.from('veterinarios').update(payload).eq('id', editando!.id)
    setGuardando(false)
    if (error) { toast.error(error.code === '23505' ? `Ya hay un veterinario llamado ${nombre}` : 'No se pudo guardar'); return }
    toast.success(editando === 'nuevo' ? 'Veterinario agregado' : 'Veterinario actualizado')
    setEditando(null)
    cargar()
  }

  async function cambiarActivo(v: Veterinario) {
    const { error } = await supabase.from('veterinarios').update({ activo: !v.activo }).eq('id', v.id)
    if (error) { toast.error('No se pudo cambiar'); return }
    cargar()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          El historial sale de los eventos, tratamientos y vacunas donde el veterinario aparece como encargado (con el mismo nombre).
        </p>
        <Button onClick={() => abrir('nuevo')} className="bg-green-700 text-sm text-white hover:bg-green-800">+ Agregar veterinario</Button>
      </div>

      {vets == null ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : vets.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-gray-400">Todavía no hay veterinarios registrados</CardContent></Card>
      ) : (
        vets.map(v => (
          <Card key={v.id} className={v.activo ? '' : 'opacity-60'}>
            <CardContent className="space-y-2 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-800">
                    {v.nombre}{!v.activo && <span className="ml-2 text-xs font-normal text-gray-400">(ya no trabaja con la finca)</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[v.especialidad, v.tarjeta_profesional && `T.P. ${v.tarjeta_profesional}`].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {v.telefono && <a href={`tel:${v.telefono}`} className="text-green-700 underline">{v.telefono}</a>}
                    {v.telefono && v.correo && ' · '}
                    {v.correo && <a href={`mailto:${v.correo}`} className="text-green-700 underline">{v.correo}</a>}
                  </p>
                  {v.notas && <p className="text-xs text-gray-400">{v.notas}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setAbierto(abierto === v.id ? null : v.id)}>
                    {v.casos.length} caso{v.casos.length === 1 ? '' : 's'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => abrir(v)} title="Editar"><Ic n="editar" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => cambiarActivo(v)} className="text-xs">{v.activo ? 'Desactivar' : 'Activar'}</Button>
                </div>
              </div>
              {abierto === v.id && (
                v.casos.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin casos con este nombre como encargado.</p>
                ) : (
                  <div className="max-h-56 overflow-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <tbody>
                        {v.casos.map((c, i) => (
                          <tr key={i} className="border-t border-gray-100 first:border-0">
                            <td className="px-2 py-1.5 whitespace-nowrap text-gray-500">{fechaCorta(c.fecha)}</td>
                            <td className="px-2 py-1.5 text-gray-500">{TIPO_CASO[c.tipo]}</td>
                            <td className="px-2 py-1.5 text-gray-700">{c.detalle}</td>
                            <td className="px-2 py-1.5 text-gray-500">{nombreLote(c.lote_id)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={editando != null} onOpenChange={o => !o && !guardando && setEditando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle><Ic n="hospital" /> {editando === 'nuevo' ? 'Agregar veterinario' : 'Editar veterinario'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Nombre *</Label><Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Teléfono</Label><Input inputMode="tel" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Correo</Label><Input type="email" value={form.correo} onChange={e => setForm(p => ({ ...p, correo: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Tarjeta profesional</Label><Input value={form.tarjeta_profesional} onChange={e => setForm(p => ({ ...p, tarjeta_profesional: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Especialidad</Label><Input placeholder="Ej: aves" value={form.especialidad} onChange={e => setForm(p => ({ ...p, especialidad: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Notas</Label><Input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>
            {editando !== 'nuevo' && editando && normalizarNombre(form.nombre) !== normalizarNombre(editando.nombre) && (
              <p className="col-span-2 text-xs text-amber-700">Al cambiar el nombre, el historial solo cuenta los casos registrados con el nombre nuevo.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={guardando} onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
