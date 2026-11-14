'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Widget, ANCHO } from '@/components/ui/widgets/Widget'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { aFechaLocal } from '@/lib/fechas'
import { cargarReferencia, semanaDeVida, type FilaReferencia } from '@/lib/referencias'
import { metaDeFecha, type LoteConMeta } from '@/lib/metasPostura'

/** Un día registrado de un galpón (lo que ya trae el Resumen). */
export interface DiaCierre {
  fecha: string; lote: string; huevos: number; aves: number | null; muertes: number; alimentoKg: number
  rotos?: number; sucios?: number; podridos?: number
}
export interface LoteCierre extends LoteConMeta { id: string; nombre: string; referencia_id: string | null }

const MS_DIA = 86_400_000
const sumar = (f: string, n: number) => aFechaLocal(new Date(new Date(f + 'T00:00:00').getTime() + n * MS_DIA))
/** El lunes de la semana de una fecha. */
const lunesDe = (f: string) => sumar(f, -((new Date(f + 'T00:00:00').getDay() + 6) % 7))
const corta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })

/**
 * El cierre de una semana (lunes a domingo) por galpón: huevos, postura frente a
 * la meta de esa semana, mortalidad, alimento por ave y huevo roto o sucio.
 * Por defecto muestra la última semana completa.
 */
export default function CierreSemanal({ lotes, dias, hoy }: { lotes: LoteCierre[]; dias: DiaCierre[]; hoy: string }) {
  const lunesActual = lunesDe(hoy)
  const semanas = Array.from({ length: 8 }, (_, i) => sumar(lunesActual, -7 * i))
  const [lunes, setLunes] = useState(semanas[1])
  const domingo = sumar(lunes, 6)
  const enCurso = lunes === lunesActual

  // La guía de cada línea, para la meta de las semanas sin meta propia
  const [guias, setGuias] = useState<Map<string, Map<number, FilaReferencia>>>(new Map())
  const refs = [...new Set(lotes.map(l => l.referencia_id).filter((x): x is string => Boolean(x)))].sort().join(',')
  useEffect(() => {
    if (!refs) return
    let vigente = true
    const supabase = createClient()
    Promise.all(refs.split(',').map(async id => [id, await cargarReferencia(supabase, id)] as const))
      .then(lista => { if (vigente) setGuias(new Map(lista)) })
    return () => { vigente = false }
  }, [refs])

  const filas = lotes.map(l => {
    const delLote = dias.filter(d => d.lote === l.id && d.fecha >= lunes && d.fecha <= domingo)
    const huevos = delLote.reduce((s, d) => s + d.huevos, 0)
    const avesDias = delLote.reduce((s, d) => s + (d.aves ?? 0), 0)
    const postura = avesDias > 0 ? (huevos / avesDias) * 100 : null
    const guia = l.referencia_id ? guias.get(l.referencia_id) : undefined
    // La meta de la semana, día a día (por si la semana de vida cambia a mitad de semana)
    const metas = delLote.map(d => metaDeFecha(l, d.fecha, guia)?.pct).filter((x): x is number => x != null)
    const meta = metas.length > 0 ? metas.reduce((s, x) => s + x, 0) / metas.length
      : metaDeFecha(l, lunes, guia)?.pct ?? null
    const muertes = delLote.reduce((s, d) => s + d.muertes, 0)
    const avesInicio = delLote.length > 0 ? ([...delLote].sort((a, b) => a.fecha.localeCompare(b.fecha))[0].aves ?? null) : null
    const alimentoG = avesDias > 0 ? (delLote.reduce((s, d) => s + d.alimentoKg, 0) * 1000) / avesDias : null
    const malos = delLote.reduce((s, d) => s + (d.rotos ?? 0) + (d.sucios ?? 0) + (d.podridos ?? 0), 0)
    return {
      lote: l, registrados: delLote.length, huevos, postura, meta,
      diferencia: postura != null && meta != null ? postura - meta : null,
      muertes, mortalidad: avesInicio ? (muertes / avesInicio) * 100 : null,
      alimentoG, malosPct: huevos > 0 ? (malos / huevos) * 100 : null,
      semanaVida: semanaDeVida(l.fecha_nacimiento, lunes),
    }
  })
  const total = {
    huevos: filas.reduce((s, f) => s + f.huevos, 0),
    muertes: filas.reduce((s, f) => s + f.muertes, 0),
  }
  const diasSemana = enCurso ? Math.max(1, Math.round((new Date(hoy + 'T00:00:00').getTime() - new Date(lunes + 'T00:00:00').getTime()) / MS_DIA) + 1) : 7

  return (
    <Widget className={ANCHO.todo} titulo="Cierre de la semana" icono="diario"
      info="Semana de lunes a domingo. La meta es la de cada galpón para esa semana de vida: la propia, la de la guía de la línea o la de pico"
      accion={
        <select value={lunes} onChange={e => setLunes(e.target.value)}
          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700" aria-label="Semana">
          {semanas.map((s, i) => (
            <option key={s} value={s}>{i === 0 ? 'Esta semana (en curso)' : `${corta(s)} – ${corta(sumar(s, 6))}`}</option>
          ))}
        </select>
      }>
      {lotes.length === 0 ? (
        <p className="text-sm text-gray-400">Sin galpones en postura.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Galpón</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Huevos</TableHead>
                <TableHead className="text-right">Postura</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">Muertes</TableHead>
                <TableHead className="text-right">Alimento</TableHead>
                <TableHead className="text-right">Rotos, sucios y podridos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(f => (
                <TableRow key={f.lote.id}>
                  <TableCell className="text-sm font-medium">
                    {f.lote.nombre}
                    {f.semanaVida != null && <span className="block text-[0.6875rem] font-normal text-gray-400">semana {f.semanaVida} de vida</span>}
                  </TableCell>
                  <TableCell className={cn('text-right text-sm tabular-nums', f.registrados < diasSemana ? 'text-amber-700' : 'text-gray-600')}>
                    {f.registrados} de {diasSemana}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{f.huevos.toLocaleString('es-CO')}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{f.postura != null ? `${n1(f.postura)} %` : '—'}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-gray-500">{f.meta != null ? `${n1(f.meta)} %` : '—'}</TableCell>
                  <TableCell className={cn('text-right text-sm font-medium tabular-nums',
                    f.diferencia == null ? 'text-gray-400' : f.diferencia >= 0 ? 'text-green-700' : f.diferencia > -5 ? 'text-amber-700' : 'text-red-700')}>
                    {f.diferencia == null ? '—' : `${f.diferencia >= 0 ? '+' : ''}${n1(f.diferencia)} pts`}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {f.muertes.toLocaleString('es-CO')}
                    {f.mortalidad != null && f.muertes > 0 && <span className="block text-[0.6875rem] text-gray-400">{n1(f.mortalidad)} %</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{f.alimentoG != null ? `${Math.round(f.alimentoG)} g/ave` : '—'}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{f.malosPct != null ? `${n1(f.malosPct)} %` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-gray-500">
            {corta(lunes)} – {corta(domingo)}{enCurso ? ' (en curso)' : ''} · {total.huevos.toLocaleString('es-CO')} huevos en la finca · {total.muertes.toLocaleString('es-CO')} {total.muertes === 1 ? 'muerte' : 'muertes'}
          </p>
        </div>
      )}
    </Widget>
  )
}
