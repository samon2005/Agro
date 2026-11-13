'use client'

import { useMemo, useState } from 'react'
import FiltroPeriodo from './FiltroPeriodo'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useProduccionFinca } from '@/lib/useProduccionFinca'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TarjetaKPI } from '@/components/ui/graficos/TarjetaKPI'
import { PanelDatos, TablaDatos, Leyenda } from '@/components/ui/graficos/PanelDatos'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { BARRA, EJE, EJE_Y, REJILLA, C, CURSOR_BARRA, CURSOR_LINEA, TINTA, TONOS, colorDe, compacto } from '@/components/ui/graficos/paleta'
import { TAMANOS_HUEVO } from '@/lib/huevos'
import { esperadoDeSemana, type FilaReferencia } from '@/lib/referencias'
import {
  filtrarPorPeriodo, TODO_EL_TIEMPO, type Periodo,
  gramosAveDe, nombreMes, parteDe, porMes, porSemanaDeVida, posturaDe, resumenLotes,
} from '@/lib/analisisProduccion'

const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const pct = (v: number) => `${n1(v)} %`
const ALTO = 'h-64'
// Un tono por tamaño, de la C (la más clara) al jumbo (la más oscura)
const COLOR_TAMANO: Record<string, string> = { c: TONOS[6], b: TONOS[5], a: TONOS[4], aa: TONOS[3], aaa: TONOS[1], jumbo: TONOS[0] }


/**
 * Análisis de producción de toda la historia de la finca, sin ventas: postura
 * por semana de vida frente a la guía, huevos por mes, tamaños por mes y la
 * tabla mes a mes. Para las fincas con datos viejos cargados de Excel.
 */
