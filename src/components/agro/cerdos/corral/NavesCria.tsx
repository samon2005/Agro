'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import TabReproduccion from '@/components/agro/cerdos/reproduccion/TabReproduccion'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Nave = Database['public']['Tables']['naves_cerdos']['Row']

/**
 * Un corral de cría puede tener varias naves de cerdas. Se pasa de una a otra con
 * la barra de arriba, y al entrar a una se ve su pantalla con sus cerdas, servicios,
 * partos, lechones y destetes. El nombre de cada nave lo pone el productor.
 */
export default function NavesCria({ lote, onLoteUpdated }: { lote: LoteCerdos; onLoteUpdated: () => void }) {
  const supabase = createClient()
  const [naves, setNaves] = useState<Nave[]>([])
  const [conteo, setConteo] = useState<Record<string, number>>({})
  const [naveId, setNaveId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [dialogo, setDialogo] = useState<{ modo: 'nueva' | 'renombrar'; nombre: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)

  const cargar = useCallback(async () => {
    const [n, c] = await Promise.all([
      supabase.from('naves_cerdos').select('*').eq('lote_id', lote.id).order('orden').order('created_at'),
      supabase.from('reproductoras_cerdos').select('nave_id, estado').eq('lote_id', lote.id),
    ])
    const lista = n.data ?? []
    setNaves(lista)
    const cuenta: Record<string, number> = {}
    for (const r of c.data ?? []) if (r.nave_id && r.estado !== 'descartada') cuenta[r.nave_id] = (cuenta[r.nave_id] ?? 0) + 1
    setConteo(cuenta)
    setNaveId(prev => (prev && lista.some(x => x.id === prev) ? prev : lista[0]?.id ?? null))
    setCargando(false)
  }, [lote.id, supabase])

  useEffect(() => { cargar() }, [cargar])

  const nave = naves.find(n => n.id === naveId) ?? null

  async function guardarNave() {
    if (!dialogo) return
    const nombre = dialogo.nombre.trim()
    if (!nombre) { toast.error('Ponle nombre a la nave'); return }
    if (naves.some(n => n.nombre.toLowerCase() === nombre.toLowerCase() && n.id !== (dialogo.modo === 'renombrar' ? naveId : null))) {
      toast.error('Ya hay una nave con ese nombre'); return
    }
    setGuardando(true)
    if (dialogo.modo === 'nueva') {
      const { data, error } = await supabase.from('naves_cerdos').insert({
        finca_id: lote.finca_id, lote_id: lote.id, nombre,
        orden: (naves.reduce((m, n) => Math.max(m, n.orden), 0) || naves.length) + 1,
      }).select('id').single()
      setGuardando(false)
      if (error || !data) { toast.error('No se pudo agregar la nave'); return }
      toast.success(`${nombre} agregada: registra sus cerdas`)
      setNaveId(data.id)
    } else if (nave) {
      const { error } = await supabase.from('naves_cerdos').update({ nombre }).eq('id', nave.id)
      setGuardando(false)
      if (error) { toast.error('No se pudo cambiar el nombre'); return }
      toast.success('Nombre de la nave cambiado')
    }
    setDialogo(null)
    cargar()
  }

  async function quitarNave() {
    if (!nave) return
    if (!confirmandoQuitar) { setConfirmandoQuitar(true); return }
    setConfirmandoQuitar(false)
    // Solo se quita vacía: las cerdas (y su historia) cuelgan de ella
    const { count } = await supabase.from('reproductoras_cerdos').select('id', { count: 'exact', head: true }).eq('nave_id', nave.id)
    if ((count ?? 0) > 0) { toast.error(`${nave.nombre} tiene cerdas: pásalas a otra nave antes de quitarla`); return }
    const { error } = await supabase.from('naves_cerdos').delete().eq('id', nave.id)
    if (error) { toast.error('No se pudo quitar la nave'); return }
    toast.success(`${nave.nombre} quitada`)
    setNaveId(null)
    cargar()
  }

  if (cargando) return <Skeleton className="h-40 w-full rounded-2xl" />

  return (
    <div className="space-y-4">
      {/* Barra de naves */}
      <div className="flex flex-wrap items-center gap-2">
        {naves.map(n => (
          <button
            key={n.id}
            onClick={() => { setNaveId(n.id); setConfirmandoQuitar(false) }}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors',
              n.id === naveId ? 'bg-pink-600 text-white shadow-[0_6px_16px_-10px_rgb(0_0_0/40%)]' : 'bg-pink-50 text-pink-900 hover:bg-pink-100',
            )}
          >
            {n.nombre}
            <span className={cn('rounded-full px-1.5 text-xs', n.id === naveId ? 'bg-white/20' : 'bg-white text-pink-700')}>{conteo[n.id] ?? 0}</span>
          </button>
        ))}
        <button
          onClick={() => setDialogo({ modo: 'nueva', nombre: `Nave ${naves.length + 1}` })}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-pink-300 px-3 text-sm font-medium text-pink-700 transition-colors hover:bg-pink-50"
        >
          <Ic n="mas" className="size-4" /> Agregar nave
        </button>
        {nave && (
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-500" onClick={() => setDialogo({ modo: 'renombrar', nombre: nave.nombre })}>
              <Ic n="editar" /> Nombre
            </Button>
            <Button
              size="sm" variant="ghost"
              className={cn('h-8 text-xs', confirmandoQuitar ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600')}
              onClick={quitarNave}
              onBlur={() => setConfirmandoQuitar(false)}
            >
              {confirmandoQuitar ? '¿Quitar la nave?' : <><Ic n="borrar" /> Quitar</>}
            </Button>
          </div>
        )}
      </div>

      {naves.length === 0 ? (
        <div className="superficie rounded-2xl py-12 text-center">
          <p className="mb-2 text-4xl text-pink-300"><Ic n="cerdo" /></p>
          <p className="font-medium text-gray-700">Este corral todavía no tiene naves</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
            Las cerdas de cría se registran por nave. Agrega la primera (el nombre lo eliges tú) y luego sus cerdas.
          </p>
          <Button className="mt-4 bg-pink-600 text-white hover:bg-pink-700" onClick={() => setDialogo({ modo: 'nueva', nombre: 'Nave 1' })}>
            <Ic n="mas" /> Agregar nave
          </Button>
        </div>
      ) : nave && (
        <TabReproduccion
          key={nave.id}
          loteActual={lote}
          nave={nave}
          naves={naves}
          onLoteUpdated={() => { onLoteUpdated(); cargar() }}
        />
      )}

      <Dialog open={dialogo != null} onOpenChange={v => !v && !guardando && setDialogo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogo?.modo === 'nueva' ? 'Agregar nave' : 'Nombre de la nave'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); guardarNave() }} className="space-y-4">
            <Input autoFocus placeholder="Ej: Nave 1, Gestación, Maternidad..." value={dialogo?.nombre ?? ''}
              onChange={e => setDialogo(prev => prev ? { ...prev, nombre: e.target.value } : prev)} />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={guardando} onClick={() => setDialogo(null)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
