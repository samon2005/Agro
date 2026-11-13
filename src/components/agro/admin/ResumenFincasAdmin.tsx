'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { dbGenerico } from '@/lib/especiesConfig'
import { useFinca } from '@/components/agro/FincaProvider'
import { ESPECIES_FINCA } from '@/lib/especies'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TarjetaKPI } from '@/components/ui/graficos/TarjetaKPI'
import { Ic } from '@/components/ui/icon'
import { compacto } from '@/components/ui/graficos/paleta'
import { hoyLocal } from '@/lib/fechas'
import { restarDias } from '@/lib/reportes'

/** Una fila de admin_fincas() (migración 079). */
interface FilaFinca {
  id: string
  nombre: string
  municipio: string | null
  departamento: string | null
  tipo_produccion: string[] | null
  created_at: string
  sin_registro_ventas: boolean
  propietario_nombre: string | null
  propietario_correo: string | null
  miembros: number
  lotes_activos: number
  lotes_total: number
  aves_actuales: number
  primer_registro: string | null
  ultimo_registro: string | null
  dias_registrados: number
  huevos_total: number
  huevos_7d: number
  postura_7d: number | null
}

const mil = (v: number) => Number(v).toLocaleString('es-CO')
const fecha = (f: string, conDia = true) => new Date(f.length === 10 ? f + 'T00:00:00' : f)
  .toLocaleDateString('es-CO', conDia ? { day: 'numeric', month: 'short', year: 'numeric' } : { month: 'short', year: 'numeric' })

/**
 * El Resumen del administrador de fincas: no tiene finca propia, así que su
 * inicio son las fincas que le tocan, cada una con cómo va y un botón para
 * entrar a ella.
 */
export default function ResumenFincasAdmin({ nombre }: { nombre: string }) {
  const { fincas: visibles, setFincaActual } = useFinca()
  const router = useRouter()
  const [filas, setFilas] = useState<FilaFinca[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')

  useEffect(() => {
    dbGenerico(createClient()).rpc('admin_fincas').then(({ data, error }) => {
      if (error) setError('No se pudieron cargar las fincas.')
      else setFilas((data ?? []) as FilaFinca[])
    })
  }, [])

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    if (!filas || !q) return filas ?? []
    return filas.filter(f => [f.nombre, f.municipio, f.departamento, f.propietario_nombre, f.propietario_correo]
      .some(x => x?.toLowerCase().includes(q)))
  }, [filas, buscar])

  function entrar(id: string) {
    const f = visibles.find(x => x.id === id)
    if (!f) return
    setFincaActual(f)
    // Las de datos viejos no tienen nada de hoy: se abren en su análisis de producción
    if (f.sin_registro_ventas) router.push('/reportes')
  }

  const especies = (t: string[] | null) =>
    ESPECIES_FINCA.filter(e => t?.includes(e.value)).map(e => e.labelNav ?? e.label).join(', ') || 'Sin especie'

  // Una finca en producción sin registros en 3 días se marca
  const hace3 = restarDias(hoyLocal(), 3)
  const activas = (filas ?? []).filter(f => !f.sin_registro_ventas)
  const totales = {
    aves: activas.reduce((s, f) => s + Number(f.aves_actuales), 0),
    huevos7: activas.reduce((s, f) => s + Number(f.huevos_7d), 0),
    historicas: (filas ?? []).filter(f => f.sin_registro_ventas).length,
    huevosHistoricos: (filas ?? []).filter(f => f.sin_registro_ventas).reduce((s, f) => s + Number(f.huevos_total), 0),
  }

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div>
        <h2 className="font-heading text-3xl font-medium text-gray-900">Hola, {nombre}</h2>
        <p className="mt-1 text-gray-500">
          Administrador de fincas · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {!filas ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
      ) : (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TarjetaKPI etiqueta="Fincas a cargo" valor={String(filas.length)}
            nota={`${activas.length} en producción · ${totales.historicas} con datos viejos`} />
          <TarjetaKPI etiqueta="Aves hoy" valor={mil(totales.aves)} nota="En los galpones activos" />
          <TarjetaKPI etiqueta="Huevos, últimos 7 días" valor={mil(totales.huevos7)} nota="De las fincas en producción" />
          <TarjetaKPI etiqueta="Huevos en datos viejos" valor={compacto(totales.huevosHistoricos)} nota="Cargados de Excel, sin ventas" />
        </div>

        {filas.length > 4 && (
          <div className="relative max-w-sm">
            <Ic n="buscar" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar finca, dueño o municipio"
              className="pl-9" aria-label="Buscar finca" />
          </div>
        )}

        {filas.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">Todavía no tienes fincas a cargo.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lista.map(f => (
              <section key={f.id} className="superficie flex flex-col rounded-2xl p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-medium text-gray-900">{f.nombre}</h3>
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <Ic n="ubicacion" className="size-3" />
                      {[f.municipio, f.departamento].filter(Boolean).join(', ') || 'Sin municipio'} · {especies(f.tipo_produccion)}
                    </p>
                  </div>
                  {f.sin_registro_ventas
                    ? <Badge variant="secondary">Datos viejos</Badge>
                    : <Badge>{f.lotes_activos > 0 ? 'En producción' : 'Sin lotes activos'}</Badge>}
                </div>

                <p className="mt-3 text-sm text-gray-700">
                  {f.propietario_correo ? (
                    <><Ic n="operario" className="mr-1 size-3.5 text-gray-400" />{f.propietario_nombre || 'Sin nombre'} <span className="text-gray-400">· {f.propietario_correo}</span></>
                  ) : (
                    <span className="text-gray-400">Sin usuario: la manejas tú</span>
                  )}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4 text-sm">
                  {f.sin_registro_ventas ? (<>
                    <Dato titulo="Lotes cargados" valor={mil(f.lotes_total)} />
                    <Dato titulo="Días registrados" valor={mil(f.dias_registrados)} />
                    <Dato titulo="Huevos" valor={mil(f.huevos_total)} />
                    <Dato titulo="Periodo" valor={f.primer_registro && f.ultimo_registro ? `${fecha(f.primer_registro, false)} – ${fecha(f.ultimo_registro, false)}` : '—'} />
                  </>) : (<>
                    <Dato titulo="Lotes activos" valor={`${mil(f.lotes_activos)} de ${mil(f.lotes_total)}`} />
                    <Dato titulo="Aves" valor={mil(f.aves_actuales)} />
                    <Dato titulo="Huevos, 7 días" valor={mil(f.huevos_7d)} nota={f.postura_7d != null ? `postura ${Number(f.postura_7d).toLocaleString('es-CO')} %` : undefined} />
                    <Dato titulo="Último registro" valor={f.ultimo_registro ? fecha(f.ultimo_registro) : 'Sin registros'}
                      alerta={!f.ultimo_registro || f.ultimo_registro < hace3} />
                  </>)}
                </dl>

                <Button className="mt-5 w-full" variant={f.sin_registro_ventas ? 'outline' : 'default'} onClick={() => entrar(f.id)}>
                  {f.sin_registro_ventas ? 'Ver el análisis' : 'Entrar a la finca'} <Ic n="flecha" className="size-4" />
                </Button>
              </section>
            ))}
          </div>
        )}
      </>)}
    </div>
  )
}

function Dato({ titulo, valor, nota, alerta }: { titulo: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-medium text-gray-500">{titulo}</dt>
      <dd className={alerta ? 'font-medium text-amber-700' : 'font-medium text-gray-900'}>{valor}</dd>
      {nota && <dd className="text-[0.6875rem] text-gray-400">{nota}</dd>}
    </div>
  )
}
