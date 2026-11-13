'use client'

import { Ic } from '@/components/ui/icon'

const TEXTO = {
  finanzas: 'Esta finca no tiene registros de ventas: se cargaron solo datos de producción. La utilidad y los ingresos no reflejan lo que pasó.',
  huevos: 'Huevos viejos sin ventas registradas: el saldo en bodega suma toda la producción cargada. Mira la producción, la postura y los tamaños, no el saldo.',
} as const

/** Aviso para las fincas con datos viejos (fincas.sin_registro_ventas). */
export default function AvisoSinVentas({ donde }: { donde: keyof typeof TEXTO }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <Ic n="aviso" className="mt-0.5 size-4" />
      <p>{TEXTO[donde]}</p>
    </div>
  )
}
