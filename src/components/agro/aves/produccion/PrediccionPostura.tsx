'use client'

import { useEffect, useState } from 'react'
import { ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { useRol } from '@/components/agro/RolProvider'
import { useFinca } from '@/components/agro/FincaProvider'
import { hoyLocal } from '@/lib/fechas'
import { preciosDeFinca } from '@/lib/huevos'
import { fechaDeSemanaDeVida, semanaDeVida, semanaInicioPostura } from '@/lib/referencias'
import { useReferencia } from '@/lib/useReferencia'
import { useResumenSemanal } from '@/lib/useResumenSemanal'
import { cargarDatosCostos, costosDeLote, ultimaSemanaPostura, type DatosCostosLote } from '@/lib/costoHuevo'
import { predecirPostura, type Punto } from '@/lib/prediccion'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

// Si no se sabe la edad ni hay guía, se supone que empezaron a poner en esta semana de vida
const INICIO_SUPUESTO = 19
const n1 = (v: number) => v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fechaLarga = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * Hacia dónde va la postura del lote: la curva ajustada a sus semanas reales
 * (modelo MCM), su pico y su persistencia, los huevos que faltan hasta el fin del
 * ciclo y, con el costo del huevo, la semana en que la postura dejaría de pagar
 * los costos. Todo es estimado: sirve para planear, no para decidir solo.
 */
export default function PrediccionPostura({ lote, version }: { lote: LoteAves; version?: string | number }) {
  const puedeVerCostos = useRol() !== 'trabajador'
  const { fincaActual } = useFinca()
  const ref = useReferencia(lote.referencia_id)
  const { filas, cargando } = useResumenSemanal(lote, undefined, version)
  const [eventos, setEventos] = useState<{ loteId: string; lista: { fecha: string; resuelto: boolean; tipo_evento: string }[] } | null>(null)
  const [costos, setCostos] = useState<DatosCostosLote | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    const id = lote.id
    supabase.from('eventos_clinicos_aves').select('fecha, resuelto, tipo_evento, origen').eq('lote_id', id).then(({ data }) => {
      // Las muertes del día también se guardan como evento: esas no son una enfermedad
      if (vigente) setEventos({ loteId: id, lista: (data ?? []).filter(e => e.origen !== 'mortalidad') })
    })
    if (puedeVerCostos) cargarDatosCostos(supabase, lote).then(d => { if (vigente) setCostos(d) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lote.id, version, puedeVerCostos])

  const listaEventos = eventos?.loteId === lote.id ? eventos.lista : null
  if (cargando || listaEventos == null) return <Skeleton className="h-80 w-full rounded-2xl" />

  // ── Semana de vida de cada semana de postura ──
  const inicioGuia = semanaInicioPostura(ref)
  const sinEdad = !lote.fecha_nacimiento
  const semanasPostura = filas.filter(f => f.etapa === 'postura')
  const vidaDe = (desde: string, semanaPostura: number) =>
    lote.fecha_nacimiento ? semanaDeVida(lote.fecha_nacimiento, desde)! : (inicioGuia ?? INICIO_SUPUESTO) + semanaPostura - 1

  const hoy = hoyLocal()
  const reales: (Punto & { semana: number; completa: boolean })[] = semanasPostura
    .filter(f => f.posturaPct != null)
    .map(f => {
      const dias = Math.round((new Date(f.hasta + 'T00:00:00').getTime() - new Date(f.desde + 'T00:00:00').getTime()) / 86_400_000) + 1
      const conEvento = listaEventos.some(e => e.fecha >= f.desde && e.fecha <= f.hasta)
      // Un bache por enfermedad o una semana a medias no deben torcer la curva
      return { x: vidaDe(f.desde, f.semana), y: f.posturaPct!, semana: f.semana, completa: dias >= 7, peso: (conEvento ? 0.3 : 1) * (dias < 7 ? 0.5 : 1) }
    })
  const guia: Punto[] = [...ref.values()]
    .filter(r => r.postura_min != null || r.postura_max != null)
    .map(r => ({ x: r.semana, y: (Number(r.postura_min ?? r.postura_max) + Number(r.postura_max ?? r.postura_min)) / 2 }))

  const pred = predecirPostura(guia, reales)
  if (!pred) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-gray-500">
          <Ic n="grafica" /> Para predecir la postura hacen falta al menos dos semanas de postura registradas o una guía de la línea
          (Configurar galpón → Referencia).
        </CardContent>
      </Card>
    )
  }

  // ── Hasta cuándo va el ciclo ──
  const vidaHoy = lote.fecha_nacimiento ? semanaDeVida(lote.fecha_nacimiento, hoy)! : (reales[reales.length - 1]?.x ?? (inicioGuia ?? INICIO_SUPUESTO))
  const vidaInicio = reales[0]?.x ?? inicioGuia ?? INICIO_SUPUESTO
  let vidaFin = vidaInicio + (lote.semanas_ciclo_postura ?? 60) - 1
  if (lote.fecha_salida_programada && lote.fecha_nacimiento) vidaFin = semanaDeVida(lote.fecha_nacimiento, lote.fecha_salida_programada) ?? vidaFin
  vidaFin = Math.min(100, Math.max(vidaFin, vidaHoy))

  // Mortalidad semanal: la de las últimas 4 semanas de postura, o 0,1 % si no hay
  const ultimasMort = semanasPostura.slice(-4).map(f => f.mortalidadPct).filter((m): m is number => m != null)
  const mortSemanal = ultimasMort.length ? ultimasMort.reduce((s, m) => s + m, 0) / ultimasMort.length / 100 : 0.001
  let aves = lote.aves_actuales
  let huevosFaltan = 0
  for (let x = vidaHoy + 1; x <= vidaFin; x++) {
    aves *= 1 - mortSemanal
    huevosFaltan += aves * 7 * (pred.curva(x) / 100)
  }

  // ── Punto de equilibrio y descarte sugerido ──
  let equilibrio: number | null = null
  if (puedeVerCostos && costos && costos.loteId === lote.id) {
    equilibrio = ultimaSemanaPostura(costosDeLote(lote, filas, costos, preciosDeFinca(fincaActual)).semanas)?.equilibrioPct ?? null
  }
  let semanaDescarte: number | null = null
  if (equilibrio != null) {
    for (let x = Math.max(vidaHoy, Math.ceil(pred.picoSemana)); x <= 100; x++) {
      if (pred.curva(x) < equilibrio) { semanaDescarte = x; break }
    }
  }

  // ── Efecto del último bache: la última semana completa frente a la curva ──
  const ultimaReal = [...reales].reverse().find(r => r.completa)
  const esperadaUltima = ultimaReal ? pred.curva(ultimaReal.x) : null
  const efecto = ultimaReal && esperadaUltima && esperadaUltima > 0 ? 1 - ultimaReal.y / esperadaUltima : null
  const eventoAbierto = listaEventos.find(e => !e.resuelto)

  // ── Datos de la gráfica ──
  const desde = Math.max(1, Math.min(vidaInicio, Math.floor(pred.parametros[3]), guia[0]?.x ?? 100) - 2)
  const hasta = Math.max(vidaFin, vidaHoy) + 2
  const porX = new Map(reales.map(r => [r.x, r.y]))
  const guiaPorX = new Map(guia.map(g => [g.x, g.y]))
  const datos = []
  for (let x = desde; x <= Math.min(100, hasta); x++) {
    datos.push({ x, real: porX.get(x) ?? null, curva: Number(pred.curva(x).toFixed(1)), guia: guiaPorX.get(x) ?? null })
  }
  const fechaDe = (x: number) => lote.fecha_nacimiento ? fechaLarga(fechaDeSemanaDeVida(lote.fecha_nacimiento, x)) : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700"><Ic n="grafica" /> Predicción de la postura</CardTitle>
        <p className="text-xs text-gray-400">
          Curva ajustada a las semanas reales con el modelo MCM (Sharifi et al., 2022), partiendo de la guía de la línea.
          {pred.soloGuia ? ' Todavía hay pocas semanas reales: por ahora es la curva de la guía.' : ` Ajustada con ${pred.semanasReales} semanas; se aleja de lo real ${n1(pred.errorMedio ?? 0)} puntos en promedio.`}
          {' '}Es una estimación, no un veredicto.
        </p>
        {sinEdad && (
          <p className="text-xs text-amber-700">
            Sin la edad de las aves se supone que empezaron a poner en la semana {inicioGuia ?? INICIO_SUPUESTO} de vida. Indícala en Configurar galpón.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Pico estimado</p>
            <p className="font-semibold text-gray-800">{n1(pred.picoPct)} %</p>
            <p className="text-xs text-gray-500">semana {pred.picoSemana} de vida</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Persistencia</p>
            <p className="font-semibold text-gray-800">{pred.semanasSobre90} semanas</p>
            <p className="text-xs text-gray-500">con postura de 90 % o más</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Huevos que faltan</p>
            <p className="font-semibold text-gray-800">{Math.round(huevosFaltan).toLocaleString('es-CO')}</p>
            <p className="text-xs text-gray-500">hasta la semana {vidaFin} de vida{fechaDe(vidaFin) ? ` (${fechaDe(vidaFin)})` : ''}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Descarte a revisar</p>
            {!puedeVerCostos ? (
              <p className="text-xs text-gray-500">Lo ve el administrador</p>
            ) : equilibrio == null ? (
              <p className="text-xs text-gray-500">Hace falta el costo del huevo (pestaña Rentabilidad)</p>
            ) : semanaDescarte ? (
              <>
                <p className="font-semibold text-gray-800">Semana {semanaDescarte}</p>
                <p className="text-xs text-gray-500">la postura bajaría de {n1(equilibrio)} % (equilibrio){fechaDe(semanaDescarte) ? ` · ${fechaDe(semanaDescarte)}` : ''}</p>
              </>
            ) : (
              <p className="text-xs text-gray-500">La curva no baja del equilibrio ({n1(equilibrio)} %) antes de la semana 100</p>
            )}
          </div>
        </div>

        {(eventoAbierto || (efecto != null && efecto >= 0.05)) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Ic n="aviso" />{' '}
            {efecto != null && efecto >= 0.05 && `La última semana quedó ${n1(efecto * 100)} % por debajo de la curva: la producción real sería la curva × ${n1(1 - efecto)}. `}
            {eventoAbierto && `Hay un evento clínico sin resolver (${eventoAbierto.tipo_evento}): la postura puede seguir por debajo de lo estimado.`}
          </p>
        )}

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11 }} label={{ value: 'Semana de vida', position: 'insideBottom', offset: -2, fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => (v == null ? '—' : `${n1(Number(v))} %`)} labelFormatter={l => `Semana ${l} de vida`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {guia.length > 0 && <Line dataKey="guia" name="Guía" stroke="#9CA3AF" strokeDasharray="4 4" dot={false} connectNulls />}
              <Line dataKey="curva" name="Curva estimada" stroke="#15803D" strokeWidth={2} dot={false} />
              <Scatter dataKey="real" name="Real" fill="#D97706" />
              {equilibrio != null && <ReferenceLine y={equilibrio} stroke="#DC2626" strokeDasharray="6 3" label={{ value: 'Equilibrio', fontSize: 10, fill: '#DC2626', position: 'insideTopRight' }} />}
              <ReferenceLine x={vidaHoy} stroke="#6B7280" label={{ value: 'Hoy', fontSize: 10, position: 'insideTop' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
