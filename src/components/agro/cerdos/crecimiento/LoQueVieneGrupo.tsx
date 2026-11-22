'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import { sumarDias } from '@/lib/cierreSemanal'
import { proyeccionGrupo, resumenPesaje } from '@/lib/engordeCerdos'
import type { ConfigCerdos, EtapaEngorde } from '@/lib/configCerdos'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type PesoLote = Database['public']['Tables']['pesos_lote_cerdos']['Row']

const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

/**
 * Lo que viene para el grupo (José: "predecir lo que se viene"): el peso de hoy
 * según su ganancia, cuándo llega al peso de salida de la etapa, la fecha
 * programada del cambio de etapa y la uniformidad del último pesaje.
 * Es una sugerencia que se corrige con cada pesaje (lib/engordeCerdos).
 */
export default function LoQueVieneGrupo({ lote, pesos, cfg, onCambio }: {
  lote: LoteCerdos; pesos: PesoLote[]; cfg: ConfigCerdos; onCambio: () => void
}) {
  const hoy = hoyLocal()
  const etapa = cfg.engorde[lote.etapa_actual as EtapaEngorde]
  const [fecha, setFecha] = useState(lote.proximo_cambio_etapa ?? '')
  if (!etapa) return null

  const proy = proyeccionGrupo({
    pesajes: pesos.map(p => ({ fecha: p.fecha, peso_promedio: Number(p.peso_promedio) })),
    inicio: { fecha: lote.fecha_ingreso, peso: lote.peso_promedio_inicial != null ? Number(lote.peso_promedio_inicial) : null },
    pesoObjetivo: etapa.pesoSalida,
    hoy,
  })
  const porDias = etapa.dias ? sumarDias(lote.fecha_ingreso, etapa.dias) : null
  const ultimo = [...pesos].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const unif = ultimo?.pesos_individuales?.length ? resumenPesaje(ultimo.pesos_individuales.map(Number)) : null
  const sugerida = proy?.fechaObjetivo ?? porDias

  async function guardar(valor: string) {
    const { error } = await createClient().from('lotes_cerdos').update({ proximo_cambio_etapa: valor || null }).eq('id', lote.id)
    if (error) { toast.error('No se pudo guardar la fecha'); return }
    setFecha(valor)
    toast.success(valor ? `Cambio de etapa programado para el ${fmt(valor)}` : 'Fecha quitada')
    onCambio()
  }

  const vencido = fecha && fecha < hoy
  return (
    <div className="superficie grid gap-3 rounded-2xl p-4 md:grid-cols-3">
      <div>
        <p className="text-xs font-medium text-gray-500">Peso estimado hoy</p>
        <p className="text-xl font-semibold text-gray-900">{proy ? `${proy.pesoHoy.toFixed(1)} kg` : '—'}</p>
        <p className="text-xs text-gray-500">
          {proy ? `Gana ${(proy.gdp * 1000).toFixed(0)} g/día según los últimos pesajes` : 'Hacen falta pesajes para proyectar'}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">Llega a {etapa.pesoSalida} kg (salida de {lote.etapa_actual})</p>
        <p className="text-xl font-semibold text-gray-900">{proy?.fechaObjetivo ? (proy.diasFaltan === 0 ? 'Ya llegó' : fmt(proy.fechaObjetivo)) : porDias ? fmt(porDias) : '—'}</p>
        <p className="text-xs text-gray-500">
          {proy?.diasFaltan ? `En unos ${proy.diasFaltan} días, si sigue ganando igual` : porDias ? `Por los ${etapa.dias} días de la etapa` : 'Sin datos para estimar'}
          {unif && <> · uniformidad del último pesaje <strong className={unif.uniformidadPct >= 80 ? 'text-green-800' : 'text-amber-700'}>{unif.uniformidadPct.toFixed(0)} %</strong></>}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">Cambio de etapa programado</p>
        <div className="mt-1 flex items-center gap-1.5">
          <Input type="date" className="h-8 w-40" value={fecha} onChange={e => guardar(e.target.value)} />
          {!fecha && sugerida && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => guardar(sugerida)}>Usar {fmt(sugerida)}</Button>
          )}
        </div>
        <p className={`text-xs ${vencido ? 'text-red-700' : 'text-gray-500'}`}>
          {vencido ? <><Ic n="alerta" /> La fecha ya pasó: mueve el grupo o cambia la fecha.</> : 'Se puede adelantar o atrasar según el peso. El grupo cambia de corral.'}
        </p>
      </div>
    </div>
  )
}