export default function AnalisisProduccion({ fincaId, periodo: periodoDado }: {
  fincaId: string
  /** El periodo lo puede elegir quien lo contiene (Reportes); si no, trae su propio filtro */
  periodo?: Periodo
}) {
  const datos = useProduccionFinca(fincaId)
  const lotes = datos?.lotes ?? null
  const [periodoPropio, setPeriodoPropio] = useState<Periodo>(TODO_EL_TIEMPO)
  const periodo = periodoDado ?? periodoPropio
  const dias = useMemo(() => filtrarPorPeriodo(datos?.dias ?? [], periodo), [datos, periodo])
  const guias = useMemo(() => datos?.guias ?? new Map<string, Map<number, FilaReferencia>>(), [datos])
  const [elegido, setElegido] = useState<string>('todos')

  const vista = useMemo(() => {
    if (!lotes) return null
    const conDias = lotes.filter(l => dias.some(d => d.lote_id === l.id))
    // Si el lote elegido no tiene días en el periodo, se ven todos
    const ls = elegido === 'todos' || !conDias.some(l => l.id === elegido) ? conDias : conDias.filter(l => l.id === elegido)
    const ids = new Set(ls.map(l => l.id))
    const ds = dias.filter(d => ids.has(d.lote_id))
    const meses = porMes(ds, ls)
    // Curva por semana de vida: una línea por lote y la guía de la línea genética
    const filasSemana = new Map<number, Record<string, number | null>>()
    for (const l of ls) {
      for (const { semana, a } of porSemanaDeVida(ds, l)) {
        const fila = filasSemana.get(semana) ?? { semana }
        fila[l.id] = posturaDe(a)
        filasSemana.set(semana, fila)
      }
    }
    const guia = ls.map(l => l.referencia_id && guias.get(l.referencia_id)).find(Boolean) || null
    const curva: Record<string, number | null>[] = [...filasSemana.values()].sort((a, b) => (a.semana ?? 0) - (b.semana ?? 0))
      .map(f => ({ ...f, guia: guia ? esperadoDeSemana(guia, f.semana)?.postura ?? null : null }))
    const conTamanos = meses.filter(m => m.a.clasificados > 0)
    const mesMasC = conTamanos.filter(m => m.a.clasificados >= 1000)
      .reduce<{ mes: string; p: number } | null>((mx, m) => { const p = parteDe(m.a, 'c') ?? 0; return !mx || p > mx.p ? { mes: m.mes, p } : mx }, null)
    return { conDias, ls, meses, curva, conTamanos, mesMasC, resumen: resumenLotes(ds, ls), hayGuia: guia != null }
  }, [lotes, dias, guias, elegido])

  if (!lotes || !vista) return <Skeleton className="h-96 rounded-2xl" />
  if (vista.conDias.length === 0) return (
    <div className="space-y-4">
      {!periodoDado && datos && <FiltroPeriodo dias={datos.dias} valor={periodoPropio} onCambio={setPeriodoPropio} />}
      <p className="py-12 text-center text-sm text-gray-400">{datos && datos.dias.length > 0 ? 'No hay días registrados en ese periodo.' : 'Esta finca todavía no tiene días registrados en los galpones.'}</p>
    </div>
  )

  const { resumen: r, meses, curva, conTamanos, mesMasC, ls } = vista
  const colorLote = (id: string) => colorDe(lotes.findIndex(l => l.id === id))
  const fechaCorta = (f: string | null) => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) : '…'

  return (
    <div className="space-y-4">
      {!periodoDado && datos && <FiltroPeriodo dias={datos.dias} valor={periodoPropio} onCambio={setPeriodoPropio} />}
      {/* Lotes: todos juntos o uno solo */}
      <div className="superficie inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
        {[{ id: 'todos', nombre: 'Todos los lotes', sub: `${lotes.length} lotes` },
          ...vista.conDias.map(l => ({ id: l.id, nombre: l.nombre, sub: `${fechaCorta(l.fecha_inicio_postura)} – ${fechaCorta(l.fecha_fin)}` }))].map(p => (
          <button key={p.id} onClick={() => setElegido(p.id)}
            className={cn('shrink-0 rounded-xl px-3.5 py-1.5 text-left transition-colors',
              (vista.ls.length === vista.conDias.length ? 'todos' : elegido) === p.id ? 'bg-green-50 text-green-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800')}>
            <span className="block whitespace-nowrap text-[0.8125rem] font-medium">{p.nombre}</span>
            <span className="block whitespace-nowrap text-[0.6875rem] text-gray-400">{p.sub}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <TarjetaKPI etiqueta="Huevos" valor={compacto(r.total.huevos)} nota={`${r.total.dias.toLocaleString('es-CO')} días de postura`} />
        <TarjetaKPI etiqueta="Postura promedio" valor={r.postura != null ? pct(r.postura) : '—'} nota="De todo el ciclo de postura" />
        <TarjetaKPI etiqueta="Pico de postura" valor={r.pico ? pct(r.pico.pct) : '—'}
          nota={r.pico ? `Semana ${r.pico.semana}${ls.length > 1 ? ` · ${r.pico.lote}` : ''}` : undefined} />
        <TarjetaKPI etiqueta="Mortalidad del ciclo" valor={r.mortalidad != null ? pct(r.mortalidad) : '—'}
          nota={`${r.muertesCiclo.toLocaleString('es-CO')} aves, con la selección`} />
        <TarjetaKPI etiqueta="Alimento por ave" valor={r.gramosAve != null ? `${Math.round(r.gramosAve)} g` : '—'} nota="Al día, en postura" />
        <TarjetaKPI etiqueta="Huevo C" valor={parteDe(r.total, 'c') != null ? pct(parteDe(r.total, 'c')!) : 'Sin clasificar'}
          nota={mesMasC ? `Más en ${nombreMes(mesMasC.mes)} (${n1(mesMasC.p)} %)` : 'No hay clasificación por tamaño'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelDatos titulo="Postura por semana de vida"
          subtitulo={vista.hayGuia ? 'Cada lote frente a la guía de la línea (punteada)' : 'Cada lote, semana a semana'}>
          {v => v === 'tabla' ? (
            <TablaDatos
              columnas={[{ titulo: 'Semana' }, ...ls.map(l => ({ titulo: l.nombre, numero: true })), ...(vista.hayGuia ? [{ titulo: 'Guía', numero: true }] : [])]}
              filas={curva.map(f => [`Semana ${f.semana}`, ...ls.map(l => f[l.id] ?? null), ...(vista.hayGuia ? [f.guia] : [])])}
            />
          ) : (<>
            <div className={ALTO}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curva} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis {...EJE_Y} domain={[0, 100]} tickFormatter={v => `${v} %`} />
                  <Tooltip cursor={CURSOR_LINEA} content={<TooltipGrafico formato={pct} titulo={s => `Semana ${s}`} />} />
                  {vista.hayGuia && <Line dataKey="guia" name="Guía" stroke={TINTA.tenue} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
                  {ls.map(l => (
                    <Line key={l.id} dataKey={l.id} name={l.nombre} stroke={colorLote(l.id)} strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Leyenda items={[...ls.map(l => ({ nombre: l.nombre, color: colorLote(l.id) })), ...(vista.hayGuia ? [{ nombre: 'Guía', color: TINTA.tenue }] : [])]} />
          </>)}
        </PanelDatos>

        <PanelDatos titulo="Huevos por mes" subtitulo="Todo lo puesto en el mes, de los lotes elegidos">
          {v => v === 'tabla' ? (
            <TablaDatos
              columnas={[{ titulo: 'Mes' }, { titulo: 'Huevos', numero: true }, { titulo: 'Postura %', numero: true }]}
              filas={meses.map(m => [nombreMes(m.mes), m.a.huevos, posturaDe(m.a)])}
              total={['Total', r.total.huevos, r.postura]}
            />
          ) : (
            <div className={ALTO}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meses.map(m => ({ mes: nombreMes(m.mes), huevos: m.a.huevos }))} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="mes" {...EJE} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis {...EJE_Y} tickFormatter={compacto} />
                  <Tooltip cursor={CURSOR_BARRA} content={<TooltipGrafico formato={v => `${v.toLocaleString('es-CO')} huevos`} />} />
                  <Bar dataKey="huevos" name="Huevos" fill={C.principal} {...BARRA} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelDatos>
      </div>

      <PanelDatos titulo="Tamaños por mes"
        subtitulo={conTamanos.length > 0 ? 'Parte de cada tamaño entre los huevos clasificados del mes' : 'Los lotes elegidos no tienen clasificación por tamaño'}>
        {v => conTamanos.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">Sin clasificación por tamaño en estos lotes.</p>
        ) : v === 'tabla' ? (
          <TablaDatos
            columnas={[{ titulo: 'Mes' }, { titulo: 'Clasificados', numero: true }, ...TAMANOS_HUEVO.map(t => ({ titulo: `${t.label} %`, numero: true })), { titulo: 'Rotos', numero: true }]}
            filas={conTamanos.map(m => [nombreMes(m.mes), m.a.clasificados, ...TAMANOS_HUEVO.map(t => parteDe(m.a, t.key)), m.a.rotos])}
            total={['Total', r.total.clasificados, ...TAMANOS_HUEVO.map(t => parteDe(r.total, t.key)), r.total.rotos]}
          />
        ) : (<>
          <div className={ALTO}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conTamanos.map(m => ({ mes: nombreMes(m.mes), ...Object.fromEntries(TAMANOS_HUEVO.map(t => [t.key, parteDe(m.a, t.key)])) }))}
                margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid {...REJILLA} />
                <XAxis dataKey="mes" {...EJE} interval="preserveStartEnd" minTickGap={14} />
                <YAxis {...EJE_Y} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow tickFormatter={v => `${v} %`} />
                <Tooltip cursor={CURSOR_BARRA} content={<TooltipGrafico formato={pct} />} />
                {[...TAMANOS_HUEVO].reverse().map(t => (
                  <Bar key={t.key} dataKey={t.key} name={t.label} stackId="t" fill={COLOR_TAMANO[t.key]} maxBarSize={30} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Leyenda items={TAMANOS_HUEVO.map(t => ({ nombre: t.label, color: COLOR_TAMANO[t.key] }))} />
        </>)}
      </PanelDatos>

      <PanelDatos titulo="Mes a mes" subtitulo="Producción, mortalidad y alimento de cada mes" vistas={['tabla']}>
        {() => (
          <TablaDatos
            columnas={[{ titulo: 'Mes' }, { titulo: 'Días', numero: true }, { titulo: 'Huevos', numero: true }, { titulo: 'Postura %', numero: true },
              { titulo: 'Huevo C %', numero: true }, { titulo: 'Muertes', numero: true }, { titulo: 'Alimento g/ave', numero: true }]}
            filas={meses.map(m => [nombreMes(m.mes, false), m.a.dias, m.a.huevos, posturaDe(m.a), parteDe(m.a, 'c'), m.a.muertes,
              gramosAveDe(m.a) != null ? Math.round(gramosAveDe(m.a)!) : null])}
          />
        )}
      </PanelDatos>
    </div>
  )
}
