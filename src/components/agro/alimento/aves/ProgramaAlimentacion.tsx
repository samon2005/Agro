'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import { compararConRango, semanaDeVida } from '@/lib/referencias'
import { useReferencia } from '@/lib/useReferencia'
import { useResumenSemanal } from '@/lib/useResumenSemanal'
import {
  alimentoSirveParaFase, cargarFases, faseSugerida, CATEGORIA_FASE_LABEL, CATEGORIAS_ALIMENTO_AVES, type FaseAlimento,
} from '@/lib/programaAlimento'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type TipoAlimento = Database['public']['Tables']['tipos_alimento_aves']['Row']

interface Props {
  lote: LoteAves
  /** Kg al día que come hoy el galpón (el último consumo registrado) */
  consumoKgDia: number | null
  /** El alimento que está comiendo */
  alimento: TipoAlimento | null
}

const g1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
const CATEGORIA_ALIMENTO = Object.fromEntries(CATEGORIAS_ALIMENTO_AVES.map(c => [c.value, c.label]))

/**
 * Qué debería comer el lote a su edad: la fase del programa de su referencia,
 * cuánto se espera que coma por ave y para todo el galpón, y cómo va lo real.
 * Todo son sugerencias de la guía, para revisar con el nutricionista.
 */
export default function ProgramaAlimentacion({ lote, consumoKgDia, alimento }: Props) {
  const ref = useReferencia(lote.referencia_id)
  const [fases, setFases] = useState<{ id: string; lista: FaseAlimento[] } | null>(null)
  const [peso, setPeso] = useState<{ id: string; g: number | null } | null>(null)
  const { filas } = useResumenSemanal(lote)

  useEffect(() => {
    if (!lote.referencia_id) return
    let vigente = true
    const id = lote.referencia_id
    cargarFases(createClient(), id).then(lista => { if (vigente) setFases({ id, lista }) })
    return () => { vigente = false }
  }, [lote.referencia_id])

  useEffect(() => {
    let vigente = true
    const id = lote.id
    createClient().from('pesos_lote_aves').select('peso_promedio_g').eq('lote_id', id).order('fecha', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (vigente) setPeso({ id, g: data ? Number(data.peso_promedio_g) : null }) })
    return () => { vigente = false }
  }, [lote.id])

  const hoy = hoyLocal()
  const vida = semanaDeVida(lote.fecha_nacimiento, hoy)
  const fasesLote = fases && fases.id === lote.referencia_id ? fases.lista : []
  const pesoG = peso && peso.id === lote.id ? peso.g : null
  const enPostura = lote.estado === 'activo'

  if (!lote.referencia_id || !lote.fecha_nacimiento) {
    return (
      <Card>
        <CardContent className="py-3 text-xs text-gray-500">
          <Ic n="meta" /> Para ver el programa de alimentación por edad, indica la edad con que llegaron las aves y su referencia en <strong>Configurar galpón</strong>.
        </CardContent>
      </Card>
    )
  }

  // Lo que la guía espera que coma esta semana de vida
  const filaRef = vida != null ? ref.get(vida) : undefined
  const esperadoMin = filaRef?.consumo_min_g != null ? Number(filaRef.consumo_min_g) : null
  const esperadoMax = filaRef?.consumo_max_g != null ? Number(filaRef.consumo_max_g) : null
  const aves = lote.aves_actuales
  const realG = consumoKgDia != null && consumoKgDia > 0 && aves > 0 ? (consumoKgDia * 1000) / aves : null
  const estado = compararConRango(realG, esperadoMin, esperadoMax, { tolerancia: 8 })
  const kgMin = esperadoMin != null ? (esperadoMin * aves) / 1000 : null
  const kgMax = esperadoMax != null ? (esperadoMax * aves) / 1000 : null

  const sugerida = faseSugerida(fasesLote, {
    vida,
    enPostura,
    fechaNacimiento: lote.fecha_nacimiento,
    posturas: filas.filter(f => f.etapa === 'postura').map(f => f.posturaPct),
    pesoG,
  })
  const sirve = sugerida && alimento ? alimentoSirveParaFase(alimento.tipo_alimento_categoria, sugerida.fase.categoria) : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700"><Ic n="meta" /> Programa de alimentación</CardTitle>
        <p className="text-xs text-gray-400">
          Semana {vida ?? '—'} de vida · según la referencia del galpón. Son sugerencias de la guía: confírmalas con tu nutricionista.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Fase que le corresponde</p>
          {sugerida ? (
            <>
              <p className="font-semibold text-gray-800">{sugerida.fase.nombre}</p>
              <p className="text-xs text-gray-500">
                {sugerida.por === 'edad'
                  ? `Semanas ${sugerida.fase.desde_semana}–${sugerida.fase.hasta_semana ?? '…'} de vida`
                  : sugerida.por === 'pico'
                    ? 'La postura sigue cerca de su pico'
                    : 'Por la postura de la última semana'}
              </p>
              {sugerida.fase.notas && <p className="mt-1 text-xs text-gray-400">{sugerida.fase.notas}</p>}
            </>
          ) : (
            <p className="text-xs text-gray-500">
              {fasesLote.length === 0
                ? 'La referencia no trae fases de alimentación. Puedes agregarlas en una copia de la finca (Configurar galpón → Ver tabla).'
                : enPostura ? 'Todavía no hay postura registrada para ubicar la fase.' : 'Sin edad para ubicar la fase.'}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Consumo esperado</p>
          {esperadoMin != null ? (
            <>
              <p className="font-semibold text-gray-800">
                {esperadoMax != null && esperadoMax !== esperadoMin ? `${g1(esperadoMin)}–${g1(esperadoMax)}` : g1(esperadoMin)} g/ave/día
              </p>
              <p className="text-xs text-gray-500">
                {kgMin != null && `${g1(kgMin)}${kgMax != null && kgMax !== kgMin ? `–${g1(kgMax)}` : ''} kg/día para ${aves.toLocaleString('es-CO')} aves`}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">La guía no da consumo para esta semana.</p>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Consumo real</p>
          {realG != null ? (
            <>
              <p className={cn('font-semibold', estado === 'ok' ? 'text-green-700' : estado === 'atento' ? 'text-amber-600' : estado === 'alerta' ? 'text-red-600' : 'text-gray-800')}>
                {g1(realG)} g/ave/día
              </p>
              <p className="text-xs text-gray-500">
                {estado === 'ok' ? 'Dentro de lo esperado'
                  : estado == null ? `${g1(consumoKgDia!)} kg/día`
                  : realG < (esperadoMin ?? 0) ? 'Come menos de lo esperado: revisar comederos, agua, calor o salud'
                  : 'Come más de lo esperado: revisar desperdicio, frío o el alimento'}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">Registra el consumo del galpón para compararlo.</p>
          )}
        </div>

        {(sugerida?.notaPeso || (sugerida?.siguiente && sugerida.cambioDesde) || sirve === false) && (
          <div className="space-y-1 text-xs sm:col-span-3">
            {sirve === false && alimento && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                <Ic n="aviso" /> Está comiendo <strong>{alimento.nombre}</strong> ({CATEGORIA_ALIMENTO[alimento.tipo_alimento_categoria ?? ''] ?? 'sin fase'}),
                pero a esta edad le corresponde {CATEGORIA_FASE_LABEL[sugerida!.fase.categoria].toLowerCase()}. Posible cambio de alimento.
              </p>
            )}
            {sugerida?.notaPeso && <p className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800"><Ic n="bascula" /> {sugerida.notaPeso}</p>}
            {sugerida?.siguiente && sugerida.cambioDesde && (
              <p className="text-gray-500">
                Siguiente: <strong>{sugerida.siguiente.nombre}</strong> desde el {fmt(sugerida.cambioDesde)}
                {sugerida.cambioDesde <= hoy ? ' (ya le toca)' : ''}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
