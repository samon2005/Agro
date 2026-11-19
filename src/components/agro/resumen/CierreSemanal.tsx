'use client'

import TareasDeLaSemana from './TareasDeLaSemana'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Widget, ANCHO } from '@/components/ui/widgets/Widget'
import { MiniBarras } from '@/components/ui/widgets/Medidores'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BarraExportar } from '@/components/ui/barra-exportar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { useGuias } from '@/lib/useGuias'
import { useBaseFinca } from '@/lib/useBaseFinca'
import { cierreAves, patronDiaSemana, sumarDias, ultimasSemanas, type DiaCierre, type LoteCierre, type Totales } from '@/lib/cierreSemanal'

export type { DiaCierre, LoteCierre } from '@/lib/cierreSemanal'

const corta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const mil = (v: number) => v.toLocaleString('es-CO')

interface Guardado { id: string; notas: string | null; created_at: string }

/** "+3,2 pts" o "+12 %" frente a la semana anterior, en verde o rojo según si subir es bueno. */
function Cambio({ ahora, antes, puntos, subirEsBueno = true }: { ahora: number | null; antes: number | null; puntos?: boolean; subirEsBueno?: boolean }) {
  if (ahora == null || antes == null || (!puntos && antes === 0)) return null
  const d = puntos ? ahora - antes : ((ahora - antes) / antes) * 100
  if (Math.abs(d) < 0.05) return <span className="text-[0.6875rem] text-gray-400">igual</span>
  const bueno = (d > 0) === subirEsBueno
  return <span className={cn('text-[0.6875rem] font-medium', bueno ? 'text-green-700' : 'text-red-700')}>{d > 0 ? '+' : '−'}{n1(Math.abs(d))}{puntos ? ' pts' : ' %'}</span>
}

/**
 * El cierre de una semana (lunes a domingo): cada galpón y la finca entera, el
 * mejor y el peor día, el patrón de cada día de la semana y el cambio frente a la
 * semana anterior. Una semana terminada se puede "cerrar": queda guardada con sus
 * notas aunque después se corrija un día. Las cuentas están en lib/cierreSemanal.
 */
