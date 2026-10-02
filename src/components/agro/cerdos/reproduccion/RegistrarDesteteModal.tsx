'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { cop } from '@/lib/huevos'
import { cn } from '@/lib/utils'
import { dbGenerico } from '@/lib/especiesConfig'
import { useFinca } from '@/components/agro/FincaProvider'
import {
  diasDesde, DIAS_LACTANCIA_MIN, DIAS_LACTANCIA_MAX, DIAS_DESTETE_SERVICIO,
  tallasDeFinca, tallaDePeso, describirTallas, type TallaDestete,
} from '@/lib/cerdos'
import { Ic } from '@/components/ui/icon'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Parto = Database['public']['Tables']['partos_cerdos']['Row']
type Lechon = Database['public']['Tables']['lechones_cerdos']['Row']
type Instalacion = Database['public']['Tables']['instalaciones']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  hembras: Reproductora[]
  /** Camadas todavía sin destetar */
  partos: Parto[]
  partoPreseleccionado?: Parto | null
  onCreated: () => void
}

interface CorralPrecebo { corral: Instalacion; loteActivo: { nombre: string; animales_actuales: number } | null }

/**
 * El destete de una camada: cada lechón sale con su peso y se clasifica solo en
 * la talla que le toca según los rangos de la granja (S, M, L o como los tenga).
 * La camada se va a un corral de precebo o se vende; en los dos casos los
 * lechones dejan de estar con la cerda y pasan al Historial.
 */
