'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import RegistrarDiaCerdosModal from './RegistrarDiaCerdosModal'
import { Widget, Cuadricula, ANCHO } from '@/components/ui/widgets/Widget'
import { Anillo, BarraMeta, Cifra, MiniBarras, TextoEstado } from '@/components/ui/widgets/Medidores'
import { CalendarioMes } from '@/components/ui/widgets/Calendario'
import { BandejaAlertas } from '@/components/ui/widgets/Alertas'
import { CurvaArea } from '@/components/ui/widgets/Curva'
import { Torta } from '@/components/ui/graficos/Torta'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'
import { Ic } from '@/components/ui/icon'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type NutricionDiaria = Database['public']['Tables']['nutricion_diaria_cerdos']['Row']
type Mortalidad = Database['public']['Tables']['mortalidad_cerdos']['Row']

interface Props {
  loteActual: LoteCerdos
  onLoteUpdated: () => void
  /** Lleva a la pestaña Alimento del corral, donde se registra el consumo */
  onIrAlimento?: () => void
}

/**
 * El día a día del lote en un solo lugar: lo que hay que anotar cada jornada
 * (alimento, agua y mortalidad) y el historial de lo anotado.
 */
export default function TabDiarioCerdos({ loteActual, onLoteUpdated, onIrAlimento }: Props) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<NutricionDiaria[]>([])
  const [mortalidad, setMortalidad] = useState<Mortalidad[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [registroEditar, setRegistroEditar] = useState<NutricionDiaria | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [diarios, morts] = await Promise.all([
      supabase.from('nutricion_diaria_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }).limit(60),
      supabase.from('mortalidad_cerdos').select('*').eq('lote_id', loteActual.id).order('fecha', { ascending: false }),
    ])
    setRegistros(diarios.data ?? [])
    setMortalidad(morts.data ?? [])
    setLoading(false)
  }, [loteActual.id, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function eliminarRegistro(r: NutricionDiaria) {
    if (confirmandoEliminar !== r.id) { setConfirmandoEliminar(r.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('nutricion_diaria_cerdos').delete().eq('id', r.id)
    if (error) { toast.error('Error al eliminar el registro'); return }
    toast.success('Registro eliminado')
    fetchAll()
  }

  function fmt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const hoyStr = hoyLocal()
  const registroHoy = registros.find(r => r.fecha === hoyStr)
  // Como en las aves: sin consumo registrado no se lleva el día (no habría con qué descontar el alimento)
  const sinAlimento = !(Number(loteActual.consumo_activo_kg ?? 0) > 0) || loteActual.alimento_activo_id == null

  // Mortalidad indexada por fecha, para verla junto al día que le corresponde
  const mortPorFecha = new Map<string, Mortalidad[]>()
  for (const m of mortalidad) {
    const lista = mortPorFecha.get(m.fecha) ?? []
    lista.push(m)
    mortPorFecha.set(m.fecha, lista)
  }

  const ultimos7 = registros.slice(0, 7)
  const ultimos14 = registros.filter(r => r.fecha <= hoyStr).slice(0, 14).reverse()
  const etiquetaDia = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  const agua7 = ultimos7.reduce((s, r) => s + Number(r.agua_litros ?? 0), 0)
  const muertesTotal = mortalidad.reduce((s, m) => s + (m.cantidad ?? 0), 0)
  const mortPct = loteActual.numero_animales > 0 ? (muertesTotal / loteActual.numero_animales) * 100 : 0
  const viabilidad = loteActual.numero_animales > 0 ? 100 - mortPct : null
  const causas = Object.entries(mortalidad.reduce<Record<string, number>>((m, x) => {
    const k = x.causa?.trim() || 'Sin causa anotada'
    m[k] = (m[k] ?? 0) + (x.cantidad ?? 0)
    return m
  }, {})).map(([causa, cantidad]) => ({ causa, cantidad }))
  const diaDelMes = Number(hoyStr.slice(8, 10))
  const diasEsteMes = registros.filter(r => r.fecha.startsWith(hoyStr.slice(0, 7))).length
  const alimento7 = ultimos7.reduce((s, r) => s + Number(r.alimento_kg), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Diario del lote</h2>
          <p className="text-xs text-gray-400">Lo que se registra todos los días: alimento, agua y mortalidad.</p>
        </div>
        <Button
          onClick={() => { setRegistroEditar(null); setModalOpen(true) }}
          disabled={sinAlimento}
          className="bg-orange-600 hover:bg-orange-700 text-white text-sm"
        >
          + Registrar día
        </Button>
      </div>

      {sinAlimento && (
        <BandejaAlertas alertas={[{
          id: 'alimento', nivel: 'revisar',
          texto: 'Falta registrar el consumo de alimento del corral. Sin él no se puede llevar el diario.',
          accion: onIrAlimento ? { texto: 'Ir a Alimento', onClick: onIrAlimento } : undefined,
        }]} />
      )}

      <Cuadricula>
        <Widget className={ANCHO.cuarto} titulo="Hoy" icono="diario">
          <div className="flex items-center gap-4">
            <Anillo pct={registroHoy ? 100 : 0} centro={registroHoy ? '✓' : '—'} sub={registroHoy ? 'registrado' : 'pendiente'} estado={registroHoy ? 'bien' : 'revisar'} tamano={96} />
            <div className="min-w-0 space-y-1.5">
              <Cifra etiqueta="Alimento de hoy" valor={registroHoy ? `${Number(registroHoy.alimento_kg).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg` : '—'} />
              <TextoEstado estado={registroHoy ? 'bien' : 'revisar'}>{registroHoy ? 'Día al día' : 'Falta registrar el día'}</TextoEstado>
            </div>
          </div>
        </Widget>

        <Widget className={ANCHO.cuarto} titulo="Alimento" icono="alimento" info="Kilos del corral por día; las barras son los últimos 14 días registrados">
          <Cifra etiqueta="Últimos 7 días" valor={`${alimento7.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`} grande
            nota={loteActual.animales_actuales > 0 && ultimos7.length > 0 ? `${Math.round((alimento7 * 1000) / ultimos7.length / loteActual.animales_actuales).toLocaleString('es-CO')} g por animal al día` : undefined} />
          <div className="mt-3">
            <MiniBarras valores={ultimos14.map(r => Number(r.alimento_kg))} etiquetas={ultimos14.map(r => etiquetaDia(r.fecha))} formato={v => `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`} alto={40} />
          </div>
        </Widget>

        <Widget className={ANCHO.cuarto} titulo="Mortalidad" icono="muerte" info="Viabilidad: el % de los animales que entraron que siguen vivos">
          <div className="flex items-center gap-4">
            <Anillo pct={viabilidad} centro={viabilidad != null ? `${viabilidad.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %` : '—'} sub="viven" tamano={96}
              estado={mortPct < 3 ? 'bien' : mortPct < 6 ? 'revisar' : 'mal'} />
            <div className="min-w-0 space-y-1.5">
              <Cifra etiqueta="Muertos" valor={muertesTotal.toLocaleString('es-CO')} />
              <p className="text-[0.6875rem] text-gray-400">{mortPct.toLocaleString('es-CO', { maximumFractionDigits: 1 })} % del lote</p>
            </div>
          </div>
        </Widget>

        <Widget className={ANCHO.cuarto} titulo="Días registrados" icono="calendario">
          <Cifra etiqueta="En total" valor={registros.length.toLocaleString('es-CO')} grande nota={registros[0] ? `Último: ${etiquetaDia(registros[0].fecha)}` : 'Sin días todavía'} />
          <div className="mt-3">
            <BarraMeta etiqueta="Este mes" valor={`${diasEsteMes} de ${diaDelMes}`} pct={diaDelMes > 0 ? (diasEsteMes / diaDelMes) * 100 : null}
              estado={diasEsteMes >= diaDelMes - 1 ? 'bien' : 'revisar'} />
          </div>
        </Widget>

        <Widget className={ANCHO.dosTercios} titulo="Alimento por día" icono="grafica" info="Kilos de alimento registrados cada día (últimos 30)">
          <CurvaArea id="alim-cerdos" nombre="Alimento" barras formato={v => `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`}
            datos={[...registros.slice(0, 30)].reverse().map(r => ({ x: etiquetaDia(r.fecha), y: Number(r.alimento_kg) }))} />
        </Widget>

        <Widget className={ANCHO.tercio} titulo="De qué se murieron" icono="clinico">
          {causas.length === 0
            ? <p className="py-10 text-center text-sm text-gray-400">Sin muertes registradas</p>
            : <Torta etiquetaTotal="Muertes" porciones={causas.map(c => ({ nombre: c.causa, valor: c.cantidad }))} />}
        </Widget>

        <Widget className={ANCHO.tercio} titulo="Registros del mes" icono="calendario" info="Cada día pintado según los kilos de alimento; el punto rojo marca muertes">
          <CalendarioMes valores={new Map(registros.map(r => [r.fecha, Number(r.alimento_kg)]))} marcados={new Set(mortalidad.map(m => m.fecha))}
            formato={v => `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`} />
        </Widget>

        <Widget className={ANCHO.tercio} titulo="Agua" icono="agua" info="Litros registrados por día (últimos 14)">
          <Cifra etiqueta="Últimos 7 días" valor={agua7 > 0 ? `${agua7.toLocaleString('es-CO', { maximumFractionDigits: 0 })} L` : '—'} grande
            nota={agua7 > 0 && alimento7 > 0 ? `${(agua7 / alimento7).toLocaleString('es-CO', { maximumFractionDigits: 1 })} L por kg de alimento` : 'Sin agua registrada'} />
          <div className="mt-3">
            <MiniBarras valores={ultimos14.map(r => (r.agua_litros != null ? Number(r.agua_litros) : null))} etiquetas={ultimos14.map(r => etiquetaDia(r.fecha))} formato={v => `${v.toLocaleString('es-CO')} L`} alto={40} />
          </div>
        </Widget>

        <Widget className={ANCHO.tercio} titulo="El lote" icono="cerdo">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <Cifra etiqueta={loteActual.sistema === 'cria' ? 'Hembras' : 'Animales'} valor={loteActual.animales_actuales.toLocaleString('es-CO')} nota={`de ${loteActual.numero_animales.toLocaleString('es-CO')}`} grande />
            <Cifra etiqueta="Peso objetivo" valor={loteActual.peso_objetivo_kg ? `${loteActual.peso_objetivo_kg} kg` : '—'} grande />
            <Cifra etiqueta="Ingreso" valor={etiquetaDia(loteActual.fecha_ingreso)} />
            <Cifra etiqueta="Salida estimada" valor={loteActual.fecha_salida_estimada ? etiquetaDia(loteActual.fecha_salida_estimada) : '—'} />
          </div>
        </Widget>
      </Cuadricula>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Historial diario</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : registros.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-2"><Ic n="diario" /></p>
              <p className="text-gray-600 font-medium">Sin días registrados</p>
              <p className="text-sm text-gray-400 mb-4">Empieza a llevar el día a día del lote</p>
              <Button
                onClick={() => { setRegistroEditar(null); setModalOpen(true) }}
                disabled={sinAlimento}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                + Registrar día
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Alimento kg</TableHead>
                    <TableHead className="text-right">Agua L</TableHead>
                    <TableHead className="text-right">Muertes</TableHead>
                    <TableHead>Causa</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map(r => {
                    const morts = mortPorFecha.get(r.fecha) ?? []
                    const totalMuertes = morts.reduce((s, m) => s + m.cantidad, 0)
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{fmt(r.fecha)}</TableCell>
                        <TableCell className="text-right text-sm">{Number(r.alimento_kg).toFixed(1)}</TableCell>
                        <TableCell className="text-right text-sm text-gray-500">{r.agua_litros != null ? Number(r.agua_litros).toFixed(0) : '—'}</TableCell>
                        <TableCell className="text-right">
                          {totalMuertes > 0 ? <Badge variant="destructive" className="text-xs">{totalMuertes}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {morts.length > 0 ? morts.map(m => m.causa ?? '—').join(' · ') : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[180px] truncate">{r.observaciones ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" onClick={() => { setRegistroEditar(r); setModalOpen(true) }}><Ic n="editar" /></Button>
                            <Button
                              size="sm" variant="ghost"
                              className={confirmandoEliminar === r.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                              onClick={() => eliminarRegistro(r)}
                            >
                              {confirmandoEliminar === r.id ? '¿Confirmar?' : <Ic n="borrar" />}
                            </Button>
                          </div>
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

      <RegistrarDiaCerdosModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setRegistroEditar(null) }}
        lote={loteActual}
        registroExistente={registroEditar}
        onCreated={() => { fetchAll(); onLoteUpdated() }}
      />
    </div>
  )
}
