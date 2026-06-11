'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const DEPARTAMENTOS = [
  'Antioquia','Atlántico','Bogotá D.C.','Bolívar','Boyacá','Caldas','Caquetá',
  'Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guajira','Huila',
  'Magdalena','Meta','Nariño','Norte de Santander','Putumayo','Quindío',
  'Risaralda','Santander','Sucre','Tolima','Valle del Cauca','Vichada',
]

type Props = {
  open: boolean
  onCreated: () => void
}

export default function CrearFincaModal({ open, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [departamento, setDepartamento] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('fincas').insert({
      nombre: form.get('nombre') as string,
      municipio: form.get('municipio') as string || null,
      departamento: departamento || null,
      hectareas: form.get('hectareas') ? Number(form.get('hectareas')) : null,
      propietario_id: user!.id,
    })

    if (error) {
      toast.error('Error al crear la finca: ' + error.message)
    } else {
      toast.success('¡Finca creada exitosamente!')
      onCreated()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-900">
            <span>🌿</span> Registra tu Finca
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Comienza registrando tu finca para gestionar tus animales e inventario
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre de la Finca *</Label>
            <Input id="nombre" name="nombre" placeholder="Ej: La Esperanza" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="municipio">Municipio</Label>
              <Input id="municipio" name="municipio" placeholder="Ej: Montería" />
            </div>
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select onValueChange={(v: string | null) => setDepartamento(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hectareas">Hectáreas</Label>
            <Input id="hectareas" name="hectareas" type="number" step="0.01" placeholder="Ej: 120.5" />
          </div>
          <Button type="submit" className="w-full bg-green-700 hover:bg-green-800 text-white" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Finca'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
