'use client'

import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { PanelDatos, TablaDatos, Leyenda } from '@/components/ui/graficos/PanelDatos'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { EJE, EJE_Y, REJILLA, CURSOR_LINEA, TONOS, colorDe } from '@/components/ui/graficos/paleta'
import { cargarLineasReferencia, cargarReferencia, esperadoDeSemana, mortalidadEsperadaDesde, semanaDeVida, type FilaReferencia, type LineaReferencia } from '@/lib/referencias'
import { resumenDeGuia } from '@/lib/lineas'
import { useProduccionFinca } from '@/lib/useProduccionFinca'
import { alimentoDelLote, analisisPorLote, mortalidadAcumulada, porSemanaDeVida, posturaDe } from '@/lib/analisisProduccion'
import { useFinca } from '@/components/agro/FincaProvider'
import { leerConfigAves } from '@/lib/configAves'

type Medida = 'postura' | 'mortalidad' | 'consumo' | 'huevo'
const MEDIDAS: { id: Medida; nombre: string; unidad: string }[] = [
  { id: 'postura', nombre: 'Postura', unidad: '%' },
  { id: 'mortalidad', nombre: 'Mortalidad acumulada', unidad: '%' },
  { id: 'consumo', nombre: 'Alimento por gallina', unidad: 'g' },
  { id: 'huevo', nombre: 'Peso del huevo', unidad: 'g' },
]
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
// Las guías van punteadas en grises y verdes claros; los lotes reales, con los colores de siempre
const COLOR_GUIA = [TONOS[5], '#9aa3a0', TONOS[6], '#c2a25a']

/**
 * Comparar líneas genéticas: las guías entre sí y contra los lotes reales de la
 * finca, semana de vida a semana de vida, con una tabla de lo normal de cada una
 * (lib/lineas) y lo que dio cada lote (lib/analisisProduccion).
 */
