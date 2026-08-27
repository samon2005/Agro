'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database'

type Revision = Database['public']['Tables']['revisiones_calidad_huevo_aves']['Row']

interface Props {
  loteId: string
  fincaId: string
}

const CATEGORIAS: { key: 'cantidad_b' | 'cantidad_a' | 'cantidad_aa' | 'cantidad_aaa' | 'cantidad_jumbo'; label: string }[] = [
  { key: 'cantidad_b', label: 'B' },
  { key: 'cantidad_a', label: 'A' },
  { key: 'cantidad_aa', label: 'AA' },
  { key: 'cantidad_aaa', label: 'AAA' },
  { key: 'cantidad_jumbo', label: 'JUMBO' },
]

function defaultForm() {
  return {
    fecha: new Date().toISOString().split('T')[0],
    cantidad_b: '0',
    cantidad_a: '0',
    cantidad_aa: '0',
    cantidad_aaa: '0',
    cantidad_jumbo: '0',
    observaciones: '',
  }
}

export default function RevisionCalidadHuevo({ loteId, fincaId }: Props) {
  const supabase = createClient()
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm)

  const fetchRevisiones = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('revisiones_calidad_huevo_aves')
      .select('*')
      .eq('lote_id', loteId)
      .order('fecha', { ascending: false })
      .limit(12)
    setRevisiones(data ?? [])
    setLoading(false)
  }, [loteId, supabase])

  useEffect(() => { fetchRevisiones() }, [fetchRevisiones])
  useEffect(() => { if (modalOpen) setForm(defaultForm()) }, [modalOpen])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const totalForm = CATEGORIAS.reduce((s, c) => s + (Number(form[c.key]) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('revisiones_calidad_huevo_aves').upsert({
      lote_id: loteId,
      finca_id: fincaId,
      fecha: form.fecha,
      cantidad_b: Number(form.cantidad_b) || 0,
      cantidad_a: Number(form.cantidad_a) || 0,
      cantidad_aa: Number(form.cantidad_aa) || 0,
      cantidad_aaa: Number(form.cantidad_aaa) || 0,
      cantidad_jumbo: Number(form.cantidad_jumbo) || 0,
      observaciones: form.observaciones || null,
    }, { onConflict: 'lote_id,fecha' })
    setSaving(false)
    if (error) { toast.error('Error al guardar la revisión'); return }
    toast.success('Revisión semanal registrada')
    setModalOpen(false)
    fetchRevisiones()
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-gray-700">🥚 Revisión semanal de calidad (clasificación por peso)</CardTitle>
        <Button size="sm" onClick={() => setModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
          + Revisión semanal
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-gray-400 p-4">Cargando...</p>
        ) : revisiones.length === 0 ? (
          <p className="text-sm text-gray-400 p-4">Sin revisiones registradas. La máquina cuenta-huevos clasifica por peso: B, A, AA, AAA y JUMBO.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">B</TableHead>
                  <TableHead className="text-right">A</TableHead>
                  <TableHead className="text-right">AA</TableHead>
                  <TableHead className="text-right">AAA</TableHead>
                  <TableHead className="text-right">JUMBO</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisiones.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{formatDate(r.fecha)}</TableCell>
                    <TableCell className="text-right">{r.cantidad_b.toLocaleString('es-CO')}</TableCell>
                    <TableCell className="text-right">{r.cantidad_a.toLocaleString('es-CO')}</TableCell>
                    <TableCell className="text-right">{r.cantidad_aa.toLocaleString('es-CO')}</TableCell>
                    <TableCell className="text-right">{r.cantidad_aaa.toLocaleString('es-CO')}</TableCell>
                    <TableCell className="text-right">{r.cantidad_jumbo.toLocaleString('es-CO')}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {(r.cantidad_b + r.cantidad_a + r.cantidad_aa + r.cantidad_aaa + r.cantidad_jumbo).toLocaleString('es-CO')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={v => !v && setModalOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🥚 Revisión semanal de calidad de huevo</DialogTitle>
            <p className="text-sm text-gray-500">Registra el conteo por categoría de peso que arroja la máquina cuenta-huevos</p>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Fecha de la revisión</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIAS.map(c => (
                <div key={c.key} className="space-y-1">
                  <Label className="text-xs">{c.label}</Label>
                  <Input type="number" min="0" value={form[c.key]} onChange={e => set(c.key, e.target.value)} />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">Total clasificado: {totalForm.toLocaleString('es-CO')} huevos</p>
            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Input placeholder="Notas de la revisión..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800 text-white">
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
