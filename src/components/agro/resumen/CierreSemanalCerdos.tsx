'use client'

import TareasDeLaSemana from './TareasDeLaSemana'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Widget, ANCHO } from '@/components/ui/widgets/Widget'
import { cn } from '@/lib/utils'
import { sumarDias, totalesCerdos, ultimasSemanas, type MovimientosCerdos, type TotalesCerdos } from '@/lib/cierreSemanal'

const corta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })

/**
 * El cierre de la semana de una granja de cerdos: servicios, partos, nacidos,
 * destetes, muertes y alimento, frente a la semana anterior. Las cuentas están
 * en lib/cierreSemanal.
 */
export default function CierreSemanalCerdos({ fincaId, hoy }: { fincaId: string; hoy: string }) {
  const semanas = ultimasSemanas(hoy, 8)
  const [lunes, setLunes] = useState(semanas[1])
  const [m, setM] = useState<{ fincaId: string; m: MovimientosCerdos } | null>(null)

  useEffect(() => {
    let vigente = true
    const s = createClient()
    const desde = sumarDias(semanas[semanas.length - 1], -7)
    Promise.all([
      s.from('servicios_cerdos').select('fecha_servicio').eq('finca_id', fincaId).gte('fecha_servicio', desde),
      s.from('partos_cerdos').select('fecha_parto, nacidos_vivos, nacidos_muertos, momificados, muertos_postparto').eq('finca_id', fincaId).gte('fecha_parto', desde),
      s.from('destetes_cerdos').select('fecha_destete, lechones_destetados, peso_promedio_kg').eq('finca_id', fincaId).gte('fecha_destete', desde),
      s.from('mortalidad_cerdos').select('fecha, cantidad').eq('finca_id', fincaId).gte('fecha', desde),
      s.from('nutricion_diaria_cerdos').select('fecha, alimento_kg, consumo_real_kg').eq('finca_id', fincaId).gte('fecha', desde),
    ]).then(([sv, pa, de, mo, al]) => {
      if (!vigente) return
      setM({ fincaId, m: {
        servicios: sv.data ?? [], partos: pa.data ?? [], destetes: de.data ?? [], mortalidad: mo.data ?? [],
        alimento: (al.data ?? []).map(a => ({ fecha: a.fecha, kg: Number(a.consumo_real_kg ?? a.alimento_kg ?? 0) })),
      } })
    })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId])

  if (!m || m.fincaId !== fincaId) return null
  const t = totalesCerdos(m.m, lunes, sumarDias(lunes, 6))
  const a = totalesCerdos(m.m, sumarDias(lunes, -7), sumarDias(lunes, -1))

  const datos: { etiqueta: string; v: (x: TotalesCerdos) => number | null; fmt?: (v: number) => string; subirEsBueno?: boolean }[] = [
    { etiqueta: 'Servicios', v: x => x.servicios },
    { etiqueta: 'Partos', v: x => x.partos },
    { etiqueta: 'Nacidos vivos', v: x => x.nacidosVivos },
    { etiqueta: 'Vivos por parto', v: x => x.vivosPorParto, fmt: n1 },
    { etiqueta: 'Muertos después del parto', v: x => x.muertosPostparto, subirEsBueno: false },
    { etiqueta: 'Destetados', v: x => x.destetados },
    { etiqueta: 'Peso al destete', v: x => x.pesoDestete, fmt: v => `${n1(v)} kg` },
    { etiqueta: 'Muertes (corrales)', v: x => x.muertes, subirEsBueno: false },
    { etiqueta: 'Alimento', v: x => x.alimentoKg, fmt: v => `${Math.round(v).toLocaleString('es-CO')} kg` },
  ]

  return (
    <Widget className={ANCHO.todo} titulo="Cierre de la semana" icono="diario" info="Semana de lunes a domingo de toda la granja, frente a la semana anterior"
      accion={
        <select value={lunes} onChange={e => setLunes(e.target.value)} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700" aria-label="Semana">
          {semanas.map((s, i) => <option key={s} value={s}>{i === 0 ? 'Esta semana (en curso)' : `${corta(s)} – ${corta(sumarDias(s, 6))}`}</option>)}
        </select>
      }>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {datos.map(d => {
          const ahora = d.v(t), antes = d.v(a)
          const fmt = d.fmt ?? ((v: number) => v.toLocaleString('es-CO'))
          const cambio = ahora != null && antes != null ? ahora - antes : null
          const bueno = cambio != null && cambio !== 0 ? (cambio > 0) === (d.subirEsBueno ?? true) : null
          return (
            <div key={d.etiqueta}>
              <p className="text-xs text-gray-500">{d.etiqueta}</p>
              <p className="text-lg font-semibold tabular-nums">{ahora != null ? fmt(ahora) : '—'}</p>
              {cambio != null && cambio !== 0 && (
                <p className={cn('text-[0.6875rem] font-medium', bueno ? 'text-green-700' : 'text-red-700')}>
                  {cambio > 0 ? '+' : '−'}{fmt(Math.abs(cambio))} frente a la anterior
                </p>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">{corta(lunes)} – {corta(sumarDias(lunes, 6))}</p>
      <div className="mt-1"><TareasDeLaSemana fincaId={fincaId} lunes={lunes} hoy={hoy} /></div>
    </Widget>
  )
}
