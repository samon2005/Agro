'use client'

import { Area, Bar, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine } from 'recharts'
import { Degradado } from '@/components/ui/graficos/Degradado'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { BARRA, C, CURSOR_BARRA, CURSOR_LINEA, EJE, EJE_Y, REJILLA, TINTA, compacto, estiloCurva, tonoPorRecencia } from '@/components/ui/graficos/paleta'

/** Un rango con números redondos que deja ver la forma de la curva sin exagerarla */
function rangoRedondo(datos: PuntoCurva[]): [number, number] {
  const v = datos.flatMap(d => [d.y, d.guia]).filter((x): x is number => x != null)
  const min = Math.min(...v), max = Math.max(...v)
  const rango = max - min || Math.abs(max) || 1
  const paso = 10 ** Math.floor(Math.log10(rango))
  return [Math.max(0, Math.floor((min - rango * 0.6) / paso) * paso), Math.ceil((max + rango * 0.2) / paso) * paso]
}

export interface PuntoCurva { x: string; y: number | null; guia?: number | null }

/**
 * La curva de los tableros: línea suave con relleno degradado y puntos, y si
 * se pasa, la guía en gris punteado. Con `barras` se dibuja como columnas que
 * se oscurecen hacia lo más reciente.
 */
export function CurvaArea({ datos, nombre, formato = compacto, alto = 220, dominio, barras, meta, id }: {
  datos: PuntoCurva[]
  nombre: string
  formato?: (v: number) => string
  alto?: number
  dominio?: [number, number]
  barras?: boolean
  /** Línea horizontal de la meta */
  meta?: { valor: number; texto: string } | null
  id: string
}) {
  const conGuia = datos.some(d => d.guia != null)
  const idDeg = `deg-${id}`
  if (datos.every(d => d.y == null)) {
    return <p className="flex items-center justify-center text-sm text-gray-400" style={{ height: alto }}>Todavía no hay datos para dibujar</p>
  }
  return (
    <div style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={datos} margin={{ top: 10, right: 6, left: -6, bottom: 0 }}>
          <Degradado id={idDeg} color={C.principal} />
          <CartesianGrid {...REJILLA} />
          <XAxis dataKey="x" {...EJE} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...EJE_Y} domain={dominio ?? (barras ? [0, 'auto'] : rangoRedondo(datos))} tickCount={5} tickFormatter={formato} allowDecimals={false} />
          <Tooltip cursor={barras ? CURSOR_BARRA : CURSOR_LINEA} content={<TooltipGrafico formato={formato} />} />
          {meta && <ReferenceLine y={meta.valor} stroke={TINTA.tenue} strokeDasharray="5 4" label={{ value: meta.texto, position: 'insideTopRight', fontSize: 10, fill: TINTA.secundaria }} />}
          {barras ? (
            <Bar dataKey="y" name={nombre} {...BARRA} isAnimationActive={false}>
              {datos.map((_, i) => <Cell key={i} fill={tonoPorRecencia(i, datos.length)} />)}
            </Bar>
          ) : (
            <Area {...estiloCurva(C.principal, idDeg, datos.length)} dataKey="y" name={nombre} />
          )}
          {conGuia && <Line dataKey="guia" name="Guía" stroke={TINTA.tenue} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
