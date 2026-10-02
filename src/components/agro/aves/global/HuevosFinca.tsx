'use client'

import { Indicador } from '@/components/ui/indicador'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'
import { Ic } from '@/components/ui/icon'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

const TAMANOS = [
  { key: 'b', label: 'B' },
  { key: 'a', label: 'A' },
  { key: 'aa', label: 'AA' },
  { key: 'aaa', label: 'AAA' },
  { key: 'jumbo', label: 'JUMBO' },
] as const

type Tamano = typeof TAMANOS[number]['key']
type PorTamano = Record<Tamano, number>

const CERO: PorTamano = { b: 0, a: 0, aa: 0, aaa: 0, jumbo: 0 }

interface Props {
  fincaId: string
  lotes: LoteAves[]
}

interface FilaGalpon {
  clave: string
  nombre: string
  puestos: PorTamano
  vendidos: PorTamano
}

function total(p: PorTamano) {
  return TAMANOS.reduce((s, t) => s + p[t.key], 0)
}

/**
 * Huevo de toda la finca, no de un solo galpón: lo que se puso menos lo que se
 * vendió, clasificado por tamaño. Registrar producción sube el disponible y
 * registrar una venta lo baja, sin tener que llevar la cuenta aparte.
 *
 * El saldo es de cada galpón, sumando todos los lotes que han pasado por él: es
 * la misma cuenta que lleva la base en el inventario (migración 056).
 */
