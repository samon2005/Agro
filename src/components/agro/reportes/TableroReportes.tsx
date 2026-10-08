'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts'
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
  alimentoPorTipo, animalesActuales, balanceNutricional, cargarReporte, consumoPorAnimal, costosPorCategoria, dineroPorEspecie,
  dineroPorMes, enfermedadesPorTipo, indicadores, ingresoHuevo, ingresosPorTipo, lugarDe, muertesPorCausa, restarDias,
  seriesSemanales, totalesSemanales, type DatosReporte, type FilaSemana, type Seleccion,
} from '@/lib/reportes'

const PERIODOS = [
  { semanas: 4, t: '4 semanas' },
  { semanas: 12, t: '12 semanas' },
  { semanas: 26, t: '6 meses' },
  { semanas: 52, t: '1 año' },
]
type Seccion = 'produccion' | 'alimento' | 'rentabilidad' | 'sanidad'

const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const n2 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 2 })
const kg = (v: number) => `${compacto(v)} kg`
const pesos = (v: number) => `$ ${Math.round(v).toLocaleString('es-CO')}`
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
const SIN_ANTERIOR = 'Sin período anterior'
const ALTO = 'h-60'
const alturaBarras = (n: number) => ({ height: Math.max(160, n * 34 + 40) })
const Vacio = ({ children }: { children: ReactNode }) => <p className="py-12 text-center text-sm text-gray-400">{children}</p>

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
 * El tablero de Reportes y de Estadísticas al estilo Power BI. Arriba el
 * período y el filtro de galpones/corrales; luego una sección por tema
 * (producción, alimento, rentabilidad, sanidad), cada una con sus cuatro
 * indicadores y sus tarjetas, que se pueden ver como gráfica, torta o tabla.
 */
