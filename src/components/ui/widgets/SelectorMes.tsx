'use client'

import { aFechaLocal } from '@/lib/fechas'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * Elegir el mes de un calendario: flechas para el mes de al lado y listas para
 * saltar directo a cualquier mes y año, sin pasar mes por mes.
 */
export function SelectorMes({ mes, onCambio, anioDesde, maxMes }: {
  /** El mes que se ve (AAAA-MM) */
  mes: string
  onCambio: (mes: string) => void
  /** El primer año que se puede elegir */
  anioDesde: number
  /** El último mes que se puede ver (AAAA-MM); sin límite si no se da */
  maxMes?: string
}) {
  const [a, m] = mes.split('-').map(Number)
  const anioHasta = maxMes ? Number(maxMes.slice(0, 4)) : new Date().getFullYear() + 1
  const anios: number[] = []
  for (let x = anioHasta; x >= Math.min(anioDesde, a); x--) anios.push(x)
  const mover = (n: number) => onCambio(aFechaLocal(new Date(a, m - 1 + n, 1)).slice(0, 7))
  const ir = (anio: number, mesNum: number) => {
    const nuevo = `${anio}-${String(mesNum).padStart(2, '0')}`
    onCambio(maxMes && nuevo > maxMes ? maxMes : nuevo)
  }
  const select = 'h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs font-semibold text-gray-800'

  return (
    <div className="flex items-center justify-between gap-1">
      <button type="button" onClick={() => mover(-1)} className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Mes anterior">‹</button>
      <div className="flex items-center gap-1">
        <select value={m} onChange={e => ir(a, Number(e.target.value))} aria-label="Mes" className={select}>
          {MESES.map((nombre, i) => (
            <option key={nombre} value={i + 1} disabled={!!maxMes && `${a}-${String(i + 1).padStart(2, '0')}` > maxMes}>
              {nombre[0].toUpperCase() + nombre.slice(1)}
            </option>
          ))}
        </select>
        <select value={a} onChange={e => ir(Number(e.target.value), m)} aria-label="Año" className={select}>
          {anios.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <button type="button" onClick={() => mover(1)} disabled={!!maxMes && mes >= maxMes} className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30" aria-label="Mes siguiente">›</button>
    </div>
  )
}
