'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Ic } from '@/components/ui/icon'
import { hoyLocal } from '@/lib/fechas'
import { leerLibroAves, planDeCarga, type Hoja, type LibroLeido } from '@/lib/importarExcelAves'

const mil = (v: number) => v.toLocaleString('es-CO')
const fecha = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Cargar días viejos de un galpón desde el Excel de registro de ponedoras. Lee el
 * archivo en el navegador, muestra qué va a cargar y solo agrega días nuevos:
 * nunca reemplaza un día ya registrado.
 */
export default function ImportarExcelModal({ open, onClose, loteId, fincaId, loteNombre, fechaEntrada, fechasRegistradas, onImportado }: {
  open: boolean
  onClose: () => void
  loteId: string
  fincaId: string
  loteNombre: string
  fechaEntrada: string
  /** Los días que el lote ya tiene: no se tocan */
  fechasRegistradas: Set<string>
  onImportado: () => void
}) {
  const [archivo, setArchivo] = useState<string | null>(null)
  const [libro, setLibro] = useState<LibroLeido | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [cargando, setCargando] = useState(false)
  // Por defecto los huevos de días viejos ya salieron de la finca: no suman a la bodega
  const [yaSalieron, setYaSalieron] = useState(true)

  function cerrar() {
    if (cargando) return
    setArchivo(null); setLibro(null); setYaSalieron(true)
    onClose()
  }

  async function leer(file: File) {
    setLeyendo(true); setLibro(null); setArchivo(file.name)
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      const hojas = await readXlsxFile(file)
      setLibro(leerLibroAves(hojas as unknown as Hoja[]))
    } catch {
      toast.error('No se pudo leer el archivo. Debe ser un Excel (.xlsx).')
      setArchivo(null)
    }
    setLeyendo(false)
  }

  const plan = libro ? planDeCarga(libro.dias, fechasRegistradas, fechaEntrada, hoyLocal()) : null
  const suma = (k: 'huevos_totales' | 'muertes' | 'alimento_kg') => (plan?.nuevos ?? []).reduce((s, d) => s + Number(d[k]), 0)

  async function cargar() {
    if (!plan || plan.nuevos.length === 0) return
    setCargando(true)
    const filas = plan.nuevos.map(d => ({ ...d, lote_id: loteId, finca_id: fincaId, importado: yaSalieron }))
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await createClient().from('produccion_diaria_aves').insert(filas.slice(i, i + 200))
      if (error) {
        setCargando(false)
        toast.error(`Se cargaron ${mil(i)} días y falló el resto. Vuelve a importar: los ya cargados se saltan.`)
        onImportado()
        return
      }
    }
    setCargando(false)
    toast.success(`${mil(filas.length)} días cargados en ${loteNombre}`)
    onImportado()
    setArchivo(null); setLibro(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) cerrar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle><Ic n="diario" /> Importar días desde Excel</DialogTitle>
          <p className="text-sm text-gray-500">
            Para {loteNombre}. Sirve el Excel de registro de ponedoras (hojas DiarioProducción, DiarioLevante y ClasificaciónDiaria).
            Solo se agregan días nuevos: un día que ya está registrado no se toca.
          </p>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 text-center hover:border-green-300 hover:bg-green-50/40">
          <Ic n="mas" className="size-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{archivo ?? 'Elegir el archivo de Excel'}</span>
          <span className="text-xs text-gray-400">{leyendo ? 'Leyendo…' : '.xlsx'}</span>
          <input type="file" accept=".xlsx" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) leer(f); e.target.value = '' }} />
        </label>

        {libro && (
          <div className="space-y-3 text-sm">
            {libro.avisos.map((a, i) => <p key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{a}</p>)}

            {libro.dias.length > 0 && plan && (<>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500">
                  El Excel trae {mil(libro.dias.length)} días, del {fecha(libro.dias[0].fecha)} al {fecha(libro.dias[libro.dias.length - 1].fecha)}
                  {libro.lote.linea ? ` · ${libro.lote.linea}` : ''}. Hojas: {libro.hojas.join(', ')}.
                </p>
                <p className="mt-2 text-base font-semibold text-gray-900">{mil(plan.nuevos.length)} días para cargar</p>
                {plan.nuevos.length > 0 && (
                  <p className="text-xs text-gray-600">
                    {mil(suma('huevos_totales'))} huevos · {mil(suma('muertes'))} muertes · {mil(Math.round(suma('alimento_kg')))} kg de alimento
                    {libro.diasClasificados > 0 ? ` · ${mil(libro.diasClasificados)} días con tamaños` : ''}
                  </p>
                )}
              </div>

              {(plan.yaRegistrados > 0 || plan.antesDeEntrada > 0 || plan.futuros > 0) && (
                <ul className="space-y-1 text-xs text-gray-500">
                  {plan.yaRegistrados > 0 && <li>• {mil(plan.yaRegistrados)} días ya están registrados: se dejan como están.</li>}
                  {plan.antesDeEntrada > 0 && (
                    <li className="text-amber-800">
                      • {mil(plan.antesDeEntrada)} días son de antes de que el lote entrara ({fecha(fechaEntrada)}) y no se cargan.
                      Si son de este lote, cambia primero la fecha de entrada en Configurar galpón{plan.primeraAntes ? ` (el primero es del ${fecha(plan.primeraAntes)})` : ''}.
                    </li>
                  )}
                  {plan.futuros > 0 && <li>• {mil(plan.futuros)} días tienen fecha futura y no se cargan.</li>}
                </ul>
              )}

              {plan.nuevos.length > 0 && (
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="mt-0.5" checked={yaSalieron} onChange={e => setYaSalieron(e.target.checked)} />
                  <span>Estos huevos ya salieron de la finca: no se suman al saldo de la bodega. Desmárcalo solo si esos huevos siguen en la finca.</span>
                </label>
              )}
            </>)}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={cerrar} disabled={cargando}>Cancelar</Button>
          <Button onClick={cargar} disabled={!plan || plan.nuevos.length === 0 || cargando}>
            {cargando ? 'Cargando…' : plan && plan.nuevos.length > 0 ? `Cargar ${mil(plan.nuevos.length)} días` : 'Cargar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
