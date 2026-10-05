'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { BarraExportar } from '@/components/ui/barra-exportar'
import { aFechaLocal, hoyLocal } from '@/lib/fechas'
import { cop } from '@/lib/huevos'
import { categoriaInfo } from '@/lib/costos'
import { cargarTablero, indicadores, seriesSemanales, type DatosTablero, type Indicadores } from '@/lib/tablero'

const COLORES = ['#15803D', '#D97706', '#2563EB', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#9333EA', '#EA580C']
const PERIODOS = [
  { semanas: 4, t: '4 semanas' },
  { semanas: 12, t: '12 semanas' },
  { semanas: 26, t: '6 meses' },
  { semanas: 52, t: '1 año' },
]
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const restarDias = (f: string, d: number) => aFechaLocal(new Date(new Date(f + 'T00:00:00').getTime() - d * 86_400_000))

/** Variación frente al período anterior, con su color (si subir es bueno o malo) */
function Variacion({ actual, anterior, subirEsBueno = true, puntos = false }: { actual: number | null; anterior: number | null; subirEsBueno?: boolean; puntos?: boolean }) {
  if (actual == null || anterior == null || (!puntos && anterior === 0)) return <span className="text-gray-400">sin período anterior</span>
  const cambio = puntos ? actual - anterior : ((actual - anterior) / Math.abs(anterior)) * 100
  if (Math.abs(cambio) < 0.05) return <span className="text-gray-500">igual que el período anterior</span>
  const bueno = cambio > 0 === subirEsBueno
  return (
    <span className={bueno ? 'text-green-700' : 'text-red-600'}>
      {cambio > 0 ? '▲' : '▼'} {n1(Math.abs(cambio))}{puntos ? ' puntos' : ' %'} frente al período anterior
    </span>
  )
}

/**
 * Tablero de la finca al estilo Power BI: se eligen el período y los galpones, y
 * los indicadores y las gráficas se mueven juntos. Al hacer clic en un galpón de
 * una gráfica, todo el tablero se filtra por él.
 */
export default function TableroFinca({ fincaId, fincaNombre }: { fincaId: string; fincaNombre: string }) {
  const hoy = hoyLocal()
  const [semanas, setSemanas] = useState(12)
  const [elegidos, setElegidos] = useState<Set<string> | null>(null)
  const [datos, setDatos] = useState<{ clave: string; d: DatosTablero } | null>(null)
  const imprimir = useRef<HTMLDivElement>(null)

  const desde = restarDias(hoy, semanas * 7 - 1)
  const desdeAnterior = restarDias(desde, semanas * 7)
  const hastaAnterior = restarDias(desde, 1)
  const clave = `${fincaId}|${desdeAnterior}`

  useEffect(() => {
    let vigente = true
    cargarTablero(createClient(), fincaId, desdeAnterior).then(d => { if (vigente) setDatos({ clave, d }) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const d = datos?.clave === clave ? datos.d : null
  const galpones = useMemo(() => (d ? d.galpones.filter(g => g !== 'Toda la finca') : []), [d])
  const visibles = elegidos ? galpones.filter(g => elegidos.has(g)) : galpones
  const color = (g: string) => COLORES[galpones.indexOf(g) % COLORES.length]

  if (!d) return <Skeleton className="h-[40rem] w-full rounded-2xl" />

  const filtro = elegidos && elegidos.size > 0 ? elegidos : null
  const actual: Indicadores = indicadores(d, desde, hoy, filtro)
  const anterior: Indicadores = indicadores(d, desdeAnterior, hastaAnterior, filtro)
  const series = seriesSemanales(d, desde, hoy, visibles)
  const porGalpon = galpones.map(g => ({ galpon: g, ...indicadores(d, desde, hoy, new Set([g])) }))
  const nombreDe = (id: string | null) => (id ? d.galponDeLote.get(id) ?? 'Galpón' : 'Toda la finca')
  const costosPeriodo = d.costos.filter(c => c.fecha >= desde && (!filtro || filtro.has(nombreDe(c.lote_id))))
  const porCategoria = Object.entries(costosPeriodo.reduce<Record<string, number>>((m, c) => {
    const k = categoriaInfo(c.categoria)?.label ?? c.categoria
    m[k] = (m[k] ?? 0) + Number(c.monto)
    return m
  }, {})).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total)
  const enfermedades = Object.entries(d.eventos
    .filter(e => e.fecha >= desde && e.tipo !== 'mortalidad' && (!filtro || filtro.has(e.galpon)))
    .reduce<Record<string, number>>((m, e) => { m[e.tipo] = (m[e.tipo] ?? 0) + 1; return m }, {}))
    .map(([tipo, casos]) => ({ tipo, casos })).sort((a, b) => b.casos - a.casos)

  function alternar(g: string) {
    setElegidos(prev => {
      const n = new Set(prev ?? [])
      if (n.has(g)) n.delete(g); else n.add(g)
      return n.size === 0 ? null : n
    })
  }

  const kpis: { t: string; v: string; icono: Parameters<typeof Ic>[0]['n']; var: React.ReactNode }[] = [
    { t: 'Huevos', v: actual.huevos.toLocaleString('es-CO'), icono: 'huevo', var: <Variacion actual={actual.huevos} anterior={anterior.huevos} /> },
    { t: 'Postura promedio', v: actual.posturaPct != null ? `${n1(actual.posturaPct)} %` : '—', icono: 'tendencia', var: <Variacion actual={actual.posturaPct} anterior={anterior.posturaPct} puntos /> },
    { t: 'Aves muertas', v: actual.muertes.toLocaleString('es-CO'), icono: 'muerte', var: <Variacion actual={actual.muertes} anterior={anterior.muertes} subirEsBueno={false} /> },
    { t: 'Alimento', v: `${n1(actual.alimentoKg)} kg`, icono: 'alimento', var: <Variacion actual={actual.alimentoKg} anterior={anterior.alimentoKg} subirEsBueno={false} /> },
    { t: 'Huevo roto, sucio o deforme', v: actual.calidadMalaPct != null ? `${n1(actual.calidadMalaPct)} %` : '—', icono: 'alerta', var: <Variacion actual={actual.calidadMalaPct} anterior={anterior.calidadMalaPct} subirEsBueno={false} puntos /> },
    { t: 'Costos', v: cop(actual.costos), icono: 'recibo', var: <Variacion actual={actual.costos} anterior={anterior.costos} subirEsBueno={false} /> },
    { t: 'Ingresos', v: cop(actual.ingresos), icono: 'dinero', var: <Variacion actual={actual.ingresos} anterior={anterior.ingresos} /> },
    { t: 'Utilidad', v: cop(actual.utilidad), icono: 'precio', var: <Variacion actual={actual.utilidad} anterior={anterior.utilidad} /> },
  ]

  return (
    <div className="space-y-4" ref={imprimir}>
      {/* Panel de filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Período</span>
            <div data-no-imprimir className="inline-flex rounded-lg bg-gray-100 p-0.5">
              {PERIODOS.map(p => (
                <button key={p.semanas} onClick={() => setSemanas(p.semanas)}
                  className={cn('h-7 rounded-md px-2.5 text-xs font-medium', semanas === p.semanas ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
                  {p.t}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400">
              {new Date(desde + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} – hoy · comparado con las {semanas} semanas anteriores
            </span>
          </div>
          <BarraExportar
            titulo={`Tablero ${fincaNombre}`}
            subtitulo={`Últimas ${semanas} semanas${filtro ? ` · ${[...filtro].join(', ')}` : ''}`}
            imprimir={imprimir}
            hojas={() => [
              { nombre: 'Indicadores', columnas: ['Indicador', 'Período', 'Período anterior'], filas: [
                ['Huevos', actual.huevos, anterior.huevos],
                ['Postura promedio %', actual.posturaPct, anterior.posturaPct],
                ['Aves muertas', actual.muertes, anterior.muertes],
                ['Alimento kg', actual.alimentoKg, anterior.alimentoKg],
                ['Huevo roto, sucio o deforme %', actual.calidadMalaPct, anterior.calidadMalaPct],
                ['Costos', actual.costos, anterior.costos],
                ['Ingresos', actual.ingresos, anterior.ingresos],
                ['Utilidad', actual.utilidad, anterior.utilidad],
              ] },
              { nombre: 'Huevos por semana', columnas: ['Semana del', ...visibles], filas: series.huevos.map(s => [s.semana as string, ...visibles.map(g => s[g] as number)]) },
              { nombre: 'Postura por semana', columnas: ['Semana del', ...visibles], filas: series.postura.map(s => [s.semana as string, ...visibles.map(g => s[g] as number | null)]) },
              { nombre: 'Muertes por semana', columnas: ['Semana del', ...visibles], filas: series.muertes.map(s => [s.semana as string, ...visibles.map(g => s[g] as number)]) },
              { nombre: 'Por galpón', columnas: ['Galpón', 'Huevos', 'Postura %', 'Muertes', 'Alimento kg', 'Costos', 'Ingresos'], filas: porGalpon.map(p => [p.galpon, p.huevos, p.posturaPct, p.muertes, p.alimentoKg, p.costos, p.ingresos]) },
              { nombre: 'Costos por categoría', columnas: ['Categoría', 'Total'], filas: porCategoria.map(c => [c.categoria, c.total]) },
              { nombre: 'Enfermedades', columnas: ['Tipo', 'Casos'], filas: enfermedades.map(e => [e.tipo, e.casos]) },
            ]}
          />
          <div className="flex w-full flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">Galpones</span>
            <button data-no-imprimir onClick={() => setElegidos(null)}
              className={cn('rounded-full px-2.5 py-1 text-xs', !filtro ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              Toda la finca
            </button>
            {galpones.map(g => (
              <button key={g} onClick={() => alternar(g)}
                className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs', filtro?.has(g) ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                <span className="size-2 rounded-full" style={{ background: color(g) }} /> {g}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.t}>
            <CardContent className="py-3">
              <p className="text-xs text-gray-500"><Ic n={k.icono} className="size-3.5" /> {k.t}</p>
              <p className="text-xl font-semibold text-gray-900 tabular-nums">{k.v}</p>
              <p className="text-[0.6875rem]">{k.var}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {galpones.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-400">No hay registros en este período</CardContent></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-gray-700">Huevos por semana</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series.huevos} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => Number(v).toLocaleString('es-CO')} />
                  <Legend wrapperStyle={{ fontSize: 11 }} onClick={e => typeof e.value === 'string' && alternar(e.value)} />
                  {visibles.map(g => <Bar key={g} dataKey={g} stackId="h" fill={color(g)} />)}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-gray-700">% de postura por semana</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.postura} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => (v == null ? '—' : `${n1(Number(v))} %`)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} onClick={e => typeof e.value === 'string' && alternar(e.value)} />
                  {visibles.map(g => <Line key={g} dataKey={g} stroke={color(g)} strokeWidth={2} dot={false} connectNulls />)}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold text-gray-700">Comparación de galpones</CardTitle>
              <p className="text-xs text-gray-400">Huevos del período. Haz clic en un galpón para filtrar todo el tablero.</p>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porGalpon} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="galpon" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={v => Number(v).toLocaleString('es-CO')} />
                  <Bar dataKey="huevos" name="Huevos" onClick={(_, i) => { const g = porGalpon[i]?.galpon; if (g) alternar(g) }} cursor="pointer">
                    {porGalpon.map(p => <Cell key={p.galpon} fill={color(p.galpon)} fillOpacity={!filtro || filtro.has(p.galpon) ? 1 : 0.25} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-gray-700">Mortalidad por semana</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series.muertes} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {visibles.map(g => <Bar key={g} dataKey={g} stackId="m" fill={color(g)} />)}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-gray-700">Costos por categoría</CardTitle></CardHeader>
            <CardContent className="h-64">
              {porCategoria.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Sin costos en el período</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porCategoria} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="categoria" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(Number(v) / 1000).toLocaleString('es-CO')}k`} />
                    <Tooltip formatter={v => cop(Number(v))} />
                    <Bar dataKey="total" name="Costo" fill="#F97316" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-gray-700">Enfermedades (eventos clínicos)</CardTitle></CardHeader>
            <CardContent className="h-64">
              {enfermedades.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Sin eventos clínicos en el período</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enfermedades} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="tipo" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="casos" name="Casos" fill="#E11D48" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-gray-400">
        ¿Quieres usarlo en Power BI? Baja todo con <strong>Excel</strong> (una hoja por tabla) y ábrelo desde Power BI → Obtener datos → Excel.
      </p>
    </div>
  )
}
