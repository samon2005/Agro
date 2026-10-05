'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { dbGenerico } from '@/lib/especiesConfig'
import type { FilaReferencia, LineaReferencia } from '@/lib/referencias'
import FasesAlimentoReferencia from './FasesAlimentoReferencia'

interface Props {
  open: boolean
  onClose: () => void
  linea: LineaReferencia | null
  fincaId: string
  /** Se hizo una copia para la finca: el galpón pasa a usarla */
  onCopiada: (linea: LineaReferencia) => void
  /** Se borró la copia de la finca */
  onBorrada?: (lineaId: string) => void
}

type Campo = Exclude<keyof FilaReferencia, 'linea_id' | 'semana'>

const GRUPOS: { titulo: string; unidad: string; min: Campo; max: Campo | null }[] = [
  { titulo: 'Postura', unidad: '%', min: 'postura_min', max: 'postura_max' },
  { titulo: 'Mort. acum.', unidad: '%', min: 'mortalidad_acum_pct', max: null },
  { titulo: 'Peso ave', unidad: 'g', min: 'peso_ave_min_g', max: 'peso_ave_max_g' },
  { titulo: 'Consumo', unidad: 'g/ave/día', min: 'consumo_min_g', max: 'consumo_max_g' },
  { titulo: 'Peso huevo', unidad: 'g', min: 'peso_huevo_min_g', max: 'peso_huevo_max_g' },
]

const fmt = (v: number | null) => (v == null ? '' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 }))

function rango(f: FilaReferencia, min: Campo, max: Campo | null) {
  const a = f[min] as number | null
  const b = max ? (f[max] as number | null) : null
  if (a == null && b == null) return '—'
  if (b == null || Number(a) === Number(b)) return fmt(a ?? b)
  return `${fmt(a)}–${fmt(b)}`
}

/**
 * La tabla de una línea genética semana a semana. La guía oficial es de solo
 * lectura; para ajustarla (clima, altura, manejo de la finca) se hace una copia.
 */
