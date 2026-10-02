'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ic } from '@/components/ui/icon'
import type { Database } from '@/types/database'

type Instalacion = Database['public']['Tables']['instalaciones']['Row']

interface Props {
  fincaId: string
  /** Avisa cuando cambian los galpones, para refrescar lo que dependa de ellos */
  onCambio?: () => void
}

interface Fila { id: string | null; nombre: string; area_m2: string; ocupado: boolean; usado: boolean }

/**
 * Los galpones de la finca: se agregan cuando se construye uno, se corrige su
 * nombre o su medida, y se quita solo si nunca tuvo aves (si tuvo, su historia
 * cuelga de él). Cambiar el nombre o la medida se refleja en el lote que lo ocupa.
 */
export default function GalponesFinca({ fincaId, onCambio }: Props) {
  const supabase = createClient()
  const [filas, setFilas] = useState<Fila[]>([])
  const [originales, setOriginales] = useState<Instalacion[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [inst, lotes] = await Promise.all([
      supabase.from('instalaciones').select('*').eq('finca_id', fincaId).eq('especie', 'aves_ponedoras').order('nombre'),
      supabase.from('lotes_aves').select('instalacion_id, estado').eq('finca_id', fincaId),
    ])
    const lista = inst.data ?? []
    const usados = new Set((lotes.data ?? []).map(l => l.instalacion_id).filter(Boolean))
    const ocupados = new Set(
      (lotes.data ?? []).filter(l => l.estado === 'activo' || l.estado === 'preparacion').map(l => l.instalacion_id).filter(Boolean),
    )
    setOriginales(lista)
    setFilas(lista.map(i => ({
      id: i.id,
      nombre: i.nombre,
      area_m2: i.area_m2 != null ? String(i.area_m2) : '',
      ocupado: ocupados.has(i.id),
      usado: usados.has(i.id),
    })))
    setLoading(false)
  }, [fincaId, supabase])

  useEffect(() => { cargar() }, [cargar])

  function set(i: number, campo: 'nombre' | 'area_m2', valor: string) {
    setFilas(prev => prev.map((f, j) => j === i ? { ...f, [campo]: valor } : f))
  }

  async function quitar(i: number) {
    const fila = filas[i]
    if (!fila.id) { setFilas(prev => prev.filter((_, j) => j !== i)); return }
    if (fila.usado) {
      toast.error(`${fila.nombre} ya tuvo aves: su historia depende de él y no se puede quitar`)
      return
    }
    const { error } = await supabase.from('instalaciones').delete().eq('id', fila.id)
    if (error) { toast.error('Error al quitar el galpón'); return }
    toast.success(`${fila.nombre} quitado de la finca`)
    await cargar()
    onCambio?.()
  }

  async function guardar() {
    const nombres = filas.map(f => f.nombre.trim().toLowerCase())
    if (nombres.some(n => !n)) { toast.error('Cada galpón necesita su nombre'); return }
    if (new Set(nombres).size !== nombres.length) { toast.error('Hay dos galpones con el mismo nombre'); return }
    if (filas.some(f => !f.area_m2 || Number(f.area_m2) <= 0)) { toast.error('Escribe la medida de cada galpón en m²'); return }

    setGuardando(true)
    for (const f of filas) {
      const nombre = f.nombre.trim()
      const area = Number(f.area_m2)
      if (!f.id) {
        const { error } = await supabase.from('instalaciones').insert({
          finca_id: fincaId, especie: 'aves_ponedoras', tipo: 'galpon', nombre, area_m2: area,
        })
        if (error) { setGuardando(false); toast.error(`Error al agregar ${nombre}`); return }
        continue
      }
      const antes = originales.find(o => o.id === f.id)
      if (!antes || (antes.nombre === nombre && Number(antes.area_m2 ?? 0) === area)) continue

      const { error } = await supabase.from('instalaciones').update({ nombre, area_m2: area }).eq('id', f.id)
      if (error) { setGuardando(false); toast.error(`Error al guardar ${nombre}`); return }

      // El lote que ocupa el galpón lleva su nombre y su medida: se mantienen iguales
      await supabase.from('lotes_aves')
        .update({ nombre, area_galpon_m2: area })
        .eq('instalacion_id', f.id)
        .in('estado', ['activo', 'preparacion'])
      // El ítem de huevos del galpón cambia de nombre solo (lo hace la base)
    }
    setGuardando(false)
    toast.success('Galpones guardados')
    await cargar()
    onCambio?.()
  }

  if (loading) return <p className="text-xs text-gray-400">Cargando galpones…</p>

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_7rem_2rem] gap-2 px-1 text-xs font-medium text-gray-500">
        <span>Galpón</span>
        <span>Medida (m²)</span>
        <span />
      </div>
      {filas.map((f, i) => (
        <div key={f.id ?? `nuevo-${i}`} className="grid grid-cols-[1fr_7rem_2rem] items-center gap-2">
          <div className="relative">
            <Input value={f.nombre} onChange={e => set(i, 'nombre', e.target.value)} />
            {f.ocupado && (
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.6875rem] text-green-700">
                con aves
              </span>
            )}
          </div>
          <Input type="number" min="0" step="0.1" value={f.area_m2} onChange={e => set(i, 'area_m2', e.target.value)} />
          <Button
            type="button" variant="ghost" size="sm" className="h-9 w-8 p-0 text-red-600 disabled:text-gray-300"
            disabled={f.usado}
            title={f.usado ? 'Ya tuvo aves: no se puede quitar' : 'Quitar galpón'}
            onClick={() => quitar(i)}
          >
            <Ic n="borrar" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => setFilas(prev => [...prev, { id: null, nombre: `Galpón ${prev.length + 1}`, area_m2: '', ocupado: false, usado: false }])}
        >
          <Ic n="mas" /> Agregar galpón
        </Button>
        <Button type="button" size="sm" disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando...' : 'Guardar galpones'}
        </Button>
      </div>
    </div>
  )
}
