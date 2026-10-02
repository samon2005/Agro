'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Indicador, GrupoIndicadores } from '@/components/ui/indicador'
import { Ic } from '@/components/ui/icon'
import { semanaDelLote } from '@/lib/postura'
import type { Database } from '@/types/database'
import RegistrarPesajeModal from './RegistrarPesajeModal'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']
type Pesaje = Database['public']['Tables']['pesos_lote_aves']['Row']

const MS_DIA = 24 * 60 * 60 * 1000

function fmtFecha(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtG(g: number) {
  return `${g.toLocaleString('es-CO', { maximumFractionDigits: 1 })} g`
}

/**
 * Los pesajes del galpón: se pesa una muestra y se lleva el historial, con cuánto
 * ganaron entre un pesaje y el siguiente. En levante es lo que dice si las pollas
 * llegan bien a la postura; en postura alimenta el peso del resumen semanal.
 */
export default function TabPesajes({ loteActual }: { loteActual: LoteAves }) {
  const supabase = createClient()
  const [pesajes, setPesajes] = useState<Pesaje[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Pesaje | null>(null)
  const [confirmandoBorrar, setConfirmandoBorrar] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase
      .from('pesos_lote_aves')
      .select('*')
      .eq('lote_id', loteActual.id)
      .order('fecha', { ascending: false })
    setPesajes(data ?? [])
    setCargando(false)
  }, [loteActual.id, supabase])

  useEffect(() => { cargar() }, [cargar])

  async function borrar(p: Pesaje) {
    if (confirmandoBorrar !== p.id) { setConfirmandoBorrar(p.id); return }
    setConfirmandoBorrar(null)
    const { error } = await supabase.from('pesos_lote_aves').delete().eq('id', p.id)
    if (error) { toast.error('No se pudo eliminar el pesaje'); return }
    toast.success('Pesaje eliminado')
    cargar()
  }

  // Cada pesaje frente al anterior (la lista viene del más nuevo al más viejo)
  const filas = pesajes.map((p, i) => {
    const anterior = pesajes[i + 1] ?? null
    const promedio = Number(p.peso_promedio_g)
    const dias = anterior
      ? Math.round((new Date(p.fecha + 'T00:00:00').getTime() - new Date(anterior.fecha + 'T00:00:00').getTime()) / MS_DIA)
      : 0
    const ganancia = anterior ? promedio - Number(anterior.peso_promedio_g) : null
    return {
      p,
      promedio,
      semana: semanaDelLote(loteActual, p.fecha),
      ganancia,
      gananciaDia: ganancia != null && dias > 0 ? ganancia / dias : null,
      dias,
    }
  })

  const ultimo = filas[0] ?? null
  const enLevante = loteActual.estado === 'preparacion'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Pesajes</h2>
          <p className="text-sm text-gray-500">
            {enLevante
              ? 'En levante se pesa una muestra cada semana para saber si las pollas llegan con el peso a la postura.'
              : 'El peso de una muestra de aves. El último de cada semana sale en el resumen semanal.'}
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setModalAbierto(true) }}>
          <Ic n="mas" /> Registrar pesaje
        </Button>
      </div>

      {cargando ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : (
        <GrupoIndicadores>
          <Indicador
            tono="blue"
            icono="bascula"
            etiqueta="Último peso promedio"
            valor={ultimo ? fmtG(ultimo.promedio) : '—'}
            detalle={ultimo
              ? `${fmtFecha(ultimo.p.fecha)} · semana ${ultimo.semana.semana} de ${ultimo.semana.etapa}`
              : 'Sin pesajes todavía'}
          />
          <Indicador
            tono={ultimo?.ganancia != null && ultimo.ganancia < 0 ? 'red' : 'green'}
            icono="tendencia"
            etiqueta="Ganancia desde el pesaje anterior"
            valor={ultimo?.ganancia != null ? `${ultimo.ganancia > 0 ? '+' : ''}${fmtG(ultimo.ganancia)}` : '—'}
            detalle={ultimo?.gananciaDia != null
              ? `${ultimo.gananciaDia.toLocaleString('es-CO', { maximumFractionDigits: 1 })} g al día en ${ultimo.dias} día${ultimo.dias === 1 ? '' : 's'}`
              : 'Hace falta un segundo pesaje'}
          />
          <Indicador
            tono="purple"
            icono="grafica"
            etiqueta="Uniformidad"
            valor={ultimo?.p.uniformidad_pct != null ? `${Number(ultimo.p.uniformidad_pct).toLocaleString('es-CO')} %` : '—'}
            detalle={ultimo?.p.uniformidad_pct != null
              ? (Number(ultimo.p.uniformidad_pct) >= 80 ? 'Lote parejo (80 % o más)' : <span className="text-amber-700">Lote disparejo: menos del 80 %</span>)
              : 'Se anota al registrar el pesaje'}
          />
          <Indicador
            tono="gray"
            icono="calendario"
            etiqueta="Pesajes registrados"
            valor={pesajes.length}
            detalle={ultimo ? `${ultimo.p.aves_pesadas.toLocaleString('es-CO')} aves en la última muestra` : '—'}
          />
        </GrupoIndicadores>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial de pesajes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cargando ? (
            <div className="space-y-2 p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : filas.length === 0 ? (
            <div className="py-10 text-center">
              <p className="mb-2 text-4xl text-gray-300"><Ic n="bascula" /></p>
              <p className="font-medium text-gray-600">Sin pesajes registrados</p>
              <p className="text-sm text-gray-400">Pesa una muestra de aves y registra su peso promedio</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Semana</TableHead>
                    <TableHead className="text-right">Aves pesadas</TableHead>
                    <TableHead className="text-right">Peso promedio</TableHead>
                    <TableHead className="text-right">Mín – máx</TableHead>
                    <TableHead className="text-right">Uniformidad</TableHead>
                    <TableHead className="text-right">Ganancia</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map(f => (
                    <TableRow key={f.p.id}>
                      <TableCell className="py-2 text-sm">
                        {fmtFecha(f.p.fecha)}
                        {f.p.observaciones && <p className="text-xs text-gray-400">{f.p.observaciones}</p>}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-gray-600">
                        {f.semana.semana} <span className="text-xs text-gray-400">· {f.semana.etapa}</span>
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm tabular-nums">{f.p.aves_pesadas.toLocaleString('es-CO')}</TableCell>
                      <TableCell className="py-2 text-right text-sm font-semibold tabular-nums">{fmtG(f.promedio)}</TableCell>
                      <TableCell className="py-2 text-right text-sm text-gray-600 tabular-nums">
                        {f.p.peso_minimo_g != null || f.p.peso_maximo_g != null
                          ? `${f.p.peso_minimo_g != null ? Number(f.p.peso_minimo_g).toLocaleString('es-CO') : '—'} – ${f.p.peso_maximo_g != null ? Number(f.p.peso_maximo_g).toLocaleString('es-CO') : '—'}`
                          : '—'}
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm tabular-nums">
                        {f.p.uniformidad_pct != null ? `${Number(f.p.uniformidad_pct).toLocaleString('es-CO')} %` : '—'}
                      </TableCell>
                      <TableCell className={`py-2 text-right text-sm tabular-nums ${f.ganancia != null && f.ganancia < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                        {f.ganancia != null ? `${f.ganancia > 0 ? '+' : ''}${fmtG(f.ganancia)}` : '—'}
                        {f.gananciaDia != null && (
                          <p className="text-xs text-gray-400">{f.gananciaDia.toLocaleString('es-CO', { maximumFractionDigits: 1 })} g/día</p>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => { setEditando(f.p); setModalAbierto(true) }}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Editar"
                        >
                          <Ic n="editar" className="size-4" />
                        </button>
                        <button
                          onClick={() => borrar(f.p)}
                          onBlur={() => setConfirmandoBorrar(null)}
                          className={`rounded-md p-1.5 text-xs ${confirmandoBorrar === f.p.id ? 'bg-red-600 px-2 font-medium text-white' : 'text-gray-400 hover:bg-red-50 hover:text-red-600'}`}
                          title="Eliminar"
                        >
                          {confirmandoBorrar === f.p.id ? '¿Eliminar?' : <Ic n="borrar" className="size-4" />}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RegistrarPesajeModal
        open={modalAbierto}
        onClose={() => { setModalAbierto(false); setEditando(null) }}
        loteId={loteActual.id}
        fincaId={loteActual.finca_id}
        fechaEntrada={loteActual.fecha_inicio}
        avesActuales={loteActual.aves_actuales}
        pesajeExistente={editando}
        onGuardado={cargar}
      />
    </div>
  )
}
