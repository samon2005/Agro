'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from './FincaProvider'
import { Badge } from '@/components/ui/badge'

type Notificacion = { tipo: 'stock' | 'equipo' | 'recoleccion' | 'postura' | 'ventas'; mensaje: string; href: string }

export default function NotificacionesPanel() {
  const { fincaActual } = useFinca()
  const [abierto, setAbierto] = useState(false)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])

  const cargar = useCallback(async () => {
    if (!fincaActual) return
    const supabase = createClient()
    const notifs: Notificacion[] = []

    const { data: inventario } = await supabase
      .from('inventario')
      .select('nombre, cantidad_actual, cantidad_minima')
      .eq('finca_id', fincaActual.id)

    for (const item of inventario ?? []) {
      if (item.cantidad_minima > 0 && item.cantidad_actual <= item.cantidad_minima) {
        notifs.push({ tipo: 'stock', mensaje: `Stock bajo: ${item.nombre}`, href: '/inventario' })
      }
    }

    const especies = (fincaActual.tipo_produccion ?? []) as string[]
    const hoy = new Date()
    const en7dias = new Date(); en7dias.setDate(hoy.getDate() + 7)

    async function chequearEquipos(tabla: 'equipos_aves' | 'equipos_cerdos' | 'equipos_pollo') {
      const { data } = await supabase.from(tabla).select('nombre, proximo_mantenimiento').eq('finca_id', fincaActual!.id)
      for (const eq of data ?? []) {
        if (!eq.proximo_mantenimiento) continue
        const fecha = new Date(eq.proximo_mantenimiento + 'T00:00:00')
        if (fecha <= en7dias) {
          notifs.push({
            tipo: 'equipo',
            mensaje: fecha < hoy ? `Mantenimiento vencido: ${eq.nombre}` : `Mantenimiento próximo: ${eq.nombre}`,
            href: '/inventario',
          })
        }
      }
    }

    const tareas: Promise<void>[] = []
    if (especies.includes('aves_ponedoras')) tareas.push(chequearEquipos('equipos_aves'))
    if (especies.includes('cerdos')) tareas.push(chequearEquipos('equipos_cerdos'))
    if (especies.includes('pollo_engorde')) tareas.push(chequearEquipos('equipos_pollo'))
    await Promise.all(tareas)

    if (especies.includes('aves_ponedoras')) {
      const { data: lotes } = await supabase.from('lotes_aves').select('id, nombre, estado, fecha_inicio_postura').eq('finca_id', fincaActual.id).in('estado', ['activo', 'preparacion'])

      for (const lote of lotes ?? []) {
        const [{ data: horarios }, { data: hoyProd }] = await Promise.all([
          supabase.from('horarios_recoleccion_aves').select('hora, descripcion').eq('lote_id', lote.id).eq('activo', true),
          supabase.from('produccion_diaria_aves').select('id').eq('lote_id', lote.id).eq('fecha', hoy.toISOString().split('T')[0]).maybeSingle(),
        ])
        if (!hoyProd && horarios && horarios.length > 0) {
          const horaActual = hoy.toTimeString().slice(0, 5)
          const vencidos = horarios.filter(h => h.hora <= horaActual)
          if (vencidos.length > 0) {
            notifs.push({ tipo: 'recoleccion', mensaje: `Recolección pendiente hoy en "${lote.nombre}" (sin registro de producción)`, href: '/aves-ponedoras' })
          }
        }

        if (lote.estado === 'preparacion' && lote.fecha_inicio_postura) {
          const fechaPostura = new Date(lote.fecha_inicio_postura + 'T00:00:00')
          const diasFaltan = Math.round((fechaPostura.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000))
          if (diasFaltan >= 0 && diasFaltan <= 14) {
            const semanas = Math.ceil(diasFaltan / 7)
            notifs.push({
              tipo: 'postura',
              mensaje: `La postura de "${lote.nombre}" inicia en ${semanas === 0 ? 'menos de 1 semana' : `${semanas} semana${semanas === 1 ? '' : 's'}`}`,
              href: '/aves-ponedoras',
            })
          }
        }
      }

      const hace7dias = new Date(hoy); hace7dias.setDate(hoy.getDate() - 7)
      const desdeStr = hace7dias.toISOString().split('T')[0]
      const [{ data: prodSemana }, { data: ventasSemana }] = await Promise.all([
        supabase.from('produccion_diaria_aves').select('huevos_totales').eq('finca_id', fincaActual.id).gte('fecha', desdeStr),
        supabase.from('ventas_huevos_aves').select('cantidad_b, cantidad_a, cantidad_aa, cantidad_aaa, cantidad_jumbo').eq('finca_id', fincaActual.id).gte('fecha', desdeStr),
      ])
      const totalProducido = (prodSemana ?? []).reduce((s, r) => s + r.huevos_totales, 0)
      const totalVendido = (ventasSemana ?? []).reduce((s, v) => s + v.cantidad_b + v.cantidad_a + v.cantidad_aa + v.cantidad_aaa + v.cantidad_jumbo, 0)
      const sinVender = totalProducido - totalVendido
      if (totalProducido > 0 && sinVender > totalProducido * 0.3) {
        notifs.push({
          tipo: 'ventas',
          mensaje: `${sinVender.toLocaleString('es-CO')} huevos producidos sin vender en los últimos 7 días`,
          href: '/aves-ponedoras',
        })
      }
    }

    setNotificaciones(notifs)
  }, [fincaActual])

  useEffect(() => { cargar() }, [cargar])

  if (!fincaActual) return null

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(v => !v)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 text-lg"
        aria-label="Notificaciones"
      >
        🔔
        {notificaciones.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
            {notificaciones.length > 9 ? '9+' : notificaciones.length}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Notificaciones</p>
              <Badge variant="secondary">{notificaciones.length}</Badge>
            </div>
            {notificaciones.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">Sin notificaciones pendientes</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {notificaciones.map((n, i) => (
                  <Link
                    key={i}
                    href={n.href}
                    onClick={() => setAbierto(false)}
                    className="block p-3 text-sm hover:bg-gray-50 text-gray-700"
                  >
                    <span className="mr-1.5">{n.tipo === 'stock' ? '📦' : n.tipo === 'equipo' ? '⚙️' : n.tipo === 'postura' ? '🐣' : n.tipo === 'ventas' ? '💰' : '🥚'}</span>
                    {n.mensaje}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
