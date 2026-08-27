'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'

interface Props {
  fincaId: string
  valores: Record<string, number>
  onUpdated: (categoria: string, monto: number) => void
}

const CATEGORIAS_REFERENCIA = [
  { value: 'alimento', label: '🌾 Alimento (por bulto)' },
  { value: 'servicios_publicos', label: '💡 Servicios públicos (mensual)' },
  { value: 'mantenimiento', label: '🔧 Mantenimiento' },
  { value: 'sanitario', label: '💉 Sanitario' },
  { value: 'pollitas', label: '🐣 Pollitas de levante (por ave)' },
]

export default function CostosPredefinidosPanel({ fincaId, valores, onUpdated }: Props) {
  const supabase = createClient()
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)

  function valorMostrado(categoria: string) {
    return borradores[categoria] ?? (valores[categoria] != null ? String(valores[categoria]) : '')
  }

  async function guardar(categoria: string) {
    const monto = Number(borradores[categoria] ?? valores[categoria] ?? 0)
    setGuardando(categoria)
    const { error } = await supabase.from('costos_predefinidos_aves')
      .upsert({ finca_id: fincaId, categoria, monto_referencia: monto }, { onConflict: 'finca_id,categoria' })
    setGuardando(null)
    if (error) { toast.error('Error al guardar el costo predefinido'); return }
    onUpdated(categoria, monto)
    setBorradores(prev => { const next = { ...prev }; delete next[categoria]; return next })
    toast.success('Costo predefinido actualizado')
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">Costos de referencia</CardTitle>
        <p className="text-xs text-gray-400">Valores predefinidos que se sugieren al registrar un costo — edítalos cuando cambien los precios</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CATEGORIAS_REFERENCIA.map(cat => (
          <div key={cat.value} className="space-y-1">
            <Label className="text-xs">{cat.label}</Label>
            <div className="flex gap-1.5">
              <CurrencyInput value={valorMostrado(cat.value)} onValueChange={v => setBorradores(prev => ({ ...prev, [cat.value]: v }))} placeholder="0" />
              <Button
                size="sm"
                variant="outline"
                className="text-xs shrink-0"
                disabled={guardando === cat.value || borradores[cat.value] === undefined}
                onClick={() => guardar(cat.value)}
              >
                Guardar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
