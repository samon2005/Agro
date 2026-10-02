'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { useFinca } from './FincaProvider'
import { useRol } from './RolProvider'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'

const NOMBRE_ESPECIE: Record<EspecieFinca, string> = {
  aves_ponedoras: 'Aves ponedoras',
  cerdos: 'Cerdos',
  pollo_engorde: 'Pollo de engorde',
}

/**
 * Una finca produce una sola especie. Si la finca abierta no tiene ninguna (quedó
 * así al pasar a una especie por finca), su dueño la elige antes de seguir: sin
 * eso el panel no sabe qué mostrar.
 */
export default function ElegirEspecieFinca() {
  const { fincaActual, refetch } = useFinca()
  const rol = useRol()
  const [especie, setEspecie] = useState<EspecieFinca | null>(null)
  const [guardando, setGuardando] = useState(false)

  const sinEspecie = fincaActual != null && (fincaActual.tipo_produccion ?? []).length === 0
  if (!sinEspecie) return null

  async function guardar() {
    if (!especie || !fincaActual) return
    setGuardando(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('fincas')
      .update({ tipo_produccion: [especie] })
      .eq('id', fincaActual.id)
      .select('id')
    setGuardando(false)
    if (error) { toast.error('Error al guardar lo que produce la finca'); return }
    // Sin permiso la base no falla: solo no actualiza nada
    if (!data || data.length === 0) { toast.error('Solo el propietario de la finca puede elegirlo'); return }
    toast.success(`${fincaActual.nombre} queda como finca de ${NOMBRE_ESPECIE[especie].toLowerCase()}`)
    refetch()
  }

  return (
    <Dialog open>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle><Ic n="hoja" /> ¿Qué produce {fincaActual.nombre}?</DialogTitle>
          <p className="text-sm text-gray-500">
            Cada finca trabaja una sola especie y el panel muestra solo lo de esa producción.
            Esta finca todavía no tiene una elegida.
          </p>
        </DialogHeader>
        {rol === 'trabajador' ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Pídele al dueño de la finca que entre y elija qué produce.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {ESPECIES_FINCA.map(esp => (
                <button
                  key={esp.value}
                  type="button"
                  onClick={() => setEspecie(esp.value)}
                  aria-pressed={especie === esp.value}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors',
                    especie === esp.value ? 'border-green-600 bg-green-50 text-green-800 ring-2 ring-green-600/20' : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  <Ic n={esp.icon} className="size-5" />
                  {NOMBRE_ESPECIE[esp.value]}
                </button>
              ))}
            </div>
            <Button className="w-full" disabled={!especie || guardando} onClick={guardar}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
