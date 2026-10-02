'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import { geocodeMunicipio } from '@/lib/clima'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { LUGAR, USOS_CORRAL, llevaLugares } from '@/lib/instalaciones'

const UNIDAD_OTRA = '__otra__'

const DEPARTAMENTOS = [
  'Antioquia','Atlántico','Bogotá D.C.','Bolívar','Boyacá','Caldas','Caquetá',
  'Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guajira','Huila',
  'Magdalena','Meta','Nariño','Norte de Santander','Putumayo','Quindío',
  'Risaralda','Santander','Sucre','Tolima','Valle del Cauca','Vichada',
]

/** Las especies se nombran por lo que son al elegirlas, no por su sección. */
const NOMBRE_ESPECIE: Record<EspecieFinca, string> = {
  aves_ponedoras: 'Aves ponedoras',
  cerdos: 'Cerdos',
  pollo_engorde: 'Pollo de engorde',
}

type Props = {
  open: boolean
  onCreated: () => void
}

interface GalponNuevo { nombre: string; area_m2: string; uso: string }

/**
 * Registro de la finca en dos pasos: primero la finca y lo que produce (una sola
 * especie), y luego sus lugares fijos con su medida: los galpones de las aves o
 * los corrales de los cerdos (con el tipo de producción de cada corral). Después
 * solo se registran los animales que entran a cada uno.
 */
