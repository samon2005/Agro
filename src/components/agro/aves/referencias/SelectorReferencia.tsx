'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cargarLineasReferencia, referenciaParaLinea, type LineaReferencia } from '@/lib/referencias'
import ReferenciaLineaModal from './ReferenciaLineaModal'

const NINGUNA = 'ninguna'

interface Props {
  fincaId: string
  /** Línea genética del lote: mientras no se elija a mano, la referencia la sigue */
  lineaGenetica: string
  value: string
  onChange: (referenciaId: string) => void
  /** Si arranca siguiendo la línea (lote nuevo) o respetando lo guardado */
  seguirLinea: boolean
}

/**
 * Con qué guía se compara el galpón. Se elige sola según la línea genética, se
 * puede cambiar, y desde aquí se ve la tabla o se hace una copia para ajustarla.
 */
export default function SelectorReferencia({ fincaId, lineaGenetica, value, onChange, seguirLinea }: Props) {
  const [lineas, setLineas] = useState<LineaReferencia[]>([])
  const [verTabla, setVerTabla] = useState(false)
  // Se eligió a mano en esta ventana: ya no se cambia sola
  const manual = useRef(false)
  // La línea con que se propuso la última vez (al abrir, la guardada)
  const lineaPrevia = useRef<string | null>(seguirLinea ? null : lineaGenetica)

  useEffect(() => {
    let vigente = true
    cargarLineasReferencia(createClient(), fincaId).then(l => { if (vigente) setLineas(l) })
    return () => { vigente = false }
  }, [fincaId])

  // Al cambiar la línea (o, en un lote nuevo, al cargar las referencias) se
  // propone la que corresponde; lo guardado de un lote se respeta al abrir
  useEffect(() => {
    if (manual.current || lineas.length === 0 || lineaPrevia.current === lineaGenetica) return
    lineaPrevia.current = lineaGenetica
    const r = referenciaParaLinea(lineas, lineaGenetica)
    if ((r?.id ?? '') !== value) onChange(r?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineaGenetica, lineas])

  const actual = lineas.find(l => l.id === value) ?? null
  const items: Record<string, string> = {
    [NINGUNA]: 'Sin referencia',
    ...Object.fromEntries(lineas.map(l => [l.id, l.finca_id ? `${l.nombre} · de la finca` : l.nombre])),
  }

  return (
    <div className="space-y-1">
      <Label>Referencia para comparar</Label>
      <div className="flex gap-2">
        <Select
          value={value || NINGUNA}
          onValueChange={v => { manual.current = true; onChange(!v || v === NINGUNA ? '' : v) }}
          items={items}
        >
          <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {Object.entries(items).map(([id, nombre]) => <SelectItem key={id} value={id}>{nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          type="button"
          disabled={!actual}
          onClick={() => setVerTabla(true)}
          className="shrink-0 rounded-lg border px-2.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Ver tabla
        </button>
      </div>
      <p className="text-xs text-gray-400">
        {actual
          ? actual.finca_id ? 'Copia ajustada por la finca.' : 'Guía oficial de la línea.'
          : lineaGenetica && lineaGenetica !== 'Otra'
            ? `No hay guía cargada para ${lineaGenetica}: elige una parecida o déjalo sin referencia.`
            : 'Sin referencia no se compara lo real con lo esperado.'}
      </p>

      <ReferenciaLineaModal
        open={verTabla}
        onClose={() => setVerTabla(false)}
        linea={actual}
        fincaId={fincaId}
        onCopiada={nueva => {
          setLineas(prev => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)))
          manual.current = true
          onChange(nueva.id)
        }}
        onBorrada={id => {
          setLineas(prev => prev.filter(l => l.id !== id))
          if (value === id) onChange(referenciaParaLinea(lineas.filter(l => l.id !== id), lineaGenetica)?.id ?? '')
        }}
      />
    </div>
  )
}
