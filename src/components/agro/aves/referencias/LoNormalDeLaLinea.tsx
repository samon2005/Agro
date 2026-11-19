'use client'

import { useReferencia } from '@/lib/useReferencia'
import { resumenDeGuia } from '@/lib/lineas'

const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const mil = (v: number) => Math.round(v).toLocaleString('es-CO')

/**
 * Lo que es normal para la línea elegida según su guía, y lo que significa con
 * las aves que entran: inicio de postura, pico, consumo, peso del huevo,
 * viabilidad y huevos por gallina. Cuentas en lib/lineas.
 */
export default function LoNormalDeLaLinea({ referenciaId, aves }: { referenciaId: string | null; aves: number | null }) {
  const ref = useReferencia(referenciaId)
  const r = resumenDeGuia(ref)
  if (!r) return null
  const edadHA = r.huevosAve[80] != null ? 80 : r.huevosAve[72] != null ? 72 : null
  return (
    <div className="rounded-lg bg-green-50/60 px-3 py-2.5 text-xs text-gray-700">
      <p className="mb-1.5 font-semibold text-green-900">Lo normal de esta línea, según su guía</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {r.inicioPostura != null && <span>Empieza a poner: <strong>semana {r.inicioPostura}</strong></span>}
        {r.pico && <span>Pico: <strong>{n1(r.pico.pct)} %</strong> (sem. {r.pico.semana})</span>}
        <span>Sobre 90 %: <strong>{r.semanasSobre90} semanas</strong></span>
        {r.consumoPostura != null && <span>Come en postura: <strong>{mil(r.consumoPostura)} g</strong>/día</span>}
        {r.pesoHuevo != null && <span>Huevo: <strong>{n1(r.pesoHuevo)} g</strong></span>}
        {r.viabilidad[80] != null && <span>Viven a la sem. 80: <strong>{n1(r.viabilidad[80]!)} %</strong></span>}
        {edadHA && <span>Huevos por gallina a la sem. {edadHA}: <strong>{mil(r.huevosAve[edadHA]!)}</strong></span>}
      </div>
      {aves != null && aves > 0 && (
        <p className="mt-1.5 text-gray-600">
          Con {mil(aves)} aves:
          {r.pico ? ` en el pico, unos ${mil(aves * r.pico.pct / 100)} huevos al día` : ''}
          {r.consumoPostura != null ? `; ${n1(aves * r.consumoPostura / 1000)} kg de alimento al día en postura` : ''}
          {edadHA ? `; unos ${mil(aves * r.huevosAve[edadHA]!)} huevos hasta la semana ${edadHA}` : ''}.
        </p>
      )}
    </div>
  )
}
