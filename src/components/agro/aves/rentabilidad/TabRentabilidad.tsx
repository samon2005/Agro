'use client'

import { useEffect, useRef, useState } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BarraExportar, type Vista } from '@/components/ui/barra-exportar'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Indicador, GrupoIndicadores } from '@/components/ui/indicador'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { useFinca } from '@/components/agro/FincaProvider'
import { useResumenSemanal } from '@/lib/useResumenSemanal'
import { cop, hayPrecios, preciosDeFinca, TAMANOS_HUEVO } from '@/lib/huevos'
import { cargarDatosCostos, costoPorTamano, costosDeLote, ultimaSemanaPostura, type DatosCostosLote } from '@/lib/costoHuevo'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

const n1 = (v: number) => v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pesos = (v: number) => cop(Math.round(v))
const pesos1 = (v: number) => `$ ${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })}`
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })

/**
 * Lo que cuesta cada huevo del galpón, lo que vale a los precios de la finca y
 * lo que queda, semana a semana. Con eso, el punto de equilibrio: el % de postura
 * con el que el huevo apenas paga lo que cuesta producirlo.
 */
export default function TabRentabilidad({ loteActual }: { loteActual: LoteAves }) {
  const { fincaActual } = useFinca()
  const { filas, cargando: cargandoSemanas } = useResumenSemanal(loteActual)
  const [datos, setDatos] = useState<DatosCostosLote | null>(null)
  const [margen, setMargen] = useState('20')
  const [vista, setVista] = useState<Vista>('tabla')
  const imprimir = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vigente = true
    cargarDatosCostos(createClient(), loteActual).then(d => { if (vigente) setDatos(d) })
    return () => { vigente = false }
  }, [loteActual])

  const precios = preciosDeFinca(fincaActual)
  const listos = datos && datos.loteId === loteActual.id && !cargandoSemanas

  if (!listos) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
  }

  const r = costosDeLote(loteActual, filas, datos, precios)
  const ultima = ultimaSemanaPostura(r.semanas)
  const kgSinPrecio = r.semanas.reduce((s, x) => s + x.kgSinPrecio, 0)
  const margenNum = Number(margen.replace(',', '.'))
  const margenValido = Number.isFinite(margenNum) && margenNum >= 0 && margenNum < 1000
  const porTamano = ultima?.costoGramo != null ? costoPorTamano(ultima.costoGramo) : null
  const visibles = [...r.semanas].reverse()
  const sinPrecios = !hayPrecios(precios)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Rentabilidad del galpón</h2>
        <p className="text-sm text-gray-500">
          Costo de producir cada huevo, lo que vale a los precios de la finca y el punto de equilibrio. El huevo se vende por la finca:
          aquí el ingreso es una estimación con los precios de venta, para comparar el galpón.
        </p>
      </div>

      {(kgSinPrecio > 0 || sinPrecios) && (
        <div className="space-y-1">
          {kgSinPrecio > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Ic n="aviso" /> {n1(kgSinPrecio)} kg de alimento consumido no tienen precio: registra el precio del bulto en sus entradas
              (Inventario) para que el costo del alimento sea completo.
            </p>
          )}
          {sinPrecios && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Ic n="aviso" /> La finca no tiene precios del huevo: defínelos en Ventas de la finca para estimar el ingreso, la utilidad y el punto de equilibrio.
            </p>
          )}
        </div>
      )}

      <GrupoIndicadores>
        <Indicador
          tono="orange" icono="recibo" etiqueta="Costo por huevo"
          valor={ultima?.costoHuevo != null ? pesos1(ultima.costoHuevo) : '—'}
          detalle={ultima ? `Semana ${ultima.semana} de postura (${fechaCorta(ultima.desde)} – ${fechaCorta(ultima.hasta)})` : 'Todavía no hay semanas de postura'}
        />
        <Indicador
          tono="green" icono="precio" etiqueta="Precio promedio del huevo"
          valor={ultima?.precioPromedio != null ? pesos1(ultima.precioPromedio) : '—'}
          detalle={ultima?.utilidad != null
            ? <span className={ultima.utilidad >= 0 ? 'text-green-700' : 'text-red-700'}>Utilidad de la semana: {pesos(ultima.utilidad)}</span>
            : 'Con los precios de la finca y los tamaños de la semana'}
        />
        <Indicador
          tono={ultima?.equilibrioPct != null && ultima.posturaPct != null && ultima.posturaPct < ultima.equilibrioPct ? 'red' : 'blue'}
          icono="meta" etiqueta="Punto de equilibrio"
          valor={ultima?.equilibrioPct != null ? `${n1(ultima.equilibrioPct)} %` : '—'}
          detalle={ultima?.equilibrioPct != null
            ? ultima.posturaPct != null
              ? ultima.posturaPct >= ultima.equilibrioPct
                ? `Postura de ${n1(ultima.posturaPct)} %: por encima, el huevo paga sus costos`
                : <span className="text-red-700">Postura de {n1(ultima.posturaPct)} %: por debajo, el galpón pierde</span>
              : 'Postura con la que el ingreso cubre los costos'
            : 'Hace falta una semana de postura con precios'}
        />
        <Indicador
          tono="purple" icono="gallina" etiqueta="Inversión en las aves"
          valor={pesos(r.inversion)}
          detalle={`Compra y levante, repartida en ${r.semanasCiclo} semanas de postura: ${pesos(r.amortizacionSemanal)} por semana`}
        />
      </GrupoIndicadores>

      {porTamano && ultima && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-gray-700">Costo y precio por tamaño</CardTitle>
                <p className="text-xs text-gray-400">
                  El costo se reparte por el peso de cada tamaño (B 49,5 · A 56,5 · AA 63,5 · AAA 72,5 · Jumbo 80 g), con la semana {ultima.semana} de postura.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                Utilidad buscada
                <Input className="h-8 w-16 text-right" inputMode="decimal" value={margen} onChange={e => setMargen(e.target.value)} /> %
              </label>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tamaño</th>
                    <th className="px-3 py-2 text-right font-medium">Costo</th>
                    <th className="px-3 py-2 text-right font-medium">Precio de la finca</th>
                    <th className="px-3 py-2 text-right font-medium">Utilidad por huevo</th>
                    <th className="px-3 py-2 text-right font-medium">Precio sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  {TAMANOS_HUEVO.map(t => {
                    const costo = porTamano[t.key]
                    const precio = precios[t.key]
                    const util = precio != null && precio > 0 ? precio - costo : null
                    return (
                      <tr key={t.key} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-800">{t.label}</td>
                        <td className="px-3 py-2 text-right">{pesos1(costo)}</td>
                        <td className="px-3 py-2 text-right">{precio != null && precio > 0 ? pesos(precio) : '—'}</td>
                        <td className={cn('px-3 py-2 text-right', util == null ? 'text-gray-400' : util >= 0 ? 'text-green-700' : 'text-red-700')}>
                          {util != null ? `${pesos1(util)} (${n1((util / precio!) * 100)} %)` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{margenValido ? pesos(costo * (1 + margenNum / 100)) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Semana a semana</CardTitle>
            <BarraExportar
              titulo={`Rentabilidad ${loteActual.nombre}`}
              imprimir={imprimir}
              vista={vista}
              onVista={setVista}
              hojas={() => [{
                nombre: 'Rentabilidad',
                columnas: ['Semana', 'Etapa', 'Desde', 'Hasta', 'Huevos', '% postura', 'Alimento', 'Kg sin precio', 'Directos', 'Finca', 'Aves (amortización)', 'Costo total', 'Costo por huevo', 'Precio promedio', 'Ingreso estimado', 'Utilidad', '% equilibrio'],
                filas: r.semanas.map(s => {
                  const v = (x: number | null) => (x == null ? null : Math.round(x * 100) / 100)
                  return [s.semana, s.etapa, s.desde, s.hasta, s.huevos, v(s.posturaPct), v(s.alimento), v(s.kgSinPrecio), v(s.directos), v(s.finca),
                    v(s.amortizacion), v(s.total), v(s.costoHuevo), v(s.precioPromedio), v(s.ingreso), v(s.utilidad), v(s.equilibrioPct)]
                }),
              }]}
            />
          </div>
          <p className="text-xs text-gray-400">
            Alimento: lo consumido por su precio por kg. Directos: costos registrados del galpón. Finca: su parte de los costos
            generales (por sus aves). Aves: la inversión repartida. En levante todo va a la inversión.
          </p>
        </CardHeader>
        <CardContent className="p-0" ref={imprimir}>
          {visibles.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">El lote todavía no tiene semanas</p>
          ) : vista === 'grafica' ? (
            <div className="h-80 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={r.semanas.filter(s => s.etapa === 'postura').map(s => ({
                  semana: `P${s.semana}`,
                  utilidad: s.utilidad != null ? Math.round(s.utilidad) : null,
                  postura: s.posturaPct != null ? Math.round(s.posturaPct * 10) / 10 : null,
                  equilibrio: s.equilibrioPct != null ? Math.round(s.equilibrioPct * 10) / 10 : null,
                }))} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="pesos" tick={{ fontSize: 10 }} tickFormatter={v => `$${(Number(v) / 1000).toLocaleString('es-CO')}k`} />
                  <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip formatter={(v, n) => (v == null ? '—' : n === 'Utilidad' ? pesos(Number(v)) : `${Number(v).toLocaleString('es-CO')} %`)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="pesos" dataKey="utilidad" name="Utilidad" fill="#86EFAC" />
                  <Line yAxisId="pct" dataKey="postura" name="% postura" stroke="#15803D" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="pct" dataKey="equilibrio" name="% equilibrio" stroke="#DC2626" strokeDasharray="5 3" dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full border-collapse text-[0.75rem] tabular-nums">
                <thead className="sticky top-0 bg-gray-50 text-gray-500">
                  <tr>
                    {['Semana', 'Huevos', '% postura', 'Alimento', 'Directos', 'Finca', 'Aves', 'Costo total', 'Costo/huevo', 'Ingreso est.', 'Utilidad', 'Equilibrio'].map(h => (
                      <th key={h} className={cn('px-2 py-2 font-medium', h === 'Semana' ? 'text-left' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(s => {
                    const levante = s.etapa === 'levante'
                    return (
                      <tr key={s.clave} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="font-semibold text-gray-800">{s.semana}</span>
                          <span className={cn('ml-1.5 rounded px-1 text-[0.625rem]', levante ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>{s.etapa}</span>
                          <span className="block text-[0.625rem] text-gray-400">{fechaCorta(s.desde)} – {fechaCorta(s.hasta)}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right">{s.huevos.toLocaleString('es-CO')}</td>
                        <td className="px-2 py-1.5 text-right">{s.posturaPct != null ? n1(s.posturaPct) : '—'}</td>
                        <td className="px-2 py-1.5 text-right">{pesos(s.alimento)}{s.kgSinPrecio > 0 && <span className="text-amber-600" title="Hay alimento sin precio"> *</span>}</td>
                        <td className="px-2 py-1.5 text-right">{pesos(s.directos)}</td>
                        <td className="px-2 py-1.5 text-right">{pesos(s.finca)}</td>
                        <td className="px-2 py-1.5 text-right">{levante ? <span className="text-gray-400">inversión</span> : pesos(s.amortizacion)}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{levante ? '—' : pesos(s.total)}</td>
                        <td className="px-2 py-1.5 text-right">{s.costoHuevo != null ? pesos1(s.costoHuevo) : '—'}</td>
                        <td className="px-2 py-1.5 text-right">{s.ingreso != null ? pesos(s.ingreso) : '—'}</td>
                        <td className={cn('px-2 py-1.5 text-right', s.utilidad == null ? '' : s.utilidad >= 0 ? 'text-green-700' : 'text-red-700')}>
                          {s.utilidad != null ? pesos(s.utilidad) : '—'}
                        </td>
                        <td className={cn('px-2 py-1.5 text-right', s.equilibrioPct != null && s.posturaPct != null && s.posturaPct < s.equilibrioPct && 'text-red-700')}>
                          {s.equilibrioPct != null ? `${n1(s.equilibrioPct)} %` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
