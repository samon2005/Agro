'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import { sumarDias } from '@/lib/cierreSemanal'
import type { Database } from '@/types/database'

type LoteCerdos = Database['public']['Tables']['lotes_cerdos']['Row']
type Evento = Database['public']['Tables']['eventos_clinicos_cerdos']['Row']
type Medicacion = Database['public']['Tables']['medicaciones_cerdos']['Row']

const TIPOS = ['Diarrea', 'Tos / respiratorio', 'Cojera', 'PRRS', 'Circovirus (PCV2)', 'Fiebre', 'Lesión o herida', 'Otro']
export const DESENLACES: Record<string, string> = {
  recuperado: 'Se recuperó',
  vuelve_grupo: 'Volvió al grupo',
  vendido_aparte: 'Se vendió aparte',
  sacrificado: 'Se sacrificó',
  murio: 'Murió',
}
const VIAS = ['Inyectable IM', 'Inyectable SC', 'Oral', 'Agua de bebida', 'Alimento', 'Tópico']
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

/** Fin del retiro de una medicación: el último día de aplicación más los días de retiro */
export function finRetiro(m: { fecha_inicio: string; fecha_fin: string | null; periodo_retiro_dias: number | null }): string | null {
  if (!m.periodo_retiro_dias) return null
  return sumarDias(m.fecha_fin ?? m.fecha_inicio, m.periodo_retiro_dias)
}

/**
 * Casos clínicos y medicaciones del grupo (José): en cada brote se anota
 * enfermedad, signos, áreas afectadas y tratamiento; el enfermo pasa a clínica
 * y se anota cómo terminó. Las medicaciones guardan quién las indicó y el
 * retiro, que se recuerda cada día hasta que termina.
 */