export default function CrearFincaModal({ open, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [paso, setPaso] = useState<1 | 2>(1)
  const [nombre, setNombre] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [areaValor, setAreaValor] = useState('')
  const [especie, setEspecie] = useState<EspecieFinca | null>(null)
  const [areaUnidad, setAreaUnidad] = useState('ha')
  const [unidadOtra, setUnidadOtra] = useState('')
  const [unidadesGuardadas, setUnidadesGuardadas] = useState<string[]>([])
  const [galpones, setGalpones] = useState<GalponNuevo[]>([{ nombre: '', area_m2: '', uso: '' }])

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('unidades_area_personalizadas')
        .select('nombre')
        .eq('propietario_id', user.id)
        .order('nombre')
      setUnidadesGuardadas((data ?? []).map(d => d.nombre))
    })
  }, [open])

  const llevaGalpones = llevaLugares(especie)
  const lugar = (especie && LUGAR[especie]) || LUGAR.aves_ponedoras!
  const esCorral = especie === 'cerdos'

  function setGalpon(i: number, campo: keyof GalponNuevo, valor: string) {
    setGalpones(prev => prev.map((g, j) => j === i ? { ...g, [campo]: valor } : g))
  }

  function agregarGalpon() {
    setGalpones(prev => [...prev, { nombre: `${lugar.base} ${prev.length + 1}`, area_m2: '', uso: '' }])
  }

  function validarPaso1(): boolean {
    if (!nombre.trim()) { toast.error('Escribe el nombre de la finca'); return false }
    if (!especie) { toast.error('Elige qué produce la finca'); return false }
    if (areaUnidad === UNIDAD_OTRA && areaValor && !unidadOtra.trim()) {
      toast.error('Escribe el nombre de la unidad de área'); return false
    }
    return true
  }

  function validarGalpones(): boolean {
    if (galpones.length === 0) { toast.error(`Registra al menos un ${lugar.singular}`); return false }
    const nombres = galpones.map(g => g.nombre.trim().toLowerCase())
    if (nombres.some(n => !n)) { toast.error(`Cada ${lugar.singular} necesita su nombre`); return false }
    if (new Set(nombres).size !== nombres.length) { toast.error(`Hay dos ${lugar.plural} con el mismo nombre`); return false }
    if (galpones.some(g => !g.area_m2 || Number(g.area_m2) <= 0)) {
      toast.error(`Escribe la medida de cada ${lugar.singular} en m²`); return false
    }
    if (esCorral && galpones.some(g => !g.uso)) { toast.error('Elige para qué es cada corral (cría o precebo)'); return false }
    return true
  }

  function siguiente(e: React.FormEvent) {
    e.preventDefault()
    if (!validarPaso1()) return
    if (llevaGalpones) {
      // Los nombres de ejemplo siguen a la especie elegida: "Galpón 1" o "Corral 1"
      setGalpones(prev => prev.map((g, i) => ({ ...g, nombre: g.nombre.trim() ? g.nombre : `${lugar.base} ${i + 1}` })))
      setPaso(2)
      return
    }
    guardar()
  }

  async function guardar() {
    if (llevaGalpones && !validarGalpones()) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); toast.error('Vuelve a iniciar sesión'); return }

    const coords = municipio && departamento ? await geocodeMunicipio(municipio, departamento) : null
    const area = areaValor ? Number(areaValor) : null
    const unidadFinal = areaUnidad === UNIDAD_OTRA ? unidadOtra.trim() : areaUnidad

    // El id se genera aquí: la membresía del dueño la crea la base justo después
    // de insertar, así que no se puede pedir la fila de vuelta en el mismo paso.
    const fincaId = crypto.randomUUID()
    const { error } = await supabase.from('fincas').insert({
      id: fincaId,
      nombre: nombre.trim(),
      municipio: municipio || null,
      departamento: departamento || null,
      area_valor: area,
      area_unidad: area && unidadFinal ? unidadFinal : null,
      tipo_produccion: [especie!],
      latitud: coords?.lat ?? null,
      longitud: coords?.lon ?? null,
      propietario_id: user.id,
    })

    if (error) {
      toast.error('Error al crear la finca: ' + error.message)
      setLoading(false)
      return
    }

    if (llevaGalpones) {
      const { error: errGalpones } = await supabase.from('instalaciones').insert(
        galpones.map(g => ({
          finca_id: fincaId,
          especie: especie!,
          tipo: lugar.tipo,
          nombre: g.nombre.trim(),
          area_m2: Number(g.area_m2),
          uso: esCorral ? g.uso : null,
          registrado_por: user.id,
        })),
      )
      if (errGalpones) {
        // La finca ya quedó: los lugares se pueden agregar después desde su configuración
        toast.warning(`La finca se creó, pero los ${lugar.plural} no se guardaron. Agrégalos en Datos de la finca.`)
      }
    }

    if (area && areaUnidad === UNIDAD_OTRA && unidadFinal) {
      await supabase.from('unidades_area_personalizadas').upsert(
        { propietario_id: user.id, nombre: unidadFinal },
        { onConflict: 'propietario_id,nombre' },
      )
    }

    toast.success('¡Finca creada!')
    setLoading(false)
    onCreated()
  }

  return (
    <Dialog open={open}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-900">
            <Ic n="hoja" /> {paso === 1 ? 'Registra tu finca' : `${lugar.plural.charAt(0).toUpperCase()}${lugar.plural.slice(1)} de la finca`}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {paso === 1
              ? 'Primero la finca y lo que produce.'
              : `Los ${lugar.plural} son los lugares fijos de la finca. Después solo registrarás los ${lugar.animales} que entran a cada uno.`}
          </p>
          {llevaGalpones && (
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className={cn('rounded-full px-2 py-0.5', paso === 1 ? 'bg-green-700 text-white' : 'bg-green-100 text-green-800')}>1. Finca</span>
              <span className="text-gray-300">→</span>
              <span className={cn('rounded-full px-2 py-0.5', paso === 2 ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-500')}>2. <span className="capitalize">{lugar.plural}</span></span>
            </div>
          )}
        </DialogHeader>

        {paso === 1 ? (
          <form onSubmit={siguiente} className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre de la finca *</Label>
              <Input id="nombre" placeholder="Ej: La Esperanza" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="municipio">Municipio</Label>
                <Input id="municipio" placeholder="Ej: Montería" value={municipio} onChange={e => setMunicipio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select
                  value={departamento}
                  onValueChange={(v: string | null) => setDepartamento(v ?? '')}
                  items={Object.fromEntries(DEPARTAMENTOS.map(d => [d, d]))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTAMENTOS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area_valor">Área de la finca</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input id="area_valor" type="number" step="0.01" min="0" placeholder="Ej: 120.5" value={areaValor} onChange={e => setAreaValor(e.target.value)} />
                <Select
                  value={areaUnidad}
                  onValueChange={v => setAreaUnidad(v ?? 'ha')}
                  items={{ ha: 'Hectáreas', m2: 'Metros cuadrados (m²)', ...Object.fromEntries(unidadesGuardadas.map(u => [u, u])), [UNIDAD_OTRA]: 'Otra unidad...' }}
                >
                  <SelectTrigger><SelectValue placeholder="Unidad" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ha">Hectáreas</SelectItem>
                    <SelectItem value="m2">Metros cuadrados (m²)</SelectItem>
                    {unidadesGuardadas.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    <SelectItem value={UNIDAD_OTRA}>Otra unidad...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {areaUnidad === UNIDAD_OTRA && (
                <Input
                  placeholder="Nombre de la unidad (Ej: fanegadas)"
                  value={unidadOtra}
                  onChange={e => setUnidadOtra(e.target.value)}
                  className="mt-1.5"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>¿Qué produce la finca? *</Label>
              <p className="text-xs text-gray-400">Una finca trabaja una sola especie: el panel solo mostrará lo de esa producción.</p>
              <div className="grid grid-cols-3 gap-2">
                {ESPECIES_FINCA.map(esp => {
                  const elegida = especie === esp.value
                  return (
                    <button
                      key={esp.value}
                      type="button"
                      onClick={() => setEspecie(esp.value)}
                      aria-pressed={elegida}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors',
                        elegida ? 'border-green-600 bg-green-50 text-green-800 ring-2 ring-green-600/20' : 'border-gray-200 text-gray-500 hover:border-gray-300',
                      )}
                    >
                      <Ic n={esp.icon} className="size-5" />
                      {NOMBRE_ESPECIE[esp.value]}
                    </button>
                  )
                })}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creando...' : llevaGalpones ? `Siguiente: ${lugar.plural}` : 'Crear finca'}
            </Button>
          </form>
        ) : (
          <div className="mt-2 space-y-4">
            <div className="space-y-2">
              <div className={cn('grid gap-2 px-1 text-xs font-medium text-gray-500', esCorral ? 'grid-cols-[1fr_6.5rem_7.5rem_2rem]' : 'grid-cols-[1fr_8rem_2rem]')}>
                <span>Nombre del {lugar.singular}</span>
                <span>Medida (m²)</span>
                {esCorral && <span>Para qué es</span>}
                <span />
              </div>
              {galpones.map((g, i) => (
                <div key={i} className={cn('grid items-center gap-2', esCorral ? 'grid-cols-[1fr_6.5rem_7.5rem_2rem]' : 'grid-cols-[1fr_8rem_2rem]')}>
                  <Input placeholder={`Ej: ${lugar.base} A`} value={g.nombre} onChange={e => setGalpon(i, 'nombre', e.target.value)} />
                  <Input type="number" min="0" step="0.1" placeholder={esCorral ? 'Ej: 60' : 'Ej: 500'} value={g.area_m2} onChange={e => setGalpon(i, 'area_m2', e.target.value)} />
                  {esCorral && (
                    <Select
                      value={g.uso}
                      onValueChange={v => setGalpon(i, 'uso', v ?? '')}
                      items={Object.fromEntries(USOS_CORRAL.map(u => [u.value, u.label]))}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>{USOS_CORRAL.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {galpones.length > 1 ? (
                    <Button
                      type="button" variant="ghost" size="sm" className="h-9 w-8 p-0 text-red-600"
                      onClick={() => setGalpones(prev => prev.filter((_, j) => j !== i))}
                    >
                      <Ic n="borrar" />
                    </Button>
                  ) : <span />}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={agregarGalpon}>
                <Ic n="mas" /> Agregar {lugar.singular}
              </Button>
            </div>
            {esCorral && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                {USOS_CORRAL.map(u => `${u.label}: ${u.detalle.toLowerCase()}`).join(' · ')}.
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" disabled={loading} onClick={() => setPaso(1)}>
                Atrás
              </Button>
              <Button type="button" className="flex-1" disabled={loading} onClick={guardar}>
                {loading ? 'Creando...' : 'Guardar y ver el resumen'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
