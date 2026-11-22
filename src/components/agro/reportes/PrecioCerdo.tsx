'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import { lunesDe } from '@/lib/cierreSemanal'
import type { Database } from '@/types/database'

type Precio = Database['public']['Tables']['precios_mercado_cerdos']['Row']
type Venta = { fecha: string; precio_kg: number | null; tipo_venta: string; modo_precio: string }

const cop = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const corta = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

/**
 * El precio del cerdo como una pantalla de bolsa (José): el precio del mercado
 * en pie y en canal semana a semana, frente al precio al que la granja vendió.
 * El precio de mercado se carga a mano con su fuente (por ejemplo, el precio de
 * referencia que publica Porkcolombia) hasta tener una fuente automática.
 */
export default function PrecioCerdo({ fincaId }: { fincaId: string }) {
  const [precios, setPrecios] = useState<Precio[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [tipo, setTipo] = useState<'pie' | 'canal'>('pie')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ fecha: hoyLocal(), pie: '', canal: '', fuente: '', enlace: '' })

  useEffect(() => {
    let vigente = true
    const s = createClient()
    Promise.all([
      s.from('precios_mercado_cerdos').select('*').eq('finca_id', fincaId).order('fecha'),
      s.from('ventas_cerdos').select('fecha, precio_kg, tipo_venta, modo_precio').eq('finca_id', fincaId).eq('modo_precio', 'kg').order('fecha'),
    ]).then(([p, v]) => {
      if (!vigente) return
      setPrecios(p.data ?? [])
      setVentas((v.data ?? []) as Venta[])
    })
    return () => { vigente = false }
  }, [fincaId, version])

  async function guardar() {
    if (!form.pie && !form.canal) { toast.error('Escribe al menos un precio'); return }
    const { error } = await createClient().from('precios_mercado_cerdos').upsert({
      finca_id: fincaId, fecha: form.fecha, precio_kg_pie: form.pie ? Number(form.pie) : null, precio_kg_canal: form.canal ? Number(form.canal) : null,
      fuente: form.fuente.trim() || null, enlace: form.enlace.trim() || null,
    }, { onConflict: 'finca_id,fecha' })
    if (error) { toast.error('No se pudo guardar el precio'); return }
    toast.success('Precio guardado')
    setForm(f => ({ ...f, pie: '', canal: '' })); setVersion(v => v + 1)
  }

  // Semana a semana: el precio del mercado y el promedio de lo que vendió la granja
  const campo = tipo === 'pie' ? 'precio_kg_pie' : 'precio_kg_canal'
  const semanas = new Map<string, { semana: string; mercado: number | null; propio: number | null; nPropio: number }>()
  for (const p of precios) {
    const v = p[campo]
    if (v == null) continue
    const k = lunesDe(p.fecha)
    semanas.set(k, { ...(semanas.get(k) ?? { semana: k, propio: null, nPropio: 0 }), mercado: Number(v) })
  }
  for (const v of ventas.filter(x => x.tipo_venta === tipo && x.precio_kg != null)) {
    const k = lunesDe(v.fecha)
    const s = semanas.get(k) ?? { semana: k, mercado: null, propio: null, nPropio: 0 }
    const n = s.nPropio + 1
    semanas.set(k, { ...s, propio: ((s.propio ?? 0) * s.nPropio + Number(v.precio_kg)) / n, nPropio: n })
  }
  const serie = [...semanas.values()].sort((a, b) => a.semana.localeCompare(b.semana)).map(s => ({ ...s, etiqueta: corta(s.semana) }))
  const conMercado = serie.filter(s => s.mercado != null)
  const ultimo = conMercado[conMercado.length - 1]
  const previo = conMercado[conMercado.length - 2]
  const cambio = ultimo && previo && previo.mercado ? ((ultimo.mercado! - previo.mercado) / previo.mercado) * 100 : null
  const conAmbos = serie.filter(s => s.mercado != null && s.propio != null)
  const diferencia = conAmbos.length ? conAmbos.reduce((t, s) => t + (s.propio! - s.mercado!) / s.mercado!, 0) / conAmbos.length * 100 : null
  const ultimaFuente = [...precios].reverse().find(p => p.fuente || p.enlace)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-gray-100 p-1">
          {(['pie', 'canal'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTipo(t)} className={cn('rounded-full px-3 py-1 text-sm', tipo === t ? 'bg-white font-medium shadow-sm' : 'text-gray-500')}>
              {t === 'pie' ? 'Kg en pie' : 'Kg en canal'}
            </button>
          ))}
        </div>
        {ultimaFuente && (
          <p className="text-xs text-gray-500">
            Fuente: {ultimaFuente.fuente ?? '—'}{ultimaFuente.enlace && <> · <a href={ultimaFuente.enlace} target="_blank" rel="noreferrer" className="text-green-800 underline">ver precio actual</a></>}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="superficie rounded-2xl p-4">
          <p className="text-xs text-gray-500">Precio del mercado ({tipo === 'pie' ? 'en pie' : 'en canal'})</p>
          <p className="text-2xl font-semibold">{ultimo ? cop(ultimo.mercado!) : '—'}<span className="text-sm font-normal text-gray-500"> /kg</span></p>
          {cambio != null && (
            <p className={cn('text-sm font-medium', cambio >= 0 ? 'text-green-700' : 'text-red-700')}>{cambio >= 0 ? '▲' : '▼'} {Math.abs(cambio).toFixed(1)} % frente a la semana anterior</p>
          )}
        </div>
        <div className="superficie rounded-2xl p-4">
          <p className="text-xs text-gray-500">Mi precio de venta (promedio)</p>
          <p className="text-2xl font-semibold">{conAmbos.length || serie.some(s => s.propio) ? cop(serie.filter(s => s.propio).slice(-1)[0]?.propio ?? 0) : '—'}<span className="text-sm font-normal text-gray-500"> /kg</span></p>
          <p className="text-xs text-gray-500">De las ventas por kg {tipo === 'pie' ? 'en pie' : 'en canal'}</p>
        </div>
        <div className="superficie rounded-2xl p-4">
          <p className="text-xs text-gray-500">Frente al mercado</p>
          <p className={cn('text-2xl font-semibold', diferencia != null && diferencia < 0 ? 'text-red-700' : 'text-green-800')}>{diferencia != null ? `${diferencia >= 0 ? '+' : ''}${diferencia.toFixed(1)} %` : '—'}</p>
          <p className="text-xs text-gray-500">{diferencia != null ? (diferencia < 0 ? 'Vendes por debajo del mercado' : 'Vendes por encima del mercado') : 'Faltan semanas con los dos precios'}</p>
        </div>
      </div>

      <div className="superficie rounded-2xl p-4">
        {serie.length < 2 ? (
          <p className="py-10 text-center text-sm text-gray-400">Carga el precio de varias semanas para ver la gráfica.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={serie} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} width={48} />
              <Tooltip formatter={v => cop(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="mercado" name="Mercado" stroke="#2f6f3e" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="propio" name="Mis ventas" stroke="#c2410c" strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="superficie space-y-2 rounded-2xl p-4">
        <p className="text-sm font-medium text-gray-800"><Ic n="precio" /> Cargar el precio de la semana</p>
        <div className="flex flex-wrap items-end gap-2">
          <Input type="date" className="h-9 w-40" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <Input type="number" placeholder="$/kg en pie" className="h-9 w-32" value={form.pie} onChange={e => setForm(f => ({ ...f, pie: e.target.value }))} />
          <Input type="number" placeholder="$/kg en canal" className="h-9 w-32" value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} />
          <Input placeholder="Fuente (ej: Porkcolombia)" className="h-9 w-48" value={form.fuente} onChange={e => setForm(f => ({ ...f, fuente: e.target.value }))} />
          <Input placeholder="Enlace del precio" className="h-9 w-56" value={form.enlace} onChange={e => setForm(f => ({ ...f, enlace: e.target.value }))} />
          <Button size="sm" onClick={guardar}>Guardar</Button>
        </div>
        <p className="text-xs text-gray-500">Se carga a mano cada semana mientras se confirma una fuente automática del precio.</p>
      </div>
    </div>
  )
}
