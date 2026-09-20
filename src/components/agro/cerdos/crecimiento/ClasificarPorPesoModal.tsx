'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import type { Database } from '@/types/database'
import { hoyLocal } from '@/lib/fechas'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']

interface Props {
  open: boolean
  onClose: () => void
  lote: LoteCerdos
  onCreated: () => void
}

/** Los tres grupos por tamaño con los que se separa el precebo. */
const GRUPOS = [
  { key: 'S', label: 'S — pequeños', detalle: 'Los de menor peso, que necesitan más tiempo' },
  { key: 'M', label: 'M — medianos', detalle: 'El grueso del lote' },
  { key: 'L', label: 'L — grandes', detalle: 'Los más adelantados' },
] as const

interface Grupo { cantidad: string; peso: string; nombre: string; corral: string }

function formVacio(lote: LoteCerdos): Record<string, Grupo> {
  return Object.fromEntries(GRUPOS.map(g => [g.key, {
    cantidad: '',
    peso: '',
    nombre: `${lote.nombre} · ${g.key}`,
    corral: '',
  }])) as Record<string, Grupo>
}

/**
 * Al salir del precebo los cerdos se clasifican por peso y cada grupo se va a su
 * propio lote, porque comen distinto y no avanzan igual. Cada grupo que se llene
 * se vuelve un lote nuevo y sale del lote de origen.
 */
