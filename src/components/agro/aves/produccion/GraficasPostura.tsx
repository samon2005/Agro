'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { Leyenda } from '@/components/ui/graficos/PanelDatos'
import { BARRA, EJE, EJE_Y, REJILLA, SERIES, TINTA, compacto } from '@/components/ui/graficos/paleta'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { semanaDePostura } from '@/lib/postura'

const TAMANOS = [
  { key: 'huevos_b', label: 'B', color: '#FCD34D' },
  { key: 'huevos_a', label: 'A', color: '#F59E0B' },
  { key: 'huevos_aa', label: 'AA', color: '#D97706' },
  { key: 'huevos_aaa', label: 'AAA', color: '#B45309' },
  { key: 'huevos_jumbo', label: 'Jumbo', color: '#78350F' },
] as const

type Clave = typeof TAMANOS[number]['key']
type Registro = { fecha: string; huevos_totales: number; aves_en_dia: number | null } & Record<Clave, number>

interface Props {
  loteId: string
  fechaInicioPostura: string | null
  /** Entrada al galpón: de respaldo para lotes viejos sin fecha de inicio de postura */
  fechaInicio: string
  metaPosturaPct: number | null
  /** Cambia cuando se registra o borra un día, para volver a cargar */
  version?: string | number
}

function fechaCorta(f: string) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

/**
 * La postura de todo el ciclo: el % real de cada semana frente a la meta de pico,
 * y cuántos huevos de cada gramaje salieron. Se actualiza con cada día registrado.
 */
export default function GraficasPostura({ loteId, fechaInicioPostura, fechaInicio, metaPosturaPct, version = 0 }: Props) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [cargando, setCargando] = useState(true)
  const [vistaGramaje, setVistaGramaje] = useState<'semana' | 'dia'>('semana')

  useEffect(() => {
    let vigente = true
    createClient()
      .from('produccion_diaria_aves')
      .select('fecha, huevos_totales, aves_en_dia, huevos_b, huevos_a, huevos_aa, huevos_aaa, huevos_jumbo')
      .eq('lote_id', loteId)
      .order('fecha')
      .then(({ data }) => {
        if (!vigente) return
        setRegistros((data ?? []) as Registro[])
        setCargando(false)
      })
    return () => { vigente = false }
  }, [loteId, version])

  // Solo los días desde que empezó la postura
  const origen = fechaInicioPostura ?? fechaInicio
  const enPostura = registros.filter(r => r.fecha >= origen)
  const meta = metaPosturaPct != null ? Number(metaPosturaPct) : null

  // ── Curva: % de postura promedio de cada semana de postura ──
  const porSemana = new Map<number, { pct: number; dias: number; gramaje: Record<Clave, number>; desde: string }>()
  for (const r of enPostura) {
    const semana = semanaDePostura(origen, r.fecha)!
    const s = porSemana.get(semana) ?? { pct: 0, dias: 0, gramaje: { huevos_b: 0, huevos_a: 0, huevos_aa: 0, huevos_aaa: 0, huevos_jumbo: 0 }, desde: r.fecha }
    if (r.aves_en_dia && r.aves_en_dia > 0) {
      s.pct += (r.huevos_totales / r.aves_en_dia) * 100
      s.dias += 1
    }
    for (const t of TAMANOS) s.gramaje[t.key] += Number(r[t.key] ?? 0)
    porSemana.set(semana, s)
  }
  const semanas = [...porSemana.entries()].sort((a, b) => a[0] - b[0])
  const curva = semanas.map(([semana, s]) => ({
    semana,
    real: s.dias > 0 ? Number((s.pct / s.dias).toFixed(1)) : null,
  }))
  const mejor = curva.reduce<{ semana: number; real: number } | null>(
    (m, d) => d.real != null && (m == null || d.real > m.real) ? { semana: d.semana, real: d.real } : m, null)

  // ── Gramaje: por semana en todo el ciclo, o día a día en los últimos 30 ──
  const gramajeSemana = semanas.map(([semana, s]) => ({ etiqueta: `S${semana}`, ...s.gramaje }))
  const gramajeDia = enPostura.slice(-30).map(r => ({
    etiqueta: fechaCorta(r.fecha),
    ...Object.fromEntries(TAMANOS.map(t => [t.key, Number(r[t.key] ?? 0)])),
  }))
  const datosGramaje = vistaGramaje === 'semana' ? gramajeSemana : gramajeDia
  const totalPorTamano = TAMANOS.map(t => ({ ...t, total: enPostura.reduce((s, r) => s + Number(r[t.key] ?? 0), 0) }))
  const totalClasificados = totalPorTamano.reduce((s, t) => s + t.total, 0)

  if (cargando) {
    return <div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold text-gray-700"><Ic n="tendencia" /> Curva de postura</CardTitle>
          <p className="text-xs text-gray-400">
            % de postura real de cada semana de postura{meta != null ? ` frente a la meta de pico (${meta} %)` : ''}.
            {mejor && ` Mejor semana: ${mejor.semana} con ${mejor.real.toLocaleString('es-CO')} %.`}
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          {curva.every(d => d.real == null) ? (
            <p className="py-16 text-center text-sm text-gray-400">Aún no hay postura registrada para dibujar la curva</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={curva} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis {...EJE_Y} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v} %`} />
                  <Tooltip content={<TooltipGrafico formato={v => `${v.toLocaleString('es-CO')} %`} titulo={l => `Semana ${l} de postura`} />} />
                  {meta != null && (
                    <ReferenceLine
                      y={meta}
                      stroke={TINTA.tenue}
                      label={{ value: `Meta pico ${meta} %`, position: 'insideTopRight', fontSize: 10, fill: TINTA.secundaria }}
                    />
                  )}
                  <Line type="monotone" dataKey="real" name="Postura real" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-1">
          <div>
            <CardTitle className="text-sm font-semibold text-gray-700"><Ic n="huevo" /> Huevos por gramaje</CardTitle>
            <p className="text-xs text-gray-400">
              {vistaGramaje === 'semana' ? 'Cada semana del ciclo' : 'Los últimos 30 días registrados'}
            </p>
          </div>
          <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5 text-xs">
            {(['semana', 'dia'] as const).map(v => (
              <button
                key={v}
                onClick={() => setVistaGramaje(v)}
                className={cn('rounded-md px-2.5 py-1 font-medium', vistaGramaje === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}
              >
                {v === 'semana' ? 'Por semana' : 'Por día'}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {totalClasificados === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">Aún no hay huevos clasificados por gramaje</p>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosGramaje} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid {...REJILLA} />
                    <XAxis dataKey="etiqueta" {...EJE} interval="preserveStartEnd" minTickGap={14} />
                    <YAxis {...EJE_Y} tickFormatter={compacto} />
                    <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico />} />
                    {TAMANOS.map((t, i) => (
                      <Bar key={t.key} dataKey={t.key} name={t.label} stackId="g" fill={t.color} stroke="#fff" strokeWidth={1}
                        maxBarSize={BARRA.maxBarSize} radius={i === TAMANOS.length - 1 ? BARRA.radius : 0} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Leyenda items={TAMANOS.map(t => ({ nombre: t.label, color: t.color }))} />
              <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                {totalPorTamano.map(t => (
                  <div key={t.key} className="rounded-md bg-gray-50 py-1">
                    <p className="text-[0.625rem] font-semibold text-gray-500">{t.label}</p>
                    <p className="text-xs font-semibold text-gray-800 tabular-nums">
                      {totalClasificados > 0 ? `${((t.total / totalClasificados) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %` : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
