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
  fechaInicioPostura: string | null
  fechaInicioLote: string
}

const MS_DIA = 24 * 60 * 60 * 1000

const CATEGORIAS: { key: 'cantidad_b' | 'cantidad_a' | 'cantidad_aa' | 'cantidad_aaa' | 'cantidad_jumbo'; label: string; semanaKey: 'b' | 'a' | 'aa' | 'aaa' | 'jumbo' }[] = [
  { key: 'cantidad_b', label: 'B', semanaKey: 'b' },
  { key: 'cantidad_a', label: 'A', semanaKey: 'a' },
  { key: 'cantidad_aa', label: 'AA', semanaKey: 'aa' },
  { key: 'cantidad_aaa', label: 'AAA', semanaKey: 'aaa' },
  { key: 'cantidad_jumbo', label: 'JUMBO', semanaKey: 'jumbo' },
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

export default function RevisionCalidadHuevo({ loteId, fincaId, fechaInicioPostura, fechaInicioLote }: Props) {
  const supabase = createClient()
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [semanaActual, setSemanaActual] = useState({ b: 0, a: 0, aa: 0, aaa: 0, jumbo: 0 })

  const origen = fechaInicioPostura ?? fechaInicioLote
  const origenDate = new Date(origen + 'T00:00:00')
  const hoyDate = new Date()
  const numSemana = Math.max(0, Math.floor((hoyDate.getTime() - origenDate.getTime()) / (7 * MS_DIA)))
  const inicioSemana = new Date(origenDate.getTime() + numSemana * 7 * MS_DIA)
  const finSemana = new Date(inicioSemana.getTime() + 6 * MS_DIA)
  const inicioSemanaStr = inicioSemana.toISOString().split('T')[0]
  const finSemanaStr = finSemana.toISOString().split('T')[0]

  const fetchRevisiones = useCallback(async () => {
    setLoading(true)
    const [revRes, diariosRes] = await Promise.all([
      supabase.from('revisiones_calidad_huevo_aves').select('*').eq('lote_id', loteId).order('fecha', { ascending: false }).limit(12),
      supabase.from('produccion_diaria_aves').select('huevos_b, huevos_a, huevos_aa, huevos_aaa, huevos_jumbo').eq('lote_id', loteId).gte('fecha', inicioSemanaStr).lte('fecha', finSemanaStr),
    ])
    setRevisiones(revRes.data ?? [])
    const acum = { b: 0, a: 0, aa: 0, aaa: 0, jumbo: 0 }
    for (const r of diariosRes.data ?? []) {
      acum.b += r.huevos_b; acum.a += r.huevos_a; acum.aa += r.huevos_aa; acum.aaa += r.huevos_aaa; acum.jumbo += r.huevos_jumbo
    }
    setSemanaActual(acum)
    setLoading(false)
  }, [loteId, supabase, inicioSemanaStr, finSemanaStr])

  useEffect(() => { fetchRevisiones() }, [fetchRevisiones])

  useEffect(() => {
    if (!modalOpen) return
    setForm({
      fecha: new Date().toISOString().split('T')[0],
      cantidad_b: String(semanaActual.b),
      cantidad_a: String(semanaActual.a),
      cantidad_aa: String(semanaActual.aa),
      cantidad_aaa: String(semanaActual.aaa),
      cantidad_jumbo: String(semanaActual.jumbo),
      observaciones: '',
    })
  }, [modalOpen, semanaActual])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const totalForm = CATEGORIAS.reduce((s, c) => s + (Number(form[c.key as keyof typeof form]) || 0), 0)
  const totalSemanaActual = semanaActual.b + semanaActual.a + semanaActual.aa + semanaActual.aaa + semanaActual.jumbo

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

  async function eliminarRevision(r: Revision) {
    if (confirmandoEliminar !== r.id) { setConfirmandoEliminar(r.id); return }
    setConfirmandoEliminar(null)
    const { error } = await supabase.from('revisiones_calidad_huevo_aves').delete().eq('id', r.id)
    if (error) { toast.error('Error al eliminar la revisión'); return }
    toast.success('Revisión eliminada')
    fetchRevisiones()
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  function formatDateCorta(d: Date) {
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-gray-700">🥚 Revisión semanal de calidad (clasificación por peso)</CardTitle>
        <Button size="sm" onClick={() => setModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
          + Revisión semanal
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-1">
            📅 Semana en curso (automático): {formatDateCorta(inicioSemana)} – {formatDateCorta(finSemana)}
          </p>
          <p className="text-xs text-amber-600 mb-2">Se calcula solo con lo que ya registraste día a día — va aumentando a medida que pasan los días</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {CATEGORIAS.map(c => (
              <div key={c.key} className="bg-white rounded-lg border border-amber-100 py-1.5">
                <p className="text-[10px] text-amber-500 font-medium">{c.label}</p>
                <p className="text-sm font-bold text-amber-800">{semanaActual[c.semanaKey].toLocaleString('es-CO')}</p>
              </div>
            ))}
            <div className="bg-amber-100 rounded-lg border border-amber-200 py-1.5">
              <p className="text-[10px] text-amber-700 font-medium">Total</p>
              <p className="text-sm font-bold text-amber-900">{totalSemanaActual.toLocaleString('es-CO')}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : revisiones.length === 0 ? (
          <p className="text-sm text-gray-400">Sin revisiones registradas. La máquina cuenta-huevos clasifica por peso: B, A, AA, AAA y JUMBO.</p>
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
                  <TableHead></TableHead>
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
                    <TableCell>
                      <Button
                        size="sm" variant="ghost"
                        className={confirmandoEliminar === r.id ? 'h-7 px-2 text-xs text-white bg-red-600 hover:bg-red-700' : 'h-7 px-2 text-xs text-red-600'}
                        onClick={() => eliminarRevision(r)}
                      >
                        {confirmandoEliminar === r.id ? '¿Confirmar?' : '🗑️'}
                      </Button>
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
            <p className="text-sm text-gray-500">Precargado con lo registrado día a día en la semana en curso — ajústalo si la máquina cuenta-huevos difiere</p>
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
                  <Input type="number" min="0" value={form[c.key as keyof typeof form]} onChange={e => set(c.key, e.target.value)} />
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
