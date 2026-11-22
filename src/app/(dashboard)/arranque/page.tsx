'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { dbGenerico } from '@/lib/especiesConfig'
import { useFinca } from '@/components/agro/FincaProvider'
import { useRolFinca } from '@/components/agro/RolProvider'
import { permisos } from '@/lib/roles'
import { TAMANOS_HUEVO } from '@/lib/huevos'
import { hoyLocal } from '@/lib/fechas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import AccesoRestringido from '@/components/agro/AccesoRestringido'
import { cn } from '@/lib/utils'

interface Estado {
  lugares: number
  lotes: number
  diasImportados: number
  saldoHuevos: Record<string, number> | null
  alimento: number
  insumos: number
  ventas: number
  equipo: number
}

/**
 * Arrancar una finca que ya traía producción antes de la app (plan de la
 * reunión con Juliana, fase 8): en orden, los lugares, los lotes con sus días
 * viejos, lo que había en bodega, las ventas viejas (si se quieren) y el equipo.
 * Cada paso dice si ya está y lleva a donde se hace; al final, la revisión.
 */
export default function ArranquePage() {
  const { fincaActual } = useFinca()
  const puede = permisos(useRolFinca())
  const [e, setE] = useState<Estado | null>(null)
  const [version, setVersion] = useState(0)
  const [saldo, setSaldo] = useState<Record<string, string>>({})
  const [fechaSaldo, setFechaSaldo] = useState(hoyLocal())
  const fincaId = fincaActual?.id
  const especies = fincaActual?.tipo_produccion ?? []
  const aves = especies.includes('aves_ponedoras')
  const cerdos = especies.includes('cerdos')

  useEffect(() => {
    if (!fincaId) return
    let vigente = true
    const s = createClient()
    const n = (q: PromiseLike<{ count: number | null }>) => q.then(r => r.count ?? 0)
    Promise.all([
      n(s.from('instalaciones').select('id', { count: 'exact', head: true }).eq('finca_id', fincaId)),
      n(s.from('lotes_aves').select('id', { count: 'exact', head: true }).eq('finca_id', fincaId)),
      n(s.from('lotes_cerdos').select('id', { count: 'exact', head: true }).eq('finca_id', fincaId)),
      n(s.from('produccion_diaria_aves').select('id', { count: 'exact', head: true }).eq('finca_id', fincaId).eq('importado', true)),
      s.from('saldos_iniciales_huevos').select('*').eq('finca_id', fincaId).maybeSingle(),
      n(s.from('tipos_alimento_aves').select('id', { count: 'exact', head: true }).eq('finca_id', fincaId)),
      n(s.from('entradas_alimento_lote').select('id', { count: 'exact', head: true }).eq('finca_id', fincaId)),
      n(s.from('inventario').select('id', { count: 'exact', head: true }).eq('finca_id', fincaId).neq('nombre', 'Huevos de la finca')),
      n(dbGenerico(s).from('ventas_huevos_cantidades').select('lote_id', { count: 'exact', head: true }).eq('finca_id', fincaId)),
      n(dbGenerico(s).from('ventas_aves_cantidades').select('lote_id', { count: 'exact', head: true }).eq('finca_id', fincaId)),
      n(s.from('finca_miembros').select('perfil_id', { count: 'exact', head: true }).eq('finca_id', fincaId)),
    ]).then(([lug, la, lc, dias, sal, tAves, entr, ins, vh, va, eq]) => {
      if (!vigente) return
      const sd = sal.data
      setE({
        lugares: lug, lotes: la + lc, diasImportados: dias,
        saldoHuevos: sd ? Object.fromEntries(TAMANOS_HUEVO.map(t => [t.key, Number(sd[`huevos_${t.key}` as keyof typeof sd] ?? 0)])) : null,
        alimento: tAves + entr, insumos: ins, ventas: vh + va, equipo: Math.max(0, eq - 1),
      })
      if (sd) {
        setSaldo(Object.fromEntries(TAMANOS_HUEVO.map(t => [t.key, String(sd[`huevos_${t.key}` as keyof typeof sd] ?? '')])))
        setFechaSaldo(sd.fecha)
      }
    })
    return () => { vigente = false }
  }, [fincaId, version])

  if (!fincaActual) return <div className="p-4 md:p-8"><Skeleton className="h-64 rounded-xl" /></div>
  if (!puede.configurarFinca) return <div className="p-4 md:p-8"><AccesoRestringido /></div>

  async function guardarSaldo() {
    const datos = Object.fromEntries(TAMANOS_HUEVO.map(t => [`huevos_${t.key}`, Math.max(0, Math.round(Number(saldo[t.key] || 0)))]))
    const { error } = await createClient().from('saldos_iniciales_huevos').upsert({ finca_id: fincaActual!.id, fecha: fechaSaldo, ...datos })
    if (error) { toast.error('No se pudo guardar el saldo'); return }
    toast.success('Saldo inicial guardado: ya cuenta en la bodega')
    setVersion(v => v + 1)
  }

  const totalSaldo = Object.values(saldo).reduce((t, v) => t + (Number(v) || 0), 0)
  const lugar = cerdos && !aves ? 'naves y corrales' : 'galpones'
  const rutaAnimales = cerdos && !aves ? '/cerdos' : '/aves-ponedoras'

  const pasos: { icono: NombreIcono; titulo: string; hecho: boolean; texto: string; detalle?: string; accion?: React.ReactNode; opcional?: boolean }[] = !e ? [] : [
    {
      icono: 'casa', titulo: `Los ${lugar}`, hecho: e.lugares > 0,
      texto: `Los lugares fijos de la finca, con su medida.`,
      detalle: e.lugares > 0 ? `${e.lugares} registrados` : undefined,
      accion: <Link href={rutaAnimales}><Button size="sm" variant="outline">Ir a {cerdos && !aves ? 'Naves' : 'Galpones'} → «{cerdos && !aves ? 'Naves' : 'Galpones'} y finca»</Button></Link>,
    },
    {
      icono: aves ? 'gallina' : 'cerdo', titulo: 'Los lotes y sus días viejos', hecho: e.lotes > 0,
      texto: aves
        ? 'Registra las aves de cada galpón. Si ya tenías los registros en Excel, impórtalos: el lote se crea con todos sus días (no tocan la bodega).'
        : 'Registra las cerdas del pie de cría y los grupos de engorde que hay hoy.',
      detalle: e.lotes > 0 ? `${e.lotes} lotes${aves ? ` · ${e.diasImportados.toLocaleString('es-CO')} días importados de Excel` : ''}` : undefined,
      accion: <Link href={rutaAnimales}><Button size="sm" variant="outline">{aves ? 'Registrar aves o importar Excel' : 'Ir a Naves'}</Button></Link>,
    },
    ...(aves ? [{
      icono: 'huevo' as NombreIcono, titulo: 'El huevo que hay en bodega hoy', hecho: e.saldoHuevos != null,
      texto: 'Lo que había guardado el día que empiezas a usar la app, por tamaño. Desde ahí la bodega suma lo puesto y resta lo vendido.',
      detalle: e.saldoHuevos ? `${Object.values(e.saldoHuevos).reduce((t, v) => t + v, 0).toLocaleString('es-CO')} huevos` : undefined,
    }] : []),
    {
      icono: 'alimento', titulo: 'El alimento y los insumos en bodega', hecho: e.alimento > 0,
      texto: 'Crea los alimentos que usas y anota lo que hay hoy como una entrada (sin precio si no lo sabes). Los insumos (vacunas, desinfectantes…) van en Inventario.',
      detalle: e.alimento > 0 || e.insumos > 0 ? `${e.alimento} alimentos o entradas · ${e.insumos} insumos` : undefined,
      accion: <span className="flex flex-wrap gap-2"><Link href="/alimento"><Button size="sm" variant="outline">Alimento</Button></Link><Link href="/inventario"><Button size="sm" variant="outline">Inventario</Button></Link></span>,
    },
    {
      icono: 'recibo', titulo: 'Las ventas viejas', hecho: e.ventas > 0, opcional: true,
      texto: 'Si quieres el historial de plata, carga las ventas de antes. Si no, la finca arranca con la plata desde hoy.',
      detalle: e.ventas > 0 ? `${e.ventas} ventas` : undefined,
      accion: puede.verDinero ? <Link href={aves ? '/ventas' : '/finanzas'}><Button size="sm" variant="outline">Ir a {aves ? 'Ventas' : 'Finanzas'}</Button></Link> : undefined,
    },
    {
      icono: 'operario', titulo: 'El equipo', hecho: e.equipo > 0, opcional: true,
      texto: 'Crea los códigos para que cada persona entre con su rol.',
      detalle: e.equipo > 0 ? `${e.equipo} personas` : undefined,
      accion: <Link href="/operarios"><Button size="sm" variant="outline">Ir a Operarios</Button></Link>,
    },
  ]
  const obligatorios = pasos.filter(p => !p.opcional)
  const listos = obligatorios.filter(p => p.hecho).length

  return (
    <div className="space-y-4 p-4 md:space-y-5 md:p-8">
      <div>
        <h1 className="text-2xl font-medium text-gray-900 md:text-3xl">Arrancar con datos viejos</h1>
        <p className="text-sm text-gray-500">{fincaActual.nombre} · para una finca que ya tenía producción antes de usar la app. En orden, y cada paso se puede volver a hacer.</p>
      </div>

      {!e ? <Skeleton className="h-64 rounded-xl" /> : (
        <>
          <div className="superficie rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-800">{listos} de {obligatorios.length} pasos listos</span>
              <span className="text-gray-500">{listos === obligatorios.length ? 'La finca ya puede trabajar en la app' : 'Faltan pasos'}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${(listos / Math.max(1, obligatorios.length)) * 100}%` }} />
            </div>
          </div>

          <ol className="space-y-3">
            {pasos.map((p, i) => (
              <li key={p.titulo} className={cn('superficie space-y-2 rounded-2xl p-4', p.hecho && 'ring-1 ring-green-200')}>
                <div className="flex items-start gap-3">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold', p.hecho ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600')}>
                    {p.hecho ? '✓' : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                      <Ic n={p.icono} className="size-4 text-green-700" /> {p.titulo}
                      {p.opcional && <span className="rounded-full bg-gray-100 px-2 text-[0.6875rem] font-normal text-gray-500">opcional</span>}
                    </p>
                    <p className="text-sm text-gray-600">{p.texto}</p>
                    {p.detalle && <p className="mt-0.5 text-xs font-medium text-green-800">{p.detalle}</p>}
                  </div>
                </div>
                {p.accion && <div className="pl-11">{p.accion}</div>}
                {p.titulo.startsWith('El huevo') && (
                  <div className="space-y-2 pl-11">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {TAMANOS_HUEVO.map(t => (
                        <label key={t.key} className="text-xs text-gray-600">{t.label}
                          <Input type="number" min="0" className="mt-0.5 h-8" value={saldo[t.key] ?? ''} onChange={ev => setSaldo(s => ({ ...s, [t.key]: ev.target.value }))} />
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-xs text-gray-600">Contado el<Input type="date" className="mt-0.5 h-8 w-40" max={hoyLocal()} value={fechaSaldo} onChange={ev => setFechaSaldo(ev.target.value)} /></label>
                      <Button size="sm" onClick={guardarSaldo}>Guardar saldo ({totalSaldo.toLocaleString('es-CO')} huevos)</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div className="superficie space-y-1 rounded-2xl p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-800">Revisión final</p>
            {pasos.map(p => (
              <p key={p.titulo} className={p.hecho ? 'text-green-800' : p.opcional ? 'text-gray-500' : 'text-amber-700'}>
                {p.hecho ? '✓' : p.opcional ? '○' : '•'} {p.titulo}{p.hecho ? ' quedó cargado' : p.opcional ? ' (opcional, sin cargar)' : ' falta'}
              </p>
            ))}
            <p className="pt-1 text-xs text-gray-500">Desde hoy la bodega, el alimento y Finanzas cuentan con lo que se registre en la app.</p>
          </div>
        </>
      )}
    </div>
  )
}