export default function HuevosFinca({ fincaId, lotes }: Props) {
  const supabase = createClient()
  const [filas, setFilas] = useState<FilaGalpon[]>([])
  const [loading, setLoading] = useState(true)

  const lotesKey = lotes.map(l => l.id).join(',')

  const fetchTodo = useCallback(async () => {
    setLoading(true)
    const [prodRes, ventasRes, lotesRes, galponesRes] = await Promise.all([
      supabase.from('produccion_diaria_aves')
        .select('lote_id, huevos_b, huevos_a, huevos_aa, huevos_aaa, huevos_jumbo')
        .eq('finca_id', fincaId),
      supabase.from('ventas_huevos_aves')
        .select('lote_id, cantidad_b, cantidad_a, cantidad_aa, cantidad_aaa, cantidad_jumbo')
        .eq('finca_id', fincaId),
      // Todos los lotes, también los que ya salieron: su huevo sigue en la bodega del galpón
      supabase.from('lotes_aves').select('id, nombre, instalacion_id').eq('finca_id', fincaId),
      supabase.from('instalaciones').select('id, nombre').eq('finca_id', fincaId),
    ])

    const nombreGalpon = new Map((galponesRes.data ?? []).map(g => [g.id, g.nombre]))
    const claveDe = (l: { nombre: string; instalacion_id: string | null }) =>
      l.instalacion_id && nombreGalpon.has(l.instalacion_id) ? l.instalacion_id : `lote:${l.nombre}`
    const filaDeLote = new Map<string, FilaGalpon>()
    const porGalpon = new Map<string, FilaGalpon>()
    for (const l of lotesRes.data ?? []) {
      const clave = claveDe(l)
      if (!porGalpon.has(clave)) {
        porGalpon.set(clave, {
          clave,
          nombre: (l.instalacion_id ? nombreGalpon.get(l.instalacion_id) : null) ?? l.nombre,
          puestos: { ...CERO },
          vendidos: { ...CERO },
        })
      }
      filaDeLote.set(l.id, porGalpon.get(clave)!)
    }
    for (const p of prodRes.data ?? []) {
      const fila = filaDeLote.get(p.lote_id)
      if (!fila) continue
      for (const t of TAMANOS) {
        fila.puestos[t.key] += Number(p[`huevos_${t.key}` as keyof typeof p] ?? 0)
      }
    }
    for (const v of ventasRes.data ?? []) {
      const fila = filaDeLote.get(v.lote_id)
      if (!fila) continue
      for (const t of TAMANOS) {
        fila.vendidos[t.key] += Number(v[`cantidad_${t.key}` as keyof typeof v] ?? 0)
      }
    }

    // Se ven los galpones con aves hoy y los que aún guardan (o deben) huevo
    const vivos = new Set(lotes.map(l => claveDe(l)))
    setFilas([...porGalpon.values()]
      .filter(f => vivos.has(f.clave) || total(f.puestos) !== total(f.vendidos))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })))
    setLoading(false)
    // lotesKey entra como dependencia para no re-consultar en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId, lotesKey, supabase])

  useEffect(() => { fetchTodo() }, [fetchTodo])

  const puestosFinca = { ...CERO }
  const vendidosFinca = { ...CERO }
  for (const f of filas) {
    for (const t of TAMANOS) {
      puestosFinca[t.key] += f.puestos[t.key]
      vendidosFinca[t.key] += f.vendidos[t.key]
    }
  }
  const disponibleFinca = Object.fromEntries(
    TAMANOS.map(t => [t.key, puestosFinca[t.key] - vendidosFinca[t.key]])
  ) as PorTamano

  if (loading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800"><Ic n="huevo" /> Huevos de la finca</h2>
        <p className="text-xs text-gray-400">
          Todo el huevo de todos los galpones. Lo que se registra en producción suma y lo que
          se registra en Ventas baja.
        </p>
      </div>

      {filas.some(f => total(f.vendidos) > total(f.puestos)) && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <Ic n="alerta" /> {filas.filter(f => total(f.vendidos) > total(f.puestos)).map(f => f.nombre).join(', ')}:
          se vendió más huevo del que está registrado en producción. Revisa los días que faltan por registrar.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Indicador tono="amber" etiqueta="Disponible en la finca" valor={total(disponibleFinca).toLocaleString('es-CO')} detalle="huevos sin vender" />
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Puestos (histórico)</p>
            <p className="text-2xl font-bold text-gray-800">{total(puestosFinca).toLocaleString('es-CO')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Vendidos (histórico)</p>
            <p className="text-2xl font-bold text-gray-800">{total(vendidosFinca).toLocaleString('es-CO')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Clasificación por tamaño</CardTitle>
          <p className="text-xs text-gray-400">Disponible hoy = puesto − vendido, sumando todos los galpones</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {TAMANOS.map(t => (
              <div key={t.key} className="rounded-lg border border-gray-100 bg-gray-50 py-3 text-center">
                <p className="text-[10px] font-semibold text-gray-500">{t.label}</p>
                <p className="text-xl font-bold text-gray-800">{disponibleFinca[t.key].toLocaleString('es-CO')}</p>
                <p className="text-[11px] text-gray-400">
                  {puestosFinca[t.key].toLocaleString('es-CO')} puestos · {vendidosFinca[t.key].toLocaleString('es-CO')} vendidos
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Por galpón</CardTitle>
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
                    {TAMANOS.map(t => <TableHead key={t.key} className="text-right">{t.label}</TableHead>)}
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-right">Vendidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map(f => {
                    const disponible = Object.fromEntries(
                      TAMANOS.map(t => [t.key, f.puestos[t.key] - f.vendidos[t.key]])
                    ) as PorTamano
                    return (
                      <TableRow key={f.clave}>
                        <TableCell className="font-medium text-sm"><Ic n="ave" /> {f.nombre}</TableCell>
                        {TAMANOS.map(t => (
                          <TableCell key={t.key} className="text-right text-sm">
                            {disponible[t.key].toLocaleString('es-CO')}
                          </TableCell>
                        ))}
                        <TableCell className={`text-right font-semibold text-sm ${total(disponible) < 0 ? 'text-red-600' : 'text-yellow-700'}`}>
                          {total(disponible).toLocaleString('es-CO')}
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500">
                          {total(f.vendidos).toLocaleString('es-CO')}
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
