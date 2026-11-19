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
import { Ic } from '@/components/ui/icon'
import { PERIODOS_PAGO, CONTRATOS } from '@/lib/desempeno'
import { ROLES_ASIGNABLES } from '@/lib/roles'

const PERIODOS = PERIODOS_PAGO.map(p => ({ value: p.v, label: p.t }))

interface Props {
  open: boolean
  onClose: () => void
  fincaId: string
  onCreated: () => void
}

export default function InvitarOperarioModal({ open, onClose, fincaId, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', cargo: '', pago_monto: '', pago_periodo: 'mensual', rol: 'operario', tipo_contrato: '' })
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
    data.set('rol', form.rol)
    data.set('tipo_contrato', form.tipo_contrato)

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
    setForm({ full_name: '', email: '', cargo: '', pago_monto: '', pago_periodo: 'mensual', rol: 'operario', tipo_contrato: '' })
    setCredenciales(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        {credenciales ? (
          <>
            <DialogHeader>
              <DialogTitle><Ic n="listo" /> Operario creado</DialogTitle>
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
              <DialogTitle><Ic n="operario" /> Nuevo Operario</DialogTitle>
              <p className="text-sm text-gray-500">Se crea su cuenta y entra a la finca con el rol que le des. Si prefieres que la persona cree su propia cuenta, dale un código.</p>
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
                <Label>Rol en la finca</Label>
                <Select value={form.rol} onValueChange={v => set('rol', v ?? 'operario')}>
                  <SelectTrigger><SelectValue>{(v: string) => ROLES_ASIGNABLES.find(r => r.v === v)?.t ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>{ROLES_ASIGNABLES.map(r => <SelectItem key={r.v} value={r.v}>{r.t}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-gray-500">{ROLES_ASIGNABLES.find(r => r.v === form.rol)?.d}</p>
              </div>
              <div className="space-y-1">
                <Label>Cargo / función</Label>
                <Input placeholder="Ej: Encargado de alimentación" value={form.cargo} onChange={e => set('cargo', e.target.value)} />
              </div>
<div className="space-y-1">
                <Label>Tipo de contrato</Label>
                <select value={form.tipo_contrato} onChange={e => set('tipo_contrato', e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                  <option value="">Sin anotar</option>
                  {CONTRATOS.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Pago</Label>
                  <CurrencyInput placeholder="Ej: 1200000" value={form.pago_monto} onValueChange={v => set('pago_monto', v)} />
                </div>
                <div className="space-y-1">
                  <Label>Periodicidad</Label>
                  <Select value={form.pago_periodo} onValueChange={v => set('pago_periodo', v ?? 'mensual')}>
                    <SelectTrigger><SelectValue>{(v: string) => PERIODOS.find(x => x.value === v)?.label ?? v}</SelectValue></SelectTrigger>
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
