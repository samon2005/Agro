'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FilaReferencia } from '@/lib/referencias'
import { huevosDeMeta, proponerMetas, type MetasSemanales } from '@/lib/metasPostura'

/**
 * La meta de postura de cada semana, en %. Debajo de cada semana se ve cuántos
 * huevos son con las aves del galpón: la meta en huevos nunca se escribe.
 */
export default function MetasSemanalesEditor({ semanas, metas, onChange, aves, pico, semanaInicio, guia }: {
  /** Semanas de vida del ciclo de postura */
  semanas: number[]
  metas: MetasSemanales
  onChange: (m: MetasSemanales) => void
  /** Aves del galpón, para mostrar la meta en huevos */
  aves: number | null
  /** Meta de pico (%), para proponer la curva cuando no hay guía */
  pico: number | null
  semanaInicio: number | null
  guia?: Map<number, FilaReferencia>
}) {
  const [abierto, setAbierto] = useState(false)
  const conMeta = semanas.filter(s => metas[s] != null).length
  // Lo que rige en cada semana sin meta propia: la guía o la subida hasta el pico
  const propuesta = proponerMetas(semanas, pico, semanaInicio, guia)
  const hayGuia = guia != null && guia.size > 0

  if (semanas.length === 0) {
    return (
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Para poner la meta de cada semana hacen falta la fecha de nacimiento (o la edad al llegar) y el inicio de postura.
      </p>
    )
  }

  function proponer() {
    onChange({ ...proponerMetas(semanas, pico, semanaInicio, guia), ...Object.fromEntries(Object.entries(metas)) })
  }
  function reemplazar() {
    onChange(proponerMetas(semanas, pico, semanaInicio, guia))
  }
  function cambiar(s: number, texto: string) {
    const v = Number(texto.replace(',', '.'))
    const nuevo = { ...metas }
    if (texto.trim() === '' || !Number.isFinite(v)) delete nuevo[s]
    else nuevo[s] = Math.min(100, Math.max(0, v))
    onChange(nuevo)
  }

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label>Meta de postura por semana (%)</Label>
          <p className="text-xs text-gray-500">
            {conMeta > 0
              ? `${conMeta} de ${semanas.length} semanas con meta propia. Las demás usan ${hayGuia ? 'la guía de la línea' : 'la meta de pico'}.`
              : `Sin metas propias: se usa ${hayGuia ? 'la guía de la línea' : 'la meta de pico'} de cada semana.`}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(v => !v)}>
          {abierto ? 'Ocultar semanas' : 'Ver y editar semanas'}
        </Button>
      </div>

      {abierto && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={conMeta > 0 ? proponer : reemplazar}>
              {conMeta > 0 ? 'Llenar las que faltan' : 'Llenar todas'} con {hayGuia ? 'la guía' : 'una subida hasta el pico'}
            </Button>
            {conMeta > 0 && (
              <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => onChange({})}>
                Borrar mis metas
              </Button>
            )}
          </div>
          <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
            {semanas.map(s => {
              const v = metas[s]
              const vigente = v ?? propuesta[s] ?? pico
              const huevos = huevosDeMeta(aves, vigente)
              return (
                <div key={s} className="space-y-0.5">
                  <span className="block text-[0.6875rem] font-medium text-gray-500">Semana {s}</span>
                  <div className="relative">
                    <Input inputMode="decimal" className={cn('h-8 pr-6 text-sm', v != null && 'border-green-600 bg-green-50/40')}
                      value={v != null ? String(v).replace('.', ',') : ''} placeholder={vigente != null ? String(vigente).replace('.', ',') : '—'}
                      onChange={e => cambiar(s, e.target.value)} />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  <span className="block text-[0.625rem] text-gray-400">
                    {huevos != null ? `${huevos.toLocaleString('es-CO')} huevos` : ' '}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