export default function ClinicaCerdos({ lote, vista }: { lote: LoteCerdos; vista: 'clinica' | 'medicaciones' }) {
  const hoy = hoyLocal()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [meds, setMeds] = useState<Medicacion[]>([])
  const [version, setVersion] = useState(0)
  const [abierto, setAbierto] = useState(false)
  const [ev, setEv] = useState({ fecha: hoy, tipo: TIPOS[0], signos: '', areas: '', afectados: '', accion: '', veterinario: '', necropsia: '' })
  const [med, setMed] = useState({ medicamento: '', dosis: '', via: VIAS[0], inicio: hoy, fin: '', animales: '', motivo: '', retiro: '', indico: '' })

  useEffect(() => {
    let vigente = true
    const s = createClient()
    Promise.all([
      s.from('eventos_clinicos_cerdos').select('*').eq('lote_id', lote.id).order('fecha', { ascending: false }).limit(100),
      s.from('medicaciones_cerdos').select('*').eq('lote_id', lote.id).order('fecha_inicio', { ascending: false }).limit(100),
    ]).then(([e, m]) => {
      if (!vigente) return
      setEventos(e.data ?? [])
      setMeds(m.data ?? [])
    })
    return () => { vigente = false }
  }, [lote.id, version])

  async function guardarEvento() {
    const { error } = await createClient().from('eventos_clinicos_cerdos').insert({
      lote_id: lote.id, finca_id: lote.finca_id, fecha: ev.fecha, tipo_evento: ev.tipo,
      descripcion: ev.signos.trim() || ev.tipo, signos: ev.signos.trim() || null, areas_afectadas: ev.areas.trim() || null,
      animales_afectados: ev.afectados ? Number(ev.afectados) : null, accion_tomada: ev.accion.trim() || null,
      veterinario: ev.veterinario.trim() || null, necropsia: ev.necropsia.trim() || null,
      resuelto: false, requiere_medicamento: !!ev.accion.trim(),
    })
    if (error) { toast.error('No se pudo guardar el caso'); return }
    toast.success('Caso anotado')
    setAbierto(false); setEv(p => ({ ...p, signos: '', areas: '', afectados: '', accion: '', necropsia: '' }))
    setVersion(v => v + 1)
  }

  async function cerrarEvento(e: Evento, desenlace: string) {
    const { error } = await createClient().from('eventos_clinicos_cerdos')
      .update({ desenlace, fecha_desenlace: hoy, resuelto: true }).eq('id', e.id)
    if (error) { toast.error('No se pudo guardar'); return }
    toast.success(DESENLACES[desenlace])
    setVersion(v => v + 1)
  }

  async function guardarMed() {
    if (!med.medicamento.trim()) { toast.error('Escribe el medicamento'); return }
    const { error } = await createClient().from('medicaciones_cerdos').insert({
      lote_id: lote.id, finca_id: lote.finca_id, medicamento: med.medicamento.trim(), dosis: med.dosis.trim() || null,
      via_administracion: med.via, fecha_inicio: med.inicio, fecha_fin: med.fin || null,
      numero_animales: med.animales ? Number(med.animales) : null, motivo: med.motivo.trim() || null,
      periodo_retiro_dias: med.retiro ? Number(med.retiro) : null, veterinario: med.indico.trim() || null,
    })
    if (error) { toast.error('No se pudo guardar la medicación'); return }
    toast.success('Medicación anotada')
    setAbierto(false); setMed(p => ({ ...p, medicamento: '', dosis: '', fin: '', animales: '', motivo: '', retiro: '' }))
    setVersion(v => v + 1)
  }

  const enRetiro = meds.filter(m => { const f = finRetiro(m); return f != null && f >= hoy })

  if (vista === 'medicaciones') {
    return (
      <div className="space-y-3 p-4">
        {enRetiro.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold"><Ic n="alerta" /> Retiro vigente: no vender ni sacrificar</p>
            {enRetiro.map(m => <p key={m.id} className="text-xs">{m.medicamento}: hasta el {fmt(finRetiro(m)!)}</p>)}
          </div>
        )}
        <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => setAbierto(a => !a)}><Ic n="mas" /> Medicación</Button></div>
        {abierto && (
          <div className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs">Medicamento *</Label><Input className="bg-white" value={med.medicamento} onChange={e => setMed(p => ({ ...p, medicamento: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Dosis</Label><Input className="bg-white" placeholder="Ej: 1 ml/10 kg" value={med.dosis} onChange={e => setMed(p => ({ ...p, dosis: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Vía</Label>
              <select className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" value={med.via} onChange={e => setMed(p => ({ ...p, via: e.target.value }))}>{VIAS.map(v => <option key={v}>{v}</option>)}</select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" className="bg-white" value={med.inicio} onChange={e => setMed(p => ({ ...p, inicio: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" className="bg-white" value={med.fin} onChange={e => setMed(p => ({ ...p, fin: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Animales tratados</Label><Input type="number" className="bg-white" value={med.animales} onChange={e => setMed(p => ({ ...p, animales: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Retiro (días)</Label><Input type="number" className="bg-white" placeholder="Lo dice el profesional" value={med.retiro} onChange={e => setMed(p => ({ ...p, retiro: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Quién lo indicó</Label><Input className="bg-white" value={med.indico} onChange={e => setMed(p => ({ ...p, indico: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Motivo</Label><Input className="bg-white" value={med.motivo} onChange={e => setMed(p => ({ ...p, motivo: e.target.value }))} /></div>
            <div className="sm:col-span-3 flex justify-end"><Button size="sm" onClick={guardarMed}>Guardar</Button></div>
          </div>
        )}
        {meds.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Sin medicaciones</p> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {meds.map(m => {
              const f = finRetiro(m)
              return (
                <li key={m.id} className="flex flex-wrap items-baseline gap-2 py-2">
                  <span className="font-medium">{m.medicamento}</span>
                  <span className="text-xs text-gray-500">{fmt(m.fecha_inicio)}{m.fecha_fin ? ` a ${fmt(m.fecha_fin)}` : ''} · {m.dosis ?? '—'} · {m.via_administracion ?? '—'}{m.numero_animales ? ` · ${m.numero_animales} animales` : ''}{m.veterinario ? ` · indicó ${m.veterinario}` : ''}</span>
                  {f && <span className={`ml-auto rounded-full px-2 text-xs ${f >= hoy ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>retiro hasta {fmt(f)}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  const abiertos = eventos.filter(e => !e.desenlace && !e.resuelto)
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">{abiertos.length > 0 ? `${abiertos.length} ${abiertos.length === 1 ? 'caso abierto' : 'casos abiertos'} (en clínica)` : 'Sin casos abiertos'}</p>
        <Button size="sm" variant="outline" onClick={() => setAbierto(a => !a)}><Ic n="mas" /> Caso o brote</Button>
      </div>
      {abierto && (
        <div className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-3">
          <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" className="bg-white" value={ev.fecha} onChange={e => setEv(p => ({ ...p, fecha: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">Enfermedad o problema</Label>
            <select className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" value={ev.tipo} onChange={e => setEv(p => ({ ...p, tipo: e.target.value }))}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Animales afectados</Label><Input type="number" className="bg-white" value={ev.afectados} onChange={e => setEv(p => ({ ...p, afectados: e.target.value }))} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Signos</Label><Input className="bg-white" placeholder="Ej: heces líquidas, decaídos" value={ev.signos} onChange={e => setEv(p => ({ ...p, signos: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">Áreas afectadas</Label><Input className="bg-white" placeholder="Ej: corral 2" value={ev.areas} onChange={e => setEv(p => ({ ...p, areas: e.target.value }))} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Tratamiento</Label><Input className="bg-white" value={ev.accion} onChange={e => setEv(p => ({ ...p, accion: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">Veterinario</Label><Input className="bg-white" value={ev.veterinario} onChange={e => setEv(p => ({ ...p, veterinario: e.target.value }))} /></div>
          <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Necropsia (si se hizo)</Label><Input className="bg-white" placeholder="Hallazgos" value={ev.necropsia} onChange={e => setEv(p => ({ ...p, necropsia: e.target.value }))} /></div>
          <div className="sm:col-span-3 flex justify-end"><Button size="sm" onClick={guardarEvento}>Guardar</Button></div>
        </div>
      )}
      {eventos.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Sin casos clínicos</p> : (
        <ul className="divide-y divide-gray-100 text-sm">
          {eventos.map(e => (
            <li key={e.id} className="space-y-1 py-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{e.tipo_evento}</span>
                <span className="text-xs text-gray-500">{fmt(e.fecha)}{e.animales_afectados ? ` · ${e.animales_afectados} animales` : ''}{e.areas_afectadas ? ` · ${e.areas_afectadas}` : ''}</span>
                {e.desenlace
                  ? <span className="ml-auto rounded-full bg-gray-100 px-2 text-xs text-gray-600">{DESENLACES[e.desenlace]}{e.fecha_desenlace ? ` · ${fmt(e.fecha_desenlace)}` : ''}</span>
                  : <span className="ml-auto rounded-full bg-amber-100 px-2 text-xs text-amber-800">En clínica</span>}
              </div>
              {(e.signos || e.accion_tomada || e.necropsia) && (
                <p className="text-xs text-gray-600">{[e.signos, e.accion_tomada && `tratamiento: ${e.accion_tomada}`, e.necropsia && `necropsia: ${e.necropsia}`].filter(Boolean).join(' · ')}</p>
              )}
              {!e.desenlace && !e.resuelto && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(DESENLACES).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => cerrarEvento(e, v)} className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">{t}</button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
