'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { BarraExportar } from '@/components/ui/barra-exportar'
import { TarjetaKPI, cambioPct } from '@/components/ui/graficos/TarjetaKPI'
import { PanelDatos, TablaDatos, Leyenda } from '@/components/ui/graficos/PanelDatos'
import { Torta } from '@/components/ui/graficos/Torta'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { BARRA, BARRA_H, EJE, EJE_Y, REJILLA, SERIES, colorDe, compacto, pesosCompacto } from '@/components/ui/graficos/paleta'
import { aFechaLocal, hoyLocal } from '@/lib/fechas'
import { categoriaInfo } from '@/lib/costos'
import { cargarTablero, indicadores, seriesSemanales, totalesSemanales, type DatosTablero } from '@/lib/tablero'

const PERIODOS = [
  { semanas: 4, t: '4 semanas' },
  { semanas: 12, t: '12 semanas' },
  { semanas: 26, t: '6 meses' },
  { semanas: 52, t: '1 año' },
]
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const restarDias = (f: string, d: number) => aFechaLocal(new Date(new Date(f + 'T00:00:00').getTime() - d * 86_400_000))
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
const ALTO = 'h-60'

/**
 * Tablero de la finca al estilo Power BI: arriba los filtros (período y
 * galpones), luego los indicadores con su cambio frente al período anterior y
 * su tendencia, y abajo una tarjeta por tema que se puede ver como gráfica,
 * torta o tabla. Un clic en un galpón filtra todo el tablero.
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
  // Cada galpón tiene su color por su lugar en la lista completa: filtrar no los repinta
  const galpones = useMemo(() => (d ? d.galpones.filter(g => g !== 'Toda la finca') : []), [d])
  const color = (g: string) => colorDe(galpones.indexOf(g))

  if (!d) return <Skeleton className="h-[40rem] w-full rounded-2xl" />

  const filtro = elegidos && elegidos.size > 0 ? elegidos : null
  const visibles = filtro ? galpones.filter(g => filtro.has(g)) : galpones
  const actual = indicadores(d, desde, hoy, filtro)
  const anterior = indicadores(d, desdeAnterior, hastaAnterior, filtro)
  const tendencia = totalesSemanales(d, desde, hoy, filtro)
  const series = seriesSemanales(d, desde, hoy, visibles)
  const porGalpon = galpones.map(g => ({ galpon: g, ...indicadores(d, desde, hoy, new Set([g])) }))
  const porGalponVisible = porGalpon.filter(p => !filtro || filtro.has(p.galpon))
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

  const leyendaGalpones = visibles.map(g => ({ nombre: g, color: color(g) }))
  const sinDatos = galpones.length === 0

  return (
    <div className="space-y-4" ref={imprimir}>
      {/* Filtros: una sola fila arriba de todo lo que filtran */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5" data-no-imprimir>
            {PERIODOS.map(p => (
              <button key={p.semanas} onClick={() => setSemanas(p.semanas)}
                className={cn('h-7 rounded-md px-3 text-xs font-medium', semanas === p.semanas ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
                {p.t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button data-no-imprimir onClick={() => setElegidos(null)}
              className={cn('h-7 rounded-full px-3 text-xs', !filtro ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              Toda la finca
            </button>
            {galpones.map(g => (
              <button key={g} onClick={() => alternar(g)}
                className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs',
                  filtro?.has(g) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                <span className="size-2 rounded-full" style={{ background: color(g) }} /> {g}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{fechaCorta(desde)} – hoy</span>
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
              { nombre: 'Por galpón', columnas: ['Galpón', 'Huevos', 'Postura %', 'Muertes', 'Alimento kg', 'Costos', 'Ingresos'], filas: porGalponVisible.map(p => [p.galpon, p.huevos, p.posturaPct, p.muertes, p.alimentoKg, p.costos, p.ingresos]) },
              { nombre: 'Costos por categoría', columnas: ['Categoría', 'Total'], filas: porCategoria.map(c => [c.categoria, c.total]) },
              { nombre: 'Enfermedades', columnas: ['Tipo', 'Casos'], filas: enfermedades.map(e => [e.tipo, e.casos]) },
            ]}
          />
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaKPI destacada etiqueta="Huevos" valor={compacto(actual.huevos)} cambio={cambioPct(actual.huevos, anterior.huevos)} tendencia={tendencia.map(t => t.huevos)} nota="Sin período anterior" />
        <TarjetaKPI etiqueta="Postura promedio" valor={actual.posturaPct != null ? `${n1(actual.posturaPct)} %` : '—'}
          cambio={actual.posturaPct != null && anterior.posturaPct != null ? actual.posturaPct - anterior.posturaPct : null} enPuntos
          tendencia={tendencia.map(t => t.postura)} nota="Sin período anterior" />
        <TarjetaKPI etiqueta="Aves muertas" valor={compacto(actual.muertes)} cambio={cambioPct(actual.muertes, anterior.muertes)} subirEsBueno={false}
          tendencia={tendencia.map(t => t.muertes)} nota="Sin período anterior" />
        <TarjetaKPI etiqueta="Utilidad" valor={pesosCompacto(actual.utilidad)} cambio={cambioPct(actual.utilidad, anterior.utilidad)}
          tendencia={tendencia.map(t => t.utilidad)} nota="Sin período anterior" />
        <TarjetaKPI etiqueta="Ingresos" valor={pesosCompacto(actual.ingresos)} cambio={cambioPct(actual.ingresos, anterior.ingresos)} nota="Sin período anterior" />
        <TarjetaKPI etiqueta="Costos" valor={pesosCompacto(actual.costos)} cambio={cambioPct(actual.costos, anterior.costos)} subirEsBueno={false} nota="Sin período anterior" />
        <TarjetaKPI etiqueta="Alimento" valor={`${compacto(actual.alimentoKg)} kg`} cambio={cambioPct(actual.alimentoKg, anterior.alimentoKg)} subirEsBueno={false} nota="Sin período anterior" />
        <TarjetaKPI etiqueta="Huevo roto, sucio o deforme" valor={actual.calidadMalaPct != null ? `${n1(actual.calidadMalaPct)} %` : '—'}
          cambio={actual.calidadMalaPct != null && anterior.calidadMalaPct != null ? actual.calidadMalaPct - anterior.calidadMalaPct : null} enPuntos subirEsBueno={false}
          nota="Sin período anterior" />
      </div>

      {sinDatos ? (
        <p className="rounded-2xl bg-white py-12 text-center text-sm text-gray-400 ring-1 ring-black/5">No hay registros en este período</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelDatos titulo="Huevos por semana" subtitulo="Suma de los galpones elegidos" vistas={['grafica', 'torta', 'tabla']}>
            {v => v === 'grafica' ? (
              <>
                <div className={ALTO}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series.huevos} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid {...REJILLA} />
                      <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                      <YAxis {...EJE_Y} tickFormatter={compacto} />
                      <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico titulo={l => `Semana del ${l}`} />} />
                      {visibles.map((g, i) => (
                        <Bar key={g} dataKey={g} name={g} stackId="h" fill={color(g)} stroke="#fff" strokeWidth={1}
                          maxBarSize={BARRA.maxBarSize} radius={i === visibles.length - 1 ? BARRA.radius : 0} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Leyenda items={leyendaGalpones} />
              </>
            ) : v === 'torta' ? (
              <Torta etiquetaTotal="Huevos" formato={compacto} porciones={porGalponVisible.map(p => ({ nombre: p.galpon, valor: p.huevos, color: color(p.galpon) }))} />
            ) : (
              <TablaDatos
                columnas={[{ titulo: 'Semana del' }, ...visibles.map(g => ({ titulo: g, numero: true })), { titulo: 'Total', numero: true }]}
                filas={series.huevos.map(s => [s.semana as string, ...visibles.map(g => s[g] as number), visibles.reduce((a, g) => a + Number(s[g] ?? 0), 0)])}
                total={['Total', ...visibles.map(g => series.huevos.reduce((a, s) => a + Number(s[g] ?? 0), 0)), actual.huevos]}
              />
            )}
          </PanelDatos>

          <PanelDatos titulo="% de postura por semana" subtitulo="Huevos ÷ aves de cada día registrado" vistas={['grafica', 'tabla']}>
            {v => v === 'grafica' ? (
              <>
                <div className={ALTO}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series.postura} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid {...REJILLA} />
                      <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                      <YAxis {...EJE_Y} domain={[0, 100]} tickFormatter={v => `${v} %`} />
                      <Tooltip content={<TooltipGrafico formato={x => `${n1(x)} %`} titulo={l => `Semana del ${l}`} />} />
                      {visibles.map(g => (
                        <Line key={g} dataKey={g} name={g} stroke={color(g)} strokeWidth={2} connectNulls isAnimationActive={false}
                          dot={{ r: 3, strokeWidth: 2, stroke: '#fff', fill: color(g) }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <Leyenda items={leyendaGalpones} />
              </>
            ) : (
              <TablaDatos
                columnas={[{ titulo: 'Semana del' }, ...visibles.map(g => ({ titulo: `${g} %`, numero: true }))]}
                filas={series.postura.map(s => [s.semana as string, ...visibles.map(g => s[g] as number | null)])}
              />
            )}
          </PanelDatos>

          <PanelDatos titulo="Comparación de galpones" subtitulo="Huevos del período · clic en un galpón para filtrar todo" vistas={['grafica', 'torta', 'tabla']}>
            {v => v === 'grafica' ? (
              <div className={ALTO}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porGalpon} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                    <XAxis type="number" {...EJE} tickFormatter={compacto} />
                    <YAxis type="category" dataKey="galpon" {...EJE} axisLine={false} width={84} />
                    <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico />} />
                    <Bar dataKey="huevos" name="Huevos" {...BARRA_H} cursor="pointer" isAnimationActive={false}
                      onClick={(_, i) => { const g = porGalpon[i]?.galpon; if (g) alternar(g) }}>
                      {porGalpon.map(p => <Cell key={p.galpon} fill={color(p.galpon)} fillOpacity={!filtro || filtro.has(p.galpon) ? 1 : 0.25} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : v === 'torta' ? (
              <Torta etiquetaTotal="Huevos" formato={compacto} porciones={porGalponVisible.map(p => ({ nombre: p.galpon, valor: p.huevos, color: color(p.galpon) }))} />
            ) : (
              <TablaDatos
                columnas={[{ titulo: 'Galpón' }, { titulo: 'Huevos', numero: true }, { titulo: 'Postura %', numero: true }, { titulo: 'Muertes', numero: true }, { titulo: 'Alimento kg', numero: true }]}
                filas={porGalponVisible.map(p => [p.galpon, p.huevos, p.posturaPct, p.muertes, p.alimentoKg])}
                total={['Total', actual.huevos, actual.posturaPct, actual.muertes, actual.alimentoKg]}
              />
            )}
          </PanelDatos>

          <PanelDatos titulo="Mortalidad por semana" subtitulo="Muertes del día y de eventos clínicos" vistas={['grafica', 'torta', 'tabla']}>
            {v => v === 'grafica' ? (
              <>
                <div className={ALTO}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series.muertes} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid {...REJILLA} />
                      <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                      <YAxis {...EJE_Y} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico titulo={l => `Semana del ${l}`} />} />
                      {visibles.map((g, i) => (
                        <Bar key={g} dataKey={g} name={g} stackId="m" fill={color(g)} stroke="#fff" strokeWidth={1}
                          maxBarSize={BARRA.maxBarSize} radius={i === visibles.length - 1 ? BARRA.radius : 0} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Leyenda items={leyendaGalpones} />
              </>
            ) : v === 'torta' ? (
              <Torta etiquetaTotal="Muertes" porciones={porGalponVisible.map(p => ({ nombre: p.galpon, valor: p.muertes, color: color(p.galpon) }))} />
            ) : (
              <TablaDatos
                columnas={[{ titulo: 'Semana del' }, ...visibles.map(g => ({ titulo: g, numero: true }))]}
                filas={series.muertes.map(s => [s.semana as string, ...visibles.map(g => s[g] as number)])}
                total={['Total', ...visibles.map(g => series.muertes.reduce((a, s) => a + Number(s[g] ?? 0), 0))]}
              />
            )}
          </PanelDatos>

          <PanelDatos titulo="Costos por categoría" subtitulo={`${pesosCompacto(actual.costos)} en el período`} vistas={['grafica', 'torta', 'tabla']}>
            {v => porCategoria.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">Sin costos en el período</p>
              : v === 'grafica' ? (
                <div className={ALTO}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porCategoria} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                      <XAxis type="number" {...EJE} tickFormatter={pesosCompacto} />
                      <YAxis type="category" dataKey="categoria" {...EJE} axisLine={false} width={110} />
                      <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={pesosCompacto} />} />
                      <Bar dataKey="total" name="Costo" fill={SERIES[0]} {...BARRA_H} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : v === 'torta' ? (
                <Torta etiquetaTotal="Costos" formato={pesosCompacto} porciones={porCategoria.map((c, i) => ({ nombre: c.categoria, valor: c.total, color: colorDe(i) }))} />
              ) : (
                <TablaDatos columnas={[{ titulo: 'Categoría' }, { titulo: 'Total', numero: true }, { titulo: '%', numero: true }]}
                  filas={porCategoria.map(c => [c.categoria, Math.round(c.total), actual.costos > 0 ? (c.total / actual.costos) * 100 : null])}
                  total={['Total', Math.round(porCategoria.reduce((a, c) => a + c.total, 0)), 100]} />
              )}
          </PanelDatos>

          <PanelDatos titulo="Enfermedades" subtitulo="Eventos clínicos por tipo" vistas={['grafica', 'torta', 'tabla']}>
            {v => enfermedades.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">Sin eventos clínicos en el período</p>
              : v === 'grafica' ? (
                <div className={ALTO}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={enfermedades} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                      <XAxis type="number" {...EJE} allowDecimals={false} />
                      <YAxis type="category" dataKey="tipo" {...EJE} axisLine={false} width={110} />
                      <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico />} />
                      <Bar dataKey="casos" name="Casos" fill={SERIES[7]} {...BARRA_H} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : v === 'torta' ? (
                <Torta etiquetaTotal="Casos" porciones={enfermedades.map((e, i) => ({ nombre: e.tipo, valor: e.casos, color: colorDe(i) }))} />
              ) : (
                <TablaDatos columnas={[{ titulo: 'Tipo' }, { titulo: 'Casos', numero: true }]}
                  filas={enfermedades.map(e => [e.tipo, e.casos])} total={['Total', enfermedades.reduce((a, e) => a + e.casos, 0)]} />
              )}
          </PanelDatos>
        </div>
      )}

      <p className="text-xs text-gray-400">
        ¿Lo quieres en Power BI? Descarga todo con <strong>Excel</strong> (una hoja por tabla) y ábrelo en Power BI → Obtener datos → Excel.
      </p>
    </div>
  )
}
