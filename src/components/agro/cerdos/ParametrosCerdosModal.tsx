'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useFinca } from '@/components/agro/FincaProvider'
import { useConfigCerdos } from '@/lib/useConfigCerdos'
import { CONFIG_CERDOS_DEFECTO, METODOS_CONFIRMACION, diferenciasConDefecto, type ConfigCerdos, type MetodoConfirmacion } from '@/lib/configCerdos'

/**
 * Los parámetros de cerdos de la granja: días de gestación y lactancia, pesos de
 * cada etapa, umbrales de alerta y metas. Cada campo muestra el valor por
 * defecto; la granja solo guarda lo que cambie.
 */

interface Campo {
  ruta: string
  etiqueta: string
  unidad: string
  /** Se puede dejar vacío (sin valor) */
  opcional?: boolean
}

interface Grupo { titulo?: string; nota?: string; campos: Campo[] }
interface Seccion { id: string; titulo: string; descripcion: string; grupos: Grupo[] }

const ETAPAS = [['precebo', 'Precebo'], ['levante', 'Levante'], ['ceba', 'Ceba']] as const
const GRUPOS = [['gestacion', 'Gestación'], ['lactancia', 'Lactancia'], ['precebo', 'Precebo'], ['levante', 'Levante'], ['ceba', 'Ceba']] as const

