'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { cop } from '@/lib/huevos'
import { MOTIVO_LABEL, PROPOSITO_LABEL } from '@/lib/lotesAves'
import type { Database } from '@/types/database'
import TabResumenSemanal from './resumen/TabResumenSemanal'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  open: boolean
  onClose: () => void
  /** Los lotes que ya salieron, el más reciente primero */
  lotes: LoteAves[]
}

interface Totales { huevos: number; muertes: number; ventasAves: number; costos: number }

function fmt(d: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function semanas(desde: string, hasta: string | null) {
  if (!hasta) return null
  return Math.round((new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / (7 * 86_400_000))
}

/**
 * Los lotes que ya salieron de los galpones: con qué entraron, cómo salieron y
 * cuánto produjeron. Se consultan sin poder registrarles nada nuevo.
 */
export default function LotesAnterioresModal({ open, onClose, lotes }: Props) {
  const [elegido, setElegido] = useState<LoteAves | null>(null)
  const [totales, setTotales] = useState<Record<string, Totales>>({})
  // Mientras falte algún lote por sumar
  const cargando = lotes.some(l => !(l.id in totales))

  useEffect(() => {
    if (!open || lotes.length === 0) return
    let vigente = true
    const supabase = createClient()
    const ids = lotes.map(l => l.id)
    Promise.all([
      supabase.from('produccion_diaria_aves').select('lote_id, huevos_totales, muertes').in('lote_id', ids),
      supabase.from('ventas_aves_lote').select('lote_id, total').in('lote_id', ids),
      supabase.from('costos_lote_aves').select('lote_id, monto').in('lote_id', ids),
      supabase.from('eventos_clinicos_aves').select('lote_id, aves_muertas, origen').in('lote_id', ids),
    ]).then(([prod, ventas, costos, eventos]) => {
      if (!vigente) return
      const t: Record<string, Totales> = Object.fromEntries(ids.map(id => [id, { huevos: 0, muertes: 0, ventasAves: 0, costos: 0 }]))
      for (const p of prod.data ?? []) { t[p.lote_id].huevos += p.huevos_totales ?? 0; t[p.lote_id].muertes += p.muertes ?? 0 }
      for (const v of ventas.data ?? []) if (v.lote_id) t[v.lote_id].ventasAves += Number(v.total ?? 0)
      for (const c of costos.data ?? []) if (c.lote_id) t[c.lote_id].costos += Number(c.monto ?? 0)
      // Las de origen "mortalidad" son el reflejo de las muertes del día: no se cuentan dos veces
      for (const e of eventos.data ?? []) if (e.origen !== 'mortalidad') t[e.lote_id].muertes += e.aves_muertas ?? 0
      setTotales(t)
    })
    return () => { vigente = false }
  }, [open, lotes])

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setElegido(null); onClose() } }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {elegido ? (
              <button type="button" onClick={() => setElegido(null)} className="mr-2 text-gray-400 hover:text-gray-700" title="Volver">←</button>
            ) : <Ic n="agenda" />}
            {elegido ? `${elegido.nombre} · ${fmt(elegido.fecha_inicio)} – ${fmt(elegido.fecha_fin)}` : 'Lotes anteriores'}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {elegido
              ? 'Solo consulta: el lote ya salió del galpón.'
              : 'Los lotes que ya salieron. Su historial se conserva y sigue contando en Finanzas.'}
          </p>
        </DialogHeader>

        {elegido ? (
          <TabResumenSemanal loteActual={elegido} hasta={elegido.fecha_fin ?? undefined} />
        ) : lotes.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Todavía no ha salido ningún lote</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Galpón</th>
                  <th className="px-3 py-2 text-left font-medium">Estadía</th>
                  <th className="px-3 py-2 text-left font-medium">Salida</th>
                  <th className="px-3 py-2 text-right font-medium">Aves</th>
                  <th className="px-3 py-2 text-right font-medium">Mortalidad</th>
                  <th className="px-3 py-2 text-right font-medium">Huevos</th>
                  <th className="px-3 py-2 text-right font-medium">Costos</th>
                  <th className="px-3 py-2 text-right font-medium">Venta de aves</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lotes.map(l => {
                  const t = totales[l.id]
                  const sem = semanas(l.fecha_inicio, l.fecha_fin)
                  return (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800">{l.nombre}</p>
                        <p className="text-xs text-gray-400">{[l.linea_genetica, PROPOSITO_LABEL[l.proposito]].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {fmt(l.fecha_inicio)} – {fmt(l.fecha_fin)}
                        {sem != null && <span className="block text-gray-400">{sem} semanas</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{l.motivo_cierre ? MOTIVO_LABEL[l.motivo_cierre] : (l.estado === 'vendido' ? 'Vendido' : 'Finalizado')}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.aves_iniciales.toLocaleString('es-CO')}</td>
                      {cargando || !t ? (
                        <td colSpan={4} className="px-3 py-2"><Skeleton className="h-4 w-full" /></td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {l.aves_iniciales > 0 ? `${((t.muertes / l.aves_iniciales) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{t.huevos.toLocaleString('es-CO')}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{cop(t.costos)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{cop(t.ventasAves)}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => setElegido(l)} className="whitespace-nowrap text-xs font-medium text-green-700 hover:underline">
                          Ver semanas →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
