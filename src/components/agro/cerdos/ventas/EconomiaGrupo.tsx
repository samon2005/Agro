'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal } from '@/lib/fechas'
import { economiaGrupo, repartirCosto } from '@/lib/dineroCerdos'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']

const cop = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const dias = (a: string, b: string) => Math.max(0, Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000))

interface Datos {
  costoPropio: number
  alimento: number
  comun: number
  ingresos: number
  vendidos: number
  kgVendidos: number
  pesoActual: number | null
}

/**
 * La plata del grupo (José: "menor costo por kg producido"): sus costos, el
 * alimento, su parte de los gastos comunes de la finca (repartidos por
 * animales-día), lo que entró por ventas, el costo por kg, el margen por cerdo y
 * el precio de equilibrio. Las cuentas están en lib/dineroCerdos.
 */
export default function EconomiaGrupo({ lote }: { lote: LoteCerdos }) {
  const [d, setD] = useState<Datos | null>(null)

  useEffect(() => {
    let vigente = true
    const s = createClient()
    const hoy = hoyLocal()
    Promise.all([
      s.from('costos_lote_cerdos').select('lote_id, monto, fecha').eq('finca_id', lote.finca_id),
      s.from('nutricion_diaria_cerdos').select('costo_alimento').eq('lote_id', lote.id),
      s.from('ventas_cerdos').select('cantidad, valor_total, peso_total_kg').eq('lote_id', lote.id),
      s.from('pesos_lote_cerdos').select('peso_promedio, fecha').eq('lote_id', lote.id).order('fecha', { ascending: false }).limit(1),
      s.from('lotes_cerdos').select('id, fecha_ingreso, numero_animales, animales_actuales, estado').eq('finca_id', lote.finca_id),
    ]).then(([c, n, v, p, l]) => {
      if (!vigente) return
      const costos = c.data ?? []
      const propio = costos.filter(x => x.lote_id === lote.id).reduce((t, x) => t + Number(x.monto), 0)
      // Gastos comunes (sin grupo): a cada grupo le toca según sus animales-día desde su ingreso
      const comunes = costos.filter(x => !x.lote_id).reduce((t, x) => t + Number(x.monto), 0)
      const grupos = (l.data ?? []).map(g => ({ id: g.id, animalesDia: ((g.numero_animales + g.animales_actuales) / 2) * dias(g.fecha_ingreso, hoy) }))
      const comun = repartirCosto(comunes, grupos).get(lote.id) ?? 0
      setD({
        costoPropio: propio,
        alimento: (n.data ?? []).reduce((t, x) => t + Number(x.costo_alimento ?? 0), 0),
        comun,
        ingresos: (v.data ?? []).reduce((t, x) => t + Number(x.valor_total ?? 0), 0),
        vendidos: (v.data ?? []).reduce((t, x) => t + x.cantidad, 0),
        kgVendidos: (v.data ?? []).reduce((t, x) => t + Number(x.peso_total_kg ?? 0), 0),
        pesoActual: p.data?.[0] ? Number(p.data[0].peso_promedio) : null,
      })
    })
    return () => { vigente = false }
  }, [lote.id, lote.finca_id])

  if (!d) return null
  const costoTotal = d.costoPropio + d.alimento + d.comun
  const pesoInicial = Number(lote.peso_promedio_inicial ?? 0)
  // Kilos producidos: lo que salió vendido más lo que hay hoy, menos con lo que entraron
  const kgHoy = d.pesoActual != null ? d.pesoActual * lote.animales_actuales : 0
  const kgProducidos = Math.max(0, d.kgVendidos + kgHoy - pesoInicial * lote.numero_animales)
  const e = economiaGrupo({ costoTotal, ingresos: d.ingresos, kgProducidos, cerdosVendidos: d.vendidos })

  const caja = (t: string, v: string, n?: string) => (
    <div>
      <p className="text-xs text-gray-500">{t}</p>
      <p className="text-lg font-semibold text-gray-900">{v}</p>
      {n && <p className="text-[0.6875rem] text-gray-500">{n}</p>}
    </div>
  )
  return (
    <div className="superficie space-y-3 rounded-2xl p-4">
      <p className="text-sm font-semibold text-gray-800">Economía del grupo</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {caja('Costos', cop(costoTotal), `propios ${cop(d.costoPropio)} · alimento ${cop(d.alimento)} · comunes ${cop(d.comun)}`)}
        {caja('Ingresos por ventas', cop(d.ingresos), `${d.vendidos} cerdos vendidos`)}
        {caja('Costo por kg producido', e.costoKg != null ? cop(e.costoKg) : '—', `${kgProducidos.toLocaleString('es-CO', { maximumFractionDigits: 0 })} kg producidos`)}
        {caja('Margen por cerdo vendido', e.margenCerdo != null ? cop(e.margenCerdo) : '—', `utilidad ${cop(e.utilidad)}`)}
      </div>
      <p className="text-xs text-gray-500">
        {e.precioEquilibrioKg != null
          ? <>Para no perder hay que vender a más de <strong>{cop(e.precioEquilibrioKg)}</strong> por kg producido (punto de equilibrio). </>
          : 'Con costos y pesajes sale el costo por kg y el punto de equilibrio. '}
        Los gastos comunes de la finca se reparten según los animales y los días de cada grupo; el profesor puede definir otra forma.
      </p>
    </div>
  )
}
