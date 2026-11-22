'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import { valorVenta, saldoVenta } from '@/lib/dineroCerdos'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Venta = Database['public']['Tables']['ventas_cerdos']['Row']

const cop = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

const VACIO = {
  fecha: hoyLocal(), cantidad: '', pesoTotal: '', modo: 'kg' as 'kg' | 'animal', tipo: 'pie' as 'pie' | 'canal',
  precioKg: '', precioAnimal: '', rendimiento: '78', transporte: '', cliente: '', forma: 'contado' as 'contado' | 'credito', vence: '',
}

/**
 * Ventas del grupo (José): de todo el grupo o por partes, por kg en pie, por kg
 * en canal o por animal. Se anota comprador, peso, precio, transporte y forma de
 * pago. Lo que se vende a crédito queda por cobrar hasta que se registren sus pagos.
 */
export default function VentasCerdos({ lote, onCambio }: { lote: LoteCerdos; onCambio: () => void }) {
  const hoy = hoyLocal()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [porCobrar, setPorCobrar] = useState<(Venta & { lote_nombre?: string })[]>([])
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState(VACIO)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [pago, setPago] = useState<{ venta: Venta; monto: string } | null>(null)

  useEffect(() => {
    let vigente = true
    const s = createClient()
    Promise.all([
      s.from('ventas_cerdos').select('*').eq('lote_id', lote.id).order('fecha', { ascending: false }),
      s.from('ventas_cerdos').select('*').eq('finca_id', lote.finca_id).eq('forma_pago', 'credito').order('fecha'),
    ]).then(([v, c]) => {
      if (!vigente) return
      setVentas(v.data ?? [])
      setPorCobrar((c.data ?? []).filter(x => saldoVenta(x, hoy).saldo > 0))
    })
    return () => { vigente = false }
  }, [lote.id, lote.finca_id, version, hoy])

  const set = <K extends keyof typeof VACIO>(k: K, v: (typeof VACIO)[K]) => setForm(p => ({ ...p, [k]: v }))
  const cantidad = Number(form.cantidad) || 0
  const calc = valorVenta({
    cantidad, pesoTotalKg: form.pesoTotal ? Number(form.pesoTotal) : null, modo: form.modo, tipo: form.tipo,
    precioKg: form.precioKg ? Number(form.precioKg) : null, precioAnimal: form.precioAnimal ? Number(form.precioAnimal) : null,
    rendimientoPct: form.rendimiento ? Number(form.rendimiento) : null,
  })

  async function guardar() {
    if (cantidad <= 0 || cantidad > lote.animales_actuales) { toast.error(`La cantidad va de 1 a ${lote.animales_actuales}`); return }
    if (calc.valor == null) { toast.error('Faltan el peso o el precio para calcular el valor'); return }
    setGuardando(true)
    const s = createClient()
    const pesoTotal = form.pesoTotal ? Number(form.pesoTotal) : null
    const { data: venta, error } = await s.from('ventas_cerdos').insert({
      lote_id: lote.id, finca_id: lote.finca_id, fecha: form.fecha, cantidad,
      peso_promedio_kg: pesoTotal != null ? pesoTotal / cantidad : null, peso_total_kg: pesoTotal,
      modo_precio: form.modo, tipo_venta: form.tipo,
      precio_kg: form.modo === 'kg' ? Number(form.precioKg) : null, precio_animal: form.modo === 'animal' ? Number(form.precioAnimal) : null,
      rendimiento_canal_pct: form.tipo === 'canal' ? Number(form.rendimiento) : null,
      valor_total: Math.round(calc.valor), costo_transporte: form.transporte ? Number(form.transporte) : null,
      cliente: form.cliente.trim() || null, forma_pago: form.forma, fecha_vencimiento: form.forma === 'credito' ? (form.vence || null) : null,
    }).select('id').single()
    if (!error && venta && form.forma === 'contado') {
      await s.from('pagos_ventas_cerdos').insert({ finca_id: lote.finca_id, venta_id: venta.id, fecha: form.fecha, monto: Math.round(calc.valor) })
    }
    // Los vendidos salen del grupo; si se vendió todo, el grupo queda vendido
    if (!error) {
      const quedan = lote.animales_actuales - cantidad
      await s.from('lotes_cerdos').update({ animales_actuales: quedan, ...(quedan === 0 ? { estado: 'vendido' } : {}) }).eq('id', lote.id)
    }
    setGuardando(false)
    if (error) { toast.error('No se pudo guardar la venta'); return }
    toast.success(`Venta de ${cantidad} ${cantidad === 1 ? 'cerdo' : 'cerdos'} por ${cop(calc.valor)}`)
    setForm(VACIO); setAbierto(false); setVersion(v => v + 1); onCambio()
  }

  async function registrarPago() {
    if (!pago || !(Number(pago.monto) > 0)) { toast.error('Escribe el monto'); return }
    const { error } = await createClient().from('pagos_ventas_cerdos').insert({
      finca_id: lote.finca_id, venta_id: pago.venta.id, fecha: hoy, monto: Number(pago.monto),
    })
    if (error) { toast.error('No se pudo registrar el pago'); return }
    toast.success('Pago registrado')
    setPago(null); setVersion(v => v + 1)
  }

  const totalPorCobrar = porCobrar.reduce((t, v) => t + saldoVenta(v, hoy).saldo, 0)

  return (
    <div className="space-y-4">
      {porCobrar.length > 0 && (
        <div className="superficie space-y-2 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-800">Por cobrar en la finca: {cop(totalPorCobrar)}</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {porCobrar.map(v => {
              const s = saldoVenta(v, hoy)
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="font-medium">{v.cliente ?? 'Sin comprador'}</span>
                  <span className="text-xs text-gray-500">{fmt(v.fecha)} · {v.cantidad} cerdos · debe {cop(s.saldo)}</span>
                  {s.vencida && <span className="rounded-full bg-red-100 px-2 text-xs text-red-700">vencida {v.fecha_vencimiento ? fmt(v.fecha_vencimiento) : ''}</span>}
                  {pago?.venta.id === v.id ? (
                    <span className="ml-auto flex gap-1">
                      <Input type="number" className="h-7 w-28" value={pago.monto} onChange={e => setPago({ venta: v, monto: e.target.value })} />
                      <Button size="sm" className="h-7 text-xs" onClick={registrarPago}>Guardar</Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => setPago({ venta: v, monto: String(s.saldo) })}>Registrar pago</Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{lote.animales_actuales} cerdos en el grupo · se puede vender todo o por partes</p>
        <Button size="sm" className="bg-green-700 text-white hover:bg-green-800" disabled={lote.animales_actuales === 0} onClick={() => setAbierto(a => !a)}><Ic n="mas" /> Registrar venta</Button>
      </div>

      {abierto && (
        <div className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" className="bg-white" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Cerdos vendidos</Label><Input type="number" min="1" max={lote.animales_actuales} className="bg-white" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Peso total en pie (kg)</Label><Input type="number" className="bg-white" value={form.pesoTotal} onChange={e => set('pesoTotal', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Comprador</Label><Input className="bg-white" value={form.cliente} onChange={e => set('cliente', e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Se vende</Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-white p-1 ring-1 ring-gray-200">
              {([['pie', 'kg en pie'], ['canal', 'kg en canal'], ['animal', 'Por animal']] as const).map(([v, t]) => {
                const on = v === 'animal' ? form.modo === 'animal' : form.modo === 'kg' && form.tipo === v
                return <button key={v} type="button" onClick={() => setForm(p => ({ ...p, modo: v === 'animal' ? 'animal' : 'kg', tipo: v === 'canal' ? 'canal' : 'pie' }))}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${on ? 'bg-green-700 text-white' : 'text-gray-600'}`}>{t}</button>
              })}
            </div>
          </div>
          {form.modo === 'animal'
            ? <div className="space-y-1"><Label className="text-xs">Precio por cerdo</Label><Input type="number" className="bg-white" value={form.precioAnimal} onChange={e => set('precioAnimal', e.target.value)} /></div>
            : <div className="space-y-1"><Label className="text-xs">Precio por kg {form.tipo === 'canal' ? 'en canal' : 'en pie'}</Label><Input type="number" className="bg-white" value={form.precioKg} onChange={e => set('precioKg', e.target.value)} /></div>}
          {form.modo === 'kg' && form.tipo === 'canal'
            ? <div className="space-y-1"><Label className="text-xs">Rendimiento en canal (%)</Label><Input type="number" className="bg-white" value={form.rendimiento} onChange={e => set('rendimiento', e.target.value)} /></div>
            : <div />}
          <div className="space-y-1"><Label className="text-xs">Transporte ($)</Label><Input type="number" className="bg-white" value={form.transporte} onChange={e => set('transporte', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Pago</Label>
            <select className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" value={form.forma} onChange={e => set('forma', e.target.value as 'contado' | 'credito')}>
              <option value="contado">De contado</option><option value="credito">A crédito (por cobrar)</option>
            </select>
          </div>
          {form.forma === 'credito' && <div className="space-y-1"><Label className="text-xs">Paga a más tardar</Label><Input type="date" className="bg-white" value={form.vence} onChange={e => set('vence', e.target.value)} /></div>}
          <div className="flex items-end justify-between gap-2 sm:col-span-4">
            <p className="text-sm text-gray-700">
              {calc.valor != null
                ? <>Valor: <strong>{cop(calc.valor)}</strong>{calc.kgCobrados != null && form.modo === 'kg' ? ` (${calc.kgCobrados.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg cobrados)` : ''}{form.transporte ? ` · neto ${cop(calc.valor - Number(form.transporte))}` : ''}</>
                : 'Escribe el peso y el precio'}
            </p>
            <Button size="sm" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar venta'}</Button>
          </div>
        </div>
      )}

      {ventas.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Este grupo no tiene ventas</p> : (
        <ul className="divide-y divide-gray-100 text-sm">
          {ventas.map(v => {
            const s = saldoVenta(v, hoy)
            return (
              <li key={v.id} className="flex flex-wrap items-baseline gap-2 py-2">
                <span className="font-medium">{fmt(v.fecha)}</span>
                <span className="text-gray-600">{v.cantidad} cerdos{v.peso_total_kg ? ` · ${Number(v.peso_total_kg).toLocaleString('es-CO')} kg` : ''} · {v.modo_precio === 'animal' ? 'por animal' : v.tipo_venta === 'canal' ? `en canal (${v.rendimiento_canal_pct ?? 78} %)` : 'en pie'}{v.cliente ? ` · ${v.cliente}` : ''}</span>
                <span className="ml-auto font-medium">{v.valor_total != null ? cop(Number(v.valor_total)) : '—'}</span>
                {s.saldo > 0 && <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">debe {cop(s.saldo)}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
