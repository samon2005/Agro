'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { USOS_NAVE, arbolNaves, esNaveDeCria, nombrePuestos } from '@/lib/instalaciones'

interface Props {
  fincaId: string
  /** Avisa cuando cambian, para refrescar lo que dependa de ellas */
  onCambio?: () => void
}

interface NaveFila {
  key: string
  id: string | null
  nombre: string
  uso: string
  puestos: string
  area_m2: string
  ocupada: boolean
  usada: boolean
}

interface CorralFila {
  key: string
  id: string | null
  /** key de la nave a la que pertenece ('' = sin nave) */
  nave: string
  nombre: string
  area_m2: string
  ocupado: boolean
  usado: boolean
}

const nuevaKey = () => `nuevo-${Math.random().toString(36).slice(2, 9)}`
const texto = (n: number | null) => (n != null ? String(n) : '')
/** Dos medidas iguales (las dos vacías cuentan como iguales) */
const mismo = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Number(a) === Number(b))

/**
 * Las naves de la granja de cerdos y, dentro de las de engorde, sus corrales.
 * Una nave o un corral se quitan solo si nunca tuvieron animales: si tuvieron,
 * su historia depende de ellos.
 */
export default function NavesFinca({ fincaId, onCambio }: Props) {
  const supabase = createClient()
  const [naves, setNaves] = useState<NaveFila[]>([])
  const [corrales, setCorrales] = useState<CorralFila[]>([])
  const [originales, setOriginales] = useState<Map<string, { nombre: string; uso: string | null; puestos: number | null; area_m2: number | null; padre_id: string | null }>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const [inst, lotes, cerdas] = await Promise.all([
      supabase.from('instalaciones').select('id, nombre, tipo, uso, padre_id, puestos, area_m2').eq('finca_id', fincaId).eq('especie', 'cerdos'),
      supabase.from('lotes_cerdos').select('instalacion_id, estado').eq('finca_id', fincaId),
      supabase.from('reproductoras_cerdos').select('ubicacion_id, estado').eq('finca_id', fincaId),
    ])
    const lugares = inst.data ?? []
    const usados = new Set([
      ...(lotes.data ?? []).map(l => l.instalacion_id),
      ...(cerdas.data ?? []).map(c => c.ubicacion_id),
    ].filter(Boolean) as string[])
    const ocupados = new Set([
      ...(lotes.data ?? []).filter(l => l.estado === 'activo').map(l => l.instalacion_id),
      ...(cerdas.data ?? []).filter(c => c.estado !== 'descartada').map(c => c.ubicacion_id),
    ].filter(Boolean) as string[])
    const { naves: arbol, sueltos } = arbolNaves(lugares)
    setOriginales(new Map(lugares.map(l => [l.id, l])))
    setNaves(arbol.map(n => ({
      key: n.id, id: n.id, nombre: n.nombre, uso: n.uso ?? '', puestos: texto(n.puestos), area_m2: texto(n.area_m2),
      ocupada: ocupados.has(n.id) || n.corrales.some(c => ocupados.has(c.id)),
      usada: usados.has(n.id),
    })))
    setCorrales([...arbol.flatMap(n => n.corrales.map(c => ({ c, nave: n.id }))), ...sueltos.map(c => ({ c, nave: '' }))]
      .map(({ c, nave }) => ({
        key: c.id, id: c.id, nave, nombre: c.nombre, area_m2: texto(c.area_m2),
        ocupado: ocupados.has(c.id), usado: usados.has(c.id),
      })))
    setCargando(false)
  }, [fincaId, supabase])

  useEffect(() => { cargar() }, [cargar])

  function setNave(key: string, campo: 'nombre' | 'uso' | 'puestos' | 'area_m2', valor: string) {
    setNaves(prev => prev.map(n => n.key === key ? { ...n, [campo]: valor } : n))
  }
  function setCorral(key: string, campo: 'nombre' | 'area_m2' | 'nave', valor: string) {
    setCorrales(prev => prev.map(c => c.key === key ? { ...c, [campo]: valor } : c))
  }

  function agregarNave() {
    setNaves(prev => [...prev, { key: nuevaKey(), id: null, nombre: `Nave ${prev.length + 1}`, uso: '', puestos: '', area_m2: '', ocupada: false, usada: false }])
  }
  function agregarCorral(naveKey: string) {
    const cuantos = corrales.filter(c => c.nave === naveKey).length
    setCorrales(prev => [...prev, { key: nuevaKey(), id: null, nave: naveKey, nombre: `Corral ${cuantos + 1}`, area_m2: '', ocupado: false, usado: false }])
  }

  async function quitarNave(n: NaveFila) {
    if (corrales.some(c => c.nave === n.key)) { toast.error(`Quita o mueve primero los corrales de ${n.nombre}`); return }
    if (!n.id) { setNaves(prev => prev.filter(x => x.key !== n.key)); return }
    if (n.usada) { toast.error(`${n.nombre} ya tuvo cerdos: su historia depende de ella y no se puede quitar`); return }
    const { error } = await supabase.from('instalaciones').delete().eq('id', n.id)
    if (error) { toast.error('No se pudo quitar la nave'); return }
    toast.success(`${n.nombre} quitada`)
    await cargar()
    onCambio?.()
  }

  async function quitarCorral(c: CorralFila) {
    if (!c.id) { setCorrales(prev => prev.filter(x => x.key !== c.key)); return }
    if (c.usado) { toast.error(`${c.nombre} ya tuvo cerdos: su historia depende de él y no se puede quitar`); return }
    const { error } = await supabase.from('instalaciones').delete().eq('id', c.id)
    if (error) { toast.error('No se pudo quitar el corral'); return }
    toast.success(`${c.nombre} quitado`)
    await cargar()
    onCambio?.()
  }

  const numero = (t: string) => (t.trim() === '' ? null : Number(t.replace(',', '.')))

  async function guardar() {
    // Validar antes de tocar la base
    const nombresNaves = naves.map(n => n.nombre.trim().toLowerCase())
    if (nombresNaves.some(n => !n)) { toast.error('Cada nave necesita su nombre'); return }
    if (new Set(nombresNaves).size !== nombresNaves.length) { toast.error('Hay dos naves con el mismo nombre'); return }
    if (naves.some(n => !n.uso)) { toast.error('Elige para qué es cada nave'); return }
    for (const n of naves) {
      const p = numero(n.puestos), a = numero(n.area_m2)
      if (p != null && (!Number.isInteger(p) || p <= 0)) { toast.error(`${n.nombre}: los puestos son un número entero`); return }
      if (a != null && !(a > 0)) { toast.error(`${n.nombre}: la medida debe ser mayor que cero`); return }
      const antes = n.id ? originales.get(n.id) : null
      if (antes && n.ocupada && antes.uso && esNaveDeCria(antes.uso) !== esNaveDeCria(n.uso)) {
        toast.error(`${n.nombre} tiene animales: no puede pasar de cría a engorde (o al revés) mientras estén ahí`); return
      }
    }
    for (const naveKey of new Set(corrales.map(c => c.nave))) {
      const nombres = corrales.filter(c => c.nave === naveKey).map(c => c.nombre.trim().toLowerCase())
      if (nombres.some(n => !n)) { toast.error('Cada corral necesita su nombre'); return }
      if (new Set(nombres).size !== nombres.length) { toast.error('Hay dos corrales con el mismo nombre en la misma nave'); return }
    }
    if (corrales.some(c => { const a = numero(c.area_m2); return a != null && !(a > 0) })) { toast.error('La medida de un corral debe ser mayor que cero'); return }

    setGuardando(true)
    const idDeNave = new Map<string, string>()
    for (const n of naves) {
      const fila = { nombre: n.nombre.trim(), uso: n.uso, puestos: nombrePuestos(n.uso) ? numero(n.puestos) : null, area_m2: numero(n.area_m2) }
      if (!n.id) {
        const { data, error } = await supabase.from('instalaciones')
          .insert({ finca_id: fincaId, especie: 'cerdos', tipo: 'nave', ...fila }).select('id').single()
        if (error || !data) { setGuardando(false); toast.error(`No se pudo agregar ${fila.nombre}`); return }
        idDeNave.set(n.key, data.id)
        continue
      }
      idDeNave.set(n.key, n.id)
      const antes = originales.get(n.id)
      if (antes && antes.nombre === fila.nombre && antes.uso === fila.uso && mismo(antes.puestos, fila.puestos) && mismo(antes.area_m2, fila.area_m2)) continue
      const { error } = await supabase.from('instalaciones').update(fila).eq('id', n.id)
      if (error) { setGuardando(false); toast.error(`No se pudo guardar ${fila.nombre}`); return }
    }

    for (const c of corrales) {
      const padre = c.nave ? idDeNave.get(c.nave) ?? null : null
      // El corral toma el uso de su nave: así el grupo que entra sabe en qué etapa está
      const uso = naves.find(n => n.key === c.nave)?.uso ?? (c.id ? originales.get(c.id)?.uso ?? null : null)
      const fila = { nombre: c.nombre.trim(), area_m2: numero(c.area_m2), padre_id: padre, uso }
      if (!c.id) {
        const { error } = await supabase.from('instalaciones').insert({ finca_id: fincaId, especie: 'cerdos', tipo: 'corral', ...fila })
        if (error) { setGuardando(false); toast.error(`No se pudo agregar ${fila.nombre}`); return }
        continue
      }
      const antes = originales.get(c.id)
      if (antes && antes.nombre === fila.nombre && antes.padre_id === fila.padre_id && antes.uso === fila.uso && mismo(antes.area_m2, fila.area_m2)) continue
      const { error } = await supabase.from('instalaciones').update(fila).eq('id', c.id)
      if (error) { setGuardando(false); toast.error(`No se pudo guardar ${fila.nombre}`); return }
      // El grupo que lo ocupa lleva el nombre y la medida del corral
      await supabase.from('lotes_cerdos').update({ corral: fila.nombre, area_corral_m2: fila.area_m2 })
        .eq('instalacion_id', c.id).eq('estado', 'activo')
    }

    setGuardando(false)
    toast.success('Naves y corrales guardados')
    await cargar()
    onCambio?.()
  }

  if (cargando) return <p className="text-xs text-gray-400">Cargando naves…</p>

  const sueltos = corrales.filter(c => !c.nave)
  const opcionesNave = Object.fromEntries(naves.filter(n => !esNaveDeCria(n.uso)).map(n => [n.key, n.nombre]))

  return (
    <div className="space-y-3">
      {naves.length === 0 && (
        <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
          Todavía no hay naves. Agrega una por cada etapa: gestación, parideras, precebo, levante, ceba…
        </p>
      )}

      {naves.map(n => {
        const puestos = nombrePuestos(n.uso)
        const deCria = esNaveDeCria(n.uso)
        const susCorrales = corrales.filter(c => c.nave === n.key)
        return (
          <div key={n.key} className="space-y-2 rounded-xl border border-gray-200 p-3">
            {/* El modal es angosto: el nombre va solo en su fila y los datos debajo */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input aria-label="Nombre de la nave" value={n.nombre} onChange={e => setNave(n.key, 'nombre', e.target.value)} className="font-medium" />
                {n.ocupada && <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.6875rem] text-green-700">con cerdos</span>}
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 w-8 p-0 text-red-600 disabled:text-gray-300"
                disabled={n.usada} title={n.usada ? 'Ya tuvo cerdos: no se puede quitar' : 'Quitar nave'} onClick={() => quitarNave(n)}>
                <Ic n="borrar" />
              </Button>
            </div>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <div className="space-y-1">
                <span className="text-[0.6875rem] font-medium text-gray-500">Para qué es</span>
                <Select value={n.uso} onValueChange={v => setNave(n.key, 'uso', v ?? '')} items={Object.fromEntries(USOS_NAVE.map(u => [u.value, u.label]))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {USOS_NAVE.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[0.6875rem] font-medium capitalize text-gray-500">{puestos ?? 'Puestos'}</span>
                <Input inputMode="numeric" placeholder={puestos ? 'Cuántas' : 'No lleva'} disabled={!puestos}
                  value={puestos ? n.puestos : ''} onChange={e => setNave(n.key, 'puestos', e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[0.6875rem] font-medium text-gray-500">Medida m²</span>
                <Input inputMode="decimal" placeholder="Opcional" value={n.area_m2} onChange={e => setNave(n.key, 'area_m2', e.target.value)} />
              </div>
            </div>

            {n.uso && (deCria ? (
              <p className="text-[0.6875rem] text-gray-500">
                Las cerdas se ubican en esta nave{puestos ? ` y en su número de ${puestos.replace(/s$/, '')}` : ''} desde la pantalla de cerdos.
              </p>
            ) : (
              <div className="space-y-1.5 border-l-2 border-gray-100 pl-3">
                {susCorrales.map(c => (
                  <div key={c.key} className="grid grid-cols-[1fr_6rem_2rem] items-center gap-2">
                    <div className="relative">
                      <Input value={c.nombre} onChange={e => setCorral(c.key, 'nombre', e.target.value)} className="h-8 text-sm" />
                      {c.ocupado && <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.6875rem] text-green-700">con cerdos</span>}
                    </div>
                    <Input inputMode="decimal" placeholder="m²" value={c.area_m2} onChange={e => setCorral(c.key, 'area_m2', e.target.value)} className="h-8 text-sm" />
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 disabled:text-gray-300"
                      disabled={c.usado} title={c.usado ? 'Ya tuvo cerdos: no se puede quitar' : 'Quitar corral'} onClick={() => quitarCorral(c)}>
                      <Ic n="borrar" />
                    </Button>
                  </div>
                ))}
                <button type="button" onClick={() => agregarCorral(n.key)} className="inline-flex items-center gap-1 text-xs font-medium text-green-800 hover:underline">
                  <Ic n="mas" className="size-3.5" /> Agregar corral
                </button>
              </div>
            ))}
          </div>
        )
      })}

      {sueltos.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs font-medium text-amber-900">Corrales sin nave</p>
          <p className="text-[0.6875rem] text-amber-800">Se registraron antes de que existieran las naves. Elige a qué nave pertenece cada uno.</p>
          {sueltos.map(c => (
            <div key={c.key} className="grid grid-cols-[1fr_9rem_2rem] items-center gap-2">
              <Input value={c.nombre} onChange={e => setCorral(c.key, 'nombre', e.target.value)} className="h-8 bg-white text-sm" />
              <Select value={c.nave} onValueChange={v => setCorral(c.key, 'nave', v ?? '')} items={opcionesNave}>
                <SelectTrigger className={cn('h-8 w-full bg-white text-sm')}><SelectValue placeholder="Elegir nave..." /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {Object.entries(opcionesNave).map(([k, nombre]) => <SelectItem key={k} value={k}>{nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 disabled:text-gray-300"
                disabled={c.usado} onClick={() => quitarCorral(c)}>
                <Ic n="borrar" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={agregarNave}><Ic n="mas" /> Agregar nave</Button>
        <Button type="button" size="sm" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar naves'}</Button>
      </div>
    </div>
  )
}
