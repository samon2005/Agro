'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Widget, ANCHO } from '@/components/ui/widgets/Widget'
import { BandejaAlertas, type AlertaBandeja } from '@/components/ui/widgets/Alertas'
import { Ic } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { hoyLocal } from '@/lib/fechas'
import { sumarDias } from '@/lib/cierreSemanal'
import { useConfigCerdos } from '@/lib/useConfigCerdos'
import { vacunasProximas } from '@/lib/reproduccionCerdos'
import { proyeccionGrupo } from '@/lib/engordeCerdos'
import { saldoVenta } from '@/lib/dineroCerdos'
import { finRetiro } from '@/components/agro/cerdos/sanitario/ClinicaCerdos'
import { descargarExcel } from '@/lib/exportar'
import type { EtapaEngorde } from '@/lib/configCerdos'

type Fila = Record<string, unknown>
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const ETAPAS = ['precebo', 'levante', 'ceba'] as const

/**
 * Lo que José quiere ver al abrir la app (sección 15): la cría (partos de hoy,
 * próximos partos, lechones), el engorde (ganancia diaria, conversión y cuándo
 * sale cada grupo) con filtro por etapa, lo que se logró hoy y las alertas que
 * no viven en un grupo: vacunas próximas, retiros, equipos en falla, alimento
 * por acabarse y cuentas vencidas. Y los registros sanitarios para descargar.
 */
