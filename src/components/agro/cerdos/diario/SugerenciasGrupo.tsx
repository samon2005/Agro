'use client'

import { Ic } from '@/components/ui/icon'
import { gananciaReciente, resumenPesaje } from '@/lib/engordeCerdos'
import { impactoTemperatura, sugerenciasGrupo } from '@/lib/prediccionCerdos'
import type { ConfigCerdos, EtapaEngorde, GrupoAnimal } from '@/lib/configCerdos'

interface Registro { fecha: string; consumo_real_kg: number | null; alimento_kg: number; temperatura_c?: number | null }

/**
 * Acompañamiento (José: "acompañar cuando la producción esté disminuida por
 * factores que la misma app está midiendo"): sugerencias de la literatura según
 * la ganancia, la conversión, la uniformidad, la mortalidad y la temperatura, y
 * cuánto cambió lo que comen los días fuera de la temperatura de confort.
 */
export default function SugerenciasGrupo({ lote, registros, mortalidad, pesajes, cfg, hoy, consumoBajo }: {
  lote: { etapa_actual: string; fecha_ingreso: string; peso_promedio_inicial: number | null; animales_actuales: number }
  registros: Registro[]
  mortalidad: { fecha: string; cantidad: number }[]
  pesajes: { fecha: string; peso_promedio: number; pesos_individuales?: number[] | null }[]
  cfg: ConfigCerdos
  hoy: string
  consumoBajo: boolean
}) {
  const etapa = (['precebo', 'levante', 'ceba'] as const).includes(lote.etapa_actual as EtapaEngorde) ? lote.etapa_actual as EtapaEngorde : null
  const grupo: GrupoAnimal = etapa ?? 'gestacion'
  const rango = cfg.alertas.temperatura[grupo]
  const impacto = impactoTemperatura(registros.slice(0, 30), rango)

  const gdp = gananciaReciente(pesajes, { fecha: lote.fecha_ingreso, peso: lote.peso_promedio_inicial })
  const e = etapa ? cfg.engorde[etapa] : null
  const gdpEsperada = e?.dias ? (e.pesoSalida - e.pesoEntrada) / e.dias : null
  // Conversión entre el primer y el último pesaje con lo que comieron en ese tiempo
  const orden = [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let conversion: number | null = null
  if (orden.length >= 2) {
    const ini = orden[0], fin = orden[orden.length - 1]
    const comido = registros.filter(r => r.fecha > ini.fecha && r.fecha <= fin.fecha).reduce((t, r) => t + Number(r.consumo_real_kg ?? r.alimento_kg ?? 0), 0)
    const ganado = (fin.peso_promedio - ini.peso_promedio) * lote.animales_actuales
    conversion = ganado > 0 && comido > 0 ? comido / ganado : null
  }
  const ultimo = orden[orden.length - 1]
  const unif = ultimo?.pesos_individuales?.length ? resumenPesaje(ultimo.pesos_individuales.map(Number))?.uniformidadPct ?? null : null
  const semana = new Date(new Date(hoy + 'T00:00:00').getTime() - 6 * 86400000).toISOString().slice(0, 10)
  const muertos = mortalidad.filter(m => m.fecha >= semana).reduce((t, m) => t + m.cantidad, 0)
  const base = lote.animales_actuales + muertos
  const tempFuera = registros.filter(r => r.fecha >= semana && r.temperatura_c != null && (Number(r.temperatura_c) < rango.min || Number(r.temperatura_c) > rango.max)).length

  const sugerencias = sugerenciasGrupo({
    etapa: lote.etapa_actual, gdpKg: gdp, gdpEsperadaKg: gdpEsperada,
    conversion, conversionMeta: etapa ? cfg.metas.conversion[etapa] : null,
    uniformidadPct: unif, mortalidadSemanaPct: base > 0 ? (muertos / base) * 100 : null,
    mortalidadUmbralPct: cfg.alertas.mortalidadSemanalPct[grupo], tempFueraDias: tempFuera, consumoBajo,
  })

  if (sugerencias.length === 0 && !impacto?.difConsumoPct) return null
  return (
    <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
      <p className="text-sm font-semibold text-sky-900"><Ic n="idea" /> Sugerencias para este grupo</p>
      {impacto?.difConsumoPct != null && (
        <p className="text-xs text-sky-900">
          Los {impacto.diasFuera} días fuera de {rango.min} a {rango.max} °C comieron {Math.abs(impacto.difConsumoPct).toFixed(0)} % {impacto.difConsumoPct < 0 ? 'menos' : 'más'} que los días dentro del rango.
        </p>
      )}
      {sugerencias.map(s => (
        <div key={s.titulo} className="rounded-lg bg-white p-2.5 text-sm">
          <p className="font-medium text-gray-900">{s.titulo}</p>
          <p className="text-xs text-gray-600">{s.texto}</p>
          <p className="mt-0.5 text-[0.6875rem] text-gray-400">Sugerencia, no regla · {s.fuente}</p>
        </div>
      ))}
    </div>
  )
}