const SECCIONES: Seccion[] = [
  {
    id: 'reproduccion', titulo: 'Reproducción',
    descripcion: 'Con estos días se calculan el parto probable, el traslado a parideras, el destete y el celo esperado.',
    grupos: [
      { campos: [
        { ruta: 'reproduccion.diasGestacion', etiqueta: 'Gestación', unidad: 'días' },
        { ruta: 'reproduccion.cicloEstral', etiqueta: 'Ciclo estral (repetición)', unidad: 'días' },
      ] },
      { titulo: 'Lactancia', nota: 'Se puede acortar o alargar según el mercado.', campos: [
        { ruta: 'reproduccion.lactanciaMin', etiqueta: 'Mínimo', unidad: 'días' },
        { ruta: 'reproduccion.lactanciaObjetivo', etiqueta: 'Objetivo', unidad: 'días' },
        { ruta: 'reproduccion.lactanciaMax', etiqueta: 'Máximo', unidad: 'días' },
      ] },
      { titulo: 'Del destete al servicio', campos: [
        { ruta: 'reproduccion.desteteServicioMin', etiqueta: 'Desde', unidad: 'días' },
        { ruta: 'reproduccion.desteteServicioMax', etiqueta: 'Hasta', unidad: 'días' },
      ] },
      { titulo: 'Confirmación de preñez', nota: 'Por validar con los profesores.', campos: [
        { ruta: 'reproduccion.diaConfirmacion', etiqueta: 'Se confirma a los', unidad: 'días' },
      ] },
      { titulo: 'Parto', campos: [
        { ruta: 'reproduccion.trasladoParideras', etiqueta: 'Pasa a parideras antes del parto', unidad: 'días' },
        { ruta: 'reproduccion.avisoParto', etiqueta: 'Avisar del parto desde', unidad: 'días antes' },
      ] },
    ],
  },
  {
    id: 'engorde', titulo: 'Etapas',
    descripcion: 'Peso con que entra y sale cada grupo de cada etapa. Los días son opcionales: si no los sabes, déjalos vacíos.',
    grupos: ETAPAS.map(([id, nombre]) => ({
      titulo: nombre,
      campos: [
        { ruta: `engorde.${id}.pesoEntrada`, etiqueta: 'Entra con', unidad: 'kg' },
        { ruta: `engorde.${id}.pesoSalida`, etiqueta: 'Sale con', unidad: 'kg' },
        { ruta: `engorde.${id}.dias`, etiqueta: 'Duración', unidad: 'días', opcional: true },
      ],
    })),
  },
  {
    id: 'reemplazo', titulo: 'Reemplazo',
    descripcion: 'La hembra nueva que entra al pie de cría.',
    grupos: [{ campos: [
      { ruta: 'reemplazo.gananciaMaxGDia', etiqueta: 'Ganancia diaria máxima', unidad: 'g/día' },
      { ruta: 'reemplazo.edadMinimaDias', etiqueta: 'Edad mínima al ingreso', unidad: 'días' },
      { ruta: 'reemplazo.pesoIngresoKg', etiqueta: 'Peso al ingreso', unidad: 'kg' },
      { ruta: 'reemplazo.celoPrimerServicio', etiqueta: 'Primer servicio en el celo n.º', unidad: '' },
      { ruta: 'reemplazo.diasCuarentena', etiqueta: 'Cuarentena al llegar', unidad: 'días' },
    ] }],
  },
  {
    id: 'alertas', titulo: 'Alertas',
    descripcion: 'Cuándo avisa la app. Son puntos de partida: ajústalos con el veterinario o asesor de la granja.',
    grupos: [
      { titulo: 'Mortalidad de una semana que dispara la alerta', nota: '% de los animales del grupo.', campos:
        GRUPOS.map(([id, nombre]) => ({ ruta: `alertas.mortalidadSemanalPct.${id}`, etiqueta: nombre, unidad: '%' })) },
      { titulo: 'Alimento y peso', campos: [
        { ruta: 'alertas.consumoBajoPct', etiqueta: 'Comieron menos de lo esperado', unidad: '%' },
        { ruta: 'alertas.bajoPesoPct', etiqueta: 'Peso por debajo de lo esperado', unidad: '%' },
        { ruta: 'alertas.diasAlimentoBodega', etiqueta: 'Avisar cuando el alimento alcance para', unidad: 'días' },
      ] },
      ...GRUPOS.map(([id, nombre]): Grupo => ({
        titulo: `Temperatura · ${nombre}`,
        campos: [
          { ruta: `alertas.temperatura.${id}.min`, etiqueta: 'Mínima', unidad: '°C' },
          { ruta: `alertas.temperatura.${id}.max`, etiqueta: 'Máxima', unidad: '°C' },
        ],
      })),
      { titulo: 'Humedad relativa', campos: [
        { ruta: 'alertas.humedad.min', etiqueta: 'Mínima', unidad: '%' },
        { ruta: 'alertas.humedad.max', etiqueta: 'Máxima', unidad: '%' },
      ] },
    ],
  },
  {
    id: 'metas', titulo: 'Metas',
    descripcion: 'Contra qué se comparan los indicadores. Las define la granja con sus asesores.',
    grupos: [
      { titulo: 'Cría', campos: [
        { ruta: 'metas.partosCerdaAno', etiqueta: 'Partos por cerda al año', unidad: '' },
        { ruta: 'metas.destetadosCerdaAno', etiqueta: 'Destetados por cerda al año', unidad: 'lechones' },
        { ruta: 'metas.kgDestetadosCerdaAno', etiqueta: 'Kg destetados por cerda al año', unidad: 'kg' },
        { ruta: 'metas.nacidosVivosParto', etiqueta: 'Nacidos vivos por parto', unidad: 'lechones' },
        { ruta: 'metas.mortalidadPredestetePct', etiqueta: 'Mortalidad antes del destete', unidad: '%' },
        { ruta: 'metas.tasaPartoPct', etiqueta: 'Tasa de parto', unidad: '%' },
      ] },
      { titulo: 'Conversión alimenticia', nota: 'Kilos de alimento por kilo ganado.', campos:
        ETAPAS.map(([id, nombre]) => ({ ruta: `metas.conversion.${id}`, etiqueta: nombre, unidad: 'kg/kg' })) },
      { titulo: 'Costo', campos: [
        { ruta: 'metas.costoKg', etiqueta: 'Costo por kg producido', unidad: '$/kg', opcional: true },
      ] },
    ],
  },
  {
    id: 'opciones', titulo: 'Registro',
    descripcion: 'Qué se anota en el día a día.',
    grupos: [{ campos: [
      { ruta: 'opciones.pesoBultoKg', etiqueta: 'Peso del bulto de alimento', unidad: 'kg' },
    ] }],
  },
]

const TODOS = SECCIONES.flatMap(s => s.grupos.flatMap(g => g.campos))

function leer(obj: unknown, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | null)?.[k], obj)
}

function escribir(obj: Record<string, unknown>, ruta: string, valor: unknown) {
  const partes = ruta.split('.')
  let o = obj
  for (const k of partes.slice(0, -1)) o = o[k] as Record<string, unknown>
  o[partes[partes.length - 1]] = valor
}

const aTexto = (v: unknown) => (typeof v === 'number' ? String(v).replace('.', ',') : '')
const aNumero = (t: string) => {
  const n = Number(t.trim().replace(',', '.'))
  return t.trim() === '' || !Number.isFinite(n) ? null : n
}

