'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { obtenerMiembrosFinca, type Operario } from '@/lib/operarios'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  fincaId: string
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
}

const OTRO = '__otro__'

export default function EncargadoSelect({ fincaId, value, onChange, placeholder = 'Nombre del encargado' }: Props) {
  const [operarios, setOperarios] = useState<Operario[]>([])
  const [loaded, setLoaded] = useState(false)
  const [modoTexto, setModoTexto] = useState(false)

  useEffect(() => {
    if (!fincaId) return
    const supabase = createClient()
    obtenerMiembrosFinca(supabase, fincaId).then(lista => {
      setOperarios(lista)
      setLoaded(true)
    })
  }, [fincaId])

  useEffect(() => {
    if (!loaded) return
    if (value && !operarios.some(o => o.full_name === value)) setModoTexto(true)
  }, [loaded, operarios, value])

  if (modoTexto || (loaded && operarios.length === 0)) {
    return (
      <div className="flex gap-1.5">
        <Input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
        {operarios.length > 0 && (
          <button
            type="button"
            onClick={() => { setModoTexto(false); onChange('') }}
            className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-1"
          >
            Elegir de la lista
          </button>
        )}
      </div>
    )
  }

  const items: Record<string, string> = Object.fromEntries(operarios.map(o => [o.full_name as string, o.full_name as string]))
  items[OTRO] = 'Otro (escribir)'

  return (
    <Select
      value={value || undefined}
      onValueChange={v => { if (v === OTRO) { setModoTexto(true); onChange('') } else { onChange(v ?? '') } }}
      items={items}
    >
      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
      <SelectContent>
        {operarios.map(o => <SelectItem key={o.id} value={o.full_name as string}>{o.full_name}</SelectItem>)}
        <SelectItem value={OTRO}>Otro (escribir)</SelectItem>
      </SelectContent>
    </Select>
  )
}
