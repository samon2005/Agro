'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { invitarOperario } from '@/lib/supabase/actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PERIODOS = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'diario', label: 'Diario' },
  { value: 'por_tarea', label: 'Por tarea' },
]

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  onCreated: () => void
}

export default function InvitarOperarioModal({ open, onClose, fincaId, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', cargo: '', pago_monto: '', pago_periodo: 'mensual' })
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim()) { toast.error('Nombre y correo son requeridos'); return }

    setLoading(true)
    const data = new FormData()
    data.set('full_name', form.full_name)
    data.set('email', form.email)
    data.set('cargo', form.cargo)
    data.set('pago_monto', form.pago_monto)
    data.set('pago_periodo', form.pago_periodo)

    try {
      const result = await invitarOperario(data, fincaId)
      setCredenciales(result)
      toast.success('Operario creado')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el operario')
    }
    setLoading(false)
  }

  function handleClose() {
    setForm({ full_name: '', email: '', cargo: '', pago_monto: '', pago_periodo: 'mensual' })
    setCredenciales(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        {credenciales ? (
          <>
            <DialogHeader>
              <DialogTitle>✅ Operario creado</DialogTitle>
              <p className="text-sm text-gray-500">Comparte estas credenciales con el operario. La contraseña solo se muestra una vez.</p>
            </DialogHeader>
            <div className="space-y-3 bg-green-50 border border-green-200 rounded-lg p-4">
              <div>
                <p className="text-xs text-green-700 font-medium">Correo</p>
                <p className="text-sm font-mono text-green-900">{credenciales.email}</p>
              </div>
              <div>
                <p className="text-xs text-green-700 font-medium">Contraseña temporal</p>
                <p className="text-sm font-mono text-green-900">{credenciales.password}</p>
              </div>
            </div>
            <DialogFooter>
              <Button className="bg-green-700 hover:bg-green-800 text-white" onClick={handleClose}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>👷 Nuevo Operario</DialogTitle>
              <p className="text-sm text-gray-500">Se creará una cuenta con acceso limitado (sin ver costos ni configuración de la finca)</p>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>Nombre completo *</Label>
                <Input placeholder="Ej: Juan Pérez" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Correo *</Label>
                <Input type="email" placeholder="operario@correo.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cargo / función</Label>
                <Input placeholder="Ej: Encargado de alimentación" value={form.cargo} onChange={e => set('cargo', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Pago</Label>
                  <CurrencyInput placeholder="Ej: 1200000" value={form.pago_monto} onValueChange={v => set('pago_monto', v)} />
                </div>
                <div className="space-y-1">
                  <Label>Periodicidad</Label>
                  <Select value={form.pago_periodo} onValueChange={v => set('pago_periodo', v ?? 'mensual')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
                  {loading ? 'Creando...' : 'Crear operario'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
