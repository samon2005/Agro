'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { aFechaLocal, hoyLocal } from '@/lib/fechas'
import { TAMANOS_HUEVO, cop, huevosDe, valorVenta, type PreciosHuevo } from '@/lib/huevos'
import { contratoVigente, type ClienteHuevos } from '@/lib/huevosFinca'
import type { Database } from '@/types/database'

type Venta = Database['public']['Tables']['ventas_huevos_aves']['Row']

const VACIO = {
  nombre: '', telefono: '', notas: '', contrato: false, contrato_desde: '', contrato_hasta: '', huevos_semana: '',
  precio_b: '', precio_a: '', precio_aa: '', precio_aaa: '', precio_jumbo: '',
}
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const DIAS = 86_400_000

/** Frecuente: compró al menos 3 veces en los últimos 60 días */
function esFrecuente(ventas: Venta[], hoy: string) {
  const desde = aFechaLocal(new Date(new Date(hoy + 'T00:00:00').getTime() - 60 * DIAS))
  return ventas.filter(v => v.fecha >= desde).length >= 3
}

/**
 * Los clientes de huevo de la finca: con su precio propio o su contrato, cada
 * cuánto compran y cómo ha cambiado el precio que pagan.
 */
export default function ClientesHuevos({ fincaId, clientes, ventas, precios, onCambio }: {
  fincaId: string
  clientes: ClienteHuevos[]
  ventas: Venta[]
  precios: PreciosHuevo
  onCambio: () => void
}) {
  const supabase = createClient()
  const [editando, setEditando] = useState<ClienteHuevos | 'nuevo' | null>(null)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)
  const hoy = hoyLocal()

  const ventasDe = (c: ClienteHuevos) => ventas
    .filter(v => v.cliente_id === c.id || (!v.cliente_id && v.cliente?.trim().toLowerCase() === c.nombre.trim().toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  function abrir(c: ClienteHuevos | 'nuevo') {
    setEditando(c)
    const t = (v: number | null) => (v != null ? String(Number(v)) : '')
    setForm(c === 'nuevo' ? VACIO : {
      nombre: c.nombre, telefono: c.telefono ?? '', notas: c.notas ?? '', contrato: c.contrato,
      contrato_desde: c.contrato_desde ?? '', contrato_hasta: c.contrato_hasta ?? '', huevos_semana: t(c.huevos_semana),
      precio_b: t(c.precio_b), precio_a: t(c.precio_a), precio_aa: t(c.precio_aa), precio_aaa: t(c.precio_aaa), precio_jumbo: t(c.precio_jumbo),
    })
  }

  async function guardar() {
    const nombre = form.nombre.trim()
    if (!nombre) { toast.error('Escribe el nombre del cliente'); return }
    if (form.contrato && form.contrato_desde && form.contrato_hasta && form.contrato_desde > form.contrato_hasta) {
      toast.error('El contrato termina antes de empezar'); return
    }
    const semana = form.huevos_semana.trim() === '' ? null : Number(form.huevos_semana)
    if (semana != null && (!Number.isInteger(semana) || semana <= 0)) { toast.error('Los huevos por semana son un número entero'); return }
    const precio = (s: string) => (s.trim() === '' ? null : Number(s))
    const payload = {
      nombre,
      telefono: form.telefono.trim() || null,
      notas: form.notas.trim() || null,
      contrato: form.contrato,
      contrato_desde: form.contrato ? form.contrato_desde || null : null,
      contrato_hasta: form.contrato ? form.contrato_hasta || null : null,
      huevos_semana: form.contrato ? semana : null,
      precio_b: precio(form.precio_b), precio_a: precio(form.precio_a), precio_aa: precio(form.precio_aa),
      precio_aaa: precio(form.precio_aaa), precio_jumbo: precio(form.precio_jumbo),
    }
    setGuardando(true)
    const { error } = editando === 'nuevo'
      ? await supabase.from('clientes_huevos').insert({ ...payload, finca_id: fincaId })
      : await supabase.from('clientes_huevos').update(payload).eq('id', editando!.id)
    // El nombre nuevo también queda en sus ventas, para que el historial se lea igual
    if (!error && editando !== 'nuevo' && editando && editando.nombre !== nombre) {
      await supabase.from('ventas_huevos_aves').update({ cliente: nombre }).eq('cliente_id', editando.id)
      await supabase.from('encargos_huevos_aves').update({ cliente: nombre }).eq('cliente_id', editando.id)
    }
    setGuardando(false)
    if (error) { toast.error(error.code === '23505' ? `Ya hay un cliente llamado ${nombre}` : 'No se pudo guardar el cliente'); return }
    toast.success(editando === 'nuevo' ? 'Cliente agregado' : 'Cliente actualizado')
    setEditando(null)
    onCambio()
  }

  async function cambiarActivo(c: ClienteHuevos) {
    const { error } = await supabase.from('clientes_huevos').update({ activo: !c.activo }).eq('id', c.id)
    if (error) { toast.error('No se pudo cambiar'); return }
    onCambio()
  }

  const ordenados = [...clientes].sort((a, b) => Number(b.activo) - Number(a.activo) || ventasDe(b).length - ventasDe(a).length)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Clientes</CardTitle>
          <p className="text-xs text-gray-500">Con precio propio, la venta usa su precio; con contrato, solo mientras el contrato rige.</p>
        </div>
        <Button size="sm" onClick={() => abrir('nuevo')}><Ic n="mas" /> Agregar cliente</Button>
      </CardHeader>
      <CardContent className="p-0">
        {ordenados.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">Sin clientes todavía. También se agregan solos al escribir uno nuevo en una venta.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ordenados.map(c => {
              const vs = ventasDe(c)
              const huevos = vs.reduce((s, v) => s + huevosDe(v), 0)
              const valor = vs.reduce((s, v) => s + valorVenta(v), 0)
              const frecuente = esFrecuente(vs, hoy)
              const vigente = contratoVigente(c, hoy)
              const propio = TAMANOS_HUEVO.some(t => c[`precio_${t.key}` as keyof ClienteHuevos] != null)
              return (
                <div key={c.id} className={cn('px-4 py-3', !c.activo && 'opacity-60')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-800">
                        {c.nombre}
                        {frecuente && <span className="ml-2 rounded bg-green-50 px-1.5 text-[0.6875rem] text-green-700">frecuente</span>}
                        {c.contrato && (
                          <span className={cn('ml-1 rounded px-1.5 text-[0.6875rem]', vigente ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500')}>
                            {vigente ? 'contrato vigente' : 'contrato vencido o por empezar'}
                          </span>
                        )}
                        {!c.activo && <span className="ml-1 text-xs text-gray-400">(inactivo)</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {vs.length} compra{vs.length === 1 ? '' : 's'} · {huevos.toLocaleString('es-CO')} huevos · {cop(valor)}
                        {vs[0] && ` · última el ${fmt(vs[0].fecha)}`}
                        {c.telefono && <> · <a className="text-green-700 underline" href={`tel:${c.telefono}`}>{c.telefono}</a></>}
                      </p>
                      {c.contrato && (
                        <p className="text-xs text-gray-500">
                          Contrato {c.contrato_desde ? `desde el ${fmt(c.contrato_desde)}` : ''}{c.contrato_hasta ? ` hasta el ${fmt(c.contrato_hasta)}` : ''}
                          {c.huevos_semana ? ` · ${c.huevos_semana.toLocaleString('es-CO')} huevos por semana` : ''}
                        </p>
                      )}
                      {propio && (
                        <p className="text-xs text-gray-500">
                          Precio propio: {TAMANOS_HUEVO.map(t => {
                            const p = c[`precio_${t.key}` as keyof ClienteHuevos] as number | null
                            return `${t.label} ${p != null ? cop(Number(p)) : `${precios[t.key] ? cop(Number(precios[t.key])) : '—'} (finca)`}`
                          }).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {vs.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setAbierto(abierto === c.id ? null : c.id)}>Precios pagados</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => abrir(c)} title="Editar"><Ic n="editar" /></Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => cambiarActivo(c)}>{c.activo ? 'Desactivar' : 'Activar'}</Button>
                    </div>
                  </div>
                  {abierto === c.id && (
                    <div className="mt-2 max-h-56 overflow-auto rounded-lg border">
                      <table className="w-full text-xs tabular-nums">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium">Fecha</th>
                            {TAMANOS_HUEVO.map(t => <th key={t.key} className="px-2 py-1.5 text-right font-medium">{t.label}</th>)}
                            <th className="px-2 py-1.5 text-right font-medium">Huevos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vs.map((v, i) => {
                            const anterior = vs[i + 1]
                            return (
                              <tr key={v.id} className="border-t border-gray-100">
                                <td className="px-2 py-1.5">{fmt(v.fecha)}</td>
                                {TAMANOS_HUEVO.map(t => {
                                  const cant = Number(v[`cantidad_${t.key}` as keyof Venta] ?? 0)
                                  const p = v[`precio_${t.key}` as keyof Venta] as number | null
                                  const pa = anterior ? anterior[`precio_${t.key}` as keyof Venta] as number | null : null
                                  // La flecha dice si el precio cambió frente a su compra anterior
                                  const cambio = p != null && pa != null && Number(p) !== Number(pa) ? (Number(p) > Number(pa) ? '↑' : '↓') : ''
                                  return (
                                    <td key={t.key} className={cn('px-2 py-1.5 text-right', cant === 0 && 'text-gray-300')}>
                                      {cant > 0 && p != null ? cop(Number(p)) : '—'}
                                      {cant > 0 && cambio && <span className={cambio === '↑' ? 'text-green-700' : 'text-red-600'}> {cambio}</span>}
                                    </td>
                                  )
                                })}
                                <td className="px-2 py-1.5 text-right">{huevosDe(v).toLocaleString('es-CO')}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={editando != null} onOpenChange={o => !o && !guardando && setEditando(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{editando === 'nuevo' ? 'Agregar cliente' : 'Editar cliente'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Nombre *</Label><Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Teléfono</Label><Input inputMode="tel" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1">
              <Label>Precio propio por tamaño</Label>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
                {TAMANOS_HUEVO.map(t => (
                  <div key={t.key} className="space-y-0.5">
                    <span className="text-[0.6875rem] text-gray-500">{t.label}</span>
                    <CurrencyInput
                      placeholder={precios[t.key] ? `${Number(precios[t.key])}` : '$'}
                      value={form[`precio_${t.key}` as keyof typeof form] as string}
                      onValueChange={v => setForm(p => ({ ...p, [`precio_${t.key}`]: v ?? '' }))}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">Vacío = el precio de la finca.</p>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="accent-green-700" checked={form.contrato} onChange={e => setForm(p => ({ ...p, contrato: e.target.checked }))} />
              Tiene contrato (el precio propio rige solo mientras dure)
            </label>
            {form.contrato && (
              <>
                <div className="space-y-1"><Label>Desde</Label><Input type="date" value={form.contrato_desde} onChange={e => setForm(p => ({ ...p, contrato_desde: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Hasta</Label><Input type="date" value={form.contrato_hasta} onChange={e => setForm(p => ({ ...p, contrato_hasta: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Huevos por semana</Label><Input type="number" min="1" step="1" value={form.huevos_semana} onChange={e => setForm(p => ({ ...p, huevos_semana: e.target.value }))} /></div>
              </>
            )}
            <div className="col-span-2 space-y-1"><Label>Notas</Label><Input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={guardando} onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