export default function ReferenciaLineaModal({ open, onClose, linea, fincaId, onCopiada, onBorrada }: Props) {
  const supabase = createClient()
  const [filas, setFilas] = useState<FilaReferencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const esDeLaFinca = linea?.finca_id != null

  useEffect(() => {
    if (!open || !linea) return
    let vigente = true
    setCargando(true)
    setEditando(false)
    setBorrador({})
    supabase.from('referencia_semanal').select('*').eq('linea_id', linea.id).order('semana').then(({ data }) => {
      if (!vigente) return
      setFilas(data ?? [])
      setCargando(false)
    })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linea?.id])

  async function copiar() {
    if (!linea) return
    setGuardando(true)
    const { data, error } = await dbGenerico(supabase).rpc('copiar_referencia', {
      p_linea: linea.id, p_finca: fincaId, p_nombre: `${linea.nombre.replace(/ \(finca\)$/, '')} (finca)`,
    })
    if (error || !data) { setGuardando(false); toast.error('No se pudo copiar la referencia'); return }
    const { data: nueva } = await supabase.from('lineas_referencia').select('*').eq('id', data as string).single()
    setGuardando(false)
    if (!nueva) { toast.error('No se pudo cargar la copia'); return }
    toast.success('Copia creada: ya puedes ajustarla')
    onCopiada(nueva)
  }

  const clave = (semana: number, campo: Campo) => `${semana}:${campo}`
  const valorEditado = (f: FilaReferencia, campo: Campo) => {
    const k = clave(f.semana, campo)
    return k in borrador ? borrador[k] : (f[campo] == null ? '' : String(f[campo]))
  }

  async function guardar() {
    if (!linea) return
    const cambiadas = new Map<number, FilaReferencia>()
    for (const [k, v] of Object.entries(borrador)) {
      const [s, campo] = k.split(':') as [string, Campo]
      const semana = Number(s)
      const base = cambiadas.get(semana) ?? { ...filas.find(f => f.semana === semana)! }
      const num = v.trim() === '' ? null : Number(v.replace(',', '.'))
      if (num != null && (!Number.isFinite(num) || num < 0)) { toast.error(`Semana ${semana}: valor no válido`); return }
      ;(base[campo] as number | null) = num
      cambiadas.set(semana, base)
    }
    for (const f of cambiadas.values()) {
      for (const g of GRUPOS) {
        // Number(): numeric puede llegar como texto desde la base
        const a = f[g.min] as number | null
        const b = g.max ? (f[g.max] as number | null) : null
        if (a != null && b != null && Number(a) > Number(b)) { toast.error(`Semana ${f.semana}: en ${g.titulo} el mínimo es mayor que el máximo`); return }
      }
      if (f.postura_max != null && Number(f.postura_max) > 100) { toast.error(`Semana ${f.semana}: la postura no puede pasar de 100 %`); return }
    }
    if (cambiadas.size === 0) { setEditando(false); return }
    setGuardando(true)
    const { error } = await supabase.from('referencia_semanal').upsert([...cambiadas.values()])
    setGuardando(false)
    if (error) { toast.error('No se pudo guardar la referencia'); return }
    setFilas(prev => prev.map(f => cambiadas.get(f.semana) ?? f))
    setBorrador({})
    setEditando(false)
    toast.success(`${cambiadas.size} ${cambiadas.size === 1 ? 'semana ajustada' : 'semanas ajustadas'}`)
  }

  async function borrarCopia() {
    if (!linea || !esDeLaFinca) return
    if (!window.confirm(`¿Borrar "${linea.nombre}"? Los galpones que la usan quedan sin referencia hasta que elijas otra.`)) return
    setGuardando(true)
    const { error } = await supabase.from('lineas_referencia').delete().eq('id', linea.id)
    setGuardando(false)
    if (error) { toast.error('No se pudo borrar la copia'); return }
    toast.success('Copia borrada')
    onBorrada?.(linea.id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="manual" /> {linea?.nombre ?? 'Referencia'}</DialogTitle>
          <p className="text-xs text-gray-500">
            {esDeLaFinca ? 'Copia de la finca, ajustable. ' : 'Guía oficial, solo lectura. '}
            {linea?.fuente}
            {linea?.url && <> · <a href={linea.url} target="_blank" rel="noreferrer" className="text-green-700 underline">ver la guía</a></>}
          </p>
          {linea?.notas && <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{linea.notas}</p>}
          <p className="text-xs text-gray-400">
            Son valores de referencia para comparar, no una meta exacta: el clima, la altura y el manejo de cada finca los mueven.
          </p>
        </DialogHeader>

        {cargando ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        ) : filas.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Esta referencia no tiene semanas cargadas</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-[0.75rem] tabular-nums">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Semana de vida</th>
                  {GRUPOS.map(g => (
                    <th key={g.titulo} className="px-2 py-2 text-right font-medium" colSpan={editando && g.max ? 2 : 1}>
                      {g.titulo} <span className="font-normal text-gray-400">{g.unidad}</span>
                      {editando && g.max && <span className="block font-normal text-gray-400">mín · máx</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.semana} className="border-t border-gray-100">
                    <td className="px-2 py-1 font-semibold text-gray-700">{f.semana}</td>
                    {GRUPOS.map(g => editando ? (
                      [g.min, ...(g.max ? [g.max] : [])].map(campo => (
                        <td key={campo} className="px-1 py-0.5">
                          <Input
                            inputMode="decimal"
                            className="h-7 w-16 px-1 text-right text-xs"
                            value={valorEditado(f, campo)}
                            onChange={e => setBorrador(prev => ({ ...prev, [clave(f.semana, campo)]: e.target.value }))}
                          />
                        </td>
                      ))
                    ) : (
                      <td key={g.titulo} className="px-2 py-1 text-right text-gray-700">{rango(f, g.min, g.max)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {linea && !editando && <FasesAlimentoReferencia key={linea.id} lineaId={linea.id} editable={esDeLaFinca} />}

        <DialogFooter className="flex-wrap gap-2">
          {esDeLaFinca ? (
            editando ? (
              <>
                <Button type="button" variant="outline" onClick={() => { setBorrador({}); setEditando(false) }}>Descartar cambios</Button>
                <Button type="button" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar ajustes'}</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" className="text-red-700" disabled={guardando} onClick={borrarCopia}>
                  <Ic n="borrar" /> Borrar copia
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditando(true)} disabled={cargando || filas.length === 0}>
                  <Ic n="editar" /> Ajustar valores
                </Button>
                <Button type="button" onClick={onClose}>Listo</Button>
              </>
            )
          ) : (
            <>
              <Button type="button" variant="outline" disabled={guardando || cargando} onClick={copiar}>
                {guardando ? 'Copiando...' : 'Hacer una copia para ajustarla'}
              </Button>
              <Button type="button" onClick={onClose}>Listo</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
