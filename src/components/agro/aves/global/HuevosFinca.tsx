'use client'

import { Indicador } from '@/components/ui/indicador'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'
import { Ic } from '@/components/ui/icon'
import { TAMANOS_HUEVO } from '@/lib/huevos'
import { cargarHuevosFinca, totalTamanos, type HuevosFinca as DatosHuevos } from '@/lib/huevosFinca'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Props {
  fincaId: string
  lotes: LoteAves[]
}

/**
 * El huevo de toda la finca: lo que se puso menos lo que se vendió, por tamaño.
 * Las ventas salen del huevo de la finca, no de un galpón; aquí también se ve
 * cuánto ha puesto cada galpón (sumando los lotes que han pasado por él).
 */
export default function HuevosFinca({ fincaId, lotes }: Props) {
  const [datos, setDatos] = useState<{ clave: string; d: DatosHuevos } | null>(null)
  const clave = `${fincaId}|${lotes.map(l => l.id).join(',')}`

  useEffect(() => {
    let vigente = true
    cargarHuevosFinca(createClient(), fincaId).then(d => { if (vigente) setDatos({ clave, d }) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  if (!datos || datos.clave !== clave) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  }
  const { puestos, vendidos, disponible, porGalpon } = datos.d
  const negativos = TAMANOS_HUEVO.filter(t => disponible[t.key] < 0)
  // Galpones con aves hoy y los que alguna vez pusieron huevo
  const vivos = new Set(lotes.map(l => l.instalacion_id ?? `lote:${l.nombre}`))
  const filas = porGalpon.filter(f => vivos.has(f.clave) || totalTamanos(f.puestos) > 0)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800"><Ic n="huevo" /> Huevos de la finca</h2>
        <p className="text-xs text-gray-400">
          Todo el huevo de todos los galpones. Lo que se registra en producción suma y lo que se vende (desde Ventas, para
          toda la finca) baja.
        </p>
      </div>

      {negativos.length > 0 && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <Ic n="alerta" /> Se vendió más huevo {negativos.map(t => t.label).join(', ')} del que está registrado en producción.
          Revisa los días que faltan por registrar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Indicador tono="amber" etiqueta="Disponible en la finca" valor={totalTamanos(disponible).toLocaleString('es-CO')} detalle="huevos sin vender" />
        <Indicador tono="green" etiqueta="Puestos (histórico)" valor={totalTamanos(puestos).toLocaleString('es-CO')} />
        <Indicador tono="gray" etiqueta="Vendidos (histórico)" valor={totalTamanos(vendidos).toLocaleString('es-CO')} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Disponible por tamaño</CardTitle>
          <p className="text-xs text-gray-400">Puesto − vendido, en toda la finca</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
            {TAMANOS_HUEVO.map(t => (
              <div key={t.key} className="rounded-lg border border-gray-100 bg-gray-50 py-3 text-center">
                <p className="text-[10px] font-semibold text-gray-500">{t.label}</p>
                <p className={`text-xl font-bold ${disponible[t.key] < 0 ? 'text-red-600' : 'text-gray-800'}`}>{disponible[t.key].toLocaleString('es-CO')}</p>
                <p className="text-[11px] text-gray-400">
                  {puestos[t.key].toLocaleString('es-CO')} puestos · {vendidos[t.key].toLocaleString('es-CO')} vendidos
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Lo que ha puesto cada galpón</CardTitle>
          <p className="text-xs text-gray-400">Huevo clasificado de todos los lotes que han pasado por el galpón</p>
        </CardHeader>
        <CardContent className="p-0">
          {filas.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No hay galpones con huevo todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Galpón</TableHead>
                    {TAMANOS_HUEVO.map(t => <TableHead key={t.key} className="text-right">{t.label}</TableHead>)}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Parte de la finca</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map(f => {
                    const total = totalTamanos(f.puestos)
                    const totalFinca = totalTamanos(puestos)
                    return (
                      <TableRow key={f.clave}>
                        <TableCell className="text-sm font-medium"><Ic n="ave" /> {f.nombre}</TableCell>
                        {TAMANOS_HUEVO.map(t => (
                          <TableCell key={t.key} className="text-right text-sm">{f.puestos[t.key].toLocaleString('es-CO')}</TableCell>
                        ))}
                        <TableCell className="text-right text-sm font-semibold">{total.toLocaleString('es-CO')}</TableCell>
                        <TableCell className="text-right text-sm text-gray-500">
                          {totalFinca > 0 ? `${((total / totalFinca) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %` : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
