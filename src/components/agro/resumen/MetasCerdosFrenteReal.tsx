'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Widget, ANCHO } from '@/components/ui/widgets/Widget'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import { useConfigCerdos } from '@/lib/useConfigCerdos'
import { sumarDias } from '@/lib/cierreSemanal'
import {
  destetadosCerdaAno, destetadosPorParto, frenteAMeta, kgDestetadosCerdaAno, mortalidadPredestetePct, nacidosVivosPorParto,
  partosCerdaAno, tasaPartoPct, type DesteteInd, type EstadoIndicador, type PartoInd, type ServicioInd,
} from '@/lib/indicadoresCerdos'

const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const COLOR: Record<EstadoIndicador, string> = { bien: 'text-green-700', revisar: 'text-amber-700', mal: 'text-red-700' }
const TEXTO: Record<EstadoIndicador, string> = { bien: 'en la meta', revisar: 'cerca', mal: 'lejos' }

/**
 * La tabla base de una granja de cerdos: las metas que puso en Parámetros frente
 * a lo real de los últimos 12 meses. Fórmulas en lib/indicadoresCerdos.
 */
export default function MetasCerdosFrenteReal({ fincaId }: { fincaId: string }) {
  const cfg = useConfigCerdos()
  const [d, setD] = useState<{ fincaId: string; servicios: ServicioInd[]; partos: PartoInd[]; destetes: DesteteInd[] } | null>(null)

  useEffect(() => {
    let vigente = true
    const s = createClient()
    const desde = sumarDias(hoyLocal(), -365)
    Promise.all([
      s.from('servicios_cerdos').select('id, reproductora_id, fecha_servicio, estado').eq('finca_id', fincaId).gte('fecha_servicio', desde),
      s.from('partos_cerdos').select('id, reproductora_id, fecha_parto, nacidos_vivos, nacidos_muertos, momificados').eq('finca_id', fincaId).gte('fecha_parto', desde),
      s.from('destetes_cerdos').select('reproductora_id, parto_id, fecha_destete, lechones_destetados, peso_promedio_kg').eq('finca_id', fincaId).gte('fecha_destete', desde),
    ]).then(([sv, pa, de]) => {
      if (vigente) setD({ fincaId, servicios: (sv.data ?? []) as ServicioInd[], partos: (pa.data ?? []) as PartoInd[], destetes: (de.data ?? []) as DesteteInd[] })
    })
    return () => { vigente = false }
  }, [fincaId])

  if (!d || d.fincaId !== fincaId) return null
  const partosAno = partosCerdaAno(d.partos, cfg)
  const destAno = destetadosCerdaAno(partosAno.valor, destetadosPorParto(d.destetes))
  const filas: { nombre: string; real: number | null; meta: number | null; mayorEsMejor: boolean; fmt: (v: number) => string; nota?: string }[] = [
    { nombre: 'Partos por cerda al año', real: partosAno.valor, meta: cfg.metas.partosCerdaAno, mayorEsMejor: true, fmt: n1, nota: partosAno.estimado ? 'estimado con el ciclo de la granja' : undefined },
    { nombre: 'Nacidos vivos por parto', real: nacidosVivosPorParto(d.partos), meta: cfg.metas.nacidosVivosParto, mayorEsMejor: true, fmt: n1 },
    { nombre: 'Mortalidad antes del destete', real: mortalidadPredestetePct(d.partos, d.destetes), meta: cfg.metas.mortalidadPredestetePct, mayorEsMejor: false, fmt: v => `${n1(v)} %` },
    { nombre: 'Destetados por cerda al año', real: destAno, meta: cfg.metas.destetadosCerdaAno, mayorEsMejor: true, fmt: n1 },
    { nombre: 'Kg destetados por cerda al año', real: kgDestetadosCerdaAno(destAno, d.destetes), meta: cfg.metas.kgDestetadosCerdaAno, mayorEsMejor: true, fmt: v => `${Math.round(v)} kg` },
    { nombre: 'Tasa de parto', real: tasaPartoPct(d.servicios, cfg, hoyLocal()), meta: cfg.metas.tasaPartoPct, mayorEsMejor: true, fmt: v => `${n1(v)} %` },
  ]

  return (
    <Widget className={ANCHO.todo} titulo="Metas de la granja frente a lo real" icono="meta"
      info="Las metas se ponen en Naves → Parámetros. Lo real es de los últimos 12 meses">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {filas.map(f => {
          const e = frenteAMeta(f.real, f.meta, f.mayorEsMejor)
          return (
            <div key={f.nombre}>
              <p className="text-xs text-gray-500">{f.nombre}</p>
              <p className="text-lg font-semibold tabular-nums">
                {f.real != null ? f.fmt(f.real) : '—'}
                <span className="ml-1.5 text-xs font-normal text-gray-400">meta {f.meta != null ? f.fmt(f.meta) : '—'}</span>
              </p>
              <p className={cn('text-[0.6875rem] font-medium', e ? COLOR[e] : 'text-gray-400')}>
                {e ? TEXTO[e] : 'sin datos todavía'}{f.nota ? <span className="font-normal text-gray-400"> · {f.nota}</span> : null}
              </p>
            </div>
          )
        })}
      </div>
    </Widget>
  )
}
