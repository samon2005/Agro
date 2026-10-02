'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { LUGAR, USOS_CORRAL } from '@/lib/instalaciones'
import type { EspecieFinca } from '@/lib/especies'
import type { Database } from '@/types/database'

type Instalacion = Database['public']['Tables']['instalaciones']['Row']

interface Props {
  fincaId: string
  /** De qué especie son los lugares: galpones de aves o corrales de cerdos */
  especie?: EspecieFinca
  /** Avisa cuando cambian, para refrescar lo que dependa de ellos */
  onCambio?: () => void
}

interface Fila { id: string | null; nombre: string; area_m2: string; uso: string; ocupado: boolean; usado: boolean }

/**
 * Los galpones (o corrales) de la finca: se agregan cuando se construye uno, se
 * corrige su nombre o su medida, y se quita solo si nunca tuvo animales (si tuvo,
 * su historia cuelga de él). Los corrales llevan además su tipo de producción.
 */
export default function GalponesFinca({ fincaId, especie = 'aves_ponedoras', onCambio }: Props) {
  const supabase = createClient()
  const lugar = LUGAR[especie] ?? LUGAR.aves_ponedoras!
  const esCorral = especie === 'cerdos'
  const [filas, setFilas] = useState<Fila[]>([])
  const [originales, setOriginales] = useState<Instalacion[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [inst, lotes] = await Promise.all([
      supabase.from('instalaciones').select('*').eq('finca_id', fincaId).eq('especie', especie).order('nombre'),
      esCorral
        ? supabase.from('lotes_cerdos').select('instalacion_id, estado').eq('finca_id', fincaId)
        : supabase.from('lotes_aves').select('instalacion_id, estado').eq('finca_id', fincaId),
    ])
    const lista = (inst.data ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
    const filasLotes = (lotes.data ?? []) as { instalacion_id: string | null; estado: string }[]
    const usados = new Set(filasLotes.map(l => l.instalacion_id).filter(Boolean))
    const ocupados = new Set(
      filasLotes.filter(l => l.estado === 'activo' || l.estado === 'preparacion').map(l => l.instalacion_id).filter(Boolean),
    )
    setOriginales(lista)
    setFilas(lista.map(i => ({
      id: i.id,
      nombre: i.nombre,
      area_m2: i.area_m2 != null ? String(i.area_m2) : '',
      uso: i.uso ?? '',
      ocupado: ocupados.has(i.id),
      usado: usados.has(i.id),
    })))
    setLoading(false)
  }, [fincaId, especie, esCorral, supabase])

  useEffect(() => { cargar() }, [cargar])

  function set(i: number, campo: 'nombre' | 'area_m2' | 'uso', valor: string) {
    setFilas(prev => prev.map((f, j) => j === i ? { ...f, [campo]: valor } : f))
  }

  async function quitar(i: number) {
    const fila = filas[i]
    if (!fila.id) { setFilas(prev => prev.filter((_, j) => j !== i)); return }
    if (fila.usado) {
      toast.error(`${fila.nombre} ya tuvo ${lugar.animales}: su historia depende de él y no se puede quitar`)
      return
    }
    const { error } = await supabase.from('instalaciones').delete().eq('id', fila.id)
    if (error) { toast.error(`Error al quitar el ${lugar.singular}`); return }
    toast.success(`${fila.nombre} quitado de la finca`)
    await cargar()
    onCambio?.()
  }

  async function guardar() {
    const nombres = filas.map(f => f.nombre.trim().toLowerCase())
    if (nombres.some(n => !n)) { toast.error(`Cada ${lugar.singular} necesita su nombre`); return }
    if (new Set(nombres).size !== nombres.length) { toast.error(`Hay dos ${lugar.plural} con el mismo nombre`); return }
    if (filas.some(f => !f.area_m2 || Number(f.area_m2) <= 0)) { toast.error(`Escribe la medida de cada ${lugar.singular} en m²`); return }
    if (esCorral && filas.some(f => !f.uso)) { toast.error('Elige para qué es cada corral (cría o precebo)'); return }

    setGuardando(true)
    for (const f of filas) {
      const nombre = f.nombre.trim()
      const area = Number(f.area_m2)
      const uso = esCorral ? f.uso : null
      if (!f.id) {
        const { error } = await supabase.from('instalaciones').insert({
          finca_id: fincaId, especie, tipo: lugar.tipo, nombre, area_m2: area, uso,
        })
        if (error) { setGuardando(false); toast.error(`Error al agregar ${nombre}`); return }
        continue
      }
      const antes = originales.find(o => o.id === f.id)
      if (!antes || (antes.nombre === nombre && Number(antes.area_m2 ?? 0) === area && (antes.uso ?? null) === uso)) continue

      // Un corral con cerdos no cambia de uso: lo que hay adentro es de ese tipo
      if (esCorral && f.ocupado && (antes.uso ?? null) !== uso) {
        setGuardando(false)
        toast.error(`${antes.nombre} tiene cerdos: no se puede cambiar su tipo mientras estén ahí`)
        return
      }

      const { error } = await supabase.from('instalaciones').update({ nombre, area_m2: area, uso }).eq('id', f.id)
      if (error) { setGuardando(false); toast.error(`Error al guardar ${nombre}`); return }

      // El lote que lo ocupa lleva su nombre y su medida: se mantienen iguales
      if (esCorral) {
        await supabase.from('lotes_cerdos')
          .update({ corral: nombre, area_corral_m2: area })
          .eq('instalacion_id', f.id).eq('estado', 'activo')
      } else {
        await supabase.from('lotes_aves')
          .update({ nombre, area_galpon_m2: area })
          .eq('instalacion_id', f.id)
          .in('estado', ['activo', 'preparacion'])
        // El ítem de huevos del galpón cambia de nombre solo (lo hace la base)
      }
    }
    setGuardando(false)
    toast.success(esCorral ? 'Corrales guardados' : 'Galpones guardados')
    await cargar()
    onCambio?.()
  }

  if (loading) return <p className="text-xs text-gray-400">Cargando {lugar.plural}…</p>

  const columnas = esCorral ? 'grid-cols-[1fr_6.5rem_7.5rem_2rem]' : 'grid-cols-[1fr_7rem_2rem]'

  return (
    <div className="space-y-2">
      <div className={cn('grid gap-2 px-1 text-xs font-medium text-gray-500', columnas)}>
        <span className="capitalize">{lugar.singular}</span>
        <span>Medida (m²)</span>
        {esCorral && <span>Para qué es</span>}
        <span />
      </div>
      {filas.map((f, i) => (
        <div key={f.id ?? `nuevo-${i}`} className={cn('grid items-center gap-2', columnas)}>
          <div className="relative">
            <Input value={f.nombre} onChange={e => set(i, 'nombre', e.target.value)} />
            {f.ocupado && (
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.6875rem] text-green-700">
                con {lugar.animales}
              </span>
            )}
          </div>
          <Input type="number" min="0" step="0.1" value={f.area_m2} onChange={e => set(i, 'area_m2', e.target.value)} />
          {esCorral && (
            <Select
              value={f.uso}
              onValueChange={v => set(i, 'uso', v ?? '')}
              items={Object.fromEntries(USOS_CORRAL.map(u => [u.value, u.label]))}
              disabled={f.ocupado}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Elegir..." /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>{USOS_CORRAL.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button
            type="button" variant="ghost" size="sm" className="h-9 w-8 p-0 text-red-600 disabled:text-gray-300"
            disabled={f.usado}
            title={f.usado ? `Ya tuvo ${lugar.animales}: no se puede quitar` : `Quitar ${lugar.singular}`}
            onClick={() => quitar(i)}
          >
            <Ic n="borrar" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => setFilas(prev => [...prev, { id: null, nombre: `${lugar.base} ${prev.length + 1}`, area_m2: '', uso: '', ocupado: false, usado: false }])}
        >
          <Ic n="mas" /> Agregar {lugar.singular}
        </Button>
        <Button type="button" size="sm" disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando...' : `Guardar ${lugar.plural}`}
        </Button>
      </div>
    </div>
  )
}
