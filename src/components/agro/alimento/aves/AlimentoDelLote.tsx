'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { Cifra } from '@/components/ui/widgets/Medidores'
import { PanelDatos, TablaDatos, Leyenda } from '@/components/ui/graficos/PanelDatos'
import { TooltipGrafico } from '@/components/ui/graficos/TooltipGrafico'
import { EJE, EJE_Y, REJILLA, C, CURSOR_LINEA, TINTA } from '@/components/ui/graficos/paleta'
import { useProduccionFinca } from '@/lib/useProduccionFinca'
import { alimentoDelLote, nombreMes } from '@/lib/analisisProduccion'
import { esperadoDeSemana, semanaDeVida } from '@/lib/referencias'

const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const mil = (v: number) => Math.round(v).toLocaleString('es-CO')

/**
 * Lo que comió el lote que se está mirando, hasta el día elegido: el consumo de
 * ese día frente a la guía, los totales, la curva de gramos por ave por semana de
 * vida frente a la guía y cada mes. Sirve igual para un lote activo o uno que salió.
 */
export default function AlimentoDelLote({ fincaId, loteId, hasta }: { fincaId: string; loteId: string; hasta: string }) {
  const datos = useProduccionFinca(fincaId)

  const a = useMemo(() => {
    const lote = datos?.lotes.find(l => l.id === loteId)
    if (!datos || !lote) return null
    const guia = lote.referencia_id ? datos.guias.get(lote.referencia_id) : undefined
    const r = alimentoDelLote(datos.dias, lote, hasta)
    const dia = datos.dias.find(d => d.lote_id === loteId && d.fecha === hasta)
    const semanaDia = semanaDeVida(lote.fecha_nacimiento, hasta)
    const guiaDia = guia && semanaDia != null ? esperadoDeSemana(guia, semanaDia)?.consumo ?? null : null
    const curva = r.semanas.map(s => ({ semana: s.semana, real: s.gAve, guia: guia ? esperadoDeSemana(guia, s.semana)?.consumo ?? null : null }))
    const semanaReal = r.semanas.find(s => s.semana === semanaDia)
    return { r, dia, semanaDia, guiaDia, curva, hayGuia: curva.some(c => c.guia != null), semanaReal }
  }, [datos, loteId, hasta])

  if (!datos) return <Skeleton className="h-64 rounded-2xl" />
  if (!a) return null
  if (a.r.dias === 0) return <p className="py-8 text-center text-sm text-gray-400">Este lote no tiene alimento registrado hasta ese día.</p>
  const fecha = new Date(hasta + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      <section className="superficie rounded-2xl p-5">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight" style={{ color: TINTA.primaria }}>Alimento del lote hasta el {fecha}</h3>
        <p className="text-xs text-gray-500">
          {a.semanaDia != null ? `Semana ${a.semanaDia} de vida. ` : ''}Todo lo que comió el lote desde que entró hasta ese día.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Cifra etiqueta="Ese día" valor={a.dia && Number(a.dia.alimento_kg) > 0 ? `${n1(Number(a.dia.alimento_kg))} kg` : '—'}
            nota={a.dia?.aves_en_dia && Number(a.dia.alimento_kg) > 0 ? `${mil((Number(a.dia.alimento_kg) * 1000) / a.dia.aves_en_dia)} g por gallina` : undefined} />
          <Cifra etiqueta="Esa semana" valor={a.semanaReal?.gAve != null ? `${mil(a.semanaReal.gAve)} g` : '—'}
            nota={a.guiaDia != null ? `la guía espera ${mil(a.guiaDia)} g` : 'por gallina al día'} />
          <Cifra etiqueta="Kilos en total" valor={mil(a.r.totalKg)} nota={`${mil(a.r.totalKg / 40)} bultos de 40 kg`} />
          <Cifra etiqueta="Promedio por gallina" valor={a.r.gAve != null ? `${mil(a.r.gAve)} g` : '—'} nota="al día" />
          <Cifra etiqueta="Por docena de huevos" valor={a.r.kgDocena != null ? `${n1(a.r.kgDocena)} kg` : '—'} nota="en postura" />
          <Cifra etiqueta="Días con alimento" valor={mil(a.r.dias)} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelDatos titulo="Gramos por gallina al día" subtitulo={a.hayGuia ? 'Cada semana de vida, frente a lo que espera la guía de la línea (punteada)' : 'Cada semana de vida'}>
          {v => v === 'tabla' ? (
            <TablaDatos
              columnas={[{ titulo: 'Semana' }, { titulo: 'g/gallina', numero: true }, ...(a.hayGuia ? [{ titulo: 'Guía', numero: true }] : []), { titulo: 'Kg', numero: true }]}
              filas={a.r.semanas.map(s => [`Semana ${s.semana}`, s.gAve != null ? Math.round(s.gAve) : null, ...(a.hayGuia ? [a.curva.find(c => c.semana === s.semana)?.guia ?? null] : []), Math.round(s.kg)])}
            />
          ) : (<>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={a.curva} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="semana" {...EJE} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis {...EJE_Y} tickFormatter={v => `${v} g`} />
                  <Tooltip cursor={CURSOR_LINEA} content={<TooltipGrafico formato={v => `${mil(v)} g`} titulo={s => `Semana ${s}`} />} />
                  {a.hayGuia && <Line dataKey="guia" name="Guía" stroke={TINTA.tenue} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
                  <Line dataKey="real" name="Real" stroke={C.principal} strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Leyenda items={[{ nombre: 'Real', color: C.principal }, ...(a.hayGuia ? [{ nombre: 'Guía', color: TINTA.tenue }] : [])]} />
          </>)}
        </PanelDatos>

        <PanelDatos titulo="Alimento de cada mes" subtitulo="Kilos, gramos por gallina y kilos por docena de huevos" vistas={['tabla']}>
          {() => (
            <TablaDatos
              columnas={[{ titulo: 'Mes' }, { titulo: 'Kg', numero: true }, { titulo: 'g/gallina', numero: true }, { titulo: 'Huevos', numero: true }, { titulo: 'Kg/docena', numero: true }]}
              filas={a.r.meses.map(m => [nombreMes(m.mes), Math.round(m.kg), m.gAve != null ? Math.round(m.gAve) : null, m.huevos, m.kgDocena != null ? Math.round(m.kgDocena * 100) / 100 : null])}
              total={['Total', Math.round(a.r.totalKg), a.r.gAve != null ? Math.round(a.r.gAve) : null, null, a.r.kgDocena != null ? Math.round(a.r.kgDocena * 100) / 100 : null]}
            />
          )}
        </PanelDatos>
      </div>
    </div>
  )
}
