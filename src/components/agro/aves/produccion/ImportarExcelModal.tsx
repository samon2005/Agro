'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import { todasLasFilas } from '@/lib/todasLasFilas'
import { cargarLineasReferencia, referenciaParaLinea, LINEAS_PONEDORAS } from '@/lib/referencias'
import { leerLibroAves, planDeCarga, type Hoja, type LibroLeido } from '@/lib/importarExcelAves'

const mil = (v: number) => v.toLocaleString('es-CO')
const fecha = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
const mesAnio = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase()

export interface LoteDestino {
  id: string; nombre: string; estado: string; instalacion_id: string | null; fecha_inicio: string; fecha_fin: string | null
}

/**
 * Cargar un Excel de registro de ponedoras (hojas DiarioProducción, DiarioLevante,
 * ClasificaciónDiaria e InformaciónLote). Se puede:
 * - crear el lote con los datos del Excel (línea, nacimiento, postura, aves), cerrado
 *   si ya salió o activo si sigue en el galpón;
 * - o sumar los días a un lote que ya existe.
 * Siempre muestra qué va a cargar y solo agrega días nuevos: nunca reemplaza.
 */
export default function ImportarExcelModal({ open, onClose, fincaId, lotes, galpones, loteInicialId, onImportado }: {
  open: boolean
  onClose: () => void
  fincaId: string
  /** Todos los lotes de la finca, activos y cerrados */
  lotes: LoteDestino[]
  galpones: { id: string; nombre: string }[]
  /** Si se abre desde un galpón, ese lote ya viene elegido */
  loteInicialId?: string | null
  onImportado: (loteId: string) => void
}) {
  const hoy = hoyLocal()
  const [archivo, setArchivo] = useState<string | null>(null)
  const [libro, setLibro] = useState<LibroLeido | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [yaSalieron, setYaSalieron] = useState(true)
  const [destino, setDestino] = useState<'nuevo' | 'existente'>(loteInicialId ? 'existente' : 'nuevo')
  const [loteId, setLoteId] = useState<string>(loteInicialId ?? '')
  const [existentes, setExistentes] = useState<{ loteId: string; fechas: Set<string> } | null>(null)
  // El lote nuevo, prellenado con lo que trae el Excel
  const [nuevo, setNuevo] = useState({ nombre: '', galpon: '', linea: '', nacimiento: '', entrada: '', postura: '', aves: '', salio: true })

  // Los días que ya tiene el lote elegido, para no repetirlos
  useEffect(() => {
    if (destino !== 'existente' || !loteId) return
    let vigente = true
    todasLasFilas<{ fecha: string }>((a, b) => createClient().from('produccion_diaria_aves').select('fecha').eq('lote_id', loteId).order('fecha').range(a, b))
      .then(({ data }) => { if (vigente) setExistentes({ loteId, fechas: new Set(data.map(d => d.fecha)) }) })
    return () => { vigente = false }
  }, [destino, loteId])

  function cerrar() {
    if (cargando) return
    setArchivo(null); setLibro(null); setYaSalieron(true); setExistentes(null)
    setDestino(loteInicialId ? 'existente' : 'nuevo'); setLoteId(loteInicialId ?? '')
    onClose()
  }

  async function leer(file: File) {
    setLeyendo(true); setLibro(null); setArchivo(file.name)
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      const leido = leerLibroAves((await readXlsxFile(file)) as unknown as Hoja[])
      setLibro(leido)
      if (leido.dias.length > 0) {
        const primero = leido.dias[0].fecha, ultimo = leido.dias[leido.dias.length - 1].fecha
        const linea = leido.lote.linea ? LINEAS_PONEDORAS.find(l => normal(l) === normal(leido.lote.linea!)) ?? leido.lote.linea : ''
        const conLevante = leido.primeraProduccion != null && primero < leido.primeraProduccion
        const libre = galpones.find(g => !lotes.some(l => l.instalacion_id === g.id && (l.estado === 'activo' || l.estado === 'preparacion')))
        setNuevo({
          nombre: `Lote ${mesAnio(leido.lote.inicioProduccion ?? primero)} – ${mesAnio(ultimo)}`,
          galpon: libre?.id ?? galpones[0]?.id ?? '',
          linea,
          nacimiento: leido.lote.nacimiento ?? '',
          entrada: primero,
          postura: leido.lote.inicioProduccion ?? leido.primeraProduccion ?? '',
          aves: String((conLevante ? leido.lote.pollitas : leido.lote.aves) ?? leido.dias.find(d => d.aves_en_dia)?.aves_en_dia ?? ''),
          // Si el último día del Excel tiene más de una semana, el lote ya salió
          salio: (new Date(hoy + 'T00:00:00').getTime() - new Date(ultimo + 'T00:00:00').getTime()) / 86_400_000 > 7,
        })
        // Si hay un lote que ya cubre esas fechas, se propone sumar a ese
        if (!loteInicialId) {
          const cubre = lotes.find(l => l.fecha_inicio <= ultimo && (l.fecha_fin ?? hoy) >= primero)
          if (cubre) { setDestino('existente'); setLoteId(cubre.id) }
        }
      }
    } catch {
      toast.error('No se pudo leer el archivo. Debe ser un Excel (.xlsx).')
      setArchivo(null)
    }
    setLeyendo(false)
  }

  const loteElegido = lotes.find(l => l.id === loteId)
  const galponOcupado = (gid: string) => lotes.some(l => l.instalacion_id === gid && (l.estado === 'activo' || l.estado === 'preparacion'))
  const plan = !libro || libro.dias.length === 0 ? null
    : destino === 'nuevo'
      ? (nuevo.entrada ? planDeCarga(libro.dias, new Set(), nuevo.entrada, hoy) : null)
      : loteElegido && existentes?.loteId === loteElegido.id ? planDeCarga(libro.dias, existentes.fechas, loteElegido.fecha_inicio, hoy) : null
  const suma = (k: 'huevos_totales' | 'muertes' | 'alimento_kg') => (plan?.nuevos ?? []).reduce((s, d) => s + Number(d[k]), 0)

  const faltaNuevo = destino !== 'nuevo' ? null
    : !nuevo.nombre.trim() ? 'Ponle nombre al lote'
    : !nuevo.galpon ? 'Elige el galpón'
    : !nuevo.entrada ? 'Falta la fecha de entrada'
    : !(Number(nuevo.aves) > 0) ? 'Faltan las aves alojadas'
    : !nuevo.salio && galponOcupado(nuevo.galpon) ? 'Ese galpón ya tiene aves: elige otro, o marca que el lote ya salió'
    : null

  async function cargar() {
    if (!plan || plan.nuevos.length === 0 || !libro) return
    if (faltaNuevo) { toast.error(faltaNuevo); return }
    setCargando(true)
    const supabase = createClient()
    let destinoId = loteId
    if (destino === 'nuevo') {
      const lineas = await cargarLineasReferencia(supabase, fincaId)
      const ref = referenciaParaLinea(lineas, nuevo.linea || null)
      const ultimo = libro.dias[libro.dias.length - 1]
      const semanasPostura = nuevo.postura ? Math.max(1, Math.round((new Date(ultimo.fecha + 'T00:00:00').getTime() - new Date(nuevo.postura + 'T00:00:00').getTime()) / (7 * 86_400_000))) : null
      const { data, error } = await supabase.from('lotes_aves').insert({
        finca_id: fincaId, instalacion_id: nuevo.galpon, nombre: nuevo.nombre.trim(),
        linea_genetica: nuevo.linea || null, referencia_id: ref?.id ?? null,
        fecha_nacimiento: nuevo.nacimiento || null, fecha_inicio: nuevo.entrada, fecha_inicio_postura: nuevo.postura || null,
        aves_iniciales: Number(nuevo.aves),
        aves_actuales: nuevo.salio ? (libro.avesAlFinal ?? 0) : (ultimo.aves_en_dia ?? Number(nuevo.aves)),
        estado: nuevo.salio ? 'finalizado' : (nuevo.postura && nuevo.postura <= hoy ? 'activo' : 'preparacion'),
        fecha_fin: nuevo.salio ? ultimo.fecha : null, motivo_cierre: nuevo.salio ? 'fin_ciclo' : null,
        proposito: 'ciclo_completo', semanas_ciclo_postura: nuevo.salio ? semanasPostura : null,
        origen_aves: 'Importado de Excel', observaciones: `Cargado del Excel "${archivo}".`,
      }).select('id').single()
      if (error || !data) {
        setCargando(false)
        toast.error('No se pudo crear el lote. Revisa que el galpón esté libre.')
        return
      }
      destinoId = data.id
    }
    const filas = plan.nuevos.map(d => ({ ...d, lote_id: destinoId, finca_id: fincaId, importado: yaSalieron }))
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await supabase.from('produccion_diaria_aves').insert(filas.slice(i, i + 200))
      if (error) {
        setCargando(false)
        toast.error(`Se cargaron ${mil(i)} días y falló el resto. Vuelve a importar en ese lote: los ya cargados se saltan.`)
        onImportado(destinoId)
        return
      }
    }
    setCargando(false)
    toast.success(`${mil(filas.length)} días cargados${destino === 'nuevo' ? ` en el lote nuevo "${nuevo.nombre.trim()}"` : ` en ${loteElegido?.nombre ?? 'el lote'}`}`)
    onImportado(destinoId)
    setArchivo(null); setLibro(null); setExistentes(null)
    onClose()
  }

  const campo = (k: keyof typeof nuevo, etiqueta: string, tipo = 'text') => (
    <div className="space-y-1">
      <Label className="text-xs">{etiqueta}</Label>
      <Input type={tipo} value={String(nuevo[k])} onChange={e => setNuevo(n => ({ ...n, [k]: e.target.value }))} className="h-8 text-sm" />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) cerrar() }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Ic n="diario" /> Importar desde Excel</DialogTitle>
          <p className="text-sm text-gray-500">
            El Excel de registro de ponedoras: producción diaria, levante y clasificación por tamaño.
            Se puede crear el lote con sus datos o sumarlo a uno que ya existe. Nunca reemplaza un día ya registrado.
          </p>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-200 px-4 py-5 text-center hover:border-green-300 hover:bg-green-50/40">
          <Ic n="mas" className="size-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{archivo ?? 'Elegir el archivo de Excel'}</span>
          <span className="text-xs text-gray-400">{leyendo ? 'Leyendo…' : '.xlsx'}</span>
          <input type="file" accept=".xlsx" className="sr-only" aria-label="Archivo de Excel"
            onChange={e => { const f = e.target.files?.[0]; if (f) leer(f); e.target.value = '' }} />
        </label>

        {libro && (
          <div className="space-y-4 text-sm">
            {libro.avisos.map((a, i) => <p key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{a}</p>)}

            {libro.dias.length > 0 && (<>
              <p className="text-xs text-gray-500">
                El Excel trae <strong>{mil(libro.dias.length)} días</strong>, del {fecha(libro.dias[0].fecha)} al {fecha(libro.dias[libro.dias.length - 1].fecha)}
                {libro.lote.linea ? ` · ${libro.lote.linea}` : ''}. Hojas: {libro.hojas.join(', ')}.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(['nuevo', 'existente'] as const).map(op => (
                  <button key={op} type="button" onClick={() => setDestino(op)} disabled={op === 'existente' && lotes.length === 0}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors disabled:opacity-40 ${destino === op ? 'border-green-700 bg-green-50 text-green-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <span className="block text-sm font-medium">{op === 'nuevo' ? 'Crear el lote' : 'Sumar a un lote'}</span>
                    {op === 'nuevo' ? 'Con la línea, las fechas y las aves del Excel' : 'Que ya está en la app'}
                  </button>
                ))}
              </div>

              {destino === 'nuevo' ? (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 p-3">
                  <div className="col-span-2">{campo('nombre', 'Nombre del lote')}</div>
                  <div className="space-y-1">
                    <Label className="text-xs">Galpón</Label>
                    <select value={nuevo.galpon} onChange={e => setNuevo(n => ({ ...n, galpon: e.target.value }))}
                      className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                      {galpones.map(g => <option key={g.id} value={g.id}>{g.nombre}{galponOcupado(g.id) ? ' (con aves hoy)' : ''}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Línea genética</Label>
                    <select value={nuevo.linea} onChange={e => setNuevo(n => ({ ...n, linea: e.target.value }))}
                      className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                      <option value="">Sin línea</option>
                      {[...new Set([...LINEAS_PONEDORAS, ...(nuevo.linea ? [nuevo.linea] : [])])].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  {campo('nacimiento', 'Nacimiento', 'date')}
                  {campo('entrada', 'Entrada al galpón', 'date')}
                  {campo('postura', 'Inicio de postura', 'date')}
                  {campo('aves', 'Aves alojadas', 'number')}
                  <label className="col-span-2 flex items-start gap-2 text-xs text-gray-700">
                    <input type="checkbox" className="mt-0.5" checked={nuevo.salio} onChange={e => setNuevo(n => ({ ...n, salio: e.target.checked }))} />
                    <span>
                      El lote ya salió del galpón: queda cerrado el {fecha(libro.dias[libro.dias.length - 1].fecha)}, con {mil(libro.avesAlFinal ?? 0)} aves al final.
                      Desmárcalo si esas aves siguen en el galpón hoy.
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Lote</Label>
                  <select value={loteId} onChange={e => setLoteId(e.target.value)}
                    className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                    <option value="" disabled>Elige el lote</option>
                    {lotes.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.nombre} · {fecha(l.fecha_inicio)} – {l.fecha_fin ? fecha(l.fecha_fin) : 'hoy'}{l.estado === 'finalizado' || l.estado === 'vendido' ? ' (ya salió)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {plan && (<>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-base font-semibold text-gray-900">{mil(plan.nuevos.length)} días para cargar</p>
                  {plan.nuevos.length > 0 && (
                    <p className="text-xs text-gray-600">
                      {mil(suma('huevos_totales'))} huevos · {mil(suma('muertes'))} muertes · {mil(Math.round(suma('alimento_kg')))} kg de alimento
                      {libro.diasClasificados > 0 ? ` · ${mil(libro.diasClasificados)} días con tamaños` : ''}
                    </p>
                  )}
                </div>
                {(plan.yaRegistrados > 0 || plan.antesDeEntrada > 0 || plan.futuros > 0) && (
                  <ul className="space-y-1 text-xs text-gray-500">
                    {plan.yaRegistrados > 0 && <li>• {mil(plan.yaRegistrados)} días ya están registrados en ese lote: se dejan como están.</li>}
                    {plan.antesDeEntrada > 0 && (
                      <li className="text-amber-800">
                        • {mil(plan.antesDeEntrada)} días son de antes de la entrada del lote y no se cargan
                        {plan.primeraAntes ? ` (el primero es del ${fecha(plan.primeraAntes)})` : ''}.
                        {destino === 'existente' ? ' Si son de este lote, cambia primero su fecha de entrada en Configurar galpón.' : ' Si son de este lote, adelanta la fecha de entrada.'}
                      </li>
                    )}
                    {plan.futuros > 0 && <li>• {mil(plan.futuros)} días tienen fecha futura y no se cargan.</li>}
                  </ul>
                )}
                {plan.nuevos.length > 0 && (
                  <label className="flex items-start gap-2 text-xs text-gray-700">
                    <input type="checkbox" className="mt-0.5" checked={yaSalieron} onChange={e => setYaSalieron(e.target.checked)} />
                    <span>Estos huevos ya salieron de la finca: no se suman a la bodega, y la app avisa que de esas fechas no hay ventas. Desmárcalo solo si esos huevos siguen en la finca.</span>
                  </label>
                )}
              </>)}
              {destino === 'existente' && loteId && !plan && <p className="text-xs text-gray-400">Revisando los días del lote…</p>}
            </>)}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={cerrar} disabled={cargando}>Cancelar</Button>
          <Button onClick={cargar} disabled={!plan || plan.nuevos.length === 0 || cargando || !!faltaNuevo} title={faltaNuevo ?? undefined}>
            {cargando ? 'Cargando…' : plan && plan.nuevos.length > 0 ? `${destino === 'nuevo' ? 'Crear el lote y cargar' : 'Cargar'} ${mil(plan.nuevos.length)} días` : 'Cargar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
