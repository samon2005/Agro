'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { aFechaLocal, hoyLocal } from '@/lib/fechas'
import { semanaDeVida } from '@/lib/referencias'
import { useReferencia } from '@/lib/useReferencia'
import { useResumenSemanal } from '@/lib/useResumenSemanal'
import { diagnosticar, type DiaCalidad, type LecturaAmbiental } from '@/lib/diagnostico'
import { cargarVeterinarios, type VeterinarioConHistorial } from '@/lib/veterinarios'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Datos {
  loteId: string
  dias: DiaCalidad[]
  peso: { fecha: string; g: number } | null
  ambiental: LecturaAmbiental | null
  vets: VeterinarioConHistorial[]
}

const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * Lo que se salió de lo esperado en el galpón y qué podría estar pasando. Solo
 * aparece cuando hay algo: son sugerencias para revisar, nunca un diagnóstico.
 */
export default function SugerenciasLote({ lote, version }: { lote: LoteAves; version?: string | number }) {
  const ref = useReferencia(lote.referencia_id)
  const { filas, cargando } = useResumenSemanal(lote, undefined, version)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    const hace7 = new Date(); hace7.setDate(hace7.getDate() - 6)
    Promise.all([
      supabase.from('produccion_diaria_aves').select('fecha, huevos_totales, huevos_rotos, huevos_sucios, huevos_deformes')
        .eq('lote_id', lote.id).gte('fecha', aFechaLocal(hace7)),
      supabase.from('pesos_lote_aves').select('fecha, peso_promedio_g').eq('lote_id', lote.id).order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('parametros_ambientales_aves').select('fecha, temperatura_interior, humedad_interior, nh3_ppm, co2_ppm')
        .eq('lote_id', lote.id).order('fecha', { ascending: false }).limit(1).maybeSingle(),
      cargarVeterinarios(supabase, lote.finca_id),
    ]).then(([prod, peso, amb, vets]) => {
      if (!vigente) return
      setDatos({
        loteId: lote.id,
        dias: (prod.data ?? []) as DiaCalidad[],
        peso: peso.data ? { fecha: peso.data.fecha, g: Number(peso.data.peso_promedio_g) } : null,
        ambiental: amb.data as LecturaAmbiental | null,
        vets: vets.filter(v => v.activo),
      })
    })
    return () => { vigente = false }
  }, [lote.id, lote.finca_id, version])

  if (cargando || !datos || datos.loteId !== lote.id) return null

  const sugerencias = diagnosticar({
    dias: datos.dias,
    semanas: filas,
    ref,
    vidaDe: f => semanaDeVida(lote.fecha_nacimiento, f),
    semanaEntrada: semanaDeVida(lote.fecha_nacimiento, lote.fecha_inicio),
    pesoUltimo: datos.peso,
    ambiental: datos.ambiental,
    hoy: hoyLocal(),
  })
  if (sugerencias.length === 0) return null

  // Los veterinarios que más han atendido la finca, primero
  const vets = [...datos.vets].sort((a, b) => b.casos.length - a.casos.length)
  const pideVet = sugerencias.some(s => s.veterinario)

  return (
    <Card className="border-amber-200">
      <CardContent className="space-y-2 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800"><Ic n="idea" /> Sugerencias para revisar</p>
          <p className="text-[0.6875rem] text-gray-400">Posibles causas según las guías: no son un diagnóstico. Confírmalo con un veterinario.</p>
        </div>
        {sugerencias.map(s => {
          const abiertaEsta = abierta === s.id
          return (
            <div key={s.id} className={cn('rounded-lg border px-3 py-2', s.nivel === 'alerta' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/50')}>
              <button type="button" onClick={() => setAbierta(abiertaEsta ? null : s.id)} className="flex w-full items-start justify-between gap-2 text-left">
                <span>
                  <span className={cn('text-sm font-medium', s.nivel === 'alerta' ? 'text-red-800' : 'text-amber-900')}>{s.titulo}</span>
                  <span className="block text-xs text-gray-600">{s.observado}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-500">{abiertaEsta ? 'Ocultar' : 'Posibles causas'}</span>
              </button>
              {abiertaEsta && (
                <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-medium text-gray-700">Podría deberse a</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-gray-600">{s.causas.map(c => <li key={c}>{c}</li>)}</ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Qué revisar</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-gray-600">{s.acciones.map(a => <li key={a}>{a}</li>)}</ul>
                  </div>
                  <p className="text-[0.6875rem] text-gray-400 sm:col-span-2">Fuente: {s.fuente}</p>
                </div>
              )}
            </div>
          )
        })}
        {pideVet && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <Ic n="hospital" /> <strong>Veterinarios de la finca</strong>
            {vets.length === 0 ? (
              <span> · Todavía no hay ninguno: agrégalos en Sanitario → Veterinarios para tenerlos a la mano con su historial.</span>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {vets.slice(0, 3).map(v => (
                  <li key={v.id}>
                    {v.nombre}{v.especialidad ? ` · ${v.especialidad}` : ''}
                    {' · '}{v.casos.length} caso{v.casos.length === 1 ? '' : 's'} atendido{v.casos.length === 1 ? '' : 's'}
                    {v.casos[0] ? ` (último el ${fechaCorta(v.casos[0].fecha)})` : ''}
                    {v.telefono && <> · <a href={`tel:${v.telefono}`} className="text-green-700 underline">{v.telefono}</a></>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