export default function ComparadorLineas({ fincaId }: { fincaId: string }) {
  const { fincaActual } = useFinca()
  const baseId = leerConfigAves(fincaActual?.config_aves).baseReferenciaId
  const datos = useProduccionFinca(fincaId)
  const [lineas, setLineas] = useState<LineaReferencia[] | null>(null)
  const [elegidas, setElegidas] = useState<string[]>([])
  const [lotesElegidos, setLotesElegidos] = useState<string[] | null>(null)
  const [medida, setMedida] = useState<Medida>('postura')
  const [tablas, setTablas] = useState<Map<string, Map<number, FilaReferencia>>>(new Map())

  useEffect(() => {
    let vigente = true
    cargarLineasReferencia(createClient(), fincaId).then(ls => {
      if (!vigente) return
      const aves = ls.filter(l => l.especie === 'aves_ponedoras')
      setLineas(aves)
      // Para arrancar: la tabla base de la finca y las guías de sus lotes, o las dos primeras
      setElegidas(prev => prev.length ? prev : aves.filter(l => l.id === baseId).map(l => l.id).concat(aves.filter(l => l.finca_id == null).slice(0, 2).map(l => l.id)).slice(0, 3))
    })
    return () => { vigente = false }
  }, [fincaId, baseId])

  useEffect(() => {
    let vigente = true
    const faltan = elegidas.filter(id => !tablas.has(id))
    if (!faltan.length) return
    Promise.all(faltan.map(async id => [id, await cargarReferencia(createClient(), id)] as const))
      .then(lista => { if (vigente) setTablas(prev => new Map([...prev, ...lista])) })
    return () => { vigente = false }
  }, [elegidas, tablas])

  const lotes = useMemo(() => (datos?.lotes ?? []).filter(l => l.fecha_nacimiento && datos?.dias.some(d => d.lote_id === l.id)), [datos])
  const lotesVista = lotesElegidos ?? lotes.slice(0, 2).map(l => l.id)

  const serie = useMemo(() => {
    const filas = new Map<number, Record<string, number | null>>()
    const poner = (s: number, k: string, v: number | null) => {
      if (v == null) return
      const f = filas.get(s) ?? { semana: s }
      f[k] = v
      filas.set(s, f)
    }
    for (const id of elegidas) {
      const ref = tablas.get(id)
      if (!ref) continue
      const inicio = resumenDeGuia(ref)?.inicioPostura ?? 18
      for (const s of ref.keys()) {
        const e = esperadoDeSemana(ref, s)
        if (!e) continue
        poner(s, id, medida === 'postura' ? e.postura : medida === 'consumo' ? e.consumo : medida === 'huevo' ? e.pesoHuevo
          : s >= inicio ? mortalidadEsperadaDesde(ref, inicio, s) : null)
      }
    }
    if (datos && medida !== 'huevo') {
      for (const l of lotes.filter(x => lotesVista.includes(x.id))) {
        if (medida === 'postura') for (const { semana, a } of porSemanaDeVida(datos.dias, l)) poner(semana, l.id, posturaDe(a))
        if (medida === 'mortalidad') for (const p of mortalidadAcumulada(datos.dias, l)) poner(p.semana, l.id, p.real)
        if (medida === 'consumo') {
          const hasta = datos.dias.filter(d => d.lote_id === l.id).reduce((m, d) => (d.fecha > m ? d.fecha : m), '')
          for (const w of alimentoDelLote(datos.dias, l, hasta).semanas) poner(w.semana, l.id, w.gAve)
        }
      }
    }
    return [...filas.values()].sort((a, b) => (a.semana ?? 0) - (b.semana ?? 0))
  }, [elegidas, tablas, medida, datos, lotes, lotesVista])

  if (!lineas || !datos) return <Skeleton className="h-96 rounded-2xl" />

  const nombreLinea = (id: string) => {
    const l = lineas.find(x => x.id === id)
    return l ? `${l.nombre}${id === baseId ? ' (base)' : l.finca_id ? ' (copia de la finca)' : ''}` : ''
  }
  const m = MEDIDAS.find(x => x.id === medida)!
  const porLote = analisisPorLote(datos.dias, lotes.filter(l => lotesVista.includes(l.id)), () => undefined)
  const chip = (activo: boolean) => cn('rounded-full border px-3 py-1 text-xs transition-colors', activo ? 'border-green-700 bg-green-50 font-medium text-green-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300')

  return (
    <div className="space-y-4">
      <div className="superficie space-y-2 rounded-2xl p-4">
        <p className="text-xs font-medium text-gray-500">Guías (hasta 4)</p>
        <div className="flex flex-wrap gap-1.5">
          {lineas.map(l => (
            <button key={l.id} type="button" className={chip(elegidas.includes(l.id))}
              onClick={() => setElegidas(prev => prev.includes(l.id) ? prev.filter(x => x !== l.id) : prev.length >= 4 ? prev : [...prev, l.id])}>
              {nombreLinea(l.id)}
            </button>
          ))}
        </div>
        {lotes.length > 0 && (<>
          <p className="pt-1 text-xs font-medium text-gray-500">Lotes de la finca</p>
          <div className="flex flex-wrap gap-1.5">
            {lotes.map(l => (
              <button key={l.id} type="button" className={chip(lotesVista.includes(l.id))}
                onClick={() => setLotesElegidos(lotesVista.includes(l.id) ? lotesVista.filter(x => x !== l.id) : [...lotesVista, l.id])}>
                {l.nombre}
              </button>
            ))}
          </div>
        </>)}
      </div>

      <PanelDatos titulo={`${m.nombre} por semana de vida`}
        subtitulo={medida === 'huevo' ? 'Solo las guías: el peso del huevo no se registra por día' : 'Guías punteadas y lotes reales de la finca'}
        accion={
          <select value={medida} onChange={e => setMedida(e.target.value as Medida)} aria-label="Qué comparar"
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700">
            {MEDIDAS.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        }>
        {v => v === 'tabla' ? (
          <TablaDatos
            columnas={[{ titulo: 'Semana' }, ...elegidas.map(id => ({ titulo: nombreLinea(id), numero: true })), ...(medida !== 'huevo' ? lotesVista.map(id => ({ titulo: lotes.find(l => l.id === id)?.nombre ?? '', numero: true })) : [])]}
            filas={serie.map(f => [`Semana ${f.semana}`, ...elegidas.map(id => f[id] ?? null), ...(medida !== 'huevo' ? lotesVista.map(id => f[id] ?? null) : [])])}
          />
        ) : (<>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid {...REJILLA} />
                <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                <YAxis {...EJE_Y} tickFormatter={v => `${v} ${m.unidad}`} />
                <Tooltip cursor={CURSOR_LINEA} content={<TooltipGrafico formato={v => `${n1(v)} ${m.unidad}`} titulo={s => `Semana ${s}`} />} />
                {elegidas.map((id, i) => (
                  <Line key={id} dataKey={id} name={nombreLinea(id)} stroke={COLOR_GUIA[i % COLOR_GUIA.length]} strokeWidth={1.75} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                ))}
                {medida !== 'huevo' && lotesVista.map(id => (
                  <Line key={id} dataKey={id} name={lotes.find(l => l.id === id)?.nombre} stroke={colorDe(lotes.findIndex(l => l.id === id))} strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Leyenda items={[
            ...elegidas.map((id, i) => ({ nombre: nombreLinea(id), color: COLOR_GUIA[i % COLOR_GUIA.length] })),
            ...(medida !== 'huevo' ? lotesVista.map(id => ({ nombre: lotes.find(l => l.id === id)?.nombre ?? '', color: colorDe(lotes.findIndex(l => l.id === id)) })) : []),
          ]} />
        </>)}
      </PanelDatos>

      <PanelDatos titulo="Lo normal de cada línea y lo que dio cada lote" subtitulo="Guías: lo que publican. Lotes: lo real de todo su ciclo de postura" vistas={['tabla']}>
        {() => (
          <TablaDatos
            columnas={[{ titulo: '' }, { titulo: 'Empieza a poner', numero: true }, { titulo: 'Pico %', numero: true }, { titulo: 'Semana del pico', numero: true },
              { titulo: 'Semanas ≥ 90 %', numero: true }, { titulo: 'g/gallina/día', numero: true }, { titulo: 'Viven (sem. 80) %', numero: true }, { titulo: 'Huevos por gallina', numero: true }]}
            filas={[
              ...elegidas.map(id => {
                const r = tablas.get(id) ? resumenDeGuia(tablas.get(id)!) : null
                return [nombreLinea(id), r?.inicioPostura ?? null, r?.pico ? Math.round(r.pico.pct * 10) / 10 : null, r?.pico?.semana ?? null,
                  r?.semanasSobre90 ?? null, r?.consumoPostura != null ? Math.round(r.consumoPostura) : null,
                  r?.viabilidad[80] != null ? Math.round(r.viabilidad[80]! * 10) / 10 : null,
                  r?.huevosAve[80] != null ? `${Math.round(r.huevosAve[80]!)} (sem. 80)` : null]
              }),
              ...porLote.map(f => [f.lote.nombre,
                f.lote.fecha_inicio_postura ? semanaDeVida(f.lote.fecha_nacimiento, f.lote.fecha_inicio_postura) : null,
                f.pico ? Math.round(f.pico.pct * 10) / 10 : null, f.pico?.semana ?? null, f.semanasSobre90,
                f.gramosAve != null ? Math.round(f.gramosAve) : null,
                f.mortalidadPostura != null ? Math.round((100 - f.mortalidadPostura) * 10) / 10 : null,
                f.huevosAve != null ? `${Math.round(f.huevosAve)} (todo el ciclo)` : null]),
            ]}
          />
        )}
      </PanelDatos>
    </div>
  )
}
