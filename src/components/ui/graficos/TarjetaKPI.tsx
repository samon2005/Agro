'use client'

import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TINTA } from './paleta'

interface Props {
  etiqueta: string
  valor: string
  /** Cambio frente al período anterior, en % (o en puntos si `enPuntos`) */
  cambio?: number | null
  enPuntos?: boolean
  /** Si subir es bueno (huevos) o malo (mortalidad, costos) */
  subirEsBueno?: boolean
  /** Contra qué se compara, para el texto del cambio */
  contra?: string
  /** Mini tendencia: un valor por semana */
  tendencia?: (number | null)[]
  /** Texto bajo el número cuando no hay cambio que mostrar */
  nota?: ReactNode
  destacada?: boolean
}

/**
 * Un indicador al estilo de un tablero: el rótulo, el número grande, cuánto
 * cambió frente al período anterior (flecha y color según si subir es bueno) y
 * la tendencia de las últimas semanas, sin ejes.
 */
export function TarjetaKPI({ etiqueta, valor, cambio, enPuntos, subirEsBueno = true, contra = 'período anterior', tendencia, nota, destacada }: Props) {
  const hayCambio = cambio != null && Number.isFinite(cambio)
  const sube = hayCambio && cambio! > 0.05
  const baja = hayCambio && cambio! < -0.05
  const bueno = (sube && subirEsBueno) || (baja && !subirEsBueno)
  const malo = (sube && !subirEsBueno) || (baja && subirEsBueno)
  const datos = (tendencia ?? []).map((v, i) => ({ i, v }))
  const conTendencia = datos.filter(d => d.v != null).length >= 2

  return (
    <div className={cn('flex flex-col rounded-2xl bg-white p-4 ring-1 ring-black/5', destacada && 'ring-green-700/15')}>
      <p className="truncate text-xs font-medium text-gray-500">{etiqueta}</p>
      <p className="mt-1.5 text-[1.6rem] leading-tight font-semibold tracking-tight whitespace-nowrap text-gray-900 tabular-nums">{valor}</p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <p className="min-w-0 text-[0.6875rem] leading-snug">
          {hayCambio ? (
            <>
              <span className={cn('font-semibold whitespace-nowrap', bueno && 'text-green-700', malo && 'text-red-600', !bueno && !malo && 'text-gray-500')}>
                {sube ? '▲' : baja ? '▼' : '='} {Math.abs(cambio!).toLocaleString('es-CO', { maximumFractionDigits: 1 })}{enPuntos ? ' pts' : ' %'}
              </span>
              <span className="text-gray-400"> vs {contra}</span>
            </>
          ) : (
            <span className="text-gray-400">{nota ?? ' '}</span>
          )}
        </p>
        {conTendencia && (
          <div className="hidden h-8 w-20 shrink-0 sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datos} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <Area
                  dataKey="v" type="monotone" connectNulls isAnimationActive={false}
                  stroke={malo ? TINTA.malo : '#2a78d6'} strokeWidth={1.5}
                  fill={malo ? TINTA.malo : '#2a78d6'} fillOpacity={0.08}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

/** Cambio % entre dos valores (null si no hay base) */
export function cambioPct(actual: number | null, anterior: number | null): number | null {
  if (actual == null || anterior == null || anterior === 0) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}
