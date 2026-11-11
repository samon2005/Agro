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
import { LUGAR } from '@/lib/instalaciones'
import { Ic } from '@/components/ui/icon'
import GalponesFinca from './GalponesFinca'
import NavesFinca from './cerdos/NavesFinca'

type Finca = {
  id: string
  nombre: string
  altitud_msnm: number | null
  velocidad_viento_kmh: number | null
  clima_predominante: string | null
  temperatura_promedio_ext: number | null
  tipo_produccion: string[] | null
  etapas_cerdos?: string[] | null
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
  /** Se llama después de borrar la finca, para que la pantalla se recargue */
  onDeleted?: () => void
}

/** Cómo se nombra cada especie al mostrar lo que produce la finca. */
const NOMBRE_ESPECIE: Record<EspecieFinca, string> = {
  aves_ponedoras: 'Aves ponedoras',
  cerdos: 'Cerdos',
  pollo_engorde: 'Pollo de engorde',
}

const CLIMAS = [
  { value: 'calido', label: 'Cálido (0–1.000 msnm)' },
  { value: 'templado', label: 'Templado (1.000–2.000 msnm)' },
  { value: 'frio', label: 'Frío (2.000–3.000 msnm)' },
  { value: 'paramo', label: 'Páramo (> 3.000 msnm)' },
]

export default function EditarFincaModal({ open, onClose, finca, onUpdated, onDeleted }: Props) {
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
  // Lo que produce la finca. Por ahora puede ser más de una especie (decisión del
  // 11 nov 2026, para la prueba de José; revisar si se queda). Aquí no se quitan
  // especies: solo se eligen si la finca todavía no tiene ninguna.
  const [especies, setEspecies] = useState<EspecieFinca[]>([])
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [areaValor, setAreaValor] = useState('')
  const [areaUnidad, setAreaUnidad] = useState('ha')
  const [unidadOtra, setUnidadOtra] = useState('')
  const [unidadesGuardadas, setUnidadesGuardadas] = useState<string[]>([])
  const [confirmarNombre, setConfirmarNombre] = useState('')
  const [eliminando, setEliminando] = useState(false)

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

  function set(field: string, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value ?? '' }))
  }

  async function eliminarFinca() {
    if (confirmarNombre.trim() !== finca.nombre) { toast.error('El nombre no coincide'); return }
    setEliminando(true)
    const { data, error } = await supabase.from('fincas').delete().eq('id', finca.id).select('id')
    setEliminando(false)
    if (error) { toast.error('Error al eliminar la finca'); return }
    // Sin permiso la base no falla: simplemente no borra ninguna fila
    if (!data || data.length === 0) { toast.error('Solo el propietario de la finca puede eliminarla'); return }
    toast.success(`Finca "${finca.nombre}" eliminada`)
    onDeleted?.()
    onUpdated()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (especies.length === 0) { toast.error('Elige qué produce la finca'); return }
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
        // Se guardan todas: nunca se pierde una especie al editar otros datos
        tipo_produccion: ESPECIES_FINCA.map(e => e.value).filter(e => especies.includes(e)),
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="ubicacion" /> Datos de la finca</DialogTitle>
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
                {buscandoUbicacion ? 'Detectando...' : 'Usar mi ubicación actual'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.000001" placeholder="Latitud" value={form.latitud} onChange={e => set('latitud', e.target.value)} />
              <Input type="number" step="0.000001" placeholder="Longitud" value={form.longitud} onChange={e => set('longitud', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Lo que produce la finca</Label>
            {finca.tipo_produccion && finca.tipo_produccion.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-900">
                {especies.map(esp => (
                  <span key={esp} className="flex items-center gap-1.5">
                    <Ic n={ESPECIES_FINCA.find(e => e.value === esp)?.icon ?? 'hoja'} className="size-5" />
                    {NOMBRE_ESPECIE[esp]}
                  </span>
                ))}
              </div>
            ) : (
              <>
                <p className="text-xs text-amber-700">
                  Esta finca todavía no tiene especie. Marca lo que produce: el panel mostrará lo de cada producción.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {ESPECIES_FINCA.map(esp => (
                    <button
                      key={esp.value}
                      type="button"
                      onClick={() => setEspecies(prev => prev.includes(esp.value) ? prev.filter(x => x !== esp.value) : [...prev, esp.value])}
                      aria-pressed={especies.includes(esp.value)}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
                        especies.includes(esp.value) ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Ic n={esp.icon} className="size-5" />
                      {NOMBRE_ESPECIE[esp.value]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Los lugares fijos de la finca: galpones de aves o corrales de cerdos */}
          {(finca.tipo_produccion ?? []).filter((e): e is EspecieFinca => LUGAR[e as EspecieFinca] != null).map(especie => (
            <div key={especie} className="space-y-1.5">
              <Label>{LUGAR[especie]!.plural.charAt(0).toUpperCase() + LUGAR[especie]!.plural.slice(1)} de la finca</Label>
              <p className="text-xs text-gray-500">
                {especie === 'cerdos'
                  ? 'Una nave por cada etapa (gestación, parideras, precebo, levante, ceba, clínica…). Las de engorde se dividen en corrales; las de cría pueden tener jaulas o parideras numeradas.'
                  : 'Los lugares fijos donde entran las aves. Agrega uno cuando se construya, o corrige su nombre o su medida.'}
              </p>
              {especie === 'cerdos'
                ? <NavesFinca fincaId={finca.id} onCambio={onUpdated} />
                : <GalponesFinca fincaId={finca.id} especie={especie} onCambio={onUpdated} />}
            </div>
          ))}
          <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-red-800"><Ic n="alerta" /> Zona de peligro</p>
            <p className="text-xs text-red-600">
              Eliminar esta finca borra para siempre todos sus galpones, corrales y lotes, con su
              producción, alimento, sanidad, equipos, ventas y costos. No se puede deshacer.
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder={`Escribe "${finca.nombre}" para confirmar`}
                value={confirmarNombre}
                onChange={e => setConfirmarNombre(e.target.value)}
                className="bg-white"
              />
              <Button
                type="button"
                variant="destructive"
                disabled={eliminando || confirmarNombre.trim() !== finca.nombre}
                onClick={eliminarFinca}
              >
                {eliminando ? 'Eliminando...' : 'Eliminar finca'}
              </Button>
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
