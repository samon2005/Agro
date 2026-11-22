'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import { gananciaReemplazo } from '@/lib/reproduccionCerdos'
import type { ConfigCerdos } from '@/lib/configCerdos'
import type { Database } from '@/types/database'

type Reproductora = Database['public']['Tables']['reproductoras_cerdos']['Row']
type Celo = Database['public']['Tables']['celos_cerdos']['Row']
type Peso = Database['public']['Tables']['pesos_reproductora_cerdos']['Row']

const METODO: Record<string, string> = { lordosis: 'Lordosis', celador: 'Celador', ambos: 'Lordosis y celador' }
const CALIDAD: Record<number, string> = { 3: 'bueno', 2: 'regular', 1: 'débil' }
const DESTINOS = [{ v: 'venta', t: 'Venta' }, { v: 'sacrificio', t: 'Sacrificio' }, { v: 'muerte', t: 'Murió' }]

/**
 * Lo que se anota de la cerda fuera de servicios y partos (José, nov 2026):
 * los celos que se ven (las primerizas se sirven en el 3.er celo), sus pesos de
 * reemplazo (máximo 600 g/día para que no se engrase), su ración diaria y el descarte.
 */
export default function ManejoCerda({ cerda, cfg, onCambio }: { cerda: Reproductora; cfg: ConfigCerdos; onCambio?: () => void }) {
  const [celos, setCelos] = useState<Celo[]>([])
  const [pesos, setPesos] = useState<Peso[]>([])
  const [version, setVersion] = useState(0)
  const [celo, setCelo] = useState({ fecha: hoyLocal(), metodo: 'ambos', calidad: '3' })
  const [peso, setPeso] = useState({ fecha: hoyLocal(), kg: '' })
  const [racion, setRacion] = useState(cerda.racion_kg_dia != null ? String(cerda.racion_kg_dia) : '')
  const [descarte, setDescarte] = useState<{ motivo: string; destino: string; fecha: string } | null>(null)

  useEffect(() => {
    let vigente = true
    const s = createClient()
    Promise.all([
      s.from('celos_cerdos').select('*').eq('reproductora_id', cerda.id).order('fecha'),
      s.from('pesos_reproductora_cerdos').select('*').eq('reproductora_id', cerda.id).order('fecha'),
    ]).then(([c, p]) => {
      if (!vigente) return
      setCelos(c.data ?? [])
      setPesos(p.data ?? [])
    })
    return () => { vigente = false }
  }, [cerda.id, version])

  const recargar = () => { setVersion(v => v + 1); onCambio?.() }

  async function guardarCelo() {
    const { error } = await createClient().from('celos_cerdos').insert({
      finca_id: cerda.finca_id, reproductora_id: cerda.id, fecha: celo.fecha, metodo: celo.metodo, calidad: Number(celo.calidad),
    })
    if (error) { toast.error('No se pudo guardar el celo'); return }
    toast.success(`Celo n.º ${celos.length + 1} anotado`)
    recargar()
  }

  async function guardarPeso() {
    if (!peso.kg || Number(peso.kg) <= 0) { toast.error('Escribe el peso'); return }
    const { error } = await createClient().from('pesos_reproductora_cerdos').insert({
      finca_id: cerda.finca_id, reproductora_id: cerda.id, fecha: peso.fecha, peso_kg: Number(peso.kg),
    })
    if (error) { toast.error('No se pudo guardar el peso'); return }
    // El último peso también queda en la ficha
    await createClient().from('reproductoras_cerdos').update({ peso_kg: Number(peso.kg) }).eq('id', cerda.id)
    setPeso(p => ({ ...p, kg: '' }))
    recargar()
  }

  async function guardarRacion() {
    const { error } = await createClient().from('reproductoras_cerdos').update({ racion_kg_dia: racion === '' ? null : Number(racion) }).eq('id', cerda.id)
    if (error) { toast.error('No se pudo guardar la ración'); return }
    toast.success('Ración guardada')
    onCambio?.()
  }

  async function confirmarDescarte() {
    if (!descarte?.motivo.trim()) { toast.error('Escribe el motivo del descarte'); return }
    const { error } = await createClient().from('reproductoras_cerdos').update({
      estado: 'descartada', fecha_descarte: descarte.fecha, motivo_descarte: descarte.motivo.trim(), destino_descarte: descarte.destino,
    }).eq('id', cerda.id)
    if (error) { toast.error('No se pudo descartar'); return }
    toast.success(`Cerda ${cerda.codigo} descartada`)
    setDescarte(null)
    recargar()
  }

  const gdp = gananciaReemplazo(pesos)
  const tope = cfg.reemplazo.gananciaMaxGDia
  const esPrimeriza = (cerda.numero_partos ?? 0) === 0 && (cerda.partos_previos ?? 0) === 0
  const celoServicio = cfg.reemplazo.celoPrimerServicio

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {/* Celos observados */}
      <div className="space-y-2 rounded-xl border border-gray-100 p-3">
        <h3 className="text-sm font-semibold text-gray-800">Celos observados</h3>
        {esPrimeriza && (
          <p className="text-xs text-gray-500">
            Primeriza: se sirve en el {celoServicio}.º celo.{' '}
            {celos.length >= celoServicio - 1
              ? <strong className="text-pink-700">{celos.length >= celoServicio ? 'Ya le toca el servicio.' : `El próximo celo (${celos.length + 1}.º) es el del servicio.`}</strong>
              : `Lleva ${celos.length}.`}
          </p>
        )}
        {celos.length > 0 && (
          <ul className="space-y-0.5 text-xs text-gray-600">
            {celos.map((c, i) => (
              <li key={c.id}>{i + 1}.º · {c.fecha} · {METODO[c.metodo ?? ''] ?? '—'}{c.calidad ? ` · ${CALIDAD[c.calidad]}` : ''}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-1.5">
          <Input type="date" className="h-8 w-36" value={celo.fecha} max={hoyLocal()} onChange={e => setCelo(p => ({ ...p, fecha: e.target.value }))} />
          <select value={celo.metodo} onChange={e => setCelo(p => ({ ...p, metodo: e.target.value }))} className="h-8 rounded-md border border-gray-200 bg-white px-1.5 text-xs">
            {Object.entries(METODO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <select value={celo.calidad} onChange={e => setCelo(p => ({ ...p, calidad: e.target.value }))} className="h-8 rounded-md border border-gray-200 bg-white px-1.5 text-xs">
            <option value="3">Bueno</option><option value="2">Regular</option><option value="1">Débil</option>
          </select>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={guardarCelo}><Ic n="mas" /> Celo</Button>
        </div>
      </div>

      {/* Pesos de reemplazo */}
      <div className="space-y-2 rounded-xl border border-gray-100 p-3">
        <h3 className="text-sm font-semibold text-gray-800">Peso</h3>
        {pesos.length > 0 && (
          <p className="text-xs text-gray-600">
            Último: <strong>{Number(pesos[pesos.length - 1].peso_kg).toLocaleString('es-CO')} kg</strong> ({pesos[pesos.length - 1].fecha})
            {gdp != null && (
              <> · gana <strong className={gdp > tope ? 'text-red-700' : 'text-green-800'}>{Math.round(gdp)} g/día</strong></>
            )}
          </p>
        )}
        {gdp != null && gdp > tope && esPrimeriza && (
          <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-800">
            <Ic n="alerta" /> Gana más de {tope} g/día: se puede engrasar. Revisa la ración (crecimiento lento y constante).
          </p>
        )}
        <div className="flex flex-wrap items-end gap-1.5">
          <Input type="date" className="h-8 w-36" value={peso.fecha} max={hoyLocal()} onChange={e => setPeso(p => ({ ...p, fecha: e.target.value }))} />
          <Input type="number" min="0" step="0.1" placeholder="kg" className="h-8 w-20" value={peso.kg} onChange={e => setPeso(p => ({ ...p, kg: e.target.value }))} />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={guardarPeso}><Ic n="bascula" /> Pesar</Button>
        </div>
        <div className="flex items-end gap-1.5 border-t border-gray-100 pt-2">
          <label className="text-xs text-gray-600">
            Ración diaria (kg)
            <Input type="number" min="0" step="0.1" className="mt-0.5 h-8 w-24" value={racion} onChange={e => setRacion(e.target.value)} placeholder="Según el profesional" />
          </label>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={guardarRacion}>Guardar</Button>
        </div>
      </div>

      {/* Descarte */}
      <div className="space-y-2 rounded-xl border border-gray-100 p-3 md:col-span-2">
        {cerda.estado === 'descartada' ? (
          <p className="text-sm text-gray-600">
            Descartada {cerda.fecha_descarte ? `el ${cerda.fecha_descarte}` : ''}{cerda.destino_descarte ? ` · ${DESTINOS.find(d => d.v === cerda.destino_descarte)?.t}` : ''}
            {cerda.motivo_descarte ? ` · ${cerda.motivo_descarte}` : ''}
          </p>
        ) : descarte ? (
          <div className="flex flex-wrap items-end gap-1.5">
            <Input className="h-8 min-w-60 flex-1" placeholder="Motivo (ej: 3 repeticiones, camadas pequeñas, patas)" value={descarte.motivo} onChange={e => setDescarte(d => d && { ...d, motivo: e.target.value })} />
            <select value={descarte.destino} onChange={e => setDescarte(d => d && { ...d, destino: e.target.value })} className="h-8 rounded-md border border-gray-200 bg-white px-1.5 text-xs">
              {DESTINOS.map(d => <option key={d.v} value={d.v}>{d.t}</option>)}
            </select>
            <Input type="date" className="h-8 w-36" value={descarte.fecha} onChange={e => setDescarte(d => d && { ...d, fecha: e.target.value })} />
            <Button size="sm" className="h-8 bg-red-600 text-xs text-white hover:bg-red-700" onClick={confirmarDescarte}>Descartar</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDescarte(null)}>Cancelar</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs text-red-700" onClick={() => setDescarte({ motivo: '', destino: 'venta', fecha: hoyLocal() })}>
            Descartar esta cerda
          </Button>
        )}
      </div>
    </section>
  )
}
