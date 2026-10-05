'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { dbGenerico } from '@/lib/especiesConfig'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ic } from '@/components/ui/icon'
import { CATEGORIAS_FASE, CATEGORIA_FASE_LABEL, cargarFases, type CategoriaFase, type FaseAlimento } from '@/lib/programaAlimento'

interface Props {
  lineaId: string
  /** Solo las copias de la finca se pueden ajustar */
  editable: boolean
}

interface Borrador {
  id?: string
  nombre: string
  categoria: CategoriaFase
  desde: string
  hasta: string
  peso: string
  posturaMin: string
  bajoPico: string
  notas: string
}

const texto = (v: number | null) => (v == null ? '' : String(Number(v)))

function aBorrador(f: FaseAlimento): Borrador {
  return {
    id: f.id, nombre: f.nombre, categoria: f.categoria,
    desde: texto(f.desde_semana), hasta: texto(f.hasta_semana), peso: texto(f.peso_cambio_g),
    posturaMin: texto(f.postura_min), bajoPico: texto(f.bajo_pico), notas: f.notas ?? '',
  }
}

function criterio(f: FaseAlimento) {
  if (f.categoria !== 'postura') {
    const sem = `Semanas ${f.desde_semana}–${f.hasta_semana ?? '…'}`
    return f.peso_cambio_g != null ? `${sem} · cambia con ${Number(f.peso_cambio_g).toLocaleString('es-CO')} g` : sem
  }
  if (f.bajo_pico != null) return `Hasta ${Number(f.bajo_pico).toLocaleString('es-CO')} puntos bajo el pico`
  return Number(f.postura_min) > 0 ? `Postura desde ${Number(f.postura_min).toLocaleString('es-CO')} %` : 'Postura más baja'
}

/**
 * Las fases de alimentación de una referencia: qué alimento le toca al lote por
 * edad (levante) o por su postura (producción). Las copias de la finca se ajustan.
 */
