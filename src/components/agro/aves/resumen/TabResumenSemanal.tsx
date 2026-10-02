'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import { resumenSemanal, type FilaSemana, type DiaProduccion } from '@/lib/resumenSemanal'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

const n0 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 0 })
const n1 = (v: number) => v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n2 = (v: number) => v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fechaCorta(f: string) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

const COLUMNAS: { titulo: string; ayuda: string; valor: (f: FilaSemana) => string }[] = [
  { titulo: 'Producción huevos sem.', ayuda: 'Huevos puestos en la semana', valor: f => n0(f.huevos) },
  { titulo: 'Huevos acumulados', ayuda: 'Desde que entró el lote', valor: f => n0(f.huevosAcumulados) },
  { titulo: 'Saldo aves', ayuda: 'Aves al cerrar la semana', valor: f => n0(f.saldoAves) },
  { titulo: 'Mortalidad aves/sem.', ayuda: 'Muertes de la semana, también las de eventos clínicos', valor: f => n0(f.muertes) },
  { titulo: 'Consumo kg', ayuda: 'Alimento de la semana (el consumo registrado rige hasta el siguiente)', valor: f => f.consumoKg > 0 ? n1(f.consumoKg) : '—' },
  { titulo: 'Peso aves g', ayuda: 'Último pesaje de la semana', valor: f => f.pesoAveG != null ? n0(f.pesoAveG) : '—' },
  { titulo: 'Peso huevo g', ayuda: 'Estimado por gramaje (B 49,5 · A 56,5 · AA 63,5 · AAA 72,5 · Jumbo 80)', valor: f => f.pesoHuevoG != null ? n1(f.pesoHuevoG) : '—' },
  { titulo: 'Aves encasetadas', ayuda: 'Las que entraron al galpón', valor: f => n0(f.avesEncasetadas) },
  { titulo: '% postura real', ayuda: 'Huevos ÷ aves de cada día de la semana', valor: f => f.posturaPct != null ? n1(f.posturaPct) : '—' },
  { titulo: 'H.A.A', ayuda: 'Huevos acumulados por ave encasetada', valor: f => n1(f.haa) },
  { titulo: 'Consumo ave g/d', ayuda: 'Gramos por ave al día', valor: f => f.consumoAveGDia != null ? n1(f.consumoAveGDia) : '—' },
  { titulo: '% mortalidad', ayuda: 'Muertes de la semana ÷ aves al empezarla', valor: f => f.mortalidadPct != null ? n2(f.mortalidadPct) : '—' },
  { titulo: '% mort. acumulada', ayuda: 'Muertes acumuladas ÷ aves encasetadas', valor: f => n2(f.mortalidadAcumPct) },
  { titulo: 'Conversión', ayuda: 'Kg de alimento por kg de huevo', valor: f => f.conversion != null ? n2(f.conversion) : '—' },
]

/**
 * El lote semana a semana en una tabla compacta, con los promedios de 7 días.
 * En levante las semanas van desde la entrada; en postura, desde que empezó a poner.
 */
export default function TabResumenSemanal({ loteActual }: { loteActual: LoteAves }) {
  const [filas, setFilas] = useState<FilaSemana[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    Promise.all([
      supabase.from('produccion_diaria_aves')
        .select('fecha, huevos_totales, huevos_b, huevos_a, huevos_aa, huevos_aaa, huevos_jumbo, muertes, alimento_kg')
        .eq('lote_id', loteActual.id),
      supabase.from('eventos_clinicos_aves').select('fecha, aves_muertas, origen').eq('lote_id', loteActual.id),
      supabase.from('ventas_aves_lote').select('fecha, cantidad, tipo').eq('lote_id', loteActual.id),
      supabase.from('pesos_lote_aves').select('fecha, peso_promedio_g').eq('lote_id', loteActual.id),
    ]).then(([prod, eventos, ventas, pesos]) => {
      if (!vigente) return
      setFilas(resumenSemanal(
        loteActual,
        ((prod.data ?? []) as DiaProduccion[]).map(d => ({ ...d, alimento_kg: Number(d.alimento_kg ?? 0) })),
        // Las de origen "mortalidad" son el reflejo de las muertes del día: no se cuentan dos veces
        (eventos.data ?? []).filter(e => e.origen !== 'mortalidad' && (e.aves_muertas ?? 0) > 0)
          .map(e => ({ fecha: e.fecha, cantidad: e.aves_muertas ?? 0 })),
        (ventas.data ?? []).filter(v => v.tipo === 'descarte' || v.tipo === 'pollas')
          .map(v => ({ fecha: v.fecha, cantidad: Number(v.cantidad) })),
        (pesos.data ?? []).map(p => ({ fecha: p.fecha, peso_promedio_g: Number(p.peso_promedio_g) })),
        hoyLocal(),
      ))
      setCargando(false)
    })
    return () => { vigente = false }
  }, [loteActual])

  // La semana más reciente arriba
  const visibles = [...filas].reverse()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">Resumen semanal</CardTitle>
        <p className="text-xs text-gray-400">
          Promedios de cada 7 días. En levante la semana cuenta desde la entrada al galpón; en postura, desde que empezó a poner.
          Pasa el cursor sobre cada columna para ver cómo se calcula.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {cargando ? (
          <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
        ) : visibles.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">El lote todavía no tiene semanas</p>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full border-collapse text-[0.75rem] tabular-nums">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 px-2.5 py-2 text-left font-medium">Semana</th>
                  {COLUMNAS.map(c => (
                    <th key={c.titulo} title={c.ayuda} className="cursor-help px-2 py-2 text-right align-bottom font-medium leading-tight whitespace-normal">
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((f, i) => {
                  const cambioEtapa = i > 0 && visibles[i - 1].etapa !== f.etapa
                  return (
                    <tr key={f.clave} className={cn('border-t border-gray-100 hover:bg-gray-50/70', cambioEtapa && 'border-t-2 border-t-green-200')}>
                      <td className="sticky left-0 bg-white px-2.5 py-1.5 whitespace-nowrap">
                        <span className="font-semibold text-gray-800">{f.semana}</span>
                        <span className={cn('ml-1.5 rounded px-1 text-[0.625rem]', f.etapa === 'postura' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700')}>
                          {f.etapa}
                        </span>
                        <span className="block text-[0.625rem] text-gray-400">{fechaCorta(f.desde)} – {fechaCorta(f.hasta)}</span>
                      </td>
                      {COLUMNAS.map(c => (
                        <td key={c.titulo} className="px-2 py-1.5 text-right text-gray-700">{c.valor(f)}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
