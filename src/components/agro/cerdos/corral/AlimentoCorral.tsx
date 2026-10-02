'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Indicador, GrupoIndicadores } from '@/components/ui/indicador'
import { Ic } from '@/components/ui/icon'
import RegistrarConsumoGenericoModal from '@/components/agro/comun/RegistrarConsumoGenericoModal'
import type { TipoAlimentoGenerico } from '@/components/agro/comun/CrearTipoAlimentoGenericoModal'
import { CONFIG_ESPECIES, dbGenerico } from '@/lib/especiesConfig'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Registro = { id: string; fecha: string; alimento_kg: number; tipo_alimento_id: string | null; agua_litros: number | null; observaciones: string | null }

const CONFIG = CONFIG_ESPECIES.cerdos

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * El alimento del corral, como en los galpones de aves: lo que come al día y los
 * bultos que quedan en bodega de ese alimento (repartidos entre todos los corrales
 * que lo comen). El alimento y sus entradas se registran en Alimento de la finca;
 * aquí solo se registra el consumo.
 */
export default function AlimentoCorral({ lote, onCambio }: { lote: LoteCerdos; onCambio: () => void }) {
  const supabase = createClient()
  const [tipos, setTipos] = useState<TipoAlimentoGenerico[]>([])
  const [consumos, setConsumos] = useState<Registro[]>([])
  const [stock, setStock] = useState<{ bultos: number; pesoBulto: number } | null>(null)
  const [kgDiaTodos, setKgDiaTodos] = useState(0)
  const [corralesQueLoComen, setCorralesQueLoComen] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [modalConsumo, setModalConsumo] = useState(false)

  const cargar = useCallback(async () => {
    const [t, c, otros] = await Promise.all([
      supabase.from('tipos_alimento_cerdos').select('*').eq('finca_id', lote.finca_id).eq('activo', true).order('nombre'),
      supabase.from('nutricion_diaria_cerdos').select('id, fecha, alimento_kg, tipo_alimento_id, agua_litros, observaciones')
        .eq('lote_id', lote.id).gt('alimento_kg', 0).order('fecha', { ascending: false }).limit(60),
      lote.alimento_activo_id
        ? supabase.from('lotes_cerdos').select('id, consumo_activo_kg').eq('finca_id', lote.finca_id)
          .eq('estado', 'activo').eq('alimento_activo_id', lote.alimento_activo_id)
        : Promise.resolve({ data: [] as { id: string; consumo_activo_kg: number | null }[] }),
    ])
    setTipos((t.data ?? []) as TipoAlimentoGenerico[])
    setConsumos((c.data ?? []) as Registro[])
    const queComen = (otros.data ?? []).filter(o => Number(o.consumo_activo_kg ?? 0) > 0)
    setKgDiaTodos(queComen.reduce((s, o) => s + Number(o.consumo_activo_kg), 0))
    setCorralesQueLoComen(queComen.length)
    if (lote.alimento_activo_id) {
      // Funciones y vistas de la base que no están en los tipos generados
      const db = dbGenerico(supabase)
      await db.rpc('recalcular_stock_alimento_cerdos', { p_finca: lote.finca_id })
      const { data: s } = await db.from('stock_alimento_lote')
        .select('bultos_disponibles, peso_bulto_kg').eq('tipo_alimento_id', lote.alimento_activo_id).maybeSingle()
      setStock(s ? { bultos: Number(s.bultos_disponibles), pesoBulto: Number(s.peso_bulto_kg) } : null)
    } else {
      setStock(null)
    }
    setCargando(false)
  }, [lote.id, lote.finca_id, lote.alimento_activo_id, supabase])

  useEffect(() => { cargar() }, [cargar])

  async function quitar(r: Registro) {
    // Si el día solo existía por el consumo se borra; si tiene más (agua, notas), se le quita el consumo
    const soloConsumo = r.agua_litros == null && !r.observaciones
    const { error } = soloConsumo
      ? await supabase.from('nutricion_diaria_cerdos').delete().eq('id', r.id)
      : await supabase.from('nutricion_diaria_cerdos').update({ alimento_kg: 0, tipo_alimento_id: null }).eq('id', r.id)
    if (error) { toast.error('No se pudo quitar el consumo'); return }
    toast.success('Consumo quitado')
    onCambio()
    cargar()
  }

  if (cargando) return <div className="space-y-3"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>

  const tipoActivo = tipos.find(t => t.id === lote.alimento_activo_id) ?? null
  const kgDia = Number(lote.consumo_activo_kg ?? 0)
  const pesoBulto = stock?.pesoBulto ?? Number(tipoActivo?.peso_bulto_kg ?? 40)
  const bultosDia = kgDia > 0 ? kgDia / pesoBulto : 0
  const kgPorCerdo = kgDia > 0 && lote.animales_actuales > 0 ? kgDia / lote.animales_actuales : null
  // Los días que alcanza salen del consumo de todos los corrales que comen ese alimento
  const dias = stock && kgDiaTodos > 0 && stock.bultos > 0 ? Math.floor((stock.bultos * stock.pesoBulto) / kgDiaTodos) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Alimento del corral</h2>
          <p className="text-xs text-gray-400">El consumo registrado rige hasta que se registre otro. El alimento y sus entradas van en Alimento de la finca.</p>
        </div>
        <Button onClick={() => setModalConsumo(true)} disabled={tipos.length === 0}>
          <Ic n="mas" /> Registrar consumo
        </Button>
      </div>

      {tipos.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-5 text-sm text-amber-800">
            <Ic n="alerta" /> La finca todavía no tiene alimentos registrados. Primero regístralo con su entrada de bultos en{' '}
            <Link href="/alimento" className="font-medium underline">Alimento</Link>, y luego vuelve a registrar el consumo del corral.
          </CardContent>
        </Card>
      ) : kgDia <= 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Ic n="alerta" /> Falta registrar el consumo del corral: sin él no se puede llevar el diario.
        </div>
      )}

      {kgDia > 0 && (
        <GrupoIndicadores>
          <Indicador
            tono="amber" icono="alimento" etiqueta="Consume al día"
            valor={`${kgDia.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`}
            detalle={<>{bultosDia.toLocaleString('es-CO', { maximumFractionDigits: 2 })} bultos{kgPorCerdo != null && ` · ${kgPorCerdo.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg por cerdo`}{tipoActivo && ` · ${tipoActivo.nombre}`}</>}
          />
          <Indicador
            tono={stock && stock.bultos <= 0 ? 'red' : 'green'} icono="caja" etiqueta="Bultos disponibles"
            valor={stock ? `${Math.max(0, stock.bultos).toLocaleString('es-CO', { maximumFractionDigits: 1 })}` : '—'}
            detalle={!stock
              ? 'Sin entradas de este alimento'
              : stock.bultos <= 0
                ? <span className="text-red-700">Se acabó: registra una entrada en Alimento</span>
                : `${dias != null ? `alcanza ${dias} día${dias === 1 ? '' : 's'}` : ''}${corralesQueLoComen > 1 ? ` · lo comen ${corralesQueLoComen} corrales` : ''}`}
          />
        </GrupoIndicadores>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Consumo registrado</CardTitle></CardHeader>
        <CardContent className="p-0">
          {consumos.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">Sin consumo registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desde</TableHead>
                    <TableHead>Alimento</TableHead>
                    <TableHead className="text-right">Kg al día</TableHead>
                    <TableHead className="text-right">Bultos al día</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumos.map((r, i) => {
                    const tipo = tipos.find(t => t.id === r.tipo_alimento_id)
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="py-2 text-sm">{fmt(r.fecha)}{i === 0 && <span className="ml-1.5 rounded bg-green-50 px-1 text-[0.625rem] text-green-700">vigente</span>}</TableCell>
                        <TableCell className="py-2 text-sm text-gray-600">{tipo?.nombre ?? '—'}</TableCell>
                        <TableCell className="py-2 text-right text-sm tabular-nums">{Number(r.alimento_kg).toLocaleString('es-CO', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="py-2 text-right text-sm tabular-nums">{(Number(r.alimento_kg) / Number(tipo?.peso_bulto_kg ?? 40)).toLocaleString('es-CO', { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="py-2 text-right">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={() => quitar(r)}>Quitar</Button>
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

      <RegistrarConsumoGenericoModal
        open={modalConsumo}
        onClose={() => setModalConsumo(false)}
        loteId={lote.id}
        fincaId={lote.finca_id}
        config={CONFIG}
        tiposAlimento={tipos}
        onCreated={() => { onCambio(); cargar() }}
      />
    </div>
  )
}
