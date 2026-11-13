'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { TarjetaKPI } from '@/components/ui/graficos/TarjetaKPI'
import { PanelDatos, TablaDatos, Leyenda } from '@/components/ui/graficos/PanelDatos'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { BARRA, EJE, EJE_Y, REJILLA, C, CURSOR_BARRA, CURSOR_LINEA, TINTA, TONOS, colorDe, compacto } from '@/components/ui/graficos/paleta'
import { useProduccionFinca } from '@/lib/useProduccionFinca'
import {
  analisisPorLote, gramosAveDe, hallazgos, mesesDeLaFinca, mortalidadAcumulada, nombreMes,
  type Hallazgo, type MesFinca,
} from '@/lib/analisisProduccion'

const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const pct = (v: number) => `${n1(v)} %`
const mil = (v: number) => v.toLocaleString('es-CO')
const ALTO = 'h-64'
const ICONO: Record<Hallazgo['tono'], { n: NombreIcono; color: string }> = {
  bien: { n: 'listo', color: 'text-green-700' },
  mal: { n: 'alerta', color: 'text-red-700' },
  nota: { n: 'idea', color: 'text-amber-600' },
}

/**
 * El Resumen de una finca con datos viejos (sin ventas): un análisis de todo lo
 * que produjo. Qué dicen los datos, el mejor y el peor mes, la postura y las
 * muertes de cada mes, la mortalidad frente a la guía y la comparación de lotes.
 */
