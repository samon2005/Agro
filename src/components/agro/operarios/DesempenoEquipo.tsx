'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { desempenoOperario, PERIODOS_PAGO, CONTRATOS, type TareaD, type TurnoD } from '@/lib/desempeno'
import { NOMBRE_ROL, type RolFinca } from '@/lib/roles'
import { hoyLocal } from '@/lib/fechas'
import { sumarDias, lunesDe } from '@/lib/cierreSemanal'
import { BarraExportar } from '@/components/ui/barra-exportar'
import { cn } from '@/lib/utils'

type Operario = {
  id: string
  full_name: string | null
  rol: RolFinca
  activo: boolean
  pago_monto: number | null
  pago_periodo: string | null
  tipo_contrato?: string | null
}

type Rango = 'semana' | 'quincena' | 'mes' | 'otro'

function cop(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

/** El rango de fechas de cada opción, hasta hoy */
function rangoDe(r: Rango, hoy: string): [string, string] {
  if (r === 'semana') return [lunesDe(hoy), hoy]
  const [y, m, d] = hoy.split('-').map(Number)
  const mes = `${y}-${String(m).padStart(2, '0')}`
  if (r === 'quincena') return [d <= 15 ? `${mes}-01` : `${mes}-16`, hoy]
  if (r === 'mes') return [`${mes}-01`, hoy]
  return [sumarDias(hoy, -29), hoy]
}

/**
 * Cómo le fue a cada persona del equipo en un periodo (tareas hechas, a tiempo,
 * atrasadas, días y horas de turno) y cuánto le toca por lo trabajado. Las
 * cuentas están en lib/desempeno.
 */
export default function DesempenoEquipo({ fincaId, fincaNombre, operarios }: { fincaId: string; fincaNombre: string; operarios: Operario[] }) {
  const hoy = hoyLocal()
  const [rango, setRango] = useState<Rango>('quincena')
  const [desdeOtro, setDesdeOtro] = useState(sumarDias(hoy, -29))
  const [hastaOtro, setHastaOtro] = useState(hoy)
  const [desde, hasta] = rango === 'otro' ? [desdeOtro, hastaOtro] : rangoDe(rango, hoy)
  const [datos, setDatos] = useState<{ clave: string; tareas: TareaD[]; turnos: TurnoD[] } | null>(null)
  const clave = `${fincaId}|${desde}|${hasta}`

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    Promise.all([
      supabase.from('tareas_operarios').select('operario_id, fecha, estado, completada_en')
        .eq('finca_id', fincaId).gte('fecha', desde).lte('fecha', hasta).limit(5000),
      supabase.from('turnos_operarios').select('operario_id, fecha, hora_inicio, hora_fin')
        .eq('finca_id', fincaId).gte('fecha', desde).lte('fecha', hasta).limit(5000),
    ]).then(([t, u]) => {
      if (vigente) setDatos({ clave: `${fincaId}|${desde}|${hasta}`, tareas: (t.data ?? []) as TareaD[], turnos: (u.data ?? []) as TurnoD[] })
    })
    return () => { vigente = false }
  }, [fincaId, desde, hasta])

  const filas = useMemo(() => {
    if (!datos) return []
    return operarios.map(op => ({ op, d: desempenoOperario(op, datos.tareas, datos.turnos, desde, hasta, hoy) }))
  }, [datos, operarios, desde, hasta, hoy])
  const imprimir = useRef<HTMLDivElement>(null)
  const cargando = !datos || datos.clave !== clave
  const total = filas.reduce((s, f) => s + (f.d.pago ?? 0), 0)

  const nombrePeriodo = (v: string | null) => PERIODOS_PAGO.find(p => p.v === v)?.t ?? '—'
  const nombreContrato = (v: string | null | undefined) => CONTRATOS.find(c => c.v === v)?.t ?? '—'

  return (
    <div ref={imprimir} className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {([['semana', 'Esta semana'], ['quincena', 'Esta quincena'], ['mes', 'Este mes'], ['otro', 'Otras fechas']] as [Rango, string][]).map(([v, t]) => (
          <button key={v} onClick={() => setRango(v)}
            className={cn('rounded-full px-3 py-1.5 text-sm', rango === v ? 'bg-green-700 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50')}>
            {t}
          </button>
        ))}
        {rango === 'otro' && (
          <span className="flex items-center gap-2 text-sm">
            <input type="date" value={desdeOtro} max={hastaOtro} onChange={e => setDesdeOtro(e.target.value)} className="h-8 rounded-md border border-gray-200 px-2" />
            a
            <input type="date" value={hastaOtro} min={desdeOtro} max={hoy} onChange={e => setHastaOtro(e.target.value)} className="h-8 rounded-md border border-gray-200 px-2" />
          </span>
        )}
      </div>

      <div className="superficie overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-3 py-2 font-medium">Persona</th>
              <th className="px-3 py-2 font-medium">Tareas hechas</th>
              <th className="px-3 py-2 font-medium">A tiempo</th>
              <th className="px-3 py-2 font-medium">Atrasadas</th>
              <th className="px-3 py-2 font-medium">Días · horas</th>
              <th className="px-3 py-2 font-medium">Contrato y pago</th>
              <th className="px-3 py-2 text-right font-medium">Toca pagar</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Sin personas en el equipo</td></tr>
            ) : filas.map(({ op, d }) => (
              <tr key={op.id} className={cn('border-b border-gray-50', !op.activo && 'text-gray-400')}>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-gray-900">{op.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-500">{NOMBRE_ROL[op.rol]}{!op.activo && ' · inactivo'}</p>
                </td>
                <td className="px-3 py-2.5">
                  {d.asignadas ? <>{d.hechas} de {d.asignadas} <span className={cn('ml-1 rounded-full px-1.5 py-0.5 text-xs',
                    (d.cumplimiento ?? 0) >= 90 ? 'bg-green-100 text-green-800' : (d.cumplimiento ?? 0) >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700')}>{d.cumplimiento}%</span></> : <span className="text-gray-400">Sin tareas</span>}
                </td>
                <td className="px-3 py-2.5">{d.hechas ? `${d.aTiempo} de ${d.hechas}` : '—'}</td>
                <td className={cn('px-3 py-2.5', d.atrasadas > 0 && 'font-medium text-red-700')}>{d.atrasadas}</td>
                <td className="px-3 py-2.5">{d.diasTrabajados} {d.diasTrabajados === 1 ? 'día' : 'días'} · {d.horas.toLocaleString('es-CO')} h</td>
                <td className="px-3 py-2.5 text-gray-600">
                  <p>{nombreContrato(op.tipo_contrato)}</p>
                  <p className="text-xs text-gray-500">{op.pago_monto ? `${cop(Number(op.pago_monto))} · ${nombrePeriodo(op.pago_periodo).toLowerCase()}` : 'Sin pago anotado'}</p>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {d.pago != null ? <><p className="font-medium text-gray-900">{cop(d.pago)}</p><p className="text-xs text-gray-500">{d.comoPago}</p></> : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {!cargando && filas.length > 0 && (
            <tfoot>
              <tr className="text-sm">
                <td colSpan={6} className="px-3 py-2.5 font-medium text-gray-700">Total del periodo</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{cop(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Es un estimado por lo trabajado del {desde} al {hasta}: los sueldos fijos van por los días del periodo, el jornal por los días con turno,
        el pago por hora con las horas de los turnos y el pago por tarea con las tareas hechas. No incluye prestaciones, aportes a salud y
        pensión, horas extra ni recargos: eso lo liquida el contador con los valores de ley del año.
      </p>

      {!cargando && filas.length > 0 && (
        <BarraExportar
          titulo={`Desempeño y pago · ${fincaNombre}`}
          subtitulo={`Del ${desde} al ${hasta}`}
          imprimir={imprimir}
          hojas={() => [{
            nombre: 'Desempeño y pago',
            columnas: ['Persona', 'Rol', 'Tareas asignadas', 'Hechas', 'A tiempo', 'Atrasadas', 'Días', 'Horas', 'Contrato', 'Forma de pago', 'Monto', 'Toca pagar', 'Cómo se calculó'],
            filas: filas.map(({ op, d }) => [op.full_name ?? '', NOMBRE_ROL[op.rol], d.asignadas, d.hechas, d.aTiempo, d.atrasadas, d.diasTrabajados, d.horas,
              nombreContrato(op.tipo_contrato), nombrePeriodo(op.pago_periodo), op.pago_monto ?? '', d.pago ?? '', d.comoPago]),
          }]}
        />
      )}
    </div>
  )
}
