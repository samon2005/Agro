'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CurrencyInput } from '@/components/ui/currency-input'
import { toast } from 'sonner'

const UNIDADES = ['kg', 'g', 'litros', 'ml', 'unidades', 'bultos', 'cajas', 'dosis', 'metros']

type Categoria = { id: string; nombre: string }

type Props = {
  open: boolean
  onClose: () => void
  fincaId: string
  categoriaSugerida?: string
  onCreated: () => void
}

export default function RegistrarInventarioModal({ open, onClose, fincaId, categoriaSugerida, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [unidad, setUnidad] = useState('')
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const [sinVencimiento, setSinVencimiento] = useState(false)
  const [precioUnitario, setPrecioUnitario] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!open) return
    formRef.current?.reset()
    setCategoriaId('')
    setUnidad('')
    setNuevaCategoria('')
    setSinVencimiento(false)
    setPrecioUnitario('')
    const supabase = createClient()
    supabase.from('inventario_categorias').select('*').eq('finca_id', fincaId).order('nombre')
      .then(({ data }) => {
        setCategorias(data ?? [])
        if (categoriaSugerida) {
          const existente = (data ?? []).find(c => c.nombre.toLowerCase() === categoriaSugerida.toLowerCase())
          if (existente) setCategoriaId(existente.id)
          else setNuevaCategoria(categoriaSugerida)
        }
      })
  }, [open, fincaId, categoriaSugerida])

  async function crearCategoria() {
    if (!nuevaCategoria.trim()) return
    setCreandoCategoria(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('inventario_categorias').insert({
      finca_id: fincaId,
      nombre: nuevaCategoria.trim(),
    }).select().single()

    if (!error && data) {
      setCategorias(prev => [...prev, data])
      setCategoriaId(data.id)
      setNuevaCategoria('')
      toast.success('Categoría creada')
    }
    setCreandoCategoria(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.from('inventario').insert({
      finca_id: fincaId,
      categoria_id: categoriaId || null,
      nombre: form.get('nombre') as string,
      descripcion: form.get('descripcion') as string || null,
      unidad_medida: unidad || null,
      cantidad_actual: Number(form.get('cantidad_actual') ?? 0),
      cantidad_minima: Number(form.get('cantidad_minima') ?? 0),
      precio_unitario: precioUnitario ? Number(precioUnitario) : null,
      proveedor: form.get('proveedor') as string || null,
      fecha_vencimiento: sinVencimiento ? null : (form.get('fecha_vencimiento') as string || null),
    })

    if (error) {
      toast.error('Error al registrar: ' + error.message)
    } else {
      toast.success('Ítem registrado en inventario')
      onCreated()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-900">
            <span>📦</span> Agregar al Inventario
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre del Ítem *</Label>
            <Input id="nombre" name="nombre" placeholder="Ej: Ivermectina 1%" required />
          </div>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <div className="flex gap-2">
              <Select
                onValueChange={(v: string | null) => setCategoriaId(v ?? '')}
                value={categoriaId}
                items={Object.fromEntries(categorias.map(c => [c.id, c.nombre]))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Nueva categoría..."
                value={nuevaCategoria}
                onChange={e => setNuevaCategoria(e.target.value)}
                className="text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={crearCategoria} disabled={creandoCategoria || !nuevaCategoria.trim()}>
                + Crear
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cantidad_actual">Cantidad Actual *</Label>
              <Input id="cantidad_actual" name="cantidad_actual" type="number" step="0.001" defaultValue="0" required />
            </div>
            <div className="space-y-1.5">
              <Label>Unidad de Medida</Label>
              <Select onValueChange={(v: string | null) => setUnidad(v ?? '')} value={unidad}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cantidad_minima">Stock Mínimo (alerta)</Label>
              <Input id="cantidad_minima" name="cantidad_minima" type="number" step="0.001" defaultValue="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="precio_unitario">Precio Unitario</Label>
              <CurrencyInput value={precioUnitario} onValueChange={setPrecioUnitario} placeholder="Ej: 15000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proveedor">Proveedor</Label>
              <Input id="proveedor" name="proveedor" placeholder="Ej: Agroveterinaria" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento</Label>
              <div className="flex gap-2">
                <Input id="fecha_vencimiento" name="fecha_vencimiento" type="date" disabled={sinVencimiento} className="flex-1" />
                <Button
                  type="button"
                  size="sm"
                  variant={sinVencimiento ? 'default' : 'outline'}
                  className={sinVencimiento ? 'bg-gray-700 hover:bg-gray-800 text-white text-xs shrink-0' : 'text-xs shrink-0'}
                  onClick={() => setSinVencimiento(v => !v)}
                >
                  No aplica
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea id="descripcion" name="descripcion" placeholder="Notas adicionales..." rows={2} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-green-700 hover:bg-green-800 text-white" disabled={loading}>
              {loading ? 'Guardando...' : 'Agregar al Inventario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
