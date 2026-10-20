'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { aFechaLocal, hoyLocal } from '@/lib/fechas'

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/**
 * El mes con los días pintados según cuánto pasó (registros del día, huevos…):
 * más oscuro es más. Hoy lleva un aro. Se puede ir a los meses anteriores.
 */
export function CalendarioMes({ valores, formato = v => v.toLocaleString('es-CO'), leyenda = ['Sin registro', 'Con registro'], marcados }: {
  /** fecha (AAAA-MM-DD) → valor del día */
  valores: Map<string, number>
  formato?: (v: number) => string
  leyenda?: [string, string]
  /** Fechas con algo especial (un evento): llevan un punto rojo */
  marcados?: Set<string>
}) {
  const hoy = hoyLocal()
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const primero = new Date(mes + '-01T00:00:00')
  const diasMes = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate()
  const huecos = (primero.getDay() + 6) % 7
  const delMes = [...valores.entries()].filter(([f]) => f.startsWith(mes)).map(([, v]) => v)
  const min = delMes.length ? Math.min(...delMes) : 0
  const max = delMes.length ? Math.max(...delMes) : 1
  // Del verde claro (el día con menos) al oscuro (el día con más)
  const tonos = ['#b6d6a6', '#8cbd78', '#62a24c', '#418b30', '#2a5d22']
  const tonoDe = (v: number) => tonos[max > min ? Math.round(((v - min) / (max - min)) * (tonos.length - 1)) : 2]
  const nombreMes = primero.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).replace(' de ', ' ')
  const mover = (n: number) => setMes(aFechaLocal(new Date(primero.getFullYear(), primero.getMonth() + n, 1)).slice(0, 7))
  const registrados = [...valores.keys()].filter(f => f.startsWith(mes)).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => mover(-1)} className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Mes anterior">‹</button>
        <p className="text-sm font-semibold text-gray-800">{nombreMes[0].toUpperCase() + nombreMes.slice(1)}</p>
        <button type="button" onClick={() => mover(1)} disabled={mes >= hoy.slice(0, 7)} className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30" aria-label="Mes siguiente">›</button>
      </div>
      <div className="mx-auto grid max-w-72 grid-cols-7 gap-1 text-center">
        {DIAS.map((d, i) => <span key={i} className="pb-1 text-[0.625rem] font-semibold text-gray-400">{d}</span>)}
        {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} />)}
        {Array.from({ length: diasMes }, (_, i) => {
          const f = `${mes}-${String(i + 1).padStart(2, '0')}`
          const v = valores.get(f)
          const futuro = f > hoy
          const tono = v != null ? tonoDe(v) : undefined
          return (
            <span key={f} title={`${new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}: ${v != null ? formato(v) : futuro ? '' : 'sin registro'}`}
              className={cn('relative flex h-8 items-center justify-center rounded-lg text-[0.6875rem] tabular-nums',
                v != null ? (tono === '#b6d6a6' || tono === '#8cbd78' ? 'font-medium text-green-950' : 'font-semibold text-white') : futuro ? 'text-gray-300' : 'bg-gray-50 text-gray-400',
                f === hoy && 'ring-2 ring-green-700 ring-offset-1')}
              style={tono ? { background: tono } : undefined}>
              {i + 1}
              {marcados?.has(f) && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-red-500" />}
            </span>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[0.6875rem] text-gray-400">
        <span>{registrados} día{registrados === 1 ? '' : 's'} con registro</span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded bg-gray-100" />{leyenda[0]}
          <span className="ml-2 size-2.5 rounded" style={{ background: '#62a24c' }} />{leyenda[1]}
        </span>
      </div>
    </div>
  )
}
