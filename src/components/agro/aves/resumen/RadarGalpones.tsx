'use client'

import { useEffect, useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { Leyenda } from '@/components/ui/graficos/PanelDatos'
import { SERIES, TINTA } from '@/components/ui/graficos/paleta'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cargarReferencia, esperadoDeSemana, mortalidadEsperadaDesde, semanaDeVida, type FilaReferencia } from '@/lib/referencias'
import { cargarSemanasLote } from '@/lib/useResumenSemanal'
import type { FilaSemana } from '@/lib/resumenSemanal'
import type { Database } from '@/types/database'

type LoteAves = Database['public']['Tables']['lotes_aves']['Row']

interface Eje { eje: string; real: number; detalle: string }

const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const tope = (v: number) => Math.max(0, Math.min(150, v))

/**
 * El "perfil" de un galpón: cada indicador de su última semana completa frente a
 * lo que espera la guía de su línea, donde 100 es estar justo en lo esperado.
 * Postura, peso y viabilidad: más es mejor. Consumo: 100 es comer lo esperado,
 * de más o de menos baja. Conversión: 100 es gastar el alimento esperado por kg de huevo.
 */
export function ejesRadar(semanas: FilaSemana[], ref: Map<number, FilaReferencia>, lote: LoteAves): Eje[] {
  const completas = semanas.filter(f => (new Date(f.hasta + 'T00:00:00').getTime() - new Date(f.desde + 'T00:00:00').getTime()) / 86_400_000 >= 6)
  const u = completas[completas.length - 1]
  if (!u || !lote.fecha_nacimiento) return []
  const vida = semanaDeVida(lote.fecha_nacimiento, u.desde)
  const entrada = semanaDeVida(lote.fecha_nacimiento, lote.fecha_inicio)
  const e = esperadoDeSemana(ref, vida)
  if (!e || vida == null || entrada == null) return []
  const ejes: Eje[] = []
  if (u.etapa === 'postura' && u.posturaPct != null && e.postura) {
    ejes.push({ eje: 'Postura', real: tope((u.posturaPct / e.postura) * 100), detalle: `${n1(u.posturaPct)} % (guía ${n1(e.postura)} %)` })
  }
  if (u.consumoAveGDia != null && e.consumo) {
    const desvio = Math.abs(u.consumoAveGDia - e.consumo) / e.consumo
    ejes.push({ eje: 'Consumo', real: tope(100 - desvio * 100), detalle: `${n1(u.consumoAveGDia)} g (guía ${n1(e.consumo)} g)` })
  }
  const mortEsp = mortalidadEsperadaDesde(ref, entrada, vida)
  if (mortEsp != null) {
    ejes.push({ eje: 'Viabilidad', real: tope(((100 - u.mortalidadAcumPct) / (100 - mortEsp)) * 100), detalle: `mortalidad ${n1(u.mortalidadAcumPct)} % (guía ${n1(mortEsp)} %)` })
  }
  if (u.pesoAveG != null && e.pesoAve) {
    ejes.push({ eje: 'Peso ave', real: tope((u.pesoAveG / e.pesoAve) * 100), detalle: `${Math.round(u.pesoAveG)} g (guía ${Math.round(e.pesoAve)} g)` })
  }
  if (u.etapa === 'postura' && u.pesoHuevoG != null && e.pesoHuevo) {
    ejes.push({ eje: 'Peso huevo', real: tope((u.pesoHuevoG / e.pesoHuevo) * 100), detalle: `${n1(u.pesoHuevoG)} g (guía ${n1(e.pesoHuevo)} g)` })
  }
  if (u.etapa === 'postura' && u.conversion != null && e.consumo && e.postura && e.pesoHuevo) {
    const convEsp = e.consumo / ((e.postura / 100) * e.pesoHuevo)
    ejes.push({ eje: 'Conversión', real: tope((convEsp / u.conversion) * 100), detalle: `${n1(u.conversion)} kg/kg (guía ${n1(convEsp)})` })
  }
  return ejes
}

export default function RadarGalpones({ fincaId }: { fincaId: string }) {
  const [lotes, setLotes] = useState<LoteAves[] | null>(null)
  const [loteId, setLoteId] = useState('')
  const [datos, setDatos] = useState<{ loteId: string; ejes: Eje[] } | null>(null)

  useEffect(() => {
    let vigente = true
    createClient().from('lotes_aves').select('*').eq('finca_id', fincaId).in('estado', ['activo', 'preparacion']).order('nombre')
      .then(({ data }) => {
        if (!vigente) return
        const conGuia = (data ?? []).filter(l => l.referencia_id && l.fecha_nacimiento)
        setLotes(conGuia)
        setLoteId(conGuia[0]?.id ?? '')
      })
    return () => { vigente = false }
  }, [fincaId])

  const lote = lotes?.find(l => l.id === loteId) ?? null
  useEffect(() => {
    if (!lote) return
    let vigente = true
    const supabase = createClient()
    Promise.all([cargarSemanasLote(supabase, lote), cargarReferencia(supabase, lote.referencia_id!)]).then(([semanas, ref]) => {
      if (vigente) setDatos({ loteId: lote.id, ejes: ejesRadar(semanas, ref, lote) })
    })
    return () => { vigente = false }
  }, [lote])

  if (lotes == null) return <Skeleton className="h-80 w-full rounded-2xl" />
  if (lotes.length === 0) return null
  const ejes = datos?.loteId === loteId ? datos.ejes : null

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold text-gray-700">Perfil del galpón frente a la guía</CardTitle>
          <p className="text-xs text-gray-400">Última semana completa. 100 = justo lo que espera la guía de su línea.</p>
        </div>
        <div className="w-48">
          <Select value={loteId} onValueChange={v => v && setLoteId(v)} items={Object.fromEntries(lotes.map(l => [l.id, l.nombre]))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {lotes.map(l => <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {ejes == null ? (
          <Skeleton className="h-64 w-full" />
        ) : ejes.length < 3 ? (
          <p className="py-8 text-center text-sm text-gray-400">Faltan datos de la última semana (consumo, pesaje o postura) para armar el perfil.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="90%">
                <RadarChart data={ejes.map(e => ({ ...e, guia: 100 }))} outerRadius="75%">
                  <PolarGrid stroke={TINTA.rejilla} />
                  <PolarAngleAxis dataKey="eje" tick={{ fontSize: 11, fill: TINTA.secundaria }} />
                  <PolarRadiusAxis domain={[0, 150]} tick={false} axisLine={false} />
                  <Radar name="Guía" dataKey="guia" stroke={TINTA.tenue} strokeWidth={1.5} fill="none" isAnimationActive={false} />
                  <Radar name="Galpón" dataKey="real" stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.15} isAnimationActive={false} />
                  <Tooltip content={<TooltipGrafico formato={v => n1(v)} />} />
                </RadarChart>
              </ResponsiveContainer>
              <Leyenda items={[{ nombre: 'Galpón', color: SERIES[0] }, { nombre: 'Guía (100)', color: TINTA.tenue }]} />
            </div>
            <ul className="space-y-1.5 self-center text-xs">
              {ejes.map(e => (
                <li key={e.eje} className="flex justify-between gap-2">
                  <span className="text-gray-600">{e.eje}<span className="block text-[0.6875rem] text-gray-400">{e.detalle}</span></span>
                  <span className={e.real >= 95 ? 'font-semibold text-green-700' : e.real >= 85 ? 'font-semibold text-amber-600' : 'font-semibold text-red-600'}>{Math.round(e.real)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