export default function FasesAlimentoReferencia({ lineaId, editable }: Props) {
  const supabase = createClient()
  const [fases, setFases] = useState<{ id: string; lista: FaseAlimento[] } | null>(null)
  const [borrador, setBorrador] = useState<Borrador[] | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    cargarFases(supabase, lineaId).then(lista => { if (vigente) setFases({ id: lineaId, lista }) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineaId])

  const lista = fases?.id === lineaId ? fases.lista : null

  function cambiar(i: number, campo: keyof Borrador, valor: string) {
    setBorrador(prev => prev && prev.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)))
  }

  async function guardar() {
    if (!borrador) return
    const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
    const filas = []
    for (const [i, b] of borrador.entries()) {
      const fila = {
        linea_id: lineaId, orden: i + 1, nombre: b.nombre.trim(), categoria: b.categoria,
        desde_semana: num(b.desde), hasta_semana: num(b.hasta), peso_cambio_g: num(b.peso),
        postura_min: num(b.posturaMin), bajo_pico: num(b.bajoPico), notas: b.notas.trim() || null,
      }
      if (!fila.nombre) { toast.error(`Fase ${i + 1}: ponle un nombre`); return }
      if (Object.values(fila).some(v => typeof v === 'number' && (!Number.isFinite(v) || v < 0))) { toast.error(`${fila.nombre}: hay un número no válido`); return }
      if (fila.categoria !== 'postura') {
        if ([fila.desde_semana, fila.hasta_semana].some(s => s != null && (!Number.isInteger(s) || s < 1 || s > 120))) {
          toast.error(`${fila.nombre}: las semanas son números enteros de 1 a 120`); return
        }
        if (fila.desde_semana == null) { toast.error(`${fila.nombre}: indica desde qué semana va`); return }
        if (fila.hasta_semana != null && fila.hasta_semana < fila.desde_semana) { toast.error(`${fila.nombre}: la semana final es menor que la inicial`); return }
        fila.postura_min = null; fila.bajo_pico = null
      } else {
        if (fila.postura_min == null && fila.bajo_pico == null) { toast.error(`${fila.nombre}: indica la postura mínima o los puntos bajo el pico`); return }
        if (fila.postura_min != null && fila.postura_min > 100) { toast.error(`${fila.nombre}: la postura no pasa de 100 %`); return }
        fila.desde_semana = null; fila.hasta_semana = null; fila.peso_cambio_g = null
      }
      filas.push(fila)
    }
    setGuardando(true)
    // Se reemplazan todas de una vez (el orden cambia al quitar o agregar); si falla, no queda a medias
    const { error } = await dbGenerico(supabase).rpc('guardar_fases_alimento', { p_linea: lineaId, p_fases: filas })
    const nuevas = await cargarFases(supabase, lineaId)
    setGuardando(false)
    setFases({ id: lineaId, lista: nuevas })
    if (error) { toast.error('No se pudieron guardar las fases'); return }
    setBorrador(null)
    toast.success('Fases de alimentación guardadas')
  }

  if (lista == null) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-700"><Ic n="alimento" /> Fases de alimentación</p>
        {editable && !borrador && (
          <Button type="button" variant="outline" size="sm" onClick={() => setBorrador(lista.map(aBorrador))}>
            <Ic n="editar" /> Ajustar fases
          </Button>
        )}
      </div>

      {!borrador ? (
        lista.length === 0 ? (
          <p className="text-xs text-gray-400">
            Esta referencia no trae fases de alimentación.{editable ? ' Agrégalas con "Ajustar fases".' : ' Haz una copia para agregarlas.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Fase</th>
                  <th className="px-2 py-1.5 text-left font-medium">Tipo</th>
                  <th className="px-2 py-1.5 text-left font-medium">Cuándo</th>
                  <th className="px-2 py-1.5 text-left font-medium">Nota</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(f => (
                  <tr key={f.id} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 font-medium text-gray-800">{f.nombre}</td>
                    <td className="px-2 py-1.5 text-gray-600">{CATEGORIA_FASE_LABEL[f.categoria]}</td>
                    <td className="px-2 py-1.5 text-gray-600">{criterio(f)}</td>
                    <td className="px-2 py-1.5 text-gray-400">{f.notas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {borrador.map((b, i) => (
            <div key={b.id ?? `nueva-${i}`} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-6">
              <Input className="col-span-2 h-8 text-xs" placeholder="Nombre" value={b.nombre} onChange={e => cambiar(i, 'nombre', e.target.value)} />
              <select
                className="col-span-2 h-8 rounded-md border border-gray-200 bg-white px-2 text-xs sm:col-span-1"
                value={b.categoria}
                onChange={e => cambiar(i, 'categoria', e.target.value)}
              >
                {CATEGORIAS_FASE.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
              </select>
              {b.categoria !== 'postura' ? (
                <>
                  <Input className="h-8 text-xs" inputMode="numeric" placeholder="Desde sem." value={b.desde} onChange={e => cambiar(i, 'desde', e.target.value)} />
                  <Input className="h-8 text-xs" inputMode="numeric" placeholder="Hasta sem." value={b.hasta} onChange={e => cambiar(i, 'hasta', e.target.value)} />
                  <Input className="h-8 text-xs" inputMode="decimal" placeholder="Peso cambio g" value={b.peso} onChange={e => cambiar(i, 'peso', e.target.value)} />
                </>
              ) : (
                <>
                  <Input className="h-8 text-xs" inputMode="decimal" placeholder="Postura mín. %" value={b.posturaMin} onChange={e => cambiar(i, 'posturaMin', e.target.value)} />
                  <Input className="h-8 text-xs" inputMode="decimal" placeholder="Pts bajo pico" value={b.bajoPico} onChange={e => cambiar(i, 'bajoPico', e.target.value)} />
                  <span className="hidden sm:block" />
                </>
              )}
              <Input className="col-span-2 h-8 text-xs sm:col-span-5" placeholder="Nota" value={b.notas} onChange={e => cambiar(i, 'notas', e.target.value)} />
              <button
                type="button"
                onClick={() => setBorrador(prev => prev && prev.filter((_, j) => j !== i))}
                className="h-8 rounded-md text-xs text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                Quitar
              </button>
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setBorrador(prev => [...(prev ?? []), { nombre: '', categoria: 'postura', desde: '', hasta: '', peso: '', posturaMin: '', bajoPico: '', notas: '' }])}
            >
              <Ic n="mas" /> Agregar fase
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setBorrador(null)}>Descartar</Button>
              <Button type="button" size="sm" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar fases'}</Button>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Levante: por semanas de vida (y el peso con que se pasa a la siguiente). Producción: la fase de pico va hasta que la
            postura cae los puntos indicados bajo el pico; las demás, mientras la postura no baje de su mínimo. Van en orden.
          </p>
        </div>
      )}
    </div>
  )
}
