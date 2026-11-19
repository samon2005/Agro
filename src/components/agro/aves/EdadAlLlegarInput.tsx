'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { UnidadEdad } from '@/lib/referencias'

/**
 * La edad con que llegan las aves, en días o en semanas: unas pollitas llegan de
 * 3 días, unas pollas levantadas de 16 semanas. La base guarda la fecha de
 * nacimiento, así que la edad sigue avanzando sola.
 */
export default function EdadAlLlegarInput({ valor, unidad, onChange, ayuda, placeholder }: {
  valor: string
  unidad: UnidadEdad
  onChange: (valor: string, unidad: UnidadEdad) => void
  ayuda?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label>Edad al llegar</Label>
      <div className="flex gap-1.5">
        <Input
          type="number" min="0" step={unidad === 'dias' ? '1' : '0.1'}
          placeholder={placeholder ?? (unidad === 'dias' ? 'Ej: 3' : 'Ej: 16')}
          value={valor}
          onChange={e => onChange(e.target.value, unidad)}
          className="min-w-0 flex-1"
        />
        <div className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label="Unidad de la edad">
          {(['dias', 'semanas'] as const).map(u => (
            <button
              key={u} type="button" role="radio" aria-checked={unidad === u}
              onClick={() => {
                // Al cambiar de unidad se convierte el número, para no perder lo escrito
                const n = Number(valor)
                const convertido = valor.trim() === '' || !Number.isFinite(n) ? valor
                  : u === 'dias' ? String(Math.round(n * 7)) : String(Math.round((n / 7) * 10) / 10)
                onChange(unidad === u ? valor : convertido, u)
              }}
              className={cn('h-8 rounded-md px-2.5 text-xs font-medium transition-colors',
                unidad === u ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
            >
              {u === 'dias' ? 'Días' : 'Semanas'}
            </button>
          ))}
        </div>
      </div>
      {ayuda && <p className="text-xs text-gray-400">{ayuda}</p>}
    </div>
  )
}
