'use client'

import { useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { Leyenda } from '@/components/ui/graficos/PanelDatos'
import { EJE, EJE_Y, REJILLA, SERIES, TINTA } from '@/components/ui/graficos/paleta'
import { BarraExportar, type Vista } from '@/components/ui/barra-exportar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { FilaSemana } from '@/lib/resumenSemanal'
import { useResumenSemanal } from '@/lib/useResumenSemanal'
import type { Database } from '@/types/database'
import {
  compararConRango, compararMortalidad, esperadoDeSemana, mortalidadEsperadaDesde, semanaDeVida,
  type EstadoComparacion, type FilaReferencia,
} from '@/lib/referencias'
import { useReferencia } from '@/lib/useReferencia'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

const n0 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 0 })
const n1 = (v: number) => v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n2 = (v: number) => v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const num = (v: number | null) => (v == null ? null : Number(v))

function fechaCorta(f: string) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

/** Lo que la guía espera para una fila, ya resuelto para pintarlo */
interface Guia { texto: string; estado: EstadoComparacion | null }

interface Contexto {
  ref: Map<number, FilaReferencia>
  /** Semana de vida con que entraron al galpón */
  semanaEntrada: number
  vida: number
}

const COLOR_ESTADO: Record<EstadoComparacion, string> = {
  ok: 'text-green-700',
  atento: 'text-amber-600',
  alerta: 'text-red-600 font-semibold',
}

const COLUMNAS: { titulo: string; ayuda: string; valor: (f: FilaSemana) => string; guia?: (f: FilaSemana, c: Contexto) => Guia | null }[] = [
  { titulo: 'Producción huevos sem.', ayuda: 'Huevos puestos en la semana', valor: f => n0(f.huevos) },
  { titulo: 'Huevos acumulados', ayuda: 'Desde que entró el lote', valor: f => n0(f.huevosAcumulados) },
  { titulo: 'Saldo aves', ayuda: 'Aves al cerrar la semana', valor: f => n0(f.saldoAves) },
  { titulo: 'Mortalidad aves/sem.', ayuda: 'Muertes de la semana, también las de eventos clínicos', valor: f => n0(f.muertes) },
  { titulo: 'Consumo kg', ayuda: 'Alimento de la semana (el consumo registrado rige hasta el siguiente)', valor: f => f.consumoKg > 0 ? n1(f.consumoKg) : '—' },
  {
    titulo: 'Peso aves g', ayuda: 'Último pesaje de la semana', valor: f => f.pesoAveG != null ? n0(f.pesoAveG) : '—',
    guia: (f, c) => {
      const e = esperadoDeSemana(c.ref, c.vida)
      if (e?.pesoAve == null) return null
      return { texto: n0(e.pesoAve), estado: compararConRango(f.pesoAveG, e.pesoAveMin, e.pesoAveMax) }
    },
  },
  {
    titulo: 'Peso huevo g', ayuda: 'Estimado por gramaje (B 49,5 · A 56,5 · AA 63,5 · AAA 72,5 · Jumbo 80)', valor: f => f.pesoHuevoG != null ? n1(f.pesoHuevoG) : '—',
    guia: (f, c) => {
      const fila = c.ref.get(c.vida)
      const e = esperadoDeSemana(c.ref, c.vida)
      if (e?.pesoHuevo == null || !fila) return null
      return { texto: n1(e.pesoHuevo), estado: compararConRango(f.pesoHuevoG, num(fila.peso_huevo_min_g), num(fila.peso_huevo_max_g), { tolerancia: 4 }) }
    },
  },
  { titulo: 'Aves encasetadas', ayuda: 'Las que entraron al galpón', valor: f => n0(f.avesEncasetadas) },
  {
    titulo: '% postura real', ayuda: 'Huevos ÷ aves de cada día de la semana', valor: f => f.posturaPct != null ? n1(f.posturaPct) : '—',
    guia: (f, c) => {
      const e = esperadoDeSemana(c.ref, c.vida)
      if (e?.postura == null) return null
      return { texto: n1(e.postura), estado: compararConRango(f.posturaPct, e.posturaMin, e.posturaMax, { mejorArriba: true }) }
    },
  },
  { titulo: 'H.A.A', ayuda: 'Huevos acumulados por ave encasetada', valor: f => n1(f.haa) },
  {
    titulo: 'Consumo ave g/d', ayuda: 'Gramos por ave al día', valor: f => f.consumoAveGDia != null ? n1(f.consumoAveGDia) : '—',
    guia: (f, c) => {
      const fila = c.ref.get(c.vida)
      const e = esperadoDeSemana(c.ref, c.vida)
      if (e?.consumo == null || !fila) return null
      return { texto: n1(e.consumo), estado: compararConRango(f.consumoAveGDia, num(fila.consumo_min_g), num(fila.consumo_max_g), { tolerancia: 8 }) }
    },
  },
  { titulo: '% mortalidad', ayuda: 'Muertes de la semana ÷ aves al empezarla', valor: f => f.mortalidadPct != null ? n2(f.mortalidadPct) : '—' },
  {
    titulo: '% mort. acumulada', ayuda: 'Muertes acumuladas ÷ aves encasetadas', valor: f => n2(f.mortalidadAcumPct),
    guia: (f, c) => {
      const esperada = mortalidadEsperadaDesde(c.ref, c.semanaEntrada, c.vida)
      if (esperada == null) return null
      return { texto: n2(esperada), estado: compararMortalidad(f.mortalidadAcumPct, esperada) }
    },
  },
  { titulo: 'Conversión', ayuda: 'Kg de alimento por kg de huevo', valor: f => f.conversion != null ? n2(f.conversion) : '—' },
]

