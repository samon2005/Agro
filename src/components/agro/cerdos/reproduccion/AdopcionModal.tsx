'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import type { Database } from '@/types/database'

type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Lechon = { id: string; codigo: string; madre_id: string | null; nodriza_id: string | null; peso_nacimiento_kg: number | null }
type Adopcion = { id: string; fecha: string; razon: string | null; lechon_id: string; madre_origen_id: string | null; madre_destino_id: string }

const RAZONES = ['Camada muy grande', 'La cerda tiene poca leche', 'Lechón débil o pequeño', 'Igualar camadas', 'Murió la cerda']

/**
 * Cambio de madre: un lechón pasa a otra cerda que lo cría. Sigue siendo hijo de
 * su madre (madre_id, su código no cambia) y queda con la nodriza (nodriza_id).
 * José: se anota de dónde viene, para dónde va y por qué.
 */
export default function AdopcionModal({ open, onClose, fincaId, hembras, onGuardado }: {
  open: boolean; onClose: () => void; fincaId: string; hembras: Reproductora[]; onGuardado: () => void
}) {
  const [lechones, setLechones] = useState<Lechon[]>([])
  const [historial, setHistorial] = useState<Adopcion[]>([])
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  const [fecha, setFecha] = useState(hoyLocal())
  const [razon, setRazon] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!open) return
    let vigente = true
    const supabase = createClient()
    Promise.all([
      supabase.from('lechones_cerdos').select('id, codigo, madre_id, nodriza_id, peso_nacimiento_kg').eq('finca_id', fincaId).eq('estado', 'lactante').order('codigo'),
      supabase.from('adopciones_cerdos').select('id, fecha, razon, lechon_id, madre_origen_id, madre_destino_id').eq('finca_id', fincaId).order('fecha', { ascending: false }).limit(15),
    ]).then(([l, a]) => {
      if (!vigente) return
      setLechones((l.data ?? []) as Lechon[])
      setHistorial((a.data ?? []) as Adopcion[])
    })
    return () => { vigente = false }
  }, [open, fincaId, version])

  // La cerda que hoy cría a cada lechón: la nodriza si lo adoptaron, si no su madre
  const criaDe = (l: Lechon) => l.nodriza_id ?? l.madre_id
  const conLechones = hembras.filter(h => lechones.some(l => criaDe(l) === h.id))
  const deOrigen = lechones.filter(l => criaDe(l) === origen)
  const nombre = (id: string | null) => {
    const h = hembras.find(x => x.id === id)
    return h ? `${h.codigo}${h.nombre ? ` (${h.nombre})` : ''}` : '—'
  }
  const codigoLechon = (id: string) => lechones.find(l => l.id === id)?.codigo ?? 'lechón'

  async function guardar() {
    if (!origen || !destino || elegidos.length === 0) { toast.error('Elige la cerda de origen, los lechones y la cerda que los recibe'); return }
    if (origen === destino) { toast.error('La cerda que recibe tiene que ser otra'); return }
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase.from('adopciones_cerdos').insert(elegidos.map(id => ({
      finca_id: fincaId, lechon_id: id, madre_origen_id: origen, madre_destino_id: destino, fecha, razon: razon.trim() || null,
    })))
    // Si vuelve con su propia madre, deja de tener nodriza
    const madreDe = (id: string) => lechones.find(l => l.id === id)?.madre_id
    const errores = error ? [error] : (await Promise.all(elegidos.map(id =>
      supabase.from('lechones_cerdos').update({ nodriza_id: madreDe(id) === destino ? null : destino }).eq('id', id)
    ))).map(r => r.error).filter(Boolean)
    setGuardando(false)
    if (errores.length) { toast.error('No se pudo registrar el cambio de madre'); return }
    toast.success(`${elegidos.length} ${elegidos.length === 1 ? 'lechón pasó' : 'lechones pasaron'} a ${nombre(destino)}`)
    setElegidos([]); setRazon(''); setVersion(v => v + 1)
    onGuardado()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ic n="ciclo" /> Cambio de madre</DialogTitle>
          <p className="text-sm text-gray-500">El lechón conserva su código (de su madre) y queda criado por la otra cerda.</p>
        </DialogHeader>

        {conLechones.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No hay lechones lactando en la finca.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Sale de</Label>
                <select value={origen} onChange={e => { setOrigen(e.target.value); setElegidos([]) }} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                  <option value="">Elegir cerda…</option>
                  {conLechones.map(h => <option key={h.id} value={h.id}>{nombre(h.id)} · {lechones.filter(l => criaDe(l) === h.id).length} lechones</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Pasa a</Label>
                <select value={destino} onChange={e => setDestino(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                  <option value="">Elegir cerda…</option>
                  {hembras.filter(h => h.id !== origen && (h.estado === 'lactante' || conLechones.some(c => c.id === h.id))).map(h => (
                    <option key={h.id} value={h.id}>{nombre(h.id)} · {lechones.filter(l => criaDe(l) === h.id).length} lechones</option>
                  ))}
                </select>
              </div>
            </div>
            {origen && (
              <div className="space-y-1">
                <Label>Lechones que cambian</Label>
                <div className="flex flex-wrap gap-1.5">
                  {deOrigen.map(l => {
                    const on = elegidos.includes(l.id)
                    return (
                      <button key={l.id} type="button" onClick={() => setElegidos(p => on ? p.filter(x => x !== l.id) : [...p, l.id])}
                        className={`rounded-full px-2.5 py-1 font-mono text-xs ${on ? 'bg-pink-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>
                        {l.codigo}{l.peso_nacimiento_kg ? ` · ${Number(l.peso_nacimiento_kg).toLocaleString('es-CO')} kg` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input type="date" value={fecha} max={hoyLocal()} onChange={e => setFecha(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Razón</Label>
                <Input list="razones-adopcion" placeholder="¿Por qué?" value={razon} onChange={e => setRazon(e.target.value)} />
                <datalist id="razones-adopcion">{RAZONES.map(r => <option key={r} value={r} />)}</datalist>
              </div>
            </div>
          </div>
        )}

        {historial.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600">Últimos cambios</p>
            <ul className="space-y-0.5 text-xs text-gray-600">
              {historial.map(a => (
                <li key={a.id}>{a.fecha} · <span className="font-mono">{codigoLechon(a.lechon_id)}</span>: {nombre(a.madre_origen_id)} → {nombre(a.madre_destino_id)}{a.razon ? ` · ${a.razon}` : ''}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={guardar} disabled={guardando || elegidos.length === 0} className="bg-pink-600 text-white hover:bg-pink-700">
            {guardando ? 'Guardando…' : 'Registrar cambio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
