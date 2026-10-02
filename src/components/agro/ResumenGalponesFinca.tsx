'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { semanaDelLote } from '@/lib/postura'
import { hoyLocal } from '@/lib/fechas'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'
import type { Database } from '@/types/database'

type Finca = Pick<Database['public']['Tables']['fincas']['Row'],
  'id' | 'nombre' | 'municipio' | 'departamento' | 'area_valor' | 'area_unidad' | 'tipo_produccion'>
type Instalacion = Database['public']['Tables']['instalaciones']['Row']
type Lote = Pick<Database['public']['Tables']['lotes_aves']['Row'],
  'id' | 'instalacion_id' | 'nombre' | 'estado' | 'aves_actuales' | 'aves_iniciales' | 'fecha_inicio' | 'fecha_inicio_postura' | 'linea_genetica'>

const QUE_PRODUCE: Record<EspecieFinca, string> = {
  aves_ponedoras: 'Aves ponedoras',
  cerdos: 'Cerdos',
  pollo_engorde: 'Pollo de engorde',
}

function unidadArea(u: string | null) {
  return u === 'ha' ? 'ha' : u === 'm2' ? 'm²' : (u ?? '')
}

/**
 * Lo que se registró de la finca: nombre, ubicación, qué produce y cada galpón con
 * su medida, si está ocupado o vacío, cuántas aves tiene y en qué semana va.
 */
export default function ResumenGalponesFinca({ finca, onEditar }: { finca: Finca; onEditar: () => void }) {
  const [galpones, setGalpones] = useState<Instalacion[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [cargando, setCargando] = useState(true)
  const especie = (finca.tipo_produccion?.[0] ?? null) as EspecieFinca | null
  const infoEspecie = ESPECIES_FINCA.find(e => e.value === especie)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    Promise.all([
      supabase.from('instalaciones').select('*').eq('finca_id', finca.id).order('nombre'),
      especie === 'aves_ponedoras'
        ? supabase.from('lotes_aves')
          .select('id, instalacion_id, nombre, estado, aves_actuales, aves_iniciales, fecha_inicio, fecha_inicio_postura, linea_genetica')
          .eq('finca_id', finca.id).in('estado', ['activo', 'preparacion'])
        : Promise.resolve({ data: [] as Lote[] }),
    ]).then(([inst, lot]) => {
      if (!vigente) return
      setGalpones((inst.data ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })))
      setLotes((lot.data ?? []) as Lote[])
      setCargando(false)
    })
    return () => { vigente = false }
  }, [finca.id, especie])

  const hoy = hoyLocal()
  const lotePorGalpon = new Map(lotes.filter(l => l.instalacion_id).map(l => [l.instalacion_id as string, l]))
  const ocupados = galpones.filter(g => lotePorGalpon.has(g.id)).length
  const avesTotal = lotes.reduce((s, l) => s + l.aves_actuales, 0)
  const areaGalpones = galpones.reduce((s, g) => s + Number(g.area_m2 ?? 0), 0)

  return (
    <section className="superficie mb-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{finca.nombre}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            {(finca.municipio || finca.departamento) && (
              <span><Ic n="ubicacion" className="size-3.5" /> {[finca.municipio, finca.departamento].filter(Boolean).join(', ')}</span>
            )}
            {finca.area_valor != null && <span>{Number(finca.area_valor).toLocaleString('es-CO')} {unidadArea(finca.area_unidad)}</span>}
            {infoEspecie && especie && <span className="rounded-md bg-green-50 px-1.5 text-green-800"><Ic n={infoEspecie.icon} className="size-3.5" /> {QUE_PRODUCE[especie]}</span>}
          </p>
        </div>
        <button onClick={onEditar} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          <Ic n="ajustes" /> Datos de la finca
        </button>
      </div>

      {especie === 'aves_ponedoras' && (
        <>
          <p className="mt-4 text-xs text-gray-500">
            {galpones.length} galpón{galpones.length === 1 ? '' : 'es'} · {ocupados} con aves · {galpones.length - ocupados} vacío{galpones.length - ocupados === 1 ? '' : 's'}
            {areaGalpones > 0 && ` · ${areaGalpones.toLocaleString('es-CO')} m²`}
            {avesTotal > 0 && ` · ${avesTotal.toLocaleString('es-CO')} aves`}
          </p>
          {cargando ? (
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : galpones.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              La finca no tiene galpones. <button onClick={onEditar} className="font-medium text-green-700 hover:underline">Registrarlos</button>
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2">
              {galpones.map(g => {
                const l = lotePorGalpon.get(g.id)
                const area = Number(g.area_m2 ?? 0)
                const semana = l ? semanaDelLote(l, hoy) : null
                const contenido = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800">{g.nombre}</span>
                      <span className={cn('rounded px-1.5 text-[0.625rem] font-medium',
                        !l ? 'bg-gray-100 text-gray-500' : l.estado === 'activo' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700')}>
                        {!l ? 'vacío' : l.estado === 'activo' ? 'en postura' : 'levante'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{area > 0 ? `${area.toLocaleString('es-CO')} m²` : 'Sin medida'}</p>
                    {l ? (
                      <p className="mt-1 text-xs text-gray-600">
                        {l.aves_actuales.toLocaleString('es-CO')} aves{area > 0 && ` · ${(l.aves_actuales / area).toLocaleString('es-CO', { maximumFractionDigits: 1 })}/m²`}
                        {semana && <span className="block text-gray-400">Semana {semana.semana} de {semana.etapa}{l.linea_genetica ? ` · ${l.linea_genetica}` : ''}</span>}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-green-700">Registrar aves →</p>
                    )}
                  </>
                )
                return (
                  <Link
                    key={g.id}
                    href={l ? `/aves-ponedoras?lote=${l.id}` : '/aves-ponedoras'}
                    className={cn('rounded-xl border p-3 transition-colors hover:border-green-400',
                      l ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50/50')}
                  >
                    {contenido}
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
