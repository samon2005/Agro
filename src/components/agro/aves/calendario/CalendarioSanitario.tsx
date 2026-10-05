'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { aFechaLocal, hoyLocal } from '@/lib/fechas'
import { CATEGORIAS_CALENDARIO, INFO_CATEGORIA, cargarCalendario, ocurreEn, type CategoriaCalendario, type EventoCalendario } from '@/lib/calendario'

const TODOS = '__todos__'
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const fechaLarga = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })

/**
 * El calendario sanitario y del ciclo de la finca: vacunas, tratamientos,
 * retiros, eventos, desinfecciones, pesajes, cambios de alimento, postura,
 * entradas, salidas y vacío sanitario, cada uno con su color. Se ve por mes o
 * como lista de lo que viene.
 */
export default function CalendarioSanitario({ fincaId }: { fincaId: string }) {
  const hoy = hoyLocal()
  const [eventos, setEventos] = useState<{ fincaId: string; lista: EventoCalendario[] } | null>(null)
  const [mes, setMes] = useState(() => hoy.slice(0, 7))
  const [diaSel, setDiaSel] = useState<string>(hoy)
  const [galpon, setGalpon] = useState(TODOS)
  const [ocultas, setOcultas] = useState<Set<CategoriaCalendario>>(new Set())
  const [vista, setVista] = useState<'mes' | 'lista'>('mes')

  useEffect(() => {
    let vigente = true
    cargarCalendario(createClient(), fincaId, hoy).then(lista => { if (vigente) setEventos({ fincaId, lista }) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId])

  const lista = eventos?.fincaId === fincaId ? eventos.lista : null
  const galpones = useMemo(() => [...new Set((lista ?? []).map(e => e.galpon))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })), [lista])
  const visibles = (lista ?? []).filter(e => !ocultas.has(e.categoria) && (galpon === TODOS || e.galpon === galpon))

  if (!lista) return <Skeleton className="h-96 w-full rounded-2xl" />

  // ── Cuadrícula del mes: de lunes a domingo ──
  const [anio, m] = mes.split('-').map(Number)
  const primero = new Date(anio, m - 1, 1)
  const desplazamiento = (primero.getDay() + 6) % 7
  const diasMes = new Date(anio, m, 0).getDate()
  const celdas: (string | null)[] = [
    ...Array(desplazamiento).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => aFechaLocal(new Date(anio, m - 1, i + 1))),
  ]
  while (celdas.length % 7) celdas.push(null)
  const moverMes = (d: number) => {
    const n = new Date(anio, m - 1 + d, 1)
    setMes(aFechaLocal(n).slice(0, 7))
  }
  const delDia = visibles.filter(e => ocurreEn(e, diaSel))
  const proximos = visibles.filter(e => (e.hasta ?? e.fecha) >= hoy).slice(0, 60)

  function alternar(c: CategoriaCalendario) {
    setOcultas(prev => {
      const n = new Set(prev)
      if (n.has(c)) n.delete(c); else n.add(c)
      return n
    })
  }

  const Fila = ({ e }: { e: EventoCalendario }) => (
    <div className="flex items-start gap-2 py-1.5">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', INFO_CATEGORIA[e.categoria].punto)} />
      <div className="min-w-0 text-sm">
        <p className="text-gray-800">
          <span className="font-medium">{e.titulo}</span>
          <span className="text-gray-500"> · {e.galpon}</span>
          {e.programado && <span className="ml-1.5 rounded bg-gray-100 px-1 text-[0.625rem] text-gray-500">programado</span>}
        </p>
        <p className="text-xs text-gray-500">
          {INFO_CATEGORIA[e.categoria].t}
          {e.hasta ? ` · del ${fechaCorta(e.fecha)} al ${fechaCorta(e.hasta)}` : ''}
          {e.detalle ? ` · ${e.detalle}` : ''}
        </p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          {(['mes', 'lista'] as const).map(v => (
            <button
              key={v} onClick={() => setVista(v)}
              className={cn('h-8 rounded-lg px-3.5 text-sm font-medium', vista === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
            >
              {v === 'mes' ? 'Mes' : 'Lo que viene'}
            </button>
          ))}
        </div>
        <div className="w-56">
          <Select value={galpon} onValueChange={v => setGalpon(v ?? TODOS)} items={{ [TODOS]: 'Todos los galpones', ...Object.fromEntries(galpones.map(g => [g, g])) }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value={TODOS}>Todos los galpones</SelectItem>
              {galpones.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Leyenda: cada categoría se muestra u oculta */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIAS_CALENDARIO.map(c => (
          <button
            key={c.v} onClick={() => alternar(c.v)}
            className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs', ocultas.has(c.v) ? 'bg-gray-50 text-gray-400 line-through' : c.color)}
            title={ocultas.has(c.v) ? 'Mostrar' : 'Ocultar'}
          >
            <span className={cn('size-2 rounded-full', ocultas.has(c.v) ? 'bg-gray-300' : c.punto)} /> {c.t}
          </button>
        ))}
      </div>

      {vista === 'mes' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardContent className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <button onClick={() => moverMes(-1)} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Mes anterior">←</button>
                <p className="font-semibold text-gray-800 first-letter:uppercase">{primero.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</p>
                <button onClick={() => moverMes(1)} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Mes siguiente">→</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-medium text-gray-400">
                {DIAS_SEMANA.map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {celdas.map((f, i) => {
                  if (!f) return <div key={`v${i}`} />
                  const delD = visibles.filter(e => ocurreEn(e, f))
                  return (
                    <button
                      key={f}
                      onClick={() => setDiaSel(f)}
                      className={cn(
                        'flex min-h-20 flex-col items-stretch gap-0.5 rounded-lg border p-1 text-left align-top',
                        f === diaSel ? 'border-green-600 ring-1 ring-green-600' : 'border-gray-100 hover:border-gray-300',
                        f === hoy && 'bg-green-50/60',
                      )}
                    >
                      <span className={cn('text-xs', f === hoy ? 'font-bold text-green-800' : 'text-gray-600')}>{Number(f.slice(8))}</span>
                      {delD.slice(0, 3).map(e => (
                        <span key={e.id} className={cn('truncate rounded px-1 text-[0.625rem] leading-4', INFO_CATEGORIA[e.categoria].color, e.programado && 'opacity-70')}>
                          {e.titulo}
                        </span>
                      ))}
                      {delD.length > 3 && <span className="text-[0.625rem] text-gray-400">+{delD.length - 3} más</span>}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-sm font-semibold text-gray-800 first-letter:uppercase">{fechaLarga(diaSel)}</p>
              {delDia.length === 0
                ? <p className="text-sm text-gray-400">Nada este día.</p>
                : <div className="divide-y divide-gray-100">{delDia.map(e => <Fila key={e.id} e={e} />)}</div>}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            {proximos.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400"><Ic n="calendario" /> No hay nada programado.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {proximos.map((e, i) => (
                  <div key={e.id}>
                    {(i === 0 || proximos[i - 1].fecha !== e.fecha) && (
                      <p className="pt-3 text-xs font-semibold text-gray-500 first-letter:uppercase">{e.fecha < hoy ? 'En curso' : fechaLarga(e.fecha)}</p>
                    )}
                    <Fila e={e} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
