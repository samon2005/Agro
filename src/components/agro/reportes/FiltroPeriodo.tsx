'use client'

import { useState } from 'react'
import { finDeMes, periodosDisponibles, type Periodo } from '@/lib/analisisProduccion'

const nombreMes = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })

/**
 * Elegir de qué tiempo es el análisis: todo, los últimos 12 meses con datos,
 * un año, o un rango de meses. Cambia todas las secciones que tiene debajo.
 */
export default function FiltroPeriodo({ dias, valor, onCambio }: {
  /** Todos los días (sin filtrar), para saber qué años hay */
  dias: { fecha: string }[]
  valor: Periodo
  onCambio: (p: Periodo) => void
}) {
  const opciones = periodosDisponibles(dias)
  const elegida = opciones.find(o => o.p.desde === valor.desde && o.p.hasta === valor.hasta)?.id ?? 'meses'
  const [abierto, setAbierto] = useState(elegida === 'meses')
  const meses = dias.length ? [dias.reduce((m, d) => (d.fecha < m ? d.fecha : m), dias[0].fecha), dias.reduce((m, d) => (d.fecha > m ? d.fecha : m), dias[0].fecha)] : null

  return (
    <div className="superficie flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
      <span className="text-xs font-medium text-gray-500">Periodo</span>
      <select
        value={abierto ? 'meses' : elegida}
        onChange={e => {
          if (e.target.value === 'meses') { setAbierto(true); return }
          setAbierto(false)
          onCambio(opciones.find(o => o.id === e.target.value)!.p)
        }}
        aria-label="Periodo del análisis"
        className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-800"
      >
        {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        <option value="meses">Elegir meses…</option>
      </select>
      {abierto && meses && (
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          de
          <input type="month" aria-label="Desde el mes" className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-800"
            min={meses[0].slice(0, 7)} max={meses[1].slice(0, 7)} value={(valor.desde ?? meses[0]).slice(0, 7)}
            onChange={e => e.target.value && onCambio({ ...valor, desde: `${e.target.value}-01` })} />
          a
          <input type="month" aria-label="Hasta el mes" className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-800"
            min={meses[0].slice(0, 7)} max={meses[1].slice(0, 7)} value={(valor.hasta ?? meses[1]).slice(0, 7)}
            onChange={e => e.target.value && onCambio({ ...valor, hasta: finDeMes(e.target.value) })} />
        </span>
      )}
      {(valor.desde || valor.hasta) && meses && (
        <span className="text-xs text-gray-400">
          {nombreMes((valor.desde ?? meses[0]).slice(0, 7))} – {nombreMes((valor.hasta ?? meses[1]).slice(0, 7))}
        </span>
      )}
    </div>
  )
}