function valoresDe(cfg: ConfigCerdos): Record<string, string> {
  return Object.fromEntries(TODOS.map(c => [c.ruta, aTexto(leer(cfg, c.ruta))]))
}

/** Se monta de nuevo cada vez que se abre (key en la página), así arranca con lo guardado. */
interface Props { open: boolean; onClose: () => void }

export default function ParametrosCerdosModal({ open, onClose }: Props) {
  const supabase = createClient()
  const { fincaActual, refetch } = useFinca()
  const cfg = useConfigCerdos()
  const [seccion, setSeccion] = useState(SECCIONES[0].id)
  const [valores, setValores] = useState<Record<string, string>>(() => valoresDe(cfg))
  const [medirAgua, setMedirAgua] = useState(cfg.opciones.medirAgua)
  const [metodo, setMetodo] = useState<MetodoConfirmacion>(cfg.reproduccion.metodoConfirmacion)
  const [guardando, setGuardando] = useState(false)

  const actual = SECCIONES.find(s => s.id === seccion) ?? SECCIONES[0]
  const cambiados = TODOS.filter(c => aNumero(valores[c.ruta] ?? '') !== (leer(CONFIG_CERDOS_DEFECTO, c.ruta) ?? null)).length
    + (medirAgua !== CONFIG_CERDOS_DEFECTO.opciones.medirAgua ? 1 : 0)
    + (metodo !== CONFIG_CERDOS_DEFECTO.reproduccion.metodoConfirmacion ? 1 : 0)

  /** Arma la configuración desde lo escrito, o devuelve el primer error que encuentre. */
  function armar(): { cfg: ConfigCerdos } | { error: string; seccion: string } {
    const nuevo = structuredClone(CONFIG_CERDOS_DEFECTO) as unknown as Record<string, unknown>
    for (const s of SECCIONES) for (const g of s.grupos) for (const c of g.campos) {
      const n = aNumero(valores[c.ruta] ?? '')
      if (n == null && !c.opcional) return { error: `Falta ${c.etiqueta.toLowerCase()}${g.titulo ? ` (${g.titulo})` : ''}`, seccion: s.id }
      if (n != null && n < 0) return { error: `${c.etiqueta} no puede ser negativo`, seccion: s.id }
      escribir(nuevo, c.ruta, n)
    }
    const r = nuevo as unknown as ConfigCerdos
    r.opciones.medirAgua = medirAgua
    r.reproduccion.metodoConfirmacion = metodo
    const rep = r.reproduccion
    if (rep.diaConfirmacion < 1 || rep.diaConfirmacion >= rep.diasGestacion)
      return { error: 'El día de confirmación de la preñez debe quedar dentro de la gestación', seccion: 'reproduccion' }
    if (!(rep.lactanciaMin <= rep.lactanciaObjetivo && rep.lactanciaObjetivo <= rep.lactanciaMax))
      return { error: 'La lactancia objetivo debe quedar entre el mínimo y el máximo', seccion: 'reproduccion' }
    if (rep.desteteServicioMin > rep.desteteServicioMax)
      return { error: 'Los días del destete al servicio: "desde" no puede ser mayor que "hasta"', seccion: 'reproduccion' }
    for (const [id, nombre] of ETAPAS) {
      if (r.engorde[id].pesoEntrada >= r.engorde[id].pesoSalida)
        return { error: `${nombre}: el peso de salida debe ser mayor que el de entrada`, seccion: 'engorde' }
    }
    for (const [id, nombre] of GRUPOS) {
      if (r.alertas.temperatura[id].min > r.alertas.temperatura[id].max)
        return { error: `Temperatura de ${nombre.toLowerCase()}: la mínima es mayor que la máxima`, seccion: 'alertas' }
    }
    if (r.alertas.humedad.min > r.alertas.humedad.max)
      return { error: 'Humedad: la mínima es mayor que la máxima', seccion: 'alertas' }
    return { cfg: r }
  }

  async function guardar() {
    if (!fincaActual) return
    const res = armar()
    if ('error' in res) { setSeccion(res.seccion); toast.error(res.error); return }
    setGuardando(true)
    const { error } = await supabase.from('fincas').update({ config_cerdos: diferenciasConDefecto(res.cfg) }).eq('id', fincaActual.id)
    setGuardando(false)
    if (error) { toast.error('No se pudieron guardar los parámetros'); return }
    toast.success('Parámetros de la granja guardados')
    refetch()
    onClose()
  }

  function restaurarSeccion() {
    setValores(prev => {
      const nuevo = { ...prev }
      for (const g of actual.grupos) for (const c of g.campos) nuevo[c.ruta] = aTexto(leer(CONFIG_CERDOS_DEFECTO, c.ruta))
      return nuevo
    })
    if (actual.id === 'opciones') setMedirAgua(CONFIG_CERDOS_DEFECTO.opciones.medirAgua)
    if (actual.id === 'reproduccion') setMetodo(CONFIG_CERDOS_DEFECTO.reproduccion.metodoConfirmacion)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parámetros de la granja</DialogTitle>
          <p className="text-sm text-gray-500">
            Cada granja trabaja distinto. Estos valores mueven los cálculos, las alertas y las metas de todo el módulo de cerdos.
            {cambiados > 0 && <> Tienes <strong className="text-gray-700">{cambiados}</strong> {cambiados === 1 ? 'valor distinto' : 'valores distintos'} al de por defecto.</>}
          </p>
        </DialogHeader>

        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 [scrollbar-width:none]">
          {SECCIONES.map(s => (
            <button key={s.id} type="button" onClick={() => setSeccion(s.id)}
              className={cn('-mb-px flex-shrink-0 border-b-2 px-3 pb-2 pt-1 text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
                seccion === s.id ? 'border-green-700 text-green-900' : 'border-transparent text-gray-500 hover:text-gray-800')}>
              {s.titulo}
            </button>
          ))}
        </div>

        <div className="min-h-[22rem] space-y-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-500">{actual.descripcion}</p>
            <button type="button" onClick={restaurarSeccion} className="flex-shrink-0 text-xs font-medium text-green-800 hover:underline">
              Usar valores por defecto
            </button>
          </div>

          {actual.grupos.map((g, i) => (
            <div key={g.titulo ?? i} className="space-y-2">
              {g.titulo && (
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {g.titulo}{g.nota && <span className="ml-1.5 font-normal normal-case tracking-normal text-gray-400">{g.nota}</span>}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {g.campos.map(c => {
                  const defecto = leer(CONFIG_CERDOS_DEFECTO, c.ruta)
                  const valor = valores[c.ruta] ?? ''
                  const distinto = aNumero(valor) !== (defecto ?? null)
                  return (
                    <div key={c.ruta} className="space-y-1">
                      <Label htmlFor={c.ruta} className="text-xs">{c.etiqueta}</Label>
                      <div className="relative">
                        <Input id={c.ruta} inputMode="decimal" value={valor}
                          placeholder={c.opcional ? 'Sin definir' : undefined}
                          onChange={e => setValores(prev => ({ ...prev, [c.ruta]: e.target.value }))}
                          className={cn(c.unidad && 'pr-14', distinto && 'border-green-600 bg-green-50/40')} />
                        {c.unidad && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{c.unidad}</span>}
                      </div>
                      <p className="text-[0.6875rem] text-gray-400">
                        Por defecto: {typeof defecto === 'number' ? defecto.toLocaleString('es-CO') : 'sin definir'}
                      </p>
                    </div>
                  )
                })}
              </div>
              {g.titulo === 'Confirmación de preñez' && (
                <div className="space-y-1">
                  <Label className="text-xs">Cómo se confirma</Label>
                  <div className="flex flex-wrap gap-2">
                    {METODOS_CONFIRMACION.map(m => (
                      <button key={m.value} type="button" onClick={() => setMetodo(m.value)}
                        className={cn('rounded-lg border px-3 py-1.5 text-sm transition-colors',
                          metodo === m.value ? 'border-green-700 bg-green-50 font-medium text-green-900' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-gray-400">Por defecto: no repitió celo. Por validar con los profesores.</p>
                </div>
              )}
            </div>
          ))}

          {actual.id === 'opciones' && (
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-green-700" checked={medirAgua} onChange={e => setMedirAgua(e.target.checked)} />
              <span>
                <span className="font-medium text-gray-800">La granja mide el agua</span>
                <span className="block text-xs text-gray-500">Si no la mide, el campo de agua no aparece en el registro del día.</span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={guardar} disabled={guardando} className="bg-green-700 text-white hover:bg-green-800">
            {guardando ? 'Guardando...' : 'Guardar parámetros'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
