'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'

type Finca = {
  id: string
  altitud_msnm: number | null
  velocidad_viento_kmh: number | null
  clima_predominante: string | null
  temperatura_promedio_ext: number | null
  tipo_produccion: string[] | null
  latitud: number | null
  longitud: number | null
  area_valor?: number | null
  area_unidad?: string | null
}

const UNIDAD_OTRA = '__otra__'

interface Props {
  open: boolean
  onClose: () => void
  finca: Finca
  onUpdated: () => void
}

const TABLA_POR_ESPECIE: Record<EspecieFinca, string> = {
  aves_ponedoras: 'lotes_aves',
  cerdos: 'lotes_cerdos',
  pollo_engorde: 'lotes_pollo',
}

const CLIMAS = [
  { value: 'calido', label: 'Cálido (0–1.000 msnm)' },
  { value: 'templado', label: 'Templado (1.000–2.000 msnm)' },
  { value: 'frio', label: 'Frío (2.000–3.000 msnm)' },
  { value: 'paramo', label: 'Páramo (> 3.000 msnm)' },
]

export default function EditarFincaModal({ open, onClose, finca, onUpdated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    altitud_msnm: '',
    velocidad_viento_kmh: '',
    clima_predominante: '',
    temperatura_promedio_ext: '',
    latitud: '',
    longitud: '',
  })
  const [especies, setEspecies] = useState<EspecieFinca[]>([])
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [conteos, setConteos] = useState<Record<string, number>>({})
  const [areaValor, setAreaValor] = useState('')
  const [areaUnidad, setAreaUnidad] = useState('ha')
  const [unidadOtra, setUnidadOtra] = useState('')
  const [unidadesGuardadas, setUnidadesGuardadas] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setForm({
      altitud_msnm: finca.altitud_msnm != null ? String(finca.altitud_msnm) : '',
      velocidad_viento_kmh: finca.velocidad_viento_kmh != null ? String(finca.velocidad_viento_kmh) : '',
      clima_predominante: finca.clima_predominante ?? '',
      temperatura_promedio_ext: finca.temperatura_promedio_ext != null ? String(finca.temperatura_promedio_ext) : '',
      latitud: finca.latitud != null ? String(finca.latitud) : '',
      longitud: finca.longitud != null ? String(finca.longitud) : '',
    })
    setEspecies((finca.tipo_produccion ?? []) as EspecieFinca[])
    setAreaValor(finca.area_valor != null ? String(finca.area_valor) : '')
    const unidadActual = finca.area_unidad ?? 'ha'
    setAreaUnidad(unidadActual === 'ha' || unidadActual === 'm2' ? unidadActual : (unidadActual ? UNIDAD_OTRA : 'ha'))
    setUnidadOtra(unidadActual !== 'ha' && unidadActual !== 'm2' ? unidadActual ?? '' : '')

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('unidades_area_personalizadas')
        .select('nombre')
        .eq('propietario_id', user.id)
        .order('nombre')
      setUnidadesGuardadas((data ?? []).map(d => d.nombre))
    })

    Promise.all(
      ESPECIES_FINCA.map(async esp => {
        const { count } = await supabase
          .from(TABLA_POR_ESPECIE[esp.value])
          .select('id', { count: 'exact', head: true })
          .eq('finca_id', finca.id)
        return [esp.value, count ?? 0] as const
      })
    ).then(entries => setConteos(Object.fromEntries(entries)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca, open])

  function usarUbicacionActual() {
    if (!navigator.geolocation) { toast.error('Tu navegador no soporta geolocalización'); return }
    setBuscandoUbicacion(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(prev => ({ ...prev, latitud: String(pos.coords.latitude), longitud: String(pos.coords.longitude) }))
        setBuscandoUbicacion(false)
        toast.success('Ubicación detectada')
      },
      () => { setBuscandoUbicacion(false); toast.error('No se pudo obtener tu ubicación') }
    )
  }

  function toggleEspecie(value: EspecieFinca) {
    const yaSeleccionada = especies.includes(value)
    if (yaSeleccionada) {
      const count = conteos[value] ?? 0
      if (count > 0) {
        const esp = ESPECIES_FINCA.find(e => e.value === value)
        toast.error(
          `No puedes quitar "${esp?.label}": tiene ${count} ${count === 1 ? 'lote/galpón registrado' : 'lotes/galpones registrados'}. Elimínalos primero desde su sección.`
        )
        return
      }
    }
    setEspecies(prev => yaSeleccionada ? prev.filter(e => e !== value) : [...prev, value])
  }

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (especies.length === 0) { toast.error('Selecciona al menos una especie con la que trabaja la finca'); return }
    setLoading(true)

    const areaNum = areaValor ? Number(areaValor) : null
    const unidadFinal = areaUnidad === UNIDAD_OTRA ? unidadOtra.trim() : areaUnidad

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('fincas')
      .update({
        altitud_msnm: form.altitud_msnm ? Number(form.altitud_msnm) : null,
        velocidad_viento_kmh: form.velocidad_viento_kmh ? Number(form.velocidad_viento_kmh) : null,
        clima_predominante: form.clima_predominante || null,
        temperatura_promedio_ext: form.temperatura_promedio_ext ? Number(form.temperatura_promedio_ext) : null,
        tipo_produccion: especies,
        latitud: form.latitud ? Number(form.latitud) : null,
        longitud: form.longitud ? Number(form.longitud) : null,
        area_valor: areaNum,
        area_unidad: areaNum && unidadFinal ? unidadFinal : null,
      })
      .eq('id', finca.id)

    setLoading(false)
    if (error) { toast.error('Error al guardar los datos de la finca'); return }

    if (areaNum && areaUnidad === UNIDAD_OTRA && unidadFinal && user) {
      await supabase.from('unidades_area_personalizadas').upsert(
        { propietario_id: user.id, nombre: unidadFinal },
        { onConflict: 'propietario_id,nombre' }
      )
    }

    toast.success('Datos geográficos actualizados')
    onUpdated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>📍 Información Geográfica y Ambiental</DialogTitle>
          <p className="text-sm text-gray-500">Datos de referencia de la finca — se usan para contextualizar las lecturas de cada galpón/corral</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Altitud (msnm)</Label>
              <Input type="number" min="0" step="1" placeholder="Ej: 1650" value={form.altitud_msnm} onChange={e => set('altitud_msnm', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Velocidad del viento (km/h)</Label>
              <Input type="number" min="0" step="0.1" placeholder="Ej: 8.5" value={form.velocidad_viento_kmh} onChange={e => set('velocidad_viento_kmh', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Clima predominante</Label>
              <Select value={form.clima_predominante} onValueChange={v => set('clima_predominante', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {CLIMAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Temperatura ambiente promedio (°C)</Label>
              <Input type="number" step="0.1" placeholder="Ej: 24.0" value={form.temperatura_promedio_ext} onChange={e => set('temperatura_promedio_ext', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Área de la finca</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.01" min="0" placeholder="Ej: 120.5" value={areaValor} onChange={e => setAreaValor(e.target.value)} />
              <Select value={areaUnidad} onValueChange={v => setAreaUnidad(v ?? 'ha')}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ha">Hectáreas</SelectItem>
                  <SelectItem value="m2">Metros cuadrados (m²)</SelectItem>
                  {unidadesGuardadas.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
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
            <div className="flex items-center justify-between">
              <Label>Coordenadas (para el clima en tiempo real)</Label>
              <button type="button" onClick={usarUbicacionActual} disabled={buscandoUbicacion} className="text-xs text-green-700 hover:underline">
                {buscandoUbicacion ? 'Detectando...' : '📍 Usar mi ubicación actual'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.000001" placeholder="Latitud" value={form.latitud} onChange={e => set('latitud', e.target.value)} />
              <Input type="number" step="0.000001" placeholder="Longitud" value={form.longitud} onChange={e => set('longitud', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Especies con las que trabaja la finca *</Label>
            <div className="grid grid-cols-3 gap-2">
              {ESPECIES_FINCA.map(esp => {
                const selected = especies.includes(esp.value)
                const count = conteos[esp.value] ?? 0
                const bloqueada = selected && count > 0
                return (
                  <button
                    key={esp.value}
                    type="button"
                    onClick={() => toggleEspecie(esp.value)}
                    title={bloqueada ? `Tiene ${count} registrado(s) — elimínalos primero para poder quitar esta especie` : undefined}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
                      selected ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{esp.icon}</span>
                    {esp.label}
                    {selected && (
                      bloqueada ? (
                        <span className="text-[10px] font-normal text-amber-600">🔒 {count} registrado(s)</span>
                      ) : (
                        <span className="text-[10px] font-normal text-gray-400">Sin registros — se puede quitar</span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