export default function ClasificarPorPesoModal({ open, onClose, lote, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [fecha, setFecha] = useState(hoyLocal())
  const [grupos, setGrupos] = useState<Record<string, Grupo>>(() => formVacio(lote))

  useEffect(() => {
    if (open) { setGrupos(formVacio(lote)); setFecha(hoyLocal()) }
  }, [open, lote])

  function set(key: string, campo: keyof Grupo, valor: string) {
    setGrupos(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }))
  }

  const conAnimales = GRUPOS.filter(g => Number(grupos[g.key]?.cantidad) > 0)
  const totalClasificado = conAnimales.reduce((s, g) => s + Number(grupos[g.key].cantidad), 0)
  const quedan = lote.animales_actuales - totalClasificado

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (conAnimales.length === 0) { toast.error('Escribe cuántos animales van en cada grupo'); return }
    if (conAnimales.length === 1) { toast.error('Para dividir el lote hacen falta al menos dos grupos'); return }
    if (totalClasificado > lote.animales_actuales) {
      toast.error(`El lote tiene ${lote.animales_actuales} animales y estás clasificando ${totalClasificado}`); return
    }
    if (conAnimales.some(g => !grupos[g.key].nombre.trim())) { toast.error('Cada grupo necesita el nombre de su lote'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    for (const g of conAnimales) {
      const datos = grupos[g.key]
      const cantidad = Number(datos.cantidad)
      // El grupo se vuelve un lote propio, con el mismo alimento y etapa del de origen
      const { data: nuevo, error } = await supabase.from('lotes_cerdos').insert({
        finca_id: lote.finca_id,
        nombre: datos.nombre.trim(),
        sistema: lote.sistema,
        linea_genetica: lote.linea_genetica,
        fecha_ingreso: fecha,
        fecha_nacimiento: lote.fecha_nacimiento,
        etapa_actual: lote.etapa_actual,
        numero_animales: cantidad,
        animales_actuales: cantidad,
        peso_promedio_inicial: datos.peso ? Number(datos.peso) : null,
        origen_animales: `Clasificación por peso de ${lote.nombre} (grupo ${g.key})`,
        corral: datos.corral || lote.corral,
        alimento_activo_id: lote.alimento_activo_id,
        consumo_estimado_kg_dia: lote.consumo_estimado_kg_dia,
        consumo_activo_kg: lote.consumo_estimado_kg_dia ? Number(lote.consumo_estimado_kg_dia) * cantidad : null,
        registrado_por: user?.id ?? null,
      }).select('id').single()

      if (error || !nuevo) { setLoading(false); toast.error(`Error al crear el lote del grupo ${g.key}`); return }

      // El traslado queda anotado en el lote de origen y en el nuevo
      await supabase.from('movimientos_cerdos').insert([
        {
          lote_id: lote.id, finca_id: lote.finca_id, fecha, tipo: 'traslado', cantidad,
          peso_promedio: datos.peso ? Number(datos.peso) : null,
          destino_origen: datos.nombre.trim(),
          observaciones: `Clasificación por peso · grupo ${g.key}`,
          registrado_por: user?.id ?? null,
        },
        {
          lote_id: nuevo.id, finca_id: lote.finca_id, fecha, tipo: 'ingreso', cantidad,
          peso_promedio: datos.peso ? Number(datos.peso) : null,
          destino_origen: lote.nombre,
          observaciones: `Viene de la clasificación por peso de ${lote.nombre}`,
          registrado_por: user?.id ?? null,
        },
      ])

      // El peso del grupo arranca su historial de pesajes
      if (datos.peso) {
        const { error: errPeso } = await supabase.from('pesos_lote_cerdos').insert({
          lote_id: nuevo.id, finca_id: lote.finca_id, fecha,
          peso_promedio: Number(datos.peso), numero_pesados: cantidad,
          metodo: 'manual',
          observaciones: `Peso al clasificar el grupo ${g.key}`,
          registrado_por: user?.id ?? null,
        })
        if (errPeso) toast.warning(`El lote ${datos.nombre.trim()} quedó creado, pero su pesaje inicial no se guardó`)
      }
    }

    // Lo que se llevó cada grupo sale del lote de origen
    const { error: errLote } = await supabase.from('lotes_cerdos')
      .update({ animales_actuales: quedan, estado: quedan > 0 ? 'activo' : 'finalizado' })
      .eq('id', lote.id)

    setLoading(false)
    if (errLote) { toast.error('Los lotes se crearon, pero el lote de origen no se actualizó'); return }
    toast.success(
      quedan > 0
        ? `${conAnimales.length} lotes creados · quedan ${quedan} animales en ${lote.nombre}`
        : `${conAnimales.length} lotes creados · ${lote.nombre} queda sin animales`,
    )
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clasificar por peso y separar en lotes</DialogTitle>
          <p className="text-sm text-gray-500">
            Al salir del precebo los cerdos se separan por tamaño: cada grupo se va a su propio
            lote porque comen distinto y no engordan igual.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fecha de la clasificación</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Animales en {lote.nombre}</Label>
              <p className="flex h-9 items-center text-sm font-semibold text-gray-800">
                {lote.animales_actuales.toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          {GRUPOS.map(g => (
            <div key={g.key} className="space-y-2 rounded-xl bg-gray-50 p-3">
              <div>
                <p className="text-xs font-semibold text-gray-700">{g.label}</p>
                <p className="text-[0.6875rem] text-gray-500">{g.detalle}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Animales</Label>
                  <Input
                    type="number" min="0" className="bg-white" placeholder="0"
                    value={grupos[g.key]?.cantidad ?? ''}
                    onChange={e => set(g.key, 'cantidad', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso promedio (kg)</Label>
                  <Input
                    type="number" min="0" step="0.1" className="bg-white" placeholder="Ej: 18"
                    value={grupos[g.key]?.peso ?? ''}
                    onChange={e => set(g.key, 'peso', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nombre del lote</Label>
                  <Input
                    className="bg-white"
                    value={grupos[g.key]?.nombre ?? ''}
                    onChange={e => set(g.key, 'nombre', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Corral</Label>
                  <Input
                    className="bg-white" placeholder="Ej: Corral B"
                    value={grupos[g.key]?.corral ?? ''}
                    onChange={e => set(g.key, 'corral', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className={`rounded-lg px-3 py-2 text-xs ${quedan < 0 ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-600'}`}>
            {quedan < 0 ? (
              <>Estás clasificando {totalClasificado} animales y el lote solo tiene {lote.animales_actuales}.</>
            ) : (
              <>
                Clasificados: <strong>{totalClasificado}</strong> · quedan en {lote.nombre}: <strong>{quedan}</strong>
                {quedan === 0 && ' — el lote de origen queda sin animales y se cierra.'}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || quedan < 0}>
              {loading ? 'Creando lotes...' : <><Ic n="cerdo" /> Separar en lotes</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