export default function RegistrarDesteteModal({ open, onClose, lote, hembras, partos, partoPreseleccionado, onCreated }: Props) {
  const supabase = createClient()
  const { fincaActual, refetch: refetchFinca } = useFinca()
  const [loading, setLoading] = useState(false)
  const [partoId, setPartoId] = useState('')
  const [fecha, setFecha] = useState(hoyLocal())
  const [lechones, setLechones] = useState<Lechon[]>([])
  const [salen, setSalen] = useState<Record<string, boolean>>({})
  const [pesos, setPesos] = useState<Record<string, string>>({})
  // Camadas viejas sin lechones identificados: solo cuántos y el peso promedio
  const [destetados, setDestetados] = useState('')
  const [pesoPromedio, setPesoPromedio] = useState('')
  const [destino, setDestino] = useState<'corral' | 'venta' | ''>('')
  const [corralId, setCorralId] = useState('')
  const [corrales, setCorrales] = useState<CorralPrecebo[]>([])
  const [precio, setPrecio] = useState('')
  const [cliente, setCliente] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [tallas, setTallas] = useState<TallaDestete[]>(tallasDeFinca(null))
  const [editandoTallas, setEditandoTallas] = useState(false)
  const [formTallas, setFormTallas] = useState<{ nombre: string; desde: string }[]>([])

  useEffect(() => {
    if (!open) return
    setPartoId(partoPreseleccionado?.id ?? '')
    setFecha(hoyLocal())
    setDestino('')
    setCorralId('')
    setPrecio('')
    setCliente('')
    setObservaciones('')
    setDestetados('')
    setPesoPromedio('')
    setEditandoTallas(false)
    setTallas(tallasDeFinca(fincaActual?.tallas_destete))
    // Los corrales de precebo de la finca y si ya tienen un lote
    Promise.all([
      supabase.from('instalaciones').select('*').eq('finca_id', lote.finca_id).eq('especie', 'cerdos').eq('uso', 'precebo'),
      supabase.from('lotes_cerdos').select('instalacion_id, nombre, animales_actuales').eq('finca_id', lote.finca_id).eq('estado', 'activo'),
    ]).then(([inst, lotes]) => {
      const porCorral = new Map((lotes.data ?? []).map(l => [l.instalacion_id, l]))
      setCorrales((inst.data ?? [])
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
        .map(c => ({ corral: c, loteActivo: porCorral.get(c.id) ?? null })))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Al elegir la camada se traen sus lechones, cada uno con su código
  useEffect(() => {
    if (!open || !partoId) { setLechones([]); return }
    supabase.from('lechones_cerdos').select('*').eq('parto_id', partoId).order('numero')
      .then(({ data }) => {
        const lista = data ?? []
        setLechones(lista)
        setSalen(Object.fromEntries(lista.map(l => [l.id, l.estado !== 'muerto'])))
        setPesos(Object.fromEntries(lista.map(l => [l.id, l.peso_destete_kg != null ? String(l.peso_destete_kg) : ''])))
      })
  }, [open, partoId, supabase])

  const parto = partos.find(p => p.id === partoId) ?? null
  const hembra = parto ? hembras.find(h => h.id === parto.reproductora_id) : null
  const diasLactancia = parto ? diasDesde(parto.fecha_parto, fecha) : null
  const conLechones = lechones.length > 0
  const marcados = lechones.filter(l => salen[l.id])
  const cantidad = conLechones ? marcados.length : (Number(destetados) || 0)
  const pesosMarcados = marcados.map(l => Number(pesos[l.id])).filter(p => p > 0)
  const promedio = conLechones
    ? (pesosMarcados.length > 0 ? pesosMarcados.reduce((s, x) => s + x, 0) / pesosMarcados.length : null)
    : (Number(pesoPromedio) || null)
  const porTalla = tallas.map(t => ({
    ...t, total: marcados.filter(l => tallaDePeso(Number(pesos[l.id]), tallas) === t.nombre).length,
  }))
  const sinPeso = marcados.filter(l => !(Number(pesos[l.id]) > 0)).length
  const corralElegido = corrales.find(c => c.corral.id === corralId) ?? null

  function etiquetaParto(p: Parto) {
    const h = hembras.find(x => x.id === p.reproductora_id)
    const f = new Date(p.fecha_parto + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    return `${h?.codigo ?? '—'} — parto del ${f} (${p.nacidos_vivos} vivos)`
  }

  function abrirTallas() {
    setFormTallas(tallas.map(t => ({ nombre: t.nombre, desde: String(t.desde) })))
    setEditandoTallas(true)
  }

  async function guardarTallas() {
    const lista = formTallas
      .filter(t => t.nombre.trim())
      .map(t => ({ nombre: t.nombre.trim(), desde: Number(t.desde) }))
    if (lista.length < 2) { toast.error('Pon al menos dos tallas'); return }
    if (lista.some(t => !Number.isFinite(t.desde) || t.desde < 0)) { toast.error('Cada talla necesita su peso desde (kg)'); return }
    if (new Set(lista.map(t => t.nombre.toLowerCase())).size !== lista.length) { toast.error('Hay dos tallas con el mismo nombre'); return }
    const ordenadas = [...lista].sort((a, b) => a.desde - b.desde)
    if (new Set(ordenadas.map(t => t.desde)).size !== ordenadas.length) { toast.error('Dos tallas no pueden empezar en el mismo peso'); return }
    const { data, error } = await supabase.from('fincas').update({ tallas_destete: ordenadas }).eq('id', lote.finca_id).select('id')
    if (error) { toast.error('No se pudieron guardar las tallas'); return }
    if (!data || data.length === 0) { toast.error('Solo el propietario de la finca puede cambiar las tallas'); return }
    setTallas(ordenadas)
    setEditandoTallas(false)
    refetchFinca()
    toast.success('Tallas de la granja guardadas')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parto) { toast.error('Selecciona la camada que se desteta'); return }
    if (fecha > hoyLocal()) { toast.error('La fecha del destete no puede ser futura'); return }
    if (fecha < parto.fecha_parto) { toast.error('El destete no puede ser antes del parto'); return }
    if (cantidad <= 0) { toast.error('Ningún lechón sale de la camada'); return }
    if (cantidad > parto.nacidos_vivos) { toast.error(`Nacieron ${parto.nacidos_vivos} vivos: no se pueden destetar ${cantidad}`); return }
    if (conLechones && sinPeso > 0) { toast.error(`Falta el peso de ${sinPeso} lechón${sinPeso === 1 ? '' : 'es'}: con él se clasifica su talla`); return }
    if (!destino) { toast.error('Elige si la camada va a un corral de precebo o se vende'); return }
    if (destino === 'corral' && !corralElegido) { toast.error('Elige el corral de precebo'); return }
    if (destino === 'venta' && !(Number(precio) > 0)) { toast.error('Indica el precio por lechón'); return }

    setLoading(true)
    const { error } = await dbGenerico(supabase).rpc('registrar_destete', {
      p_parto: parto.id,
      p_fecha: fecha,
      p_lechones: lechones.map(l => ({
        id: l.id,
        sale: Boolean(salen[l.id]),
        peso: salen[l.id] ? pesos[l.id] || null : null,
        talla: salen[l.id] ? tallaDePeso(Number(pesos[l.id]), tallas) : null,
      })),
      p_destino: destino,
      p_corral: destino === 'corral' ? corralId : null,
      p_destetados: conLechones ? null : cantidad,
      p_peso_promedio: conLechones ? null : promedio,
      p_precio_lechon: destino === 'venta' ? Number(precio) : null,
      p_cliente: destino === 'venta' ? cliente : null,
      p_observaciones: observaciones.trim() || null,
    })
    setLoading(false)
    if (error) {
      toast.error(error.hint === 'destete' ? error.message : 'No se pudo registrar el destete')
      return
    }
    toast.success(destino === 'corral'
      ? `Destete registrado: ${cantidad} lechones pasan a ${corralElegido!.corral.nombre}`
      : `Destete registrado: ${cantidad} lechones vendidos por ${cop(cantidad * Number(precio))}`)
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !loading && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="cerdo" /> Registrar destete</DialogTitle>
          <p className="text-sm text-gray-500">
            El destete normal va entre los {DIAS_LACTANCIA_MIN} y los {DIAS_LACTANCIA_MAX} días de nacidos.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Camada *</Label>
              <Select
                value={partoId}
                onValueChange={v => setPartoId(v ?? '')}
                items={Object.fromEntries(partos.map(p => [p.id, etiquetaParto(p)]))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar camada..." /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="max-h-64">
                  {partos.length === 0
                    ? <div className="px-2 py-1.5 text-xs text-gray-400">No hay camadas lactando</div>
                    : partos.map(p => <SelectItem key={p.id} value={p.id}>{etiquetaParto(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha del destete</Label>
              <Input type="date" min={parto?.fecha_parto} max={hoyLocal()} value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            {parto && diasLactancia != null && (
              <div className="space-y-1">
                <Label>Lactancia</Label>
                <p className={cn('flex h-9 items-center text-sm', diasLactancia < DIAS_LACTANCIA_MIN || diasLactancia > DIAS_LACTANCIA_MAX ? 'text-amber-700' : 'text-gray-700')}>
                  {diasLactancia} días · {hembra?.codigo ?? '—'}
                </p>
              </div>
            )}
          </div>

          {/* Tallas de la granja: cada lechón se clasifica solo por su peso */}
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-600"><span className="font-semibold">Tallas de la granja:</span> {describirTallas(tallas)}</p>
              {!editandoTallas && (
                <button type="button" onClick={abrirTallas} className="text-xs font-medium text-pink-700 hover:underline">Cambiar</button>
              )}
            </div>
            {editandoTallas && (
              <div className="mt-2 space-y-2">
                {formTallas.map((t, i) => (
                  <div key={i} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-2">
                    <Input placeholder="Talla" value={t.nombre} onChange={e => setFormTallas(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} />
                    <div className="relative">
                      <Input type="number" min="0" step="0.1" placeholder="Desde" value={t.desde}
                        onChange={e => setFormTallas(prev => prev.map((x, j) => j === i ? { ...x, desde: e.target.value } : x))} />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.6875rem] text-gray-400">kg en adelante</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-8 p-0 text-red-600"
                      onClick={() => setFormTallas(prev => prev.filter((_, j) => j !== i))}><Ic n="borrar" /></Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormTallas(prev => [...prev, { nombre: '', desde: '' }])}><Ic n="mas" /> Talla</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditandoTallas(false)}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={guardarTallas}>Guardar tallas</Button>
                </div>
              </div>
            )}
          </div>

          {conLechones ? (
            <div className="space-y-2 rounded-xl bg-gray-50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-gray-700">Lechones de la camada</p>
                <p className="text-[0.6875rem] text-gray-500">Desmarca el que no llegó al destete · salen {marcados.length} de {lechones.length}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {lechones.map(l => {
                  const talla = salen[l.id] ? tallaDePeso(Number(pesos[l.id]), tallas) : null
                  const yaMuerto = l.estado === 'muerto'
                  return (
                    <div key={l.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-gray-200">
                      <input
                        type="checkbox" className="size-4 accent-pink-600"
                        checked={salen[l.id] ?? false}
                        disabled={yaMuerto}
                        onChange={e => setSalen(prev => ({ ...prev, [l.id]: e.target.checked }))}
                      />
                      <span className={cn('w-16 shrink-0 text-xs font-medium', salen[l.id] ? 'text-gray-700' : 'text-gray-400 line-through')}>{l.codigo}</span>
                      <div className="relative flex-1">
                        <Input
                          type="number" min="0" step="0.01" placeholder={yaMuerto ? 'Murió' : 'Peso'}
                          className="h-8 w-full pr-8 text-sm"
                          disabled={!salen[l.id]}
                          value={pesos[l.id] ?? ''}
                          onChange={e => setPesos(prev => ({ ...prev, [l.id]: e.target.value }))}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.6875rem] text-gray-400">kg</span>
                      </div>
                      <span className={cn('w-7 shrink-0 rounded text-center text-xs font-semibold', talla ? 'bg-pink-100 text-pink-800' : 'text-gray-300')}>{talla ?? '—'}</span>
                    </div>
                  )
                })}
              </div>
              {marcados.length > 0 && (
                <p className="text-[0.6875rem] text-gray-600">
                  {porTalla.map(t => `${t.nombre}: ${t.total}`).join(' · ')}
                  {promedio != null && <> · Peso promedio <strong>{promedio.toFixed(2)} kg</strong></>}
                </p>
              )}
            </div>
          ) : parto && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Lechones destetados *</Label>
                <Input type="number" min="1" max={parto.nacidos_vivos} value={destetados} onChange={e => setDestetados(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Peso promedio (kg)</Label>
                <Input type="number" min="0" step="0.01" value={pesoPromedio} onChange={e => setPesoPromedio(e.target.value)} />
              </div>
              <p className="col-span-2 text-[0.6875rem] text-gray-500">Esta camada no tiene lechones identificados: se registra en grupo.</p>
            </div>
          )}

          {/* Destino de la camada */}
          <div className="space-y-2">
            <Label>¿A dónde va la camada? *</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: 'corral', t: 'A un corral de precebo', d: 'Los lechones pasan al lote del corral' },
                { v: 'venta', t: 'Se vende la camada', d: 'Queda la venta en Finanzas' },
              ] as const).map(o => (
                <button
                  key={o.v} type="button" onClick={() => setDestino(o.v)}
                  className={cn('rounded-lg border p-3 text-left transition-colors', destino === o.v ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-pink-300')}
                >
                  <p className="text-sm font-semibold text-gray-800">{o.t}</p>
                  <p className="text-[0.6875rem] text-gray-500">{o.d}</p>
                </button>
              ))}
            </div>
            {destino === 'corral' && (
              corrales.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  La finca no tiene corrales de precebo. Agrégalo en Datos de la finca (Corrales) para poder pasar los lechones.
                </p>
              ) : (
                <>
                  <Select value={corralId} onValueChange={v => setCorralId(v ?? '')}
                    items={Object.fromEntries(corrales.map(c => [c.corral.id, c.corral.nombre]))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Elegir corral de precebo..." /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {corrales.map(c => (
                        <SelectItem key={c.corral.id} value={c.corral.id}>
                          {c.corral.nombre} · {c.loteActivo ? `${c.loteActivo.animales_actuales} cerdos` : 'vacío'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {corralElegido && (
                    <p className="text-[0.6875rem] text-gray-500">
                      {corralElegido.loteActivo
                        ? `Se suman al lote ${corralElegido.loteActivo.nombre} (quedarían ${corralElegido.loteActivo.animales_actuales + cantidad}).`
                        : `El corral está vacío: se crea su lote de precebo con estos ${cantidad} lechones.`}
                    </p>
                  )}
                </>
              )
            )}
            {destino === 'venta' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Precio por lechón *</Label>
                  <CurrencyInput placeholder="0" value={precio} onValueChange={setPrecio} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cliente</Label>
                  <Input placeholder="¿A quién?" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
                {Number(precio) > 0 && cantidad > 0 && (
                  <p className="col-span-2 text-xs text-gray-600">Total: <strong>{cop(cantidad * Number(precio))}</strong> por {cantidad} lechones</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input placeholder="Notas del destete..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>

          {parto && (
            <p className="text-[0.6875rem] text-gray-500">
              <Ic n="repetir" /> {hembra?.codigo ?? 'La cerda'} queda vacía: debería volver a celo unos {DIAS_DESTETE_SERVICIO} días después del destete.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={loading} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-pink-600 text-white hover:bg-pink-700">
              {loading ? 'Guardando...' : 'Registrar destete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
