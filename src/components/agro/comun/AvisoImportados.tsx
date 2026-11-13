'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ic } from '@/components/ui/icon'

const fecha = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

const TEXTO = {
  general: 'son datos importados de Excel: solo hay producción. No hay ventas, costos ni pagos registrados de esas fechas, y esos huevos no suman a la bodega.',
  finanzas: 'son datos importados de Excel: no hay ventas, costos ni pagos registrados de esas fechas. Las cifras de dinero de ese tiempo no reflejan lo que pasó.',
  huevos: 'son datos importados de Excel: esos huevos ya salieron de la finca y no suman a la bodega, y no hay ventas registradas de esas fechas.',
} as const

/**
 * Aviso para la finca que tiene días importados (produccion_diaria_aves.importado):
 * dice de qué fecha a qué fecha son y que de ese tiempo no hay ventas.
 */
export default function AvisoImportados({ fincaId, donde = 'general' }: { fincaId: string; donde?: keyof typeof TEXTO }) {
  const [rango, setRango] = useState<{ fincaId: string; desde: string; hasta: string } | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    const base = () => supabase.from('produccion_diaria_aves').select('fecha').eq('finca_id', fincaId).eq('importado', true).limit(1)
    Promise.all([base().order('fecha', { ascending: true }), base().order('fecha', { ascending: false })]).then(([a, b]) => {
      if (!vigente) return
      const desde = a.data?.[0]?.fecha, hasta = b.data?.[0]?.fecha
      setRango(desde && hasta ? { fincaId, desde, hasta } : null)
    })
    return () => { vigente = false }
  }, [fincaId])

  if (!rango || rango.fincaId !== fincaId) return null
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <Ic n="info" className="mt-0.5 size-4" />
      <p>Del <strong>{fecha(rango.desde)}</strong> al <strong>{fecha(rango.hasta)}</strong> {TEXTO[donde]}</p>
    </div>
  )
}
