'use client'

import Link from 'next/link'
import { Anillo } from '@/components/ui/widgets/Medidores'
import { Ic } from '@/components/ui/icon'
import { arbolNaves, esNaveDeCria, nombrePuestos, usoCorralLabel, type LugarCerdos } from '@/lib/instalaciones'

interface LoteResumen { id: string; nombre: string; sistema: string; instalacion_id: string | null; animales_actuales: number; numero_animales: number }

interface Tarjeta {
  id: string
  nombre: string
  detalle: string
  nota: string
  href: string
  animales: number
  pct: number | null
}

/**
 * Las naves de cerdos en el Resumen: las de cría cuentan sus cerdas (frente a
 * sus jaulas o parideras, si las tienen) y las de engorde suman los cerdos de
 * sus corrales. Lo que quedó sin nave se muestra aparte para no perderlo.
 */
export function resumenNaves(lugares: (LugarCerdos & { especie?: string })[], lotes: LoteResumen[], cerdasPorUbicacion: Record<string, number>) {
  const { naves, sueltos } = arbolNaves(lugares.filter(l => !l.especie || l.especie === 'cerdos'))
  const pie = lotes.find(l => l.sistema === 'cria')
  const engorde = lotes.filter(l => l.sistema !== 'cria')
  const tarjetas: Tarjeta[] = []

  for (const n of naves) {
    // "Gestación · 1 cerda" solo si la nave no se llama ya así
    const usoTexto = usoCorralLabel(n.uso) ?? 'Nave'
    const uso = usoTexto.toLowerCase() === n.nombre.trim().toLowerCase() ? '' : usoTexto
    if (esNaveDeCria(n.uso)) {
      const cerdas = cerdasPorUbicacion[n.id] ?? 0
      const cupo = nombrePuestos(n.uso) ? n.puestos : null
      tarjetas.push({
        id: n.id, nombre: n.nombre, animales: cerdas,
        pct: cupo ? Math.min(100, (cerdas / cupo) * 100) : null,
        detalle: `${uso ? `${uso} · ` : ''}${cerdas} ${cerdas === 1 ? 'cerda' : 'cerdas'}`,
        nota: cupo ? `${cerdas} de ${cupo} ${nombrePuestos(n.uso)} ocupadas` : 'Pie de cría',
        href: pie ? `/cerdos?lote=${pie.id}` : '/cerdos',
      })
      continue
    }
    const grupos = engorde.filter(l => n.corrales.some(c => c.id === l.instalacion_id))
    const animales = grupos.reduce((s, l) => s + l.animales_actuales, 0)
    const iniciales = grupos.reduce((s, l) => s + l.numero_animales, 0)
    tarjetas.push({
      id: n.id, nombre: n.nombre, animales,
      pct: iniciales > 0 ? (animales / iniciales) * 100 : null,
      detalle: `${uso ? `${uso} · ` : ''}${animales.toLocaleString('es-CO')} cerdos`,
      nota: `${grupos.length} de ${n.corrales.length} ${n.corrales.length === 1 ? 'corral ocupado' : 'corrales ocupados'}`,
      href: grupos[0] ? `/cerdos?lote=${grupos[0].id}` : '/cerdos',
    })
  }

  for (const c of sueltos) {
    const l = engorde.find(x => x.instalacion_id === c.id)
    tarjetas.push({
      id: c.id, nombre: c.nombre, animales: l?.animales_actuales ?? 0,
      pct: l && l.numero_animales > 0 ? (l.animales_actuales / l.numero_animales) * 100 : null,
      detalle: `${usoCorralLabel(c.uso) ?? 'Corral'} · sin nave`,
      nota: l ? l.nombre : 'Vacío',
      href: l ? `/cerdos?lote=${l.id}` : '/cerdos',
    })
  }

  // Grupos que no quedaron en ningún corral
  for (const l of engorde.filter(x => !x.instalacion_id || !lugares.some(c => c.id === x.instalacion_id))) {
    tarjetas.push({
      id: l.id, nombre: l.nombre, animales: l.animales_actuales,
      pct: l.numero_animales > 0 ? (l.animales_actuales / l.numero_animales) * 100 : null,
      detalle: 'sin corral', nota: '', href: `/cerdos?lote=${l.id}`,
    })
  }

  return {
    tarjetas,
    total: naves.length + sueltos.length,
    ocupadas: tarjetas.filter(t => t.animales > 0 && lugares.some(l => l.id === t.id)).length,
    animales: tarjetas.reduce((s, t) => s + t.animales, 0),
  }
}

export default function NavesResumen({ tarjetas }: { tarjetas: Tarjeta[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2.5">
      {tarjetas.map(t => t.animales > 0 ? (
        <Link key={t.id} href={t.href} className="flex items-center gap-3 rounded-xl bg-gray-50/80 p-3 ring-1 ring-black/5 transition-colors hover:bg-green-50/60">
          <Anillo pct={t.pct} centro={t.animales.toLocaleString('es-CO')} tamano={52} grosor={6} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-gray-800">{t.nombre}</span>
            <span className="block truncate text-[0.6875rem] text-gray-500">{t.detalle}</span>
            {t.nota && <span className="block truncate text-[0.6875rem] text-gray-400">{t.nota}</span>}
          </span>
        </Link>
      ) : (
        <Link key={t.id} href={t.href} className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 p-3 transition-colors hover:border-green-500">
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"><Ic n="mas" className="size-5" /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-gray-700">{t.nombre}</span>
            <span className="block truncate text-[0.6875rem] text-gray-500">{t.detalle}</span>
            <span className="block truncate text-[0.6875rem] text-green-700">Vacía · agregar animales</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
