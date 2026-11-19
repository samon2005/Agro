'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { tareasDelPeriodo, type TareaD } from '@/lib/desempeno'
import { sumarDias } from '@/lib/cierreSemanal'
import { cn } from '@/lib/utils'

/** Las tareas del equipo en la semana del cierre: hechas, atrasadas y el % cumplido (lib/desempeno). */
export default function TareasDeLaSemana({ fincaId, lunes, hoy }: { fincaId: string; lunes: string; hoy: string }) {
  const domingo = sumarDias(lunes, 6)
  const [datos, setDatos] = useState<{ clave: string; t: TareaD[] } | null>(null)
  const clave = `${fincaId}|${lunes}`
  useEffect(() => {
    let vigente = true
    createClient().from('tareas_operarios').select('operario_id, fecha, estado, completada_en')
      .eq('finca_id', fincaId).gte('fecha', lunes).lte('fecha', domingo).limit(2000)
      .then(({ data }) => { if (vigente) setDatos({ clave: `${fincaId}|${lunes}`, t: (data ?? []) as TareaD[] }) })
    return () => { vigente = false }
  }, [fincaId, lunes, domingo])
  if (!datos || datos.clave !== clave) return null
  const r = tareasDelPeriodo(datos.t, lunes, domingo, hoy)
  if (r.asignadas === 0) return <p className="text-xs text-gray-500">Tareas del equipo: ninguna programada esta semana.</p>
  return (
    <p className="text-xs text-gray-600">
      Tareas del equipo: <span className="font-medium text-gray-900">{r.hechas} de {r.asignadas} hechas</span>
      <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5',
        (r.cumplimiento ?? 0) >= 90 ? 'bg-green-100 text-green-800' : (r.cumplimiento ?? 0) >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700')}>{r.cumplimiento}%</span>
      {r.atrasadas > 0 && <span className="ml-1.5 text-red-700">· {r.atrasadas} {r.atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>}
    </p>
  )
}