export default function CierreSemanal({ fincaId, lotes, dias, hoy, umbralRotos = 3 }: {
  fincaId: string
  lotes: LoteCierre[]; dias: DiaCierre[]; hoy: string
  /** Desde qué % de rotos se marca en rojo (lib/configAves) */
  umbralRotos?: number
}) {
  const semanas = ultimasSemanas(hoy, 8)
  const [lunes, setLunes] = useState(semanas[1])
  const guias = useGuias(lotes)
  const imprimir = useRef<HTMLDivElement>(null)
  const base = useBaseFinca()
  const c = cierreAves(lotes, dias, lunes, hoy, l => (l.referencia_id ? guias.get(l.referencia_id) : undefined), base)
  // El patrón de las últimas 8 semanas completas
  const patron = patronDiaSemana(dias, lotes.map(l => l.id), semanas[semanas.length - 1], sumarDias(semanas[0], -1))

  // El cierre guardado de esta semana, si lo hay
  const [guardado, setGuardado] = useState<{ lunes: string; g: Guardado | null } | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const [notas, setNotas] = useState('')
  useEffect(() => {
    let vigente = true
    createClient().from('cierres_semanales').select('id, notas, created_at').eq('finca_id', fincaId).eq('especie', 'aves_ponedoras').eq('lunes', lunes).maybeSingle()
      .then(({ data }) => { if (vigente) setGuardado({ lunes, g: data ?? null }) })
    return () => { vigente = false }
  }, [fincaId, lunes])
  const cierreGuardado = guardado?.lunes === lunes ? guardado.g : null

  async function cerrarSemana() {
    const { data, error } = await createClient().from('cierres_semanales').upsert({
      finca_id: fincaId, especie: 'aves_ponedoras', lunes,
      datos: JSON.parse(JSON.stringify({ filas: c.filas.map(f => ({ lote: f.lote.nombre, semanaVida: f.semanaVida, ...f.t })), finca: c.finca, dias: c.dias, mejorDia: c.mejorDia, peorDia: c.peorDia })),
      notas: notas.trim() || null,
    }, { onConflict: 'finca_id,especie,lunes' }).select('id, notas, created_at').single()
    if (error || !data) { toast.error('No se pudo cerrar la semana'); return }
    setGuardado({ lunes, g: data })
    setCerrando(false); setNotas('')
    toast.success(`Semana del ${corta(lunes)} cerrada`)
  }

  const fila = (nombre: string, sub: string | null, t: Totales, diferencia: number | null, total = false) => (
    <TableRow key={nombre} className={total ? 'bg-green-50/50 font-semibold' : undefined}>
      <TableCell className="text-sm font-medium">
        {nombre}
        {sub && <span className="block text-[0.6875rem] font-normal text-gray-400">{sub}</span>}
      </TableCell>
      <TableCell className={cn('text-right text-sm tabular-nums', t.registros < c.diasSemana * (total ? lotes.length : 1) ? 'text-amber-700' : 'text-gray-600')}>
        {t.registros} de {c.diasSemana * (total ? lotes.length : 1)}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">{mil(t.huevos)}</TableCell>
      <TableCell className="text-right text-sm font-semibold tabular-nums">{t.postura != null ? `${n1(t.postura)} %` : '—'}</TableCell>
      <TableCell className="text-right text-sm tabular-nums text-gray-500">{t.meta != null ? `${n1(t.meta)} %` : '—'}</TableCell>
      <TableCell className={cn('text-right text-sm font-medium tabular-nums',
        diferencia == null ? 'text-gray-400' : diferencia >= 0 ? 'text-green-700' : diferencia > -5 ? 'text-amber-700' : 'text-red-700')}>
        {diferencia == null ? '—' : `${diferencia >= 0 ? '+' : ''}${n1(diferencia)} pts`}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {mil(t.muertes)}
        {t.mortalidad != null && t.muertes > 0 && <span className="block text-[0.6875rem] text-gray-400">{n1(t.mortalidad)} %</span>}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">{t.alimentoG != null ? `${Math.round(t.alimentoG)} g/ave` : '—'}</TableCell>
      <TableCell className={cn('text-right text-sm tabular-nums', t.rotosPct != null && t.rotosPct > umbralRotos ? 'font-medium text-red-700' : '')}>{t.rotosPct != null ? `${n1(t.rotosPct)} %` : '—'}</TableCell>
      <TableCell className="text-right text-sm tabular-nums">{t.malosPct != null ? `${n1(t.malosPct)} %` : '—'}</TableCell>
    </TableRow>
  )

  const f = c.finca
  return (
    <Widget className={ANCHO.todo} titulo="Cierre de la semana" icono="diario"
      info="Semana de lunes a domingo. La meta es la de cada galpón para esa semana de vida: la propia, la de la tabla base de la finca, la de la guía de la línea o la de pico. El mejor y el peor día cuentan solo los días con todos los galpones registrados"
      accion={
        <div className="flex flex-wrap items-center gap-1">
          <BarraExportar titulo={`Cierre de la semana ${corta(c.lunes)}`} imprimir={imprimir}
            hojas={() => [{
              nombre: 'Cierre',
              columnas: ['Galpón', 'Días', 'Huevos', 'Postura %', 'Meta %', 'Muertes', 'g/ave', 'Rotos %', 'Sucios y podridos %'],
              filas: [...c.filas.map(x => [x.lote.nombre, x.t.registros, x.t.huevos, x.t.postura, x.t.meta, x.t.muertes, x.t.alimentoG, x.t.rotosPct, x.t.malosPct]),
                ['Finca', f.registros, f.huevos, f.postura, f.meta, f.muertes, f.alimentoG, f.rotosPct, f.malosPct]],
            }]} />
          <select value={lunes} onChange={e => setLunes(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700" aria-label="Semana">
            {semanas.map((s, i) => (
              <option key={s} value={s}>{i === 0 ? 'Esta semana (en curso)' : `${corta(s)} – ${corta(sumarDias(s, 6))}`}</option>
            ))}
          </select>
        </div>
      }>
      {lotes.length === 0 ? (
        <p className="text-sm text-gray-400">Sin galpones en postura.</p>
      ) : (
        <div ref={imprimir} className="space-y-4">
          {/* La finca en una línea, frente a la semana anterior */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><p className="text-xs text-gray-500">Huevos</p><p className="text-lg font-semibold tabular-nums">{mil(f.huevos)}</p><Cambio ahora={f.huevos} antes={c.anterior.huevos || null} /></div>
            <div><p className="text-xs text-gray-500">Postura de la finca</p><p className="text-lg font-semibold tabular-nums">{f.postura != null ? `${n1(f.postura)} %` : '—'}</p><Cambio ahora={f.postura} antes={c.anterior.postura} puntos /></div>
            <div><p className="text-xs text-gray-500">Muertes</p><p className="text-lg font-semibold tabular-nums">{mil(f.muertes)}</p><Cambio ahora={f.muertes} antes={c.anterior.muertes || null} subirEsBueno={false} /></div>
            <div><p className="text-xs text-gray-500">Rotos</p><p className={cn('text-lg font-semibold tabular-nums', f.rotosPct != null && f.rotosPct > umbralRotos && 'text-red-700')}>{f.rotosPct != null ? `${n1(f.rotosPct)} %` : '—'}</p><Cambio ahora={f.rotosPct} antes={c.anterior.rotosPct} puntos subirEsBueno={false} /></div>
          </div>

          {/* Cada día de la semana */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-600">Postura de cada día</p>
              <MiniBarras valores={c.dias.map(d => d.postura)} etiquetas={c.dias.map(d => d.nombre.slice(0, 3))} formato={v => `${n1(v)} %`} />
            </div>
            <div className="space-y-1.5 text-sm text-gray-700">
              {c.mejorDia && <p><Ic n="listo" className="mr-1 text-green-700" />El <strong>{c.mejorDia.nombre}</strong> fue el día de mejor postura ({n1(c.mejorDia.postura!)} %).</p>}
              {c.peorDia && <p><Ic n="alerta" className="mr-1 text-amber-600" />El <strong>{c.peorDia.nombre}</strong> fue el de menor postura ({n1(c.peorDia.postura!)} %).</p>}
              {!c.mejorDia && <p className="text-gray-400">Todavía no hay días con todos los galpones registrados.</p>}
              {patron.mejor && patron.peor && (
                <p className="text-xs text-gray-500">
                  En las últimas 8 semanas, el día que mejor sale suele ser el <strong>{patron.mejor.nombre}</strong> ({n1(patron.mejor.postura!)} %) y el más bajo el <strong>{patron.peor.nombre}</strong> ({n1(patron.peor.postura!)} %).
                  {patron.mejor.postura! - patron.peor.postura! >= 2 ? ' Si un día siempre sale más bajo, revisa qué pasa ese día: turno, operario u hora de recolección.' : ''}
                </p>
              )}
            </div>
          </div>

          <div className="-mx-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Galpón</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead className="text-right">Huevos</TableHead>
                  <TableHead className="text-right">Postura</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-right">Muertes</TableHead>
                  <TableHead className="text-right">Alimento</TableHead>
                  <TableHead className="text-right">Rotos</TableHead>
                  <TableHead className="text-right">Sucios y podridos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.filas.map(x => fila(x.lote.nombre, x.semanaVida != null ? `semana ${x.semanaVida} de vida` : null, x.t, x.diferencia))}
                {c.filas.length > 1 && fila('Toda la finca', null, f, f.postura != null && f.meta != null ? f.postura - f.meta : null, true)}
              </TableBody>
            </Table>
          </div>

          <TareasDeLaSemana fincaId={fincaId} lunes={c.lunes} hoy={hoy} />

          {/* Cerrar la semana: queda guardada con sus notas */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span>{corta(c.lunes)} – {corta(c.domingo)}{c.enCurso ? ' (en curso)' : ''}</span>
            {cierreGuardado ? (
              <span className="flex items-center gap-1.5 text-green-800">
                <Ic n="listo" className="size-3.5" /> Cerrada el {new Date(cierreGuardado.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                {cierreGuardado.notas ? <span className="text-gray-500">· {cierreGuardado.notas}</span> : null}
              </span>
            ) : !c.enCurso && (cerrando ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <Input className="h-8 w-64" placeholder="Notas de la semana (opcional)" value={notas} onChange={e => setNotas(e.target.value)} />
                <Button size="sm" onClick={cerrarSemana}>Cerrar la semana</Button>
                <Button size="sm" variant="ghost" onClick={() => setCerrando(false)}>Cancelar</Button>
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setCerrando(true)}><Ic n="listo" /> Cerrar la semana</Button>
            ))}
          </div>
        </div>
      )}
    </Widget>
  )
}