type MetricaGrafica = 'posturaPct' | 'consumoAveGDia' | 'pesoAveG' | 'pesoHuevoG' | 'mortalidadAcumPct' | 'huevos'

const METRICAS: { v: MetricaGrafica; t: string; unidad: string }[] = [
  { v: 'posturaPct', t: '% postura', unidad: '%' },
  { v: 'huevos', t: 'Huevos', unidad: '' },
  { v: 'consumoAveGDia', t: 'Consumo g/ave/día', unidad: 'g' },
  { v: 'pesoAveG', t: 'Peso ave', unidad: 'g' },
  { v: 'pesoHuevoG', t: 'Peso huevo', unidad: 'g' },
  { v: 'mortalidadAcumPct', t: '% mort. acumulada', unidad: '%' },
]

/** Lo que espera la guía de una métrica en una semana (null si no aplica) */
function esperadoMetrica(m: MetricaGrafica, c: Contexto | null): number | null {
  if (!c) return null
  const e = esperadoDeSemana(c.ref, c.vida)
  if (m === 'posturaPct') return e?.postura ?? null
  if (m === 'consumoAveGDia') return e?.consumo ?? null
  if (m === 'pesoAveG') return e?.pesoAve ?? null
  if (m === 'pesoHuevoG') return e?.pesoHuevo ?? null
  if (m === 'mortalidadAcumPct') return mortalidadEsperadaDesde(c.ref, c.semanaEntrada, c.vida)
  return null
}

/**
 * El lote semana a semana en una tabla compacta, con los promedios de 7 días.
 * En levante las semanas van desde la entrada; en postura, desde que empezó a poner.
 */
