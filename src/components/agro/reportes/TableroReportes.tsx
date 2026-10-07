'use client'

import { useEffect, useRef, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { BarraExportar } from '@/components/ui/barra-exportar'
import { TarjetaKPI, cambioPct } from '@/components/ui/graficos/TarjetaKPI'
import { PanelDatos, TablaDatos, Leyenda, type VistaDatos } from '@/components/ui/graficos/PanelDatos'
import { Torta } from '@/components/ui/graficos/Torta'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { BARRA, BARRA_H, EJE, EJE_Y, REJILLA, SERIES, TINTA, colorDe, compacto, pesosCompacto } from '@/components/ui/graficos/paleta'
import { hoyLocal } from '@/lib/fechas'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import {
  cargarReporte, costosPorCategoria, dineroPorEspecie, dineroPorMes, enfermedadesPorTipo, indicadores, lugarDe, restarDias,
  seriesSemanales, totalesSemanales, type DatosReporte, type FilaSemana, type Seleccion,
} from '@/lib/reportes'

const PERIODOS = [
  { semanas: 4, t: '4 semanas' },
  { semanas: 12, t: '12 semanas' },
  { semanas: 26, t: '6 meses' },
  { semanas: 52, t: '1 año' },
]
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const kg = (v: number) => `${compacto(v)} kg`
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
const SIN_ANTERIOR = 'Sin período anterior'
const ALTO = 'h-60'

interface Serie { id: string; nombre: string; color: string }

interface Props {
  fincaId: string
  fincaNombre: string
  /** Especies de la finca (para "Toda la finca") */
  especies: EspecieFinca[]
  /** null = toda la finca */
  especie: EspecieFinca | null
  /** Un solo galpón o corral: su pestaña Estadísticas */
  loteId?: string
  /** Los operarios no ven costos, ingresos ni utilidad */
  verDinero?: boolean
}

/**
 * El tablero de Reportes al estilo Power BI: arriba el período y el filtro de
 * galpones/corrales, luego los indicadores con su cambio frente al período
 * anterior y su tendencia, y abajo una tarjeta por tema que se puede ver como
 * gráfica, torta o tabla. Sirve para toda la finca, para una especie y para un
 * solo galpón o corral.
 */
export default function TableroReportes({ fincaId, fincaNombre, especies, especie, loteId, verDinero = true }: Props) {
  const hoy = hoyLocal()
  const [semanas, setSemanas] = useState(12)
  const [elegidos, setElegidos] = useState<Set<string> | null>(null)
  const [datos, setDatos] = useState<{ clave: string; d: DatosReporte } | null>(null)
  const imprimir = useRef<HTMLDivElement>(null)

  const desde = restarDias(hoy, semanas * 7 - 1)
  const desdeAnterior = restarDias(desde, semanas * 7)
  const hastaAnterior = restarDias(desde, 1)
  const cargar = especie ? [especie] : especies
  const clave = `${fincaId}|${desdeAnterior}|${cargar.join(',')}|${loteId ?? ''}`

  useEffect(() => {
    let vigente = true
    cargarReporte(createClient(), fincaId, cargar, desdeAnterior, loteId).then(d => { if (vigente) setDatos({ clave, d }) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const d = datos?.clave === clave ? datos.d : null

  // Los galpones/corrales que se muestran: los activos y los que tienen algo en el período.
  // Cada uno tiene su color por su lugar en esta lista: filtrar no los repinta.
  const unidades = (() => {
    if (!d) return []
    const conDatos = new Set([...d.dias, ...d.eventos, ...d.pesos].filter(x => x.fecha >= desdeAnterior).map(x => x.lote))
    const orden = (e: EspecieFinca) => ESPECIES_FINCA.findIndex(x => x.value === e)
    return d.unidades
      .filter(u => u.activo || conDatos.has(u.id))
      .sort((a, b) => orden(a.especie) - orden(b.especie) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
  })()

  if (!d) return <Skeleton className="h-[40rem] w-full rounded-2xl" />

  const color = (id: string) => colorDe(unidades.findIndex(u => u.id === id))
  const filtro = loteId ? null : elegidos && elegidos.size > 0 ? elegidos : null
  const sel: Seleccion = { especie, lotes: filtro }
  const visibles: Serie[] = unidades.filter(u => !filtro || filtro.has(u.id)).map(u => ({ id: u.id, nombre: u.nombre, color: color(u.id) }))
  const ids = visibles.map(v => v.id)
  const actual = indicadores(d, desde, hoy, sel)
  const anterior = indicadores(d, desdeAnterior, hastaAnterior, sel)
  const tendencia = totalesSemanales(d, desde, hoy, sel)
  const series = seriesSemanales(d, desde, hoy, ids)
  const porUnidad = unidades.map(u => ({ ...u, ...indicadores(d, desde, hoy, { especie, lotes: new Set([u.id]) }) }))
  const porUnidadVisible = porUnidad.filter(p => !filtro || filtro.has(p.id))
  const categorias = costosPorCategoria(d, desde, hoy, sel)
  const enfermedades = enfermedadesPorTipo(d, desde, hoy, sel)
  const meses = dineroPorMes(d, desde, hoy, sel)

  const hayPonedoras = especie === 'aves_ponedoras' || (!especie && especies.includes('aves_ponedoras'))
  const hayCarne = especie === 'cerdos' || especie === 'pollo_engorde'
  const hayPesos = d.pesos.some(p => p.fecha >= desde)
  const unSolo = !!loteId || unidades.length <= 1
  const lugar = lugarDe(especie)
  const lugares = especie === 'cerdos' ? 'corrales' : especie ? 'galpones' : 'galpones y corrales'

  function alternar(id: string) {
    setElegidos(prev => {
      const n = new Set(prev ?? [])
      if (n.has(id)) n.delete(id); else n.add(id)
      return n.size === 0 ? null : n
    })
  }

  const nombreDe = (id: string) => unidades.find(u => u.id === id)?.nombre ?? lugar
  const columnasSemana = (filas: FilaSemana[]) => filas.map(s => [s.semana as string, ...ids.map(g => s[g] as number | null)])

  const kpis = [
    hayPonedoras && <TarjetaKPI key="h" etiqueta="Huevos" valor={compacto(actual.huevos)} cambio={cambioPct(actual.huevos, anterior.huevos)} tendencia={tendencia.map(t => t.huevos)} nota={SIN_ANTERIOR} />,
    especie === 'aves_ponedoras' && (
      <TarjetaKPI key="p" etiqueta="Postura promedio" valor={actual.posturaPct != null ? `${n1(actual.posturaPct)} %` : '—'}
        cambio={actual.posturaPct != null && anterior.posturaPct != null ? actual.posturaPct - anterior.posturaPct : null} enPuntos
        tendencia={tendencia.map(t => t.posturaPct)} nota={SIN_ANTERIOR} />
    ),
    hayCarne && (
      <TarjetaKPI key="pe" etiqueta="Peso promedio" valor={actual.pesoKg != null ? `${n1(actual.pesoKg)} kg` : '—'}
        cambio={cambioPct(actual.pesoKg, anterior.pesoKg)} tendencia={tendencia.map(t => t.pesoKg)} nota={hayPesos ? SIN_ANTERIOR : 'Sin pesajes en el período'} />
    ),
    <TarjetaKPI key="m" etiqueta={especie === 'cerdos' ? 'Animales muertos' : especie ? 'Aves muertas' : 'Animales muertos'} valor={compacto(actual.muertes)}
      cambio={cambioPct(actual.muertes, anterior.muertes)} subirEsBueno={false} tendencia={tendencia.map(t => t.muertes)} nota={SIN_ANTERIOR} />,
    <TarjetaKPI key="a" etiqueta="Alimento" valor={kg(actual.alimentoKg)} cambio={cambioPct(actual.alimentoKg, anterior.alimentoKg)} subirEsBueno={false}
      tendencia={tendencia.map(t => t.alimentoKg)} nota={SIN_ANTERIOR} />,
    verDinero && <TarjetaKPI key="u" etiqueta="Utilidad" valor={pesosCompacto(actual.utilidad)} cambio={cambioPct(actual.utilidad, anterior.utilidad)} tendencia={tendencia.map(t => t.utilidad)} nota={SIN_ANTERIOR} />,
    verDinero && <TarjetaKPI key="i" etiqueta="Ingresos" valor={pesosCompacto(actual.ingresos)} cambio={cambioPct(actual.ingresos, anterior.ingresos)} tendencia={tendencia.map(t => t.ingresos)} nota={SIN_ANTERIOR} />,
    verDinero && <TarjetaKPI key="c" etiqueta="Costos" valor={pesosCompacto(actual.costos)} cambio={cambioPct(actual.costos, anterior.costos)} subirEsBueno={false} tendencia={tendencia.map(t => t.costos)} nota={SIN_ANTERIOR} />,
    especie === 'aves_ponedoras' && (
      <TarjetaKPI key="q" etiqueta="Huevo roto, sucio o deforme" valor={actual.calidadMalaPct != null ? `${n1(actual.calidadMalaPct)} %` : '—'}
        cambio={actual.calidadMalaPct != null && anterior.calidadMalaPct != null ? actual.calidadMalaPct - anterior.calidadMalaPct : null} enPuntos subirEsBueno={false}
        nota={SIN_ANTERIOR} />
    ),
  ].filter(Boolean)

  // Lo que se compara entre galpones/corrales
  const comparar = especie === 'aves_ponedoras'
    ? { campo: 'huevos' as const, nombre: 'Huevos', formato: compacto }
    : hayCarne && hayPesos
      ? { campo: 'pesoKg' as const, nombre: 'Peso promedio', formato: (v: number) => `${n1(v)} kg` }
      : verDinero
        ? { campo: 'utilidad' as const, nombre: 'Utilidad', formato: pesosCompacto }
        : { campo: 'alimentoKg' as const, nombre: 'Alimento', formato: kg }

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
          {!loteId && unidades.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button data-no-imprimir onClick={() => setElegidos(null)}
                className={cn('h-7 rounded-full px-3 text-xs', !filtro ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {especie ? `Todos los ${lugares}` : 'Toda la finca'}
              </button>
              {unidades.map(u => (
                <button key={u.id} onClick={() => alternar(u.id)}
                  className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs',
                    filtro?.has(u.id) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  <span className="size-2 rounded-full" style={{ background: color(u.id) }} /> {u.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{fechaCorta(desde)} – hoy</span>
          <BarraExportar
            titulo={loteId ? `Estadísticas ${nombreDe(loteId)}` : `Reportes ${fincaNombre}`}
            subtitulo={`Últimas ${semanas} semanas${filtro ? ` · ${[...filtro].map(nombreDe).join(', ')}` : ''}`}
            imprimir={imprimir}
            hojas={() => [
              { nombre: 'Indicadores', columnas: ['Indicador', 'Período', 'Período anterior'], filas: [
                ...(hayPonedoras ? [['Huevos', actual.huevos, anterior.huevos] as (string | number | null)[]] : []),
                ...(especie === 'aves_ponedoras' ? [['Postura promedio %', actual.posturaPct, anterior.posturaPct] as (string | number | null)[]] : []),
                ...(hayCarne ? [['Peso promedio kg', actual.pesoKg, anterior.pesoKg] as (string | number | null)[]] : []),
                ['Muertes', actual.muertes, anterior.muertes],
                ['Alimento kg', actual.alimentoKg, anterior.alimentoKg],
                ...(verDinero ? [['Costos', actual.costos, anterior.costos], ['Ingresos', actual.ingresos, anterior.ingresos], ['Utilidad', actual.utilidad, anterior.utilidad]] as (string | number | null)[][] : []),
              ] },
              ...(hayPonedoras ? [
                { nombre: 'Huevos por semana', columnas: ['Semana del', ...visibles.map(v => v.nombre)], filas: columnasSemana(series.huevos) },
                { nombre: 'Postura por semana', columnas: ['Semana del', ...visibles.map(v => v.nombre)], filas: columnasSemana(series.postura) },
              ] : []),
              ...(hayCarne ? [{ nombre: 'Peso por semana', columnas: ['Semana del', ...visibles.map(v => v.nombre)], filas: columnasSemana(series.peso) }] : []),
              { nombre: 'Alimento por semana', columnas: ['Semana del', ...visibles.map(v => v.nombre)], filas: columnasSemana(series.alimento) },
              { nombre: 'Muertes por semana', columnas: ['Semana del', ...visibles.map(v => v.nombre)], filas: columnasSemana(series.muertes) },
              { nombre: `Por ${lugar}`, columnas: ['Nombre', 'Huevos', 'Muertes', 'Alimento kg', 'Peso kg', ...(verDinero ? ['Costos', 'Ingresos', 'Utilidad'] : [])],
                filas: porUnidadVisible.map(p => [p.nombre, p.huevos, p.muertes, p.alimentoKg, p.pesoKg, ...(verDinero ? [p.costos, p.ingresos, p.utilidad] : [])]) },
              ...(verDinero ? [{ nombre: 'Costos por categoría', columnas: ['Categoría', 'Total'], filas: categorias.map(c => [c.categoria, c.total]) }] : []),
              { nombre: 'Enfermedades', columnas: ['Tipo', 'Casos'], filas: enfermedades.map(e => [e.tipo, e.casos]) },
            ]}
          />
        </div>
      </div>

      {/* Indicadores */}
      <div className={cn('grid grid-cols-2 gap-3', kpis.length % 3 === 0 && kpis.length % 4 !== 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>{kpis}</div>

      {unidades.length === 0 ? (
        <p className="rounded-2xl bg-white py-12 text-center text-sm text-gray-400 ring-1 ring-black/5">No hay {lugares} con registros en este período</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {!especie && verDinero && (
            <PanelDatos titulo="Ingresos y costos por mes" subtitulo="Todo el dinero de la finca" vistas={['grafica', 'tabla']}>
              {v => v === 'grafica' ? (<>
                <div className={ALTO}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={meses} margin={{ top: 4, right: 4, left: -4, bottom: 0 }} barGap={2}>
                      <CartesianGrid {...REJILLA} />
                      <XAxis dataKey="mes" {...EJE} />
                      <YAxis {...EJE_Y} width={56} tickFormatter={pesosCompacto} />
                      <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={pesosCompacto} />} />
                      <ReferenceLine y={0} stroke={TINTA.eje} />
                      <Bar dataKey="ingresos" name="Ingresos" fill={SERIES[0]} {...BARRA} isAnimationActive={false} />
                      <Bar dataKey="costos" name="Costos" fill={SERIES[1]} {...BARRA} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Leyenda items={[{ nombre: 'Ingresos', color: SERIES[0] }, { nombre: 'Costos', color: SERIES[1] }]} />
              </>) : (
                <TablaDatos columnas={[{ titulo: 'Mes' }, { titulo: 'Ingresos', numero: true }, { titulo: 'Costos', numero: true }, { titulo: 'Utilidad', numero: true }]}
                  filas={meses.map(m => [m.mes, m.ingresos, m.costos, m.utilidad])}
                  total={['Total', Math.round(actual.ingresos), Math.round(actual.costos), Math.round(actual.utilidad)]} />
              )}
            </PanelDatos>
          )}

          {!especie && verDinero && especies.length > 1 && (
            <PanelDatos titulo="Dinero por especie" subtitulo="De dónde vienen los ingresos y a dónde van los costos" vistas={['torta', 'tabla']}>
              {v => {
                const filas = dineroPorEspecie(d, desde, hoy)
                return v === 'torta' ? (
                  <div className="space-y-6">
                    <Torta etiquetaTotal="Ingresos" formato={pesosCompacto} porciones={filas.map((f, i) => ({ nombre: f.nombre, valor: f.ingresos, color: colorDe(i) }))} />
                    <Torta etiquetaTotal="Costos" formato={pesosCompacto} porciones={filas.map((f, i) => ({ nombre: f.nombre, valor: f.costos, color: colorDe(i) }))} />
                  </div>
                ) : (
                  <TablaDatos columnas={[{ titulo: 'Especie' }, { titulo: 'Ingresos', numero: true }, { titulo: 'Costos', numero: true }, { titulo: 'Utilidad', numero: true }]}
                    filas={filas.map(f => [f.nombre, Math.round(f.ingresos), Math.round(f.costos), Math.round(f.utilidad)])} />
                )
              }}
            </PanelDatos>
          )}

          {hayPonedoras && (
            <PanelSemanal titulo="Huevos por semana" subtitulo={unSolo ? undefined : 'Suma de los galpones elegidos'} filas={series.huevos} series={visibles} tipo="barras" etiquetaTotal="Huevos" />
          )}
          {especie === 'aves_ponedoras' && (
            <PanelSemanal titulo="% de postura por semana" subtitulo="Huevos ÷ aves de cada día registrado" filas={series.postura} series={visibles} tipo="lineas"
              formato={v => `${n1(v)} %`} dominio={[0, 100]} sumable={false} />
          )}
          {hayCarne && (
            <PanelSemanal titulo="Peso promedio por semana" subtitulo="Promedio de los pesajes de cada semana" filas={series.peso} series={visibles} tipo="lineas"
              formato={v => `${n1(v)} kg`} sumable={false} vacio={!hayPesos ? 'Sin pesajes en el período' : undefined} />
          )}

          {!unSolo && (
            <PanelDatos titulo={`Comparación de ${lugares}`} subtitulo={`${comparar.nombre} del período · clic en uno para filtrar todo`}
              vistas={comparar.campo === 'pesoKg' || comparar.campo === 'utilidad' ? ['grafica', 'tabla'] : ['grafica', 'torta', 'tabla']}>
              {v => v === 'grafica' ? (
                <div style={{ height: Math.max(160, porUnidad.length * 34 + 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porUnidad} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                      <XAxis type="number" {...EJE} tickFormatter={comparar.formato} />
                      <YAxis type="category" dataKey="nombre" {...EJE} axisLine={false} width={96} />
                      <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={comparar.formato} />} />
                      {comparar.campo === 'utilidad' && <ReferenceLine x={0} stroke={TINTA.eje} />}
                      <Bar dataKey={comparar.campo} name={comparar.nombre} {...BARRA_H} cursor="pointer" isAnimationActive={false}
                        onClick={(_, i) => { const u = porUnidad[i]; if (u) alternar(u.id) }}>
                        {porUnidad.map(p => <Cell key={p.id} fill={color(p.id)} fillOpacity={!filtro || filtro.has(p.id) ? 1 : 0.25} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : v === 'torta' ? (
                <Torta etiquetaTotal={comparar.nombre} formato={comparar.formato} porciones={porUnidadVisible.map(p => ({ nombre: p.nombre, valor: Number(p[comparar.campo] ?? 0), color: color(p.id) }))} />
              ) : (
                <TablaDatos
                  columnas={[
                    { titulo: lugar[0].toUpperCase() + lugar.slice(1) },
                    ...(hayPonedoras ? [{ titulo: 'Huevos', numero: true }] : []),
                    ...(hayCarne ? [{ titulo: 'Peso kg', numero: true }] : []),
                    { titulo: 'Muertes', numero: true }, { titulo: 'Alimento kg', numero: true },
                    ...(verDinero ? [{ titulo: 'Utilidad', numero: true }] : []),
                  ]}
                  filas={porUnidadVisible.map(p => [
                    p.nombre,
                    ...(hayPonedoras ? [p.huevos] : []),
                    ...(hayCarne ? [p.pesoKg] : []),
                    p.muertes, Math.round(p.alimentoKg),
                    ...(verDinero ? [Math.round(p.utilidad)] : []),
                  ])}
                />
              )}
            </PanelDatos>
          )}

          <PanelSemanal titulo="Mortalidad por semana" subtitulo="Muertes del día y de eventos clínicos" filas={series.muertes} series={visibles} tipo="barras" etiquetaTotal="Muertes" />
          <PanelSemanal titulo="Alimento por semana" subtitulo="Kilos consumidos" filas={series.alimento} series={visibles} tipo="barras" etiquetaTotal="Alimento" formato={kg} />

          {verDinero && (
            <PanelDatos titulo="Costos por categoría" subtitulo={`${pesosCompacto(actual.costos)} en el período`} vistas={['grafica', 'torta', 'tabla']}>
              {v => categorias.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">Sin costos en el período</p>
                : v === 'grafica' ? (
                  <div style={{ height: Math.max(160, categorias.length * 34 + 40) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categorias} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                        <XAxis type="number" {...EJE} tickFormatter={pesosCompacto} />
                        <YAxis type="category" dataKey="categoria" {...EJE} axisLine={false} width={110} />
                        <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={pesosCompacto} />} />
                        <Bar dataKey="total" name="Costo" fill={SERIES[0]} {...BARRA_H} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : v === 'torta' ? (
                  <Torta etiquetaTotal="Costos" formato={pesosCompacto} porciones={categorias.map((c, i) => ({ nombre: c.categoria, valor: c.total, color: colorDe(i) }))} />
                ) : (
                  <TablaDatos columnas={[{ titulo: 'Categoría' }, { titulo: 'Total', numero: true }, { titulo: '%', numero: true }]}
                    filas={categorias.map(c => [c.categoria, Math.round(c.total), actual.costos > 0 ? (c.total / actual.costos) * 100 : null])}
                    total={['Total', Math.round(categorias.reduce((a, c) => a + c.total, 0)), 100]} />
                )}
            </PanelDatos>
          )}

          <PanelDatos titulo="Enfermedades" subtitulo="Eventos clínicos por tipo" vistas={['grafica', 'torta', 'tabla']}>
            {v => enfermedades.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">Sin eventos clínicos en el período</p>
              : v === 'grafica' ? (
                <div style={{ height: Math.max(160, enfermedades.length * 34 + 40) }}>
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

      {!loteId && (
        <p className="text-xs text-gray-400">
          ¿Lo quieres en Power BI? Descarga todo con <strong>Excel</strong> (una hoja por tabla) y ábrelo en Power BI → Obtener datos → Excel.
        </p>
      )}
    </div>
  )
}

/**
 * Una tarjeta con un dato semana a semana por galpón/corral: barras apiladas
 * (o líneas, si no se suma), torta con el total de cada uno y tabla.
 */
function PanelSemanal({ titulo, subtitulo, filas, series, tipo, formato = compacto, dominio, sumable = true, etiquetaTotal = 'Total', vacio }: {
  titulo: string
  subtitulo?: string
  filas: FilaSemana[]
  series: Serie[]
  tipo: 'barras' | 'lineas'
  formato?: (v: number) => string
  dominio?: [number, number]
  sumable?: boolean
  etiquetaTotal?: string
  vacio?: string
}) {
  const varios = series.length > 1
  const totalDe = (id: string) => filas.reduce((a, s) => a + Number(s[id] ?? 0), 0)
  const vistas: VistaDatos[] = ['grafica', ...(sumable && varios ? ['torta' as const] : []), 'tabla']
  const titulo1 = (l: string | number | undefined) => `Semana del ${l}`
  return (
    <PanelDatos titulo={titulo} subtitulo={subtitulo} vistas={vistas}>
      {v => vacio ? <p className="py-12 text-center text-sm text-gray-400">{vacio}</p> : v === 'grafica' ? (<>
        <div className={ALTO}>
          <ResponsiveContainer width="100%" height="100%">
            {tipo === 'barras' ? (
              <BarChart data={filas} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid {...REJILLA} />
                <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                <YAxis {...EJE_Y} tickFormatter={formato} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={formato} titulo={titulo1} />} />
                {series.map((g, i) => (
                  <Bar key={g.id} dataKey={g.id} name={g.nombre} stackId="s" fill={g.color} stroke="#fff" strokeWidth={varios ? 1 : 0}
                    maxBarSize={BARRA.maxBarSize} radius={i === series.length - 1 ? BARRA.radius : 0} isAnimationActive={false} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={filas} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid {...REJILLA} />
                <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                <YAxis {...EJE_Y} domain={dominio ?? ['auto', 'auto']} tickFormatter={formato} />
                <Tooltip content={<TooltipGrafico formato={formato} titulo={titulo1} />} />
                {series.map(g => (
                  <Line key={g.id} dataKey={g.id} name={g.nombre} stroke={g.color} strokeWidth={2} connectNulls isAnimationActive={false}
                    dot={{ r: 3, strokeWidth: 2, stroke: '#fff', fill: g.color }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
        <Leyenda items={series.map(s => ({ nombre: s.nombre, color: s.color }))} />
      </>) : v === 'torta' ? (
        <Torta etiquetaTotal={etiquetaTotal} formato={formato} porciones={series.map(s => ({ nombre: s.nombre, valor: totalDe(s.id), color: s.color }))} />
      ) : (
        <TablaDatos
          columnas={[{ titulo: 'Semana del' }, ...series.map(s => ({ titulo: s.nombre, numero: true })), ...(sumable && varios ? [{ titulo: 'Total', numero: true }] : [])]}
          filas={filas.map(s => [
            s.semana as string,
            ...series.map(g => s[g.id] as number | null),
            ...(sumable && varios ? [series.reduce((a, g) => a + Number(s[g.id] ?? 0), 0)] : []),
          ])}
          total={sumable ? ['Total', ...series.map(g => totalDe(g.id)), ...(varios ? [series.reduce((a, g) => a + totalDe(g.id), 0)] : [])] : undefined}
        />
      )}
    </PanelDatos>
  )
}