export default function ResumenHistorico({ fincaId }: { fincaId: string }) {
  const datos = useProduccionFinca(fincaId)

  const a = useMemo(() => {
    if (!datos) return null
    const { lotes, dias, guias } = datos
    const guiaDe = (l: { id: string }) => {
      const ref = lotes.find(x => x.id === l.id)?.referencia_id
      return ref ? guias.get(ref) : undefined
    }
    const porLote = analisisPorLote(dias, lotes, guiaDe)
    const meses = mesesDeLaFinca(dias, lotes)
    const completos = meses.filter(m => !m.parcial && m.postura != null && m.a.dias >= 20)
    const mejor = completos.reduce<MesFinca | null>((x, m) => (!x || m.postura! > x.postura! ? m : x), null)
    const peor = completos.reduce<MesFinca | null>((x, m) => (!x || m.postura! < x.postura! ? m : x), null)
    const masMuertes = meses.reduce<MesFinca | null>((x, m) => (!x || m.muertes > x.muertes ? m : x), null)

    // Mortalidad acumulada: una línea por lote y la guía desde el arranque más temprano
    const filas = new Map<number, Record<string, number | null>>()
    let primero: { semana: number; guia: number | null }[] = []
    for (const l of lotes) {
      const serie = mortalidadAcumulada(dias, l, guiaDe(l))
      if (serie.length && (!primero.length || serie[0].semana < primero[0].semana)) primero = serie
      for (const p of serie) {
        const f = filas.get(p.semana) ?? { semana: p.semana }
        f[l.id] = p.real
        filas.set(p.semana, f)
      }
    }
    const guiaPor = new Map(primero.map(p => [p.semana, p.guia]))
    const mortalidad: Record<string, number | null>[] = [...filas.values()].sort((x, y) => (x.semana ?? 0) - (y.semana ?? 0))
      .map(f => ({ ...f, guia: guiaPor.get(f.semana as number) ?? null }))

    const alojadas = porLote.reduce((s, l) => s + (l.avesAlojadas ?? 0), 0)
    const huevos = porLote.reduce((s, l) => s + l.huevos, 0)
    const muertesPostura = porLote.reduce((s, l) => s + l.muertesPostura, 0)
    const conAves = porLote.filter(l => l.kgDocena != null)
    return {
      lotes, porLote, meses, mejor, peor, masMuertes, mortalidad,
      hayGuia: mortalidad.some(f => f.guia != null),
      hallazgos: hallazgos(porLote, meses),
      kpi: {
        huevos, alojadas,
        huevosAve: alojadas > 0 ? huevos / alojadas : null,
        postura: (() => {
          const t = porLote.filter(l => l.postura != null)
          const dias = t.reduce((s, l) => s + l.diasPostura, 0)
          return dias > 0 ? t.reduce((s, l) => s + l.postura! * l.diasPostura, 0) / dias : null
        })(),
        mortalidad: alojadas > 0 ? (muertesPostura / alojadas) * 100 : null,
        muertesPostura,
        kgDocena: conAves.length ? conAves.reduce((s, l) => s + l.kgDocena! * l.huevos, 0) / conAves.reduce((s, l) => s + l.huevos, 0) : null,
        desde: meses[0]?.mes, hasta: meses[meses.length - 1]?.mes,
      },
    }
  }, [datos])

  if (!a) return <Skeleton className="h-96 rounded-2xl" />
  if (a.lotes.length === 0) return <p className="py-12 text-center text-sm text-gray-400">Esta finca no tiene lotes cargados.</p>

  const colorLote = (id: string) => colorDe(a.lotes.findIndex(l => l.id === id))
  const colorMes = (m: MesFinca) => m === a.mejor ? C.principal : m === a.peor ? C.falta : m.parcial ? TONOS[6] : C.claro

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="flex items-start gap-2">
          <Ic n="info" className="mt-0.5 size-4" />
          Datos viejos cargados de Excel, de {a.kpi.desde ? nombreMes(a.kpi.desde, false) : '…'} a {a.kpi.hasta ? nombreMes(a.kpi.hasta, false) : '…'}. No hay ventas: aquí se mira solo la producción.
        </p>
        <Button size="sm" variant="outline" render={<Link href="/reportes" />}>
          Ver el análisis completo <Ic n="flecha" className="size-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <TarjetaKPI etiqueta="Huevos" valor={compacto(a.kpi.huevos)} nota={`${a.lotes.length} lotes`} />
        <TarjetaKPI etiqueta="Huevos por ave alojada" valor={a.kpi.huevosAve != null ? mil(Math.round(a.kpi.huevosAve)) : '—'} nota={`${mil(a.kpi.alojadas)} aves al empezar la postura`} />
        <TarjetaKPI etiqueta="Postura promedio" valor={a.kpi.postura != null ? pct(a.kpi.postura) : '—'} nota="De todos los ciclos" />
        <TarjetaKPI etiqueta="Mortalidad en postura" valor={a.kpi.mortalidad != null ? pct(a.kpi.mortalidad) : '—'} nota={`${mil(a.kpi.muertesPostura)} aves, con la selección`} />
        <TarjetaKPI etiqueta="Alimento por docena" valor={a.kpi.kgDocena != null ? `${n1(a.kpi.kgDocena)} kg` : '—'} nota="Kilos para 12 huevos" />
        <TarjetaKPI etiqueta="Mes con más muertes" valor={a.masMuertes ? nombreMes(a.masMuertes.mes) : '—'} nota={a.masMuertes ? `${mil(a.masMuertes.muertes)} aves` : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="superficie rounded-2xl p-5 xl:col-span-2">
          <h3 className="text-[0.9375rem] font-semibold tracking-tight" style={{ color: TINTA.primaria }}>Lo que dicen los datos</h3>
          <ul className="mt-3 space-y-2.5">
            {a.hallazgos.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Ic n={ICONO[h.tono].n} className={cn('mt-0.5 size-4', ICONO[h.tono].color)} />
                {h.texto}
              </li>
            ))}
          </ul>
        </section>
        <div className="grid gap-4">
          <MesDestacado titulo="Mejor mes" m={a.mejor} tono="bien" />
          <MesDestacado titulo="Peor mes" m={a.peor} tono="mal" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelDatos titulo="Postura de cada mes" subtitulo="El mejor mes en verde oscuro, el peor en rojo; en claro, los meses de arranque o cierre de un lote">
          {v => v === 'tabla' ? (
            <TablaDatos
              columnas={[{ titulo: 'Mes' }, { titulo: 'Postura %', numero: true }, { titulo: 'Huevos', numero: true }, { titulo: 'Lotes' }]}
              filas={a.meses.filter(m => m.postura != null).map(m => [nombreMes(m.mes), m.postura, m.a.huevos, m.lotes.join(', ')])}
            />
          ) : (
            <div className={ALTO}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.meses.filter(m => m.postura != null).map(m => ({ mes: nombreMes(m.mes), postura: m.postura, m }))} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="mes" {...EJE} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis {...EJE_Y} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v} %`} />
                  <Tooltip cursor={CURSOR_BARRA} content={<TooltipGrafico formato={pct} />} />
                  <Bar dataKey="postura" name="Postura" {...BARRA} isAnimationActive={false}>
                    {a.meses.filter(m => m.postura != null).map(m => <Cell key={m.mes} fill={colorMes(m)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelDatos>

        <PanelDatos titulo="Muertes por mes" subtitulo="Aves muertas y de selección; en rojo, el mes con más">
          {v => v === 'tabla' ? (
            <TablaDatos
              columnas={[{ titulo: 'Mes' }, { titulo: 'Muertes', numero: true }, { titulo: 'Mortalidad %', numero: true }, { titulo: 'Lotes' }]}
              filas={a.meses.map(m => [nombreMes(m.mes), m.muertes, m.mortalidad, m.lotes.join(', ')])}
              total={['Total', a.meses.reduce((s, m) => s + m.muertes, 0), null, '']}
            />
          ) : (
            <div className={ALTO}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.meses.map(m => ({ mes: nombreMes(m.mes), muertes: m.muertes }))} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="mes" {...EJE} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis {...EJE_Y} allowDecimals={false} />
                  <Tooltip cursor={CURSOR_BARRA} content={<TooltipGrafico formato={v => `${mil(v)} aves`} />} />
                  <Bar dataKey="muertes" name="Muertes" {...BARRA} isAnimationActive={false}>
                    {a.meses.map(m => <Cell key={m.mes} fill={m === a.masMuertes ? C.falta : C.claro} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelDatos>
      </div>

      <PanelDatos titulo="Mortalidad acumulada en postura"
        subtitulo={a.hayGuia ? 'Cada lote desde que empezó a poner, frente a lo que espera la guía de la línea (punteada)' : 'Cada lote desde que empezó a poner'}>
        {v => v === 'tabla' ? (
          <TablaDatos
            columnas={[{ titulo: 'Semana' }, ...a.lotes.map(l => ({ titulo: `${l.nombre} %`, numero: true })), ...(a.hayGuia ? [{ titulo: 'Guía %', numero: true }] : [])]}
            filas={a.mortalidad.map(f => [`Semana ${f.semana}`, ...a.lotes.map(l => f[l.id] ?? null), ...(a.hayGuia ? [f.guia] : [])])}
          />
        ) : (<>
          <div className={ALTO}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={a.mortalidad} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid {...REJILLA} />
                <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                <YAxis {...EJE_Y} tickFormatter={v => `${v} %`} />
                <Tooltip cursor={CURSOR_LINEA} content={<TooltipGrafico formato={pct} titulo={s => `Semana ${s}`} />} />
                {a.hayGuia && <Line dataKey="guia" name="Guía" stroke={TINTA.tenue} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
                {a.lotes.map(l => (
                  <Line key={l.id} dataKey={l.id} name={l.nombre} stroke={colorLote(l.id)} strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Leyenda items={[...a.lotes.map(l => ({ nombre: l.nombre, color: colorLote(l.id) })), ...(a.hayGuia ? [{ nombre: 'Guía', color: TINTA.tenue }] : [])]} />
        </>)}
      </PanelDatos>

      <PanelDatos titulo="Comparación de lotes" subtitulo="Todo el ciclo de postura de cada lote" vistas={['tabla']}>
        {() => (
          <TablaDatos
            columnas={[
              { titulo: 'Lote' }, { titulo: 'Aves alojadas', numero: true }, { titulo: 'Semanas', numero: true },
              { titulo: 'Huevos por ave', numero: true }, { titulo: 'Postura %', numero: true }, { titulo: 'Pico', numero: true },
              { titulo: 'Semanas ≥ 90 %', numero: true }, { titulo: 'Mortalidad %', numero: true }, { titulo: 'g/ave/día', numero: true },
              { titulo: 'kg/docena', numero: true }, { titulo: 'Huevo C %', numero: true }, { titulo: 'Frente a la guía', numero: true },
            ]}
            filas={a.porLote.map(l => [
              l.lote.nombre, l.avesAlojadas, Math.round(l.diasPostura / 7), l.huevosAve != null ? Math.round(l.huevosAve) : null,
              l.postura, l.pico ? `${n1(l.pico.pct)} % (sem. ${l.pico.semana})` : null, l.semanasSobre90, l.mortalidadPostura,
              l.gramosAve != null ? Math.round(l.gramosAve) : null, l.kgDocena != null ? Math.round(l.kgDocena * 100) / 100 : null, l.parteC,
              l.contraGuia != null ? `${l.contraGuia >= 0 ? '+' : '−'}${n1(Math.abs(l.contraGuia))} pts` : null,
            ])}
          />
        )}
      </PanelDatos>
    </div>
  )
}

function MesDestacado({ titulo, m, tono }: { titulo: string; m: MesFinca | null; tono: 'bien' | 'mal' }) {
  const g = m ? gramosAveDe(m.a) : null
  return (
    <section className={cn('rounded-2xl p-5 ring-1', tono === 'bien' ? 'bg-green-50 ring-green-200' : 'bg-red-50 ring-red-200')}>
      <p className={cn('text-xs font-medium', tono === 'bien' ? 'text-green-800' : 'text-red-800')}>{titulo}</p>
      {m ? (<>
        <p className="mt-1 text-lg font-medium text-gray-900 first-letter:uppercase">{nombreMes(m.mes, false)}</p>
        <p className={cn('text-3xl font-semibold tabular-nums', tono === 'bien' ? 'text-green-800' : 'text-red-800')}>{pct(m.postura!)}</p>
        <p className="mt-1 text-xs text-gray-600">
          {mil(m.a.huevos)} huevos · {mil(m.muertes)} {m.muertes === 1 ? 'muerte' : 'muertes'}{g != null ? ` · ${Math.round(g)} g/ave` : ''}
        </p>
        <p className="text-xs text-gray-400">{m.lotes.join(', ')}</p>
      </>) : <p className="mt-1 text-sm text-gray-400">Sin meses completos</p>}
    </section>
  )
}
