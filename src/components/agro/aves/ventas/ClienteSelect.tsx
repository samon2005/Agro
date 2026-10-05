'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClienteHuevos } from '@/lib/huevosFinca'

const NINGUNO = '__ninguno__'
const OTRO = '__otro__'

export interface ValorCliente {
  /** Cliente del directorio, si se eligió de la lista */
  id: string | null
  nombre: string
}

/**
 * Cliente de una venta o encargo: de la lista de la finca, o uno nuevo escrito a
 * mano (que entra al directorio al guardar).
 */
export default function ClienteSelect({ clientes, value, onChange }: {
  clientes: ClienteHuevos[]
  value: ValorCliente
  onChange: (v: ValorCliente) => void
}) {
  const activos = clientes.filter(c => c.activo || c.id === value.id)
  const [modoTexto, setEscribiendo] = useState(false)
  // Un nombre escrito que no es del directorio (o una venta de antes) se muestra como texto
  const escribiendo = modoTexto || (!value.id && value.nombre.trim() !== '')

  if (escribiendo) {
    return (
      <div className="flex gap-1.5">
        <Input placeholder="Nombre del cliente" value={value.nombre} onChange={e => onChange({ id: null, nombre: e.target.value })} />
        {activos.length > 0 && (
          <button type="button" onClick={() => { setEscribiendo(false); onChange({ id: null, nombre: '' }) }} className="shrink-0 px-1 text-xs text-gray-400 hover:text-gray-600">
            Elegir de la lista
          </button>
        )}
      </div>
    )
  }

  const items: Record<string, string> = {
    [NINGUNO]: 'Sin cliente',
    ...Object.fromEntries(activos.map(c => [c.id, c.contrato ? `${c.nombre} · contrato` : c.nombre])),
    [OTRO]: 'Nuevo cliente (escribir)',
  }
  return (
    <Select
      value={value.id ?? NINGUNO}
      onValueChange={v => {
        if (v === OTRO) { setEscribiendo(true); onChange({ id: null, nombre: '' }); return }
        if (!v || v === NINGUNO) { onChange({ id: null, nombre: '' }); return }
        const c = activos.find(x => x.id === v)
        onChange({ id: v, nombre: c?.nombre ?? '' })
      }}
      items={items}
    >
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {Object.entries(items).map(([id, nombre]) => <SelectItem key={id} value={id}>{nombre}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

/**
 * El id del cliente para guardar: el elegido, el que ya existe con ese nombre, o
 * uno nuevo en el directorio. Sin nombre, sin cliente.
 */
export async function asegurarCliente(
  supabase: SupabaseClient<Database>,
  fincaId: string,
  valor: ValorCliente,
  clientes: ClienteHuevos[],
): Promise<{ id: string | null; nombre: string | null; error?: string }> {
  const nombre = valor.nombre.trim()
  if (valor.id) return { id: valor.id, nombre: nombre || null }
  if (!nombre) return { id: null, nombre: null }
  const existente = clientes.find(c => c.nombre.trim().toLowerCase() === nombre.toLowerCase())
  if (existente) return { id: existente.id, nombre: existente.nombre }
  const { data, error } = await supabase.from('clientes_huevos').insert({ finca_id: fincaId, nombre }).select('id, nombre').single()
  if (error || !data) {
    // Otro usuario pudo crearlo al mismo tiempo: se busca por nombre
    const { data: otro } = await supabase.from('clientes_huevos').select('id, nombre').eq('finca_id', fincaId).ilike('nombre', nombre).maybeSingle()
    if (otro) return { id: otro.id, nombre: otro.nombre }
    return { id: null, nombre, error: 'No se pudo guardar el cliente' }
  }
  return { id: data.id, nombre: data.nombre }
}