export default function TabResumenSemanal({ loteActual, hasta }: { loteActual: LoteAves; /** Último día (un lote cerrado llega hasta su salida) */ hasta?: string }) {
  const { filas, cargando } = useResumenSemanal(loteActual, hasta)
  const ref = useReferencia(loteActual.referencia_id)
  const [comparar, setComparar] = useState(true)
  const [vista, setVista] = useState<Vista>('tabla')
  const [metrica, setMetrica] = useState<MetricaGrafica>('posturaPct')
  const imprimir = useRef<HTMLDivElement>(null)

  // La semana más reciente arriba
  const visibles = [...filas].reverse()

  // Para comparar con la guía hacen falta la edad (fecha de nacimiento) y la referencia
  const semanaEntrada = semanaDeVida(loteActual.fecha_nacimiento, loteActual.fecha_inicio)
  const puedeComparar = ref.size > 0 && semanaEntrada != null
  const conGuia = puedeComparar && comparar
  const contexto = (f: FilaSemana): Contexto | null => {
    const vida = semanaDeVida(loteActual.fecha_nacimiento, f.desde)
    return conGuia && vida != null && semanaEntrada != null ? { ref, semanaEntrada, vida } : null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Resumen semanal</CardTitle>
          <BarraExportar
            titulo={`Resumen semanal ${loteActual.nombre}`}
            subtitulo={loteActual.linea_genetica ?? undefined}
            imprimir={imprimir}
            vista={vista}
            onVista={setVista}
            hojas={() => [{
              nombre: 'Resumen semanal',
              columnas: ['Semana', 'Etapa', 'Desde', 'Hasta', ...(conGuia ? ['Semana de vida'] : []), ...COLUMNAS.map(c => c.titulo),
                ...(conGuia ? ['Guía % postura', 'Guía consumo g', 'Guía peso ave g', 'Guía peso huevo g', 'Guía % mort. acum.'] : [])],
              filas: filas.map(f => {
                const c = contexto(f)
                const num = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100)
                return [f.semana, f.etapa, f.desde, f.hasta, ...(conGuia ? [c?.vida ?? null] : []),
                  f.huevos, f.huevosAcumulados, f.saldoAves, f.muertes, num(f.consumoKg), num(f.pesoAveG), num(f.pesoHuevoG),
                  f.avesEncasetadas, num(f.posturaPct), num(f.haa), num(f.consumoAveGDia), num(f.mortalidadPct), num(f.mortalidadAcumPct), num(f.conversion),
                  ...(conGuia ? (['posturaPct', 'consumoAveGDia', 'pesoAveG', 'pesoHuevoG', 'mortalidadAcumPct'] as const).map(m => num(esperadoMetrica(m, c))) : [])]
              }),
            }]}
          />
        </div>
        <p className="text-xs text-gray-400">
          Promedios de cada 7 días. En levante la semana cuenta desde la entrada al galpón; en postura, desde que empezó a poner.
          Pasa el cursor sobre cada columna para ver cómo se calcula.
        </p>
        {puedeComparar ? (
          <label className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
            <input type="checkbox" checked={comparar} onChange={e => setComparar(e.target.checked)} className="accent-green-700" />
            Comparar con la guía de la línea
            {conGuia && (
              <span className="text-gray-400">
                · debajo de cada valor, lo esperado: <span className="text-green-700">en rango</span> · <span className="text-amber-600">cerca</span> · <span className="text-red-600">lejos</span>.
                Son señales para revisar, no un diagnóstico.
              </span>
            )}
          </label>
        ) : (
          <p className="mt-1 text-xs text-gray-400">
            Para comparar con la guía de la línea, indica la edad con que llegaron las aves y la referencia en la configuración del galpón.
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0" ref={imprimir}>
        {cargando ? (
          <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
        ) : visibles.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">El lote todavía no tiene semanas</p>
        ) : vista === 'grafica' ? (
          <div className="space-y-2 p-4">
            <div data-no-imprimir className="flex flex-wrap gap-1">
              {METRICAS.map(m => (
                <button
                  key={m.v} type="button" onClick={() => setMetrica(m.v)}
                  className={cn('rounded-full px-2.5 py-1 text-xs', metrica === m.v ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                >
                  {m.t}
                </button>
              ))}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={filas.map(f => ({
                    semana: `${f.etapa === 'postura' ? 'P' : 'L'}${f.semana}`,
                    real: f[metrica] == null ? null : Math.round(Number(f[metrica]) * 100) / 100,
                    guia: (() => { const v = esperadoMetrica(metrica, contexto(f)); return v == null ? null : Math.round(v * 100) / 100 })(),
                  }))}
                  margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
                >
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis {...EJE_Y} />
                  <Tooltip content={<TooltipGrafico formato={v => `${v.toLocaleString('es-CO')} ${METRICAS.find(m => m.v === metrica)?.unidad ?? ''}`} />} />
                  <Line dataKey="real" name="Real" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} connectNulls isAnimationActive={false} />
                  {conGuia && <Line dataKey="guia" name="Guía" stroke={TINTA.tenue} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Leyenda items={conGuia ? [{ nombre: 'Real', color: SERIES[0] }, { nombre: 'Guía', color: TINTA.tenue }] : []} />
            <p className="text-[0.6875rem] text-gray-400">L = semana de levante · P = semana de postura</p>
          </div>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full border-collapse text-[0.75rem] tabular-nums">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 px-2.5 py-2 text-left font-medium">Semana</th>
                  {conGuia && <th title="Semana de vida de las aves: con ella se lee la guía" className="cursor-help px-2 py-2 text-right align-bottom font-medium">Vida</th>}
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
                  const ctx = contexto(f)
                  return (
                    <tr key={f.clave} className={cn('border-t border-gray-100 hover:bg-gray-50/70', cambioEtapa && 'border-t-2 border-t-green-200')}>
                      <td className="sticky left-0 bg-white px-2.5 py-1.5 whitespace-nowrap">
                        <span className="font-semibold text-gray-800">{f.semana}</span>
                        <span className={cn('ml-1.5 rounded px-1 text-[0.625rem]', f.etapa === 'postura' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700')}>
                          {f.etapa}
                        </span>
                        <span className="block text-[0.625rem] text-gray-400">{fechaCorta(f.desde)} – {fechaCorta(f.hasta)}</span>
                      </td>
                      {conGuia && <td className="px-2 py-1.5 text-right text-gray-500">{ctx?.vida ?? '—'}</td>}
                      {COLUMNAS.map(c => {
                        const g = ctx && c.guia ? c.guia(f, ctx) : null
                        return (
                          <td key={c.titulo} className="px-2 py-1.5 text-right text-gray-700">
                            <span className={g?.estado ? COLOR_ESTADO[g.estado] : undefined}>{c.valor(f)}</span>
                            {g && <span className="block text-[0.625rem] text-gray-400">guía {g.texto}</span>}
                          </td>
                        )
                      })}
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