export default function TableroReportes({ fincaId, fincaNombre, especies, especie, loteId, verDinero = true }: Props) {
  const hoy = hoyLocal()
  const [semanas, setSemanas] = useState(12)
  const [elegidos, setElegidos] = useState<Set<string> | null>(null)
  const [seccion, setSeccion] = useState<Seccion>('produccion')
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

  const hayPonedoras = especie === 'aves_ponedoras' || (!especie && especies.includes('aves_ponedoras'))
  const hayCarne = especie === 'cerdos' || especie === 'pollo_engorde'
  const hayPesos = d.pesos.some(p => p.fecha >= desde)
  const unSolo = !!loteId || unidades.length <= 1
  const lugar = lugarDe(especie)
  const lugares = especie === 'cerdos' ? 'corrales' : especie ? 'galpones' : 'galpones y corrales'
  const animales = especie === 'aves_ponedoras' || especie === 'pollo_engorde' ? 'aves' : 'animales'
  const Animales = animales[0].toUpperCase() + animales.slice(1)

  const secciones: { id: Seccion; t: string }[] = [
    { id: 'produccion', t: hayCarne ? 'Crecimiento' : 'Producción' },
    { id: 'alimento', t: 'Alimento' },
    ...(verDinero ? [{ id: 'rentabilidad' as const, t: 'Rentabilidad' }] : []),
    { id: 'sanidad', t: 'Sanidad' },
  ]
  const verSeccion = secciones.some(s => s.id === seccion) ? seccion : 'produccion'

  function alternar(id: string) {
    setElegidos(prev => {
      const n = new Set(prev ?? [])
      if (n.has(id)) n.delete(id); else n.add(id)
      return n.size === 0 ? null : n
    })
  }

  const nombreDe = (id: string) => unidades.find(u => u.id === id)?.nombre ?? lugar
  const columnasSemana = (filas: FilaSemana[]) => filas.map(s => [s.semana as string, ...ids.map(g => s[g] as number | null)])

  // ── Lo de cada sección ──
  const hoyAnimales = animalesActuales(d, sel)
  const comida = alimentoPorTipo(d, desde, hoy, sel)
  const balance = balanceNutricional(d, desde, hoy, sel)
  // El balance compara contra la guía de una especie: con varias juntas no tiene sentido
  const balanceAplica = !!especie || especies.length === 1
  const gAnimal = consumoPorAnimal(d, desde, hoy, sel)
  const gAnimalAnt = consumoPorAnimal(d, desdeAnterior, hastaAnterior, sel)
  const categorias = costosPorCategoria(d, desde, hoy, sel)
  const costoAlimento = categorias.find(c => c.categoria === 'Alimento')?.total ?? 0
  const costoAlimentoAnt = costosPorCategoria(d, desdeAnterior, hastaAnterior, sel).find(c => c.categoria === 'Alimento')?.total ?? 0
  const ingresosTipo = ingresosPorTipo(d, desde, hoy, sel)
  const meses = dineroPorMes(d, desde, hoy, sel)
  const enfermedades = enfermedadesPorTipo(d, desde, hoy, sel)
  const enfermedadesAnt = enfermedadesPorTipo(d, desdeAnterior, hastaAnterior, sel)
  const causas = muertesPorCausa(d, desde, hoy, sel)
  const casos = enfermedades.reduce((a, e) => a + e.casos, 0)
  const casosAnt = enfermedadesAnt.reduce((a, e) => a + e.casos, 0)
  const mortalidadPct = hoyAnimales + actual.muertes > 0 ? (actual.muertes / (hoyAnimales + actual.muertes)) * 100 : null
  const margen = actual.ingresos > 0 ? (actual.utilidad / actual.ingresos) * 100 : null
  const margenAnt = anterior.ingresos > 0 ? (anterior.utilidad / anterior.ingresos) * 100 : null
  // Equilibrio aproximado: con lo que entró por huevo, cuántos huevos pagan los costos
  const precioHuevo = hayPonedoras && actual.huevos > 0 ? ingresoHuevo(d, desde, hoy, sel) / actual.huevos : 0
  const huevosEquilibrio = precioHuevo > 0 ? actual.costos / precioHuevo : null
  const posturaEquilibrio = huevosEquilibrio != null && actual.avesDia > 0 ? (huevosEquilibrio / actual.avesDia) * 100 : null
  const cubiertos = balance.nutrientes.filter(n => n.pct >= 95).length

  // Lo que se compara entre galpones/corrales en Producción
  const comparar = especie === 'aves_ponedoras' || (!especie && hayPonedoras)
    ? { campo: 'huevos' as const, nombre: 'Huevos', formato: compacto }
    : { campo: 'pesoKg' as const, nombre: 'Peso promedio', formato: (v: number) => `${n1(v)} kg` }

  const kpis: ReactNode[] = verSeccion === 'produccion' ? [
    hayPonedoras && <TarjetaKPI key="h" etiqueta="Huevos" valor={compacto(actual.huevos)} cambio={cambioPct(actual.huevos, anterior.huevos)} tendencia={tendencia.map(t => t.huevos)} nota={SIN_ANTERIOR} />,
    especie === 'aves_ponedoras' && (
      <TarjetaKPI key="p" etiqueta="Postura promedio" valor={actual.posturaPct != null ? `${n1(actual.posturaPct)} %` : '—'}
        cambio={actual.posturaPct != null && anterior.posturaPct != null ? actual.posturaPct - anterior.posturaPct : null} enPuntos
        tendencia={tendencia.map(t => t.posturaPct)} nota={SIN_ANTERIOR} />
    ),
    especie === 'aves_ponedoras' && (
      <TarjetaKPI key="q" etiqueta="Huevo roto, sucio o deforme" valor={actual.calidadMalaPct != null ? `${n1(actual.calidadMalaPct)} %` : '—'}
        cambio={actual.calidadMalaPct != null && anterior.calidadMalaPct != null ? actual.calidadMalaPct - anterior.calidadMalaPct : null} enPuntos subirEsBueno={false}
        nota={SIN_ANTERIOR} />
    ),
    (hayCarne || !especie) && (
      <TarjetaKPI key="pe" etiqueta="Peso promedio" valor={actual.pesoKg != null ? `${n1(actual.pesoKg)} kg` : '—'}
        cambio={cambioPct(actual.pesoKg, anterior.pesoKg)} tendencia={tendencia.map(t => t.pesoKg)} nota={hayPesos ? SIN_ANTERIOR : 'Sin pesajes en el período'} />
    ),
    <TarjetaKPI key="an" etiqueta={`${Animales} hoy`} valor={hoyAnimales.toLocaleString('es-CO')} nota={unSolo ? `en el ${lugar}` : `en los ${lugares} elegidos`} />,
    hayCarne && <TarjetaKPI key="al" etiqueta="Alimento" valor={kg(actual.alimentoKg)} cambio={cambioPct(actual.alimentoKg, anterior.alimentoKg)} subirEsBueno={false} tendencia={tendencia.map(t => t.alimentoKg)} nota={SIN_ANTERIOR} />,
  ] : verSeccion === 'alimento' ? [
    <TarjetaKPI key="a" etiqueta="Alimento consumido" valor={kg(actual.alimentoKg)} cambio={cambioPct(actual.alimentoKg, anterior.alimentoKg)} subirEsBueno={false}
      tendencia={tendencia.map(t => t.alimentoKg)} nota={SIN_ANTERIOR} />,
    <TarjetaKPI key="g" etiqueta={`Por ${animales === 'aves' ? 'ave' : 'animal'} al día`} valor={gAnimal != null ? `${Math.round(gAnimal).toLocaleString('es-CO')} g` : '—'}
      cambio={cambioPct(gAnimal, gAnimalAnt)} subirEsBueno={false} nota={gAnimal != null ? SIN_ANTERIOR : 'Sin consumo registrado'} />,
    verDinero
      ? <TarjetaKPI key="c" etiqueta="Costo del alimento" valor={pesosCompacto(costoAlimento)} cambio={cambioPct(costoAlimento, costoAlimentoAnt)} subirEsBueno={false}
          nota={actual.alimentoKg > 0 && costoAlimento > 0 ? `${pesos(costoAlimento / actual.alimentoKg)} por kg` : SIN_ANTERIOR} />
      : <TarjetaKPI key="t" etiqueta="Alimentos distintos" valor={String(comida.length)} nota="en el período" />,
    <TarjetaKPI key="b" etiqueta="Dieta balanceada" valor={balanceAplica && balance.nutrientes.length > 0 ? `${cubiertos} de ${balance.nutrientes.length}` : '—'}
      nota={balanceAplica && balance.nutrientes.length > 0 ? 'nutrientes cubiertos (≥ 95 %)' : 'Falta la composición o la guía'} />,
  ] : verSeccion === 'rentabilidad' ? [
    <TarjetaKPI key="u" etiqueta="Utilidad" valor={pesosCompacto(actual.utilidad)} cambio={cambioPct(actual.utilidad, anterior.utilidad)} tendencia={tendencia.map(t => t.utilidad)} nota={SIN_ANTERIOR} />,
    <TarjetaKPI key="i" etiqueta="Ingresos" valor={pesosCompacto(actual.ingresos)} cambio={cambioPct(actual.ingresos, anterior.ingresos)} tendencia={tendencia.map(t => t.ingresos)} nota={SIN_ANTERIOR} />,
    <TarjetaKPI key="c" etiqueta="Costos" valor={pesosCompacto(actual.costos)} cambio={cambioPct(actual.costos, anterior.costos)} subirEsBueno={false} tendencia={tendencia.map(t => t.costos)} nota={SIN_ANTERIOR} />,
    hayPonedoras && actual.huevos > 0
      ? <TarjetaKPI key="ch" etiqueta="Costo por huevo" valor={pesos(actual.costos / actual.huevos)}
          cambio={anterior.huevos > 0 ? cambioPct(actual.costos / actual.huevos, anterior.costos / anterior.huevos) : null} subirEsBueno={false} nota={SIN_ANTERIOR} />
      : <TarjetaKPI key="m" etiqueta="Margen" valor={margen != null ? `${n1(margen)} %` : '—'}
          cambio={margen != null && margenAnt != null ? margen - margenAnt : null} enPuntos nota={margen != null ? SIN_ANTERIOR : 'Sin ingresos en el período'} />,
  ] : [
    <TarjetaKPI key="m" etiqueta={animales === 'aves' ? 'Aves muertas' : 'Animales muertos'} valor={compacto(actual.muertes)} cambio={cambioPct(actual.muertes, anterior.muertes)} subirEsBueno={false}
      tendencia={tendencia.map(t => t.muertes)} nota={SIN_ANTERIOR} />,
    <TarjetaKPI key="mp" etiqueta="Mortalidad del período" valor={mortalidadPct != null ? `${n2(mortalidadPct)} %` : '—'} nota={`de las ${animales} que había`} />,
    <TarjetaKPI key="e" etiqueta="Eventos clínicos" valor={String(casos)} cambio={cambioPct(casos, casosAnt)} subirEsBueno={false} nota={SIN_ANTERIOR} />,
    <TarjetaKPI key="cp" etiqueta="Causa principal" valor={causas[0]?.causa ?? '—'} nota={causas[0] ? `${causas[0].muertes.toLocaleString('es-CO')} muertes` : 'Sin muertes en el período'} />,
  ]

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
                ...(hayPonedoras ? [['Huevos', actual.huevos, anterior.huevos], ['Postura promedio %', actual.posturaPct, anterior.posturaPct]] as (string | number | null)[][] : []),
                ...(hayCarne ? [['Peso promedio kg', actual.pesoKg, anterior.pesoKg]] as (string | number | null)[][] : []),
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
              { nombre: 'Alimento por tipo', columnas: ['Alimento', 'Kg'], filas: comida.map(c => [c.nombre, c.kg]) },
              { nombre: 'Balance de la dieta', columnas: ['Nutriente', 'Comió', 'Necesita', 'Unidad', '% cubierto'], filas: balance.nutrientes.map(n => [n.nombre, n.comio, n.necesita, n.unidad, n.pct]) },
              { nombre: 'Muertes por semana', columnas: ['Semana del', ...visibles.map(v => v.nombre)], filas: columnasSemana(series.muertes) },
              { nombre: 'Muertes por causa', columnas: ['Causa', 'Muertes'], filas: causas.map(c => [c.causa, c.muertes]) },
              { nombre: 'Enfermedades', columnas: ['Tipo', 'Casos'], filas: enfermedades.map(e => [e.tipo, e.casos]) },
              { nombre: `Por ${lugar}`, columnas: ['Nombre', 'Huevos', 'Muertes', 'Alimento kg', 'Peso kg', ...(verDinero ? ['Costos', 'Ingresos', 'Utilidad'] : [])],
                filas: porUnidadVisible.map(p => [p.nombre, p.huevos, p.muertes, p.alimentoKg, p.pesoKg, ...(verDinero ? [p.costos, p.ingresos, p.utilidad] : [])]) },
              ...(verDinero ? [
                { nombre: 'Costos por categoría', columnas: ['Categoría', 'Total'], filas: categorias.map(c => [c.categoria, c.total]) },
                { nombre: 'Ingresos por tipo', columnas: ['Tipo', 'Total'], filas: ingresosTipo.map(i => [i.tipo, i.total]) },
                { nombre: 'Dinero por mes', columnas: ['Mes', 'Ingresos', 'Costos', 'Utilidad'], filas: meses.map(m => [m.mes, m.ingresos, m.costos, m.utilidad]) },
              ] : []),
            ]}
          />
        </div>
      </div>

      {/* Secciones: un tema a la vez, para no saturar */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 [scrollbar-width:none]" role="tablist" data-no-imprimir>
        {secciones.map(s => (
          <button key={s.id} role="tab" aria-selected={verSeccion === s.id} onClick={() => setSeccion(s.id)}
            className={cn('-mb-px shrink-0 border-b-2 px-3 pb-2 text-sm font-medium transition-colors',
              verSeccion === s.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {s.t}
          </button>
        ))}
      </div>

      <div className={cn('grid grid-cols-2 gap-3', kpis.filter(Boolean).length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>{kpis.filter(Boolean)}</div>

      {unidades.length === 0 ? (
        <p className="rounded-2xl bg-white py-12 text-center text-sm text-gray-400 ring-1 ring-black/5">No hay {lugares} con registros en este período</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {verSeccion === 'produccion' && (<>
            {hayPonedoras && (
              <PanelSemanal titulo="Huevos por semana" subtitulo={unSolo ? undefined : 'Suma de los galpones elegidos'} filas={series.huevos} series={visibles} tipo="barras" etiquetaTotal="Huevos" />
            )}
            {especie === 'aves_ponedoras' && (
              <PanelSemanal titulo="% de postura por semana" subtitulo="Huevos ÷ aves de cada día registrado" filas={series.postura} series={visibles} tipo="lineas"
                formato={v => `${n1(v)} %`} dominio={[0, 100]} sumable={false} />
            )}
            {(hayCarne || (!especie && d.pesos.length > 0)) && (
              <PanelSemanal titulo="Peso promedio por semana" subtitulo="Promedio de los pesajes de cada semana" filas={series.peso} series={visibles} tipo="lineas"
                formato={v => `${n1(v)} kg`} sumable={false} vacio={!hayPesos ? 'Sin pesajes en el período' : undefined} />
            )}
            {!unSolo && (
              <PanelComparacion titulo={`Comparación de ${lugares}`} subtitulo={`${comparar.nombre} del período · clic en uno para filtrar todo`}
                filas={porUnidad.map(p => ({ id: p.id, nombre: p.nombre, valor: Number(p[comparar.campo] ?? 0) }))}
                color={color} filtro={filtro} onClic={alternar} formato={comparar.formato} conTorta={comparar.campo === 'huevos'}
                columnasExtra={[
                  { titulo: 'Muertes', valor: id => porUnidad.find(p => p.id === id)!.muertes },
                  { titulo: 'Alimento kg', valor: id => Math.round(porUnidad.find(p => p.id === id)!.alimentoKg) },
                ]} />
            )}
          </>)}

          {verSeccion === 'alimento' && (<>
            <PanelDatos titulo="Qué comió" subtitulo={`${kg(actual.alimentoKg)} en el período, por alimento`} vistas={['torta', 'grafica', 'tabla']}>
              {v => comida.length === 0 ? <Vacio>Sin consumo registrado en el período</Vacio>
                : v === 'torta' ? <Torta etiquetaTotal="Alimento" formato={kg} porciones={comida.map((c, i) => ({ nombre: c.nombre, valor: c.kg, color: colorDe(i) }))} />
                : v === 'grafica' ? (
                  <div style={alturaBarras(comida.length)}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comida} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                        <XAxis type="number" {...EJE} tickFormatter={kg} />
                        <YAxis type="category" dataKey="nombre" {...EJE} axisLine={false} width={120} />
                        <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={kg} />} />
                        <Bar dataKey="kg" name="Consumido" {...BARRA_H} isAnimationActive={false}>
                          {comida.map((c, i) => <Cell key={c.nombre} fill={colorDe(i)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <TablaDatos columnas={[{ titulo: 'Alimento' }, { titulo: 'Kg', numero: true }, { titulo: '%', numero: true }]}
                    filas={comida.map(c => [c.nombre, c.kg, actual.alimentoKg > 0 ? (c.kg / actual.alimentoKg) * 100 : null])}
                    total={['Total', Math.round(actual.alimentoKg * 10) / 10, 100]} />
                )}
            </PanelDatos>

            {balanceAplica ? (
              <PanelBalanceDieta balance={balance} esAves={especie === 'aves_ponedoras' || (!especie && especies[0] === 'aves_ponedoras')} />
            ) : (
              <PanelDatos titulo="Balance de la dieta" vistas={['grafica']}>
                {() => <Vacio>Cada especie tiene su propia guía: mira el balance en la pestaña de Galpones o de Corrales.</Vacio>}
              </PanelDatos>
            )}

            <PanelSemanal titulo="Alimento por semana" subtitulo="Kilos consumidos" filas={series.alimento} series={visibles} tipo="barras" etiquetaTotal="Alimento" formato={kg} />
            {!unSolo && (
              <PanelComparacion titulo={`Consumo por ${lugar}`} subtitulo={`Gramos por ${animales === 'aves' ? 'ave' : 'animal'} al día · clic en uno para filtrar todo`}
                filas={unidades.map(u => ({ id: u.id, nombre: u.nombre, valor: Math.round(consumoPorAnimal(d, desde, hoy, { especie, lotes: new Set([u.id]) }) ?? 0) }))}
                color={color} filtro={filtro} onClic={alternar} formato={v => `${compacto(v)} g`} conTorta={false}
                columnasExtra={[{ titulo: 'Total kg', valor: id => Math.round(porUnidad.find(p => p.id === id)!.alimentoKg) }]} />
            )}
          </>)}

          {verSeccion === 'rentabilidad' && verDinero && (<>
            <PanelDatos titulo="En qué se va la plata" subtitulo={`${pesosCompacto(actual.costos)} de costos en el período`} vistas={['torta', 'grafica', 'tabla']}>
              {v => categorias.length === 0 ? <Vacio>Sin costos en el período</Vacio>
                : v === 'torta' ? <Torta etiquetaTotal="Costos" formato={pesosCompacto} porciones={categorias.map((c, i) => ({ nombre: c.categoria, valor: c.total, color: colorDe(i) }))} />
                : v === 'grafica' ? (
                  <div style={alturaBarras(categorias.length)}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categorias} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                        <XAxis type="number" {...EJE} tickFormatter={pesosCompacto} />
                        <YAxis type="category" dataKey="categoria" {...EJE} axisLine={false} width={120} />
                        <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={pesosCompacto} />} />
                        <Bar dataKey="total" name="Costo" {...BARRA_H} isAnimationActive={false}>
                          {categorias.map((c, i) => <Cell key={c.categoria} fill={colorDe(i)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <TablaDatos columnas={[{ titulo: 'Categoría' }, { titulo: 'Total', numero: true }, { titulo: '%', numero: true }]}
                    filas={categorias.map(c => [c.categoria, Math.round(c.total), actual.costos > 0 ? (c.total / actual.costos) * 100 : null])}
                    total={['Total', Math.round(actual.costos), 100]} />
                )}
            </PanelDatos>

            <PanelDatos titulo="¿Alcanza?" subtitulo="Lo que entró frente a lo que costó" vistas={['grafica', 'tabla']}>
              {v => {
                const filas = [
                  { concepto: 'Ingresos', valor: Math.round(actual.ingresos), color: SERIES[0] },
                  { concepto: 'Costos', valor: Math.round(actual.costos), color: SERIES[1] },
                  { concepto: 'Utilidad', valor: Math.round(actual.utilidad), color: actual.utilidad >= 0 ? SERIES[2] : SERIES[7] },
                ]
                const datosExtra: [string, string][] = [
                  ['Margen', margen != null ? `${n1(margen)} %` : '—'],
                  ...(hayPonedoras && actual.huevos > 0 ? [
                    ['Costo por huevo', pesos(actual.costos / actual.huevos)] as [string, string],
                    ['Ingreso por huevo', precioHuevo > 0 ? pesos(precioHuevo) : '—'] as [string, string],
                  ] : []),
                  ...(huevosEquilibrio != null ? [['Huevos para cubrir los costos', `${compacto(huevosEquilibrio)}${posturaEquilibrio != null ? ` (postura de ${n1(posturaEquilibrio)} %)` : ''}`] as [string, string]] : []),
                ]
                return v === 'grafica' ? (<>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                        <XAxis type="number" {...EJE} tickFormatter={pesosCompacto} />
                        <YAxis type="category" dataKey="concepto" {...EJE} axisLine={false} width={72} />
                        <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={pesos} />} />
                        <ReferenceLine x={0} stroke={TINTA.eje} />
                        <Bar dataKey="valor" name="Valor" {...BARRA_H} isAnimationActive={false}>
                          {filas.map(f => <Cell key={f.concepto} fill={f.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs">
                    {datosExtra.map(([t, val]) => (
                      <div key={t}><dt className="text-gray-500">{t}</dt><dd className="font-semibold text-gray-900 tabular-nums">{val}</dd></div>
                    ))}
                  </dl>
                  {huevosEquilibrio != null && <p className="mt-2 text-[0.6875rem] text-gray-400">El equilibrio es aproximado: usa lo que entró por huevo en el período.</p>}
                </>) : (
                  <TablaDatos columnas={[{ titulo: 'Concepto' }, { titulo: 'Valor', numero: false }]}
                    filas={[...filas.map(f => [f.concepto, pesos(f.valor)]), ...datosExtra]} />
                )
              }}
            </PanelDatos>

            <PanelDatos titulo="De dónde entra la plata" subtitulo={`${pesosCompacto(actual.ingresos)} de ingresos en el período`} vistas={['torta', 'tabla']}>
              {v => ingresosTipo.length === 0 ? <Vacio>Sin ingresos en el período</Vacio>
                : v === 'torta' ? <Torta etiquetaTotal="Ingresos" formato={pesosCompacto} porciones={ingresosTipo.map((t, i) => ({ nombre: t.tipo, valor: t.total, color: colorDe(i) }))} />
                : <TablaDatos columnas={[{ titulo: 'Tipo' }, { titulo: 'Total', numero: true }, { titulo: '%', numero: true }]}
                    filas={ingresosTipo.map(t => [t.tipo, Math.round(t.total), actual.ingresos > 0 ? (t.total / actual.ingresos) * 100 : null])}
                    total={['Total', Math.round(actual.ingresos), 100]} />}
            </PanelDatos>

            <PanelDatos titulo="Ingresos y costos por mes" vistas={['grafica', 'tabla']}>
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

            {!especie && especies.length > 1 && (
              <PanelDatos titulo="Dinero por especie" subtitulo="Ingresos, costos y utilidad de cada una" vistas={['grafica', 'tabla']}>
                {v => {
                  const filas = dineroPorEspecie(d, desde, hoy)
                  return v === 'grafica' ? (<>
                    <div className={ALTO}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filas} margin={{ top: 4, right: 4, left: -4, bottom: 0 }} barGap={2}>
                          <CartesianGrid {...REJILLA} />
                          <XAxis dataKey="nombre" {...EJE} />
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
                    <TablaDatos columnas={[{ titulo: 'Especie' }, { titulo: 'Ingresos', numero: true }, { titulo: 'Costos', numero: true }, { titulo: 'Utilidad', numero: true }]}
                      filas={filas.map(f => [f.nombre, Math.round(f.ingresos), Math.round(f.costos), Math.round(f.utilidad)])} />
                  )
                }}
              </PanelDatos>
            )}

            {!unSolo && (
              <PanelComparacion titulo={`Utilidad por ${lugar}`} subtitulo="Ingresos menos costos de cada uno · clic para filtrar"
                filas={porUnidad.map(p => ({ id: p.id, nombre: p.nombre, valor: Math.round(p.utilidad) }))}
                color={color} filtro={filtro} onClic={alternar} formato={pesosCompacto} conTorta={false}
                columnasExtra={[
                  { titulo: 'Ingresos', valor: id => Math.round(porUnidad.find(p => p.id === id)!.ingresos) },
                  { titulo: 'Costos', valor: id => Math.round(porUnidad.find(p => p.id === id)!.costos) },
                ]} />
            )}
          </>)}

          {verSeccion === 'sanidad' && (<>
            <PanelDatos titulo="De qué se murieron" subtitulo={`${actual.muertes.toLocaleString('es-CO')} muertes en el período`} vistas={['torta', 'grafica', 'tabla']}>
              {v => causas.length === 0 ? <Vacio>Sin muertes en el período</Vacio>
                : v === 'torta' ? <Torta etiquetaTotal="Muertes" porciones={causas.map((c, i) => ({ nombre: c.causa, valor: c.muertes, color: colorDe(i) }))} />
                : v === 'grafica' ? (
                  <div style={alturaBarras(causas.length)}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={causas} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                        <XAxis type="number" {...EJE} allowDecimals={false} />
                        <YAxis type="category" dataKey="causa" {...EJE} axisLine={false} width={120} />
                        <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico />} />
                        <Bar dataKey="muertes" name="Muertes" {...BARRA_H} isAnimationActive={false}>
                          {causas.map((c, i) => <Cell key={c.causa} fill={colorDe(i)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <TablaDatos columnas={[{ titulo: 'Causa' }, { titulo: 'Muertes', numero: true }, { titulo: '%', numero: true }]}
                    filas={causas.map(c => [c.causa, c.muertes, actual.muertes > 0 ? (c.muertes / actual.muertes) * 100 : null])}
                    total={['Total', causas.reduce((a, c) => a + c.muertes, 0), 100]} />
                )}
            </PanelDatos>

            <PanelDatos titulo="Enfermedades" subtitulo="Eventos clínicos por tipo" vistas={['torta', 'grafica', 'tabla']}>
              {v => enfermedades.length === 0 ? <Vacio>Sin eventos clínicos en el período</Vacio>
                : v === 'torta' ? <Torta etiquetaTotal="Casos" porciones={enfermedades.map((e, i) => ({ nombre: e.tipo, valor: e.casos, color: colorDe(i) }))} />
                : v === 'grafica' ? (
                  <div style={alturaBarras(enfermedades.length)}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={enfermedades} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
                        <XAxis type="number" {...EJE} allowDecimals={false} />
                        <YAxis type="category" dataKey="tipo" {...EJE} axisLine={false} width={120} />
                        <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico />} />
                        <Bar dataKey="casos" name="Casos" {...BARRA_H} isAnimationActive={false}>
                          {enfermedades.map((e, i) => <Cell key={e.tipo} fill={colorDe(i)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <TablaDatos columnas={[{ titulo: 'Tipo' }, { titulo: 'Casos', numero: true }]}
                    filas={enfermedades.map(e => [e.tipo, e.casos])} total={['Total', casos]} />
                )}
            </PanelDatos>

            <PanelSemanal titulo="Mortalidad por semana" subtitulo="Muertes del día y de eventos clínicos" filas={series.muertes} series={visibles} tipo="barras" etiquetaTotal="Muertes" />
            {!unSolo && (
              <PanelComparacion titulo={`Muertes por ${lugar}`} subtitulo="En el período · clic para filtrar"
                filas={porUnidad.map(p => ({ id: p.id, nombre: p.nombre, valor: p.muertes }))}
                color={color} filtro={filtro} onClic={alternar} formato={v => v.toLocaleString('es-CO')} conTorta
                columnasExtra={[{ titulo: `${Animales} hoy`, valor: id => unidades.find(u => u.id === id)?.animales ?? 0 }]} />
            )}
          </>)}
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
 * Qué tan balanceada estuvo la comida: cada nutriente como % de lo que pide la
 * guía, con la línea del 100 %. Debajo de 95 % falta, arriba de 120 % sobra.
 */
function PanelBalanceDieta({ balance, esAves }: { balance: ReturnType<typeof balanceNutricional>; esAves: boolean }) {
  const estado = (pct: number) => (pct < 95 ? { t: 'Falta', c: SERIES[7] } : pct > 120 ? { t: 'Sobra', c: SERIES[3] } : { t: 'Bien', c: SERIES[2] })
  const filas = balance.nutrientes.map(n => ({ ...n, pctVista: Math.min(n.pct, 200) }))
  const tope = Math.ceil(Math.max(150, ...filas.map(f => f.pctVista + 15)) / 50) * 50
  const marcas = Array.from({ length: tope / 50 + 1 }, (_, i) => i * 50)
  const cubiertos = balance.nutrientes.filter(n => n.pct >= 95).length
  const sinDatos = balance.nutrientes.length === 0
  const motivo = balance.diasSinComposicion > 0
    ? 'Los alimentos que se comieron no tienen su composición anotada (proteína, calcio...). Agrégala en Alimento → Alimentos.'
    : !esAves && !balance.conGuia
      ? 'Falta definir los requerimientos nutricionales en la pestaña Alimento.'
      : 'Sin consumo registrado en el período.'
  return (
    <PanelDatos titulo="Balance de la dieta" subtitulo={sinDatos ? 'Lo que comió frente a lo que pide la guía' : `${cubiertos} de ${balance.nutrientes.length} nutrientes cubiertos · 100 % = lo que pide la guía`}
      vistas={['grafica', 'tabla']}>
      {v => sinDatos ? <Vacio>{motivo}</Vacio> : v === 'grafica' ? (<>
        <div style={alturaBarras(filas.length)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filas} layout="vertical" margin={{ top: 14, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
              <XAxis type="number" {...EJE} domain={[0, tope]} ticks={marcas} tickFormatter={v => `${v} %`} />
              <YAxis type="category" dataKey="nombre" {...EJE} axisLine={false} width={72} />
              <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={v => `${n1(v)} %`} />} />
              <ReferenceLine x={100} stroke={TINTA.secundaria} label={{ value: 'Lo que pide', position: 'top', fontSize: 10, fill: TINTA.secundaria }} />
              <Bar dataKey="pctVista" name="% cubierto" {...BARRA_H} isAnimationActive={false}>
                {filas.map(f => <Cell key={f.id} fill={estado(f.pct).c} />)}
                <LabelList dataKey="pct" position="right" fontSize={11} fill={TINTA.primaria} formatter={(v: unknown) => `${Math.round(Number(v))} %`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Leyenda items={[{ nombre: 'Falta (< 95 %)', color: SERIES[7] }, { nombre: 'Bien', color: SERIES[2] }, { nombre: 'Sobra (> 120 %)', color: SERIES[3] }]} />
        {esAves && !balance.conGuia && (
          <p className="mt-2 text-[0.6875rem] text-gray-400">Con los valores de mantenimiento por defecto: define los requerimientos del galpón en su pestaña Alimento.</p>
        )}
      </>) : (
        <TablaDatos
          columnas={[{ titulo: 'Nutriente' }, { titulo: 'Comió', numero: true }, { titulo: 'Necesita', numero: true }, { titulo: 'Unidad' }, { titulo: '% cubierto', numero: true }, { titulo: 'Estado' }]}
          filas={balance.nutrientes.map(n => [n.nombre, Math.round(n.comio * 100) / 100, Math.round(n.necesita * 100) / 100, n.unidad, n.pct, estado(n.pct).t])}
        />
      )}
    </PanelDatos>
  )
}

/** Barras horizontales de un valor por galpón/corral; clic en una filtra todo el tablero */
function PanelComparacion({ titulo, subtitulo, filas, color, filtro, onClic, formato, conTorta, columnasExtra }: {
  titulo: string
  subtitulo: string
  filas: { id: string; nombre: string; valor: number }[]
  color: (id: string) => string
  filtro: Set<string> | null
  onClic: (id: string) => void
  formato: (v: number) => string
  conTorta: boolean
  columnasExtra: { titulo: string; valor: (id: string) => number }[]
}) {
  const visibles = filas.filter(f => !filtro || filtro.has(f.id))
  return (
    <PanelDatos titulo={titulo} subtitulo={subtitulo} vistas={conTorta ? ['grafica', 'torta', 'tabla'] : ['grafica', 'tabla']}>
      {v => v === 'grafica' ? (
        <div style={alturaBarras(filas.length)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={REJILLA.stroke} horizontal={false} />
              <XAxis type="number" {...EJE} tickFormatter={formato} />
              <YAxis type="category" dataKey="nombre" {...EJE} axisLine={false} width={96} />
              <Tooltip cursor={{ fill: 'rgb(0 0 0 / 4%)' }} content={<TooltipGrafico formato={formato} />} />
              {filas.some(f => f.valor < 0) && <ReferenceLine x={0} stroke={TINTA.eje} />}
              <Bar dataKey="valor" name={titulo} {...BARRA_H} cursor="pointer" isAnimationActive={false}
                onClick={(_, i) => { const f = filas[i]; if (f) onClic(f.id) }}>
                {filas.map(f => <Cell key={f.id} fill={color(f.id)} fillOpacity={!filtro || filtro.has(f.id) ? 1 : 0.25} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : v === 'torta' ? (
        <Torta formato={formato} porciones={visibles.map(f => ({ nombre: f.nombre, valor: f.valor, color: color(f.id) }))} />
      ) : (
        <TablaDatos
          columnas={[{ titulo: 'Nombre' }, { titulo: 'Valor', numero: true }, ...columnasExtra.map(c => ({ titulo: c.titulo, numero: true }))]}
          filas={visibles.map(f => [f.nombre, f.valor, ...columnasExtra.map(c => c.valor(f.id))])}
        />
      )}
    </PanelDatos>
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
      {v => vacio ? <Vacio>{vacio}</Vacio> : v === 'grafica' ? (<>
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