export default function PanelCerdos({ fincaId, verDinero }: { fincaId: string; verDinero: boolean }) {
  const cfg = useConfigCerdos()
  const hoy = hoyLocal()
  const [d, setD] = useState<Record<string, Fila[]> | null>(null)
  const [etapa, setEtapa] = useState<string>('todas')
  const [grupoSinc, setGrupoSinc] = useState<string>('todos')

  useEffect(() => {
    let vigente = true
    const s = createClient()
    const desde = sumarDias(hoy, -45)
    const consultas = {
      lotes: s.from('lotes_cerdos').select('*').eq('finca_id', fincaId).eq('estado', 'activo'),
      servicios: s.from('servicios_cerdos').select('id, reproductora_id, fecha_probable_parto, estado, grupo_sincronizado').eq('finca_id', fincaId).in('estado', ['pendiente', 'confirmado']),
      partos: s.from('partos_cerdos').select('id, fecha_parto, nacidos_vivos').eq('finca_id', fincaId).gte('fecha_parto', sumarDias(hoy, -30)),
      lechones: s.from('lechones_cerdos').select('id').eq('finca_id', fincaId).eq('estado', 'lactante'),
      pesos: s.from('pesos_lote_cerdos').select('lote_id, fecha, peso_promedio').eq('finca_id', fincaId).gte('fecha', sumarDias(hoy, -60)),
      diarios: s.from('nutricion_diaria_cerdos').select('lote_id, fecha, alimento_kg, consumo_real_kg').eq('finca_id', fincaId).gte('fecha', desde),
      plan: s.from('plan_vacunacion').select('id, vacuna, dia_vida, obligatoria').eq('finca_id', fincaId).eq('especie', 'cerdos'),
      vacunas: s.from('vacunaciones_cerdos').select('*').eq('finca_id', fincaId),
      meds: s.from('medicaciones_cerdos').select('*').eq('finca_id', fincaId).gte('fecha_inicio', sumarDias(hoy, -120)),
      equipos: s.from('equipos_cerdos').select('nombre, estado, ubicacion').eq('finca_id', fincaId).neq('estado', 'operativo'),
      stock: s.from('stock_alimento_lote').select('nombre, bultos_disponibles, peso_bulto_kg').eq('finca_id', fincaId).eq('especie', 'cerdos'),
      ventas: s.from('ventas_cerdos').select('cliente, valor_total, pagado, fecha, fecha_vencimiento').eq('finca_id', fincaId).eq('forma_pago', 'credito'),
      tareas: s.from('tareas_operarios').select('descripcion, estado, operario_id').eq('finca_id', fincaId).eq('fecha', hoy),
      mortalidad: s.from('mortalidad_cerdos').select('*').eq('finca_id', fincaId).gte('fecha', sumarDias(hoy, -365)),
      visitas: s.from('visitas_finca').select('*').eq('finca_id', fincaId).gte('fecha', sumarDias(hoy, -365)),
      clinica: s.from('eventos_clinicos_cerdos').select('*').eq('finca_id', fincaId).gte('fecha', sumarDias(hoy, -365)),
    }
    const claves = Object.keys(consultas) as (keyof typeof consultas)[]
    Promise.all(claves.map(k => consultas[k])).then(res => {
      if (!vigente) return
      setD(Object.fromEntries(claves.map((k, i) => [k, (res[i].data ?? []) as Fila[]])))
    })
    return () => { vigente = false }
  }, [fincaId, hoy])

  if (!d) return null
  const lotes = d.lotes as { id: string; nombre: string; etapa_actual: string; sistema: string; fecha_ingreso: string; fecha_nacimiento: string | null; peso_promedio_inicial: number | null; animales_actuales: number }[]

  // ── Cría ──
  const servicios = (d.servicios as { fecha_probable_parto: string | null; grupo_sincronizado: string | null }[])
    .filter(s => grupoSinc === 'todos' || s.grupo_sincronizado === grupoSinc)
  const grupos = [...new Set((d.servicios as { grupo_sincronizado: string | null }[]).map(s => s.grupo_sincronizado).filter(Boolean))] as string[]
  const partosHoy = (d.partos as { fecha_parto: string; nacidos_vivos: number }[]).filter(p => p.fecha_parto === hoy)
  const proximos = servicios.filter(s => s.fecha_probable_parto && s.fecha_probable_parto >= hoy && s.fecha_probable_parto <= sumarDias(hoy, 7))
  const partosMes = d.partos.length

  // ── Engorde: ganancia, conversión del último mes y salida estimada por grupo ──
  const engorde = lotes.filter(l => l.sistema !== 'cria' && ETAPAS.includes(l.etapa_actual as EtapaEngorde))
    .filter(l => etapa === 'todas' || l.etapa_actual === etapa)
    .map(l => {
      const pesajes = (d.pesos as { lote_id: string; fecha: string; peso_promedio: number }[]).filter(p => p.lote_id === l.id).map(p => ({ fecha: p.fecha, peso_promedio: Number(p.peso_promedio) }))
      const proy = proyeccionGrupo({ pesajes, inicio: { fecha: l.fecha_ingreso, peso: l.peso_promedio_inicial }, pesoObjetivo: cfg.engorde[l.etapa_actual as EtapaEngorde].pesoSalida, hoy })
      const comido = (d.diarios as { lote_id: string; alimento_kg: number; consumo_real_kg: number | null }[]).filter(x => x.lote_id === l.id)
        .reduce((t, x) => t + Number(x.consumo_real_kg ?? x.alimento_kg ?? 0), 0)
      const orden = [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha))
      const ganado = orden.length >= 2 ? (orden[orden.length - 1].peso_promedio - orden[0].peso_promedio) * l.animales_actuales : null
      const conversion = ganado && ganado > 0 && comido > 0 ? comido / ganado : null
      return { l, proy, conversion }
    })

  // ── Alertas de la finca ──
  const vacunas = vacunasProximas({
    lotes, plan: d.plan as { id: string; vacuna: string; dia_vida: number; obligatoria: boolean }[],
    aplicadas: d.vacunas as { lote_id: string | null; plan_id: string | null; vacuna: string | null }[], hoy,
  })
  const retiros = (d.meds as { medicamento: string; fecha_inicio: string; fecha_fin: string | null; periodo_retiro_dias: number | null }[])
    .map(m => ({ m, fin: finRetiro(m) })).filter(x => x.fin && x.fin >= hoy)
  const consumoDia = (d.diarios as { fecha: string; alimento_kg: number }[]).filter(x => x.fecha >= sumarDias(hoy, -7)).reduce((t, x) => t + Number(x.alimento_kg ?? 0), 0) / 7
  const kgBodega = (d.stock as { bultos_disponibles: number; peso_bulto_kg: number }[]).reduce((t, x) => t + Number(x.bultos_disponibles) * Number(x.peso_bulto_kg), 0)
  const diasAlimento = consumoDia > 0 ? Math.floor(kgBodega / consumoDia) : null
  const vencidas = (d.ventas as { cliente: string | null; valor_total: number | null; pagado: number | null; fecha: string; fecha_vencimiento: string | null }[])
    .map(v => ({ v, ...saldoVenta(v, hoy) })).filter(x => x.vencida)

  const alertas: AlertaBandeja[] = [
    ...vacunas.map((v, i) => ({ id: `vac-${i}`, nivel: (v.faltan <= 0 ? 'urgente' : 'revisar') as AlertaBandeja['nivel'],
      texto: `${v.lote}: ${v.vacuna} ${v.faltan < 0 ? `atrasada ${-v.faltan} días` : v.faltan === 0 ? 'hoy' : `en ${v.faltan} días (${fmt(v.fecha)})`}`,
      detalle: v.faltan > 0 ? 'Pide el producto con tiempo.' : undefined })),
    ...retiros.map((r, i) => ({ id: `ret-${i}`, nivel: 'urgente' as const, texto: `Retiro de ${r.m.medicamento} hasta el ${fmt(r.fin!)}`, detalle: 'No vender ni sacrificar los tratados hasta esa fecha.' })),
    ...(d.equipos as { nombre: string; estado: string; ubicacion: string | null }[]).filter(e => e.estado === 'falla').map((e, i) => ({
      id: `eq-${i}`, nivel: 'urgente' as const, texto: `Equipo en falla: ${e.nombre}${e.ubicacion ? ` (${e.ubicacion})` : ''}` })),
    ...(diasAlimento != null && diasAlimento <= cfg.alertas.diasAlimentoBodega ? [{ id: 'bodega', nivel: (diasAlimento <= 3 ? 'urgente' : 'revisar') as AlertaBandeja['nivel'],
      texto: `El alimento en bodega alcanza para ${diasAlimento} días`, detalle: 'El pedido se hace con 7 días de anticipación.' }] : []),
    ...(verDinero ? vencidas.map((x, i) => ({ id: `cxc-${i}`, nivel: 'revisar' as const,
      texto: `${x.v.cliente ?? 'Un comprador'} debe ${x.saldo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}`,
      detalle: x.v.fecha_vencimiento ? `Vencía el ${fmt(x.v.fecha_vencimiento)}` : undefined })) : []),
  ]

  // ── Hoy ──
  const tareas = d.tareas as { estado: string }[]
  const hechas = tareas.filter(t => t.estado === 'completada').length
  const registradosHoy = new Set((d.diarios as { lote_id: string; fecha: string }[]).filter(x => x.fecha === hoy).map(x => x.lote_id)).size

  function descargarRegistros() {
    const hoja = (nombre: string, filas: Fila[], cols: [string, string][]) => ({
      nombre, columnas: cols.map(c => c[1]), filas: filas.map(f => cols.map(c => (f[c[0]] ?? '') as string | number)),
    })
    descargarExcel(`Registros sanitarios cerdos ${hoy}`, [
      hoja('Vacunaciones', d!.vacunas, [['fecha_aplicacion', 'Fecha'], ['vacuna', 'Vacuna'], ['lote_vacuna', 'Lote del biológico'], ['laboratorio', 'Laboratorio'], ['dosis', 'Dosis'], ['via_administracion', 'Vía'], ['numero_animales', 'Animales'], ['veterinario', 'Responsable']]),
      hoja('Medicaciones', d!.meds, [['fecha_inicio', 'Desde'], ['fecha_fin', 'Hasta'], ['medicamento', 'Medicamento'], ['principio_activo', 'Principio activo'], ['dosis', 'Dosis'], ['via_administracion', 'Vía'], ['numero_animales', 'Animales'], ['periodo_retiro_dias', 'Retiro (días)'], ['veterinario', 'Indicó'], ['motivo', 'Motivo']]),
      hoja('Clínica', d!.clinica, [['fecha', 'Fecha'], ['tipo_evento', 'Enfermedad'], ['signos', 'Signos'], ['areas_afectadas', 'Áreas'], ['animales_afectados', 'Afectados'], ['accion_tomada', 'Tratamiento'], ['necropsia', 'Necropsia'], ['desenlace', 'Desenlace']]),
      hoja('Mortalidad', d!.mortalidad, [['fecha', 'Fecha'], ['cantidad', 'Cantidad'], ['causa', 'Causa'], ['descripcion', 'Detalle']]),
      hoja('Visitas', d!.visitas, [['fecha', 'Fecha'], ['nombre', 'Quién'], ['empresa', 'Empresa'], ['motivo', 'Motivo'], ['areas', 'Áreas'], ['ducha', 'Ducha'], ['cambio_ropa', 'Cambio de ropa'], ['desinfeccion', 'Desinfección'], ['ultimo_contacto_animales', 'Último contacto con animales']]),
    ])
  }

  return (
    <>
      <div className={ANCHO.todo}><BandejaAlertas titulo="Alertas de la granja" alertas={alertas} /></div>

      <Widget className={ANCHO.tercio} titulo="Cría" icono="cerdo" accion={<Link href="/cerdos" className="text-xs text-gray-500 hover:text-gray-800">Naves</Link>}>
        {grupos.length > 0 && (
          <select value={grupoSinc} onChange={e => setGrupoSinc(e.target.value)} className="mb-2 h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs">
            <option value="todos">Todos los grupos sincronizados</option>
            {grupos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-2xl font-semibold">{partosHoy.length}</p><p className="text-[0.6875rem] text-gray-500">partos hoy</p></div>
          <div><p className="text-2xl font-semibold">{proximos.length}</p><p className="text-[0.6875rem] text-gray-500">partos en 7 días</p></div>
          <div><p className="text-2xl font-semibold">{d.lechones.length}</p><p className="text-[0.6875rem] text-gray-500">lechones lactando</p></div>
        </div>
        <p className="mt-2 text-xs text-gray-500">{partosMes} partos en los últimos 30 días{partosHoy.length ? ` · hoy nacieron ${partosHoy.reduce((t, p) => t + p.nacidos_vivos, 0)} vivos` : ''}</p>
      </Widget>

      <Widget plegable resumen={`${engorde.length} ${engorde.length === 1 ? 'grupo' : 'grupos'}`} className={ANCHO.dosTercios} titulo="Engorde" icono="tendencia">
        <div className="mb-2 flex flex-wrap gap-1">
          {['todas', ...ETAPAS].map(e => (
            <button key={e} type="button" onClick={() => setEtapa(e)}
              className={cn('rounded-full px-2.5 py-0.5 text-xs', etapa === e ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600')}>{e === 'todas' ? 'Todas las etapas' : e[0].toUpperCase() + e.slice(1)}</button>
          ))}
        </div>
        {engorde.length === 0 ? <p className="py-4 text-center text-sm text-gray-400">Sin grupos de engorde</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="py-1 font-medium">Grupo</th><th className="font-medium">Ganancia diaria</th><th className="font-medium">Conversión</th><th className="font-medium">Peso hoy</th><th className="font-medium">Sale</th></tr></thead>
            <tbody>
              {engorde.map(({ l, proy, conversion }) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="py-1.5"><Link href={`/cerdos?lote=${l.id}`} className="font-medium text-gray-800 hover:underline">{l.nombre}</Link> <span className="text-xs capitalize text-gray-500">{l.etapa_actual}</span></td>
                  <td>{proy ? `${Math.round(proy.gdp * 1000)} g` : '—'}</td>
                  <td className={conversion && conversion > cfg.metas.conversion[l.etapa_actual as EtapaEngorde] ? 'text-amber-700' : ''}>{conversion ? n1(conversion) : '—'}</td>
                  <td>{proy ? `${n1(proy.pesoHoy)} kg` : '—'}</td>
                  <td>{proy?.fechaObjetivo ? (proy.diasFaltan === 0 ? 'ya' : fmt(proy.fechaObjetivo)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[0.6875rem] text-gray-400">La salida es una estimación con la ganancia de los últimos pesajes; se corrige con cada pesaje.</p>
      </Widget>

      <Widget plegable resumen={`${hechas} de ${tareas.length} tareas hechas`} className={ANCHO.tercio} titulo="Hoy en la granja" icono="listo">
        <p className="text-sm text-gray-700">{registradosHoy} de {lotes.filter(l => l.sistema !== 'cria').length} grupos con el día registrado</p>
        <p className="text-sm text-gray-700">{hechas} de {tareas.length} tareas hechas</p>
        {tareas.length > hechas && <p className="text-xs text-amber-700">Quedan {tareas.length - hechas} por hacer</p>}
        <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={descargarRegistros}>
          <Ic n="diario" /> Registros sanitarios (Excel)
        </Button>
        <p className="mt-1 text-[0.6875rem] text-gray-400">Vacunas, medicaciones, clínica, mortalidad y visitas del último año. El formato oficial del ICA está por validar.</p>
      </Widget>
    </>
  )
}
