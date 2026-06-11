'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

type Especie = { id: string; nombre: string }
type Raza = { id: string; nombre: string }

type Props = {
  open: boolean
  onClose: () => void
  fincaId: string
  onCreated: () => void
}

export default function RegistrarAnimalModal({ open, onClose, fincaId, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [especies, setEspecies] = useState<Especie[]>([])
  const [razas, setRazas] = useState<Raza[]>([])
  const [especieId, setEspecieId] = useState('')
  const [razaId, setRazaId] = useState('')
  const [sexo, setSexo] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('especies').select('*').order('nombre')
      .then(({ data }) => setEspecies(data ?? []))
  }, [])

  useEffect(() => {
    if (!especieId) return
    setRazaId('')
    const supabase = createClient()
    supabase.from('razas').select('*').eq('especie_id', especieId).order('nombre')
      .then(({ data }) => setRazas(data ?? []))
  }, [especieId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.from('animales').insert({
      finca_id: fincaId,
      especie_id: especieId || null,
      raza_id: razaId || null,
      numero_arete: form.get('numero_arete') as string || null,
      nombre: form.get('nombre') as string || null,
      sexo: sexo || null,
      fecha_nacimiento: form.get('fecha_nacimiento') as string || null,
      peso_actual: form.get('peso_actual') ? Number(form.get('peso_actual')) : null,
      estado: 'activo',
    })

    if (error) {
      toast.error('Error al registrar: ' + error.message)
    } else {
      toast.success('Animal registrado exitosamente')
      onCreated()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-900">
            <span>🐄</span> Registrar Animal
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Especie</Label>
              <Select onValueChange={(v: string | null) => setEspecieId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {especies.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Raza</Label>
              <Select onValueChange={(v: string | null) => setRazaId(v ?? '')} disabled={!especieId || razas.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={especieId ? 'Seleccionar' : 'Elige especie'} />
                </SelectTrigger>
                <SelectContent>
                  {razas.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="numero_arete">Número de Arete</Label>
              <Input id="numero_arete" name="numero_arete" placeholder="Ej: 0045" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre (opcional)</Label>
              <Input id="nombre" name="nombre" placeholder="Ej: Manchas" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <Select onValueChange={(v: string | null) => setSexo(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="H">Hembra</SelectItem>
                  <SelectItem value="M">Macho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
              <Input id="fecha_nacimiento" name="fecha_nacimiento" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="peso_actual">Peso Actual (kg)</Label>
            <Input id="peso_actual" name="peso_actual" type="number" step="0.1" placeholder="Ej: 320.5" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-green-700 hover:bg-green-800 text-white" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar Animal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
