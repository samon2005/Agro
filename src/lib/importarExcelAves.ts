/**
 * Lee el Excel de registro de ponedoras (el formato "multilíneas" que usa José:
 * hojas DiarioProducción, DiarioLevante y ClasificaciónDiaria) y lo vuelve días
 * para produccion_diaria_aves. Mismas reglas con que se cargaron los Excel de
 * Marinilla y Jericó:
 * - muertes = mortalidad + selección; si solo hubo selección, la causa es "Descarte";
 * - aves del día = saldo + vendidas ese día (las que había antes de la venta);
 * - las vendidas quedan en la observación (no hay precio para una venta);
 * - el tamaño va el día en que se clasificó: Yumbo→jumbo, Extra→AAA, AA, A, B, C,
 *   totiado→rotos, sucio→sucios, pipo y yema→deformes.
 */

export type Celda = string | number | boolean | Date | null
export interface Hoja { sheet: string; data: Celda[][] }

export interface DiaImportado {
  fecha: string
  huevos_totales: number
  alimento_kg: number
  muertes: number
  causa_muerte: string | null
  aves_en_dia: number | null
  observaciones: string | null
  huevos_c: number; huevos_b: number; huevos_a: number; huevos_aa: number; huevos_aaa: number; huevos_jumbo: number
  huevos_rotos: number; huevos_sucios: number; huevos_deformes: number
}

export interface LibroLeido {
  dias: DiaImportado[]
  /** Qué hojas se usaron, para mostrarlo antes de cargar */
  hojas: string[]
  /** Datos del encabezado del Excel (línea, fechas), si los trae */
  lote: { linea: string | null; nacimiento: string | null; inicioProduccion: string | null; aves: number | null; pollitas: number | null }
  /** Las aves que quedaron el último día (saldo después de ventas y muertes) */
  avesAlFinal: number | null
  /** El primer día con producción (el inicio de postura según los datos) */
  primeraProduccion: string | null
  diasClasificados: number
  avisos: string[]
}

const norm = (v: Celda) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
const num = (v: Celda) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const esNum = (v: Celda) => typeof v === 'number' && Number.isFinite(v)
/** Las fechas de Excel llegan como medianoche UTC: se toma ese día tal cual */
const fechaDe = (v: Celda) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : null)

const TAMANO: Record<string, keyof DiaImportado> = {
  YUMBO: 'huevos_jumbo', JUMBO: 'huevos_jumbo', EXTAR: 'huevos_aaa', EXTRA: 'huevos_aaa', AAA: 'huevos_aaa',
  AA: 'huevos_aa', A: 'huevos_a', B: 'huevos_b', C: 'huevos_c',
  SUCIO: 'huevos_sucios', SUCIOS: 'huevos_sucios', TOTIADO: 'huevos_rotos', ROTOS: 'huevos_rotos', ROTO: 'huevos_rotos',
  PIPO: 'huevos_deformes', YEMA: 'huevos_deformes',
}

const hojaPor = (hojas: Hoja[], nombre: string) => hojas.find(h => norm(h.sheet) === nombre)

/** La fila de títulos: la que tiene "Fecha" y todas las palabras pedidas. Devuelve su número y las columnas. */
function titulos(data: Celda[][], palabras: string[]) {
  for (let i = 0; i < Math.min(data.length, 40); i++) {
    const fila = data[i] ?? []
    const nombres = fila.map(norm)
    if (!nombres.includes('FECHA') && !nombres.some(n => n === 'FECHADIA')) continue
    if (palabras.every(p => nombres.some(n => n.includes(p)))) {
      const col = (pred: (n: string) => boolean) => nombres.findIndex(pred)
      return { fila: i, nombres, col }
    }
  }
  return null
}

function observacion(mort: number, sel: number, vent: number, texto: Celda) {
  const o: string[] = []
  if (sel && mort) o.push(`Incluye ${sel} de selección (descarte)`)
  if (vent) o.push(`Salieron ${vent} aves (venta, según el Excel)`)
  if (texto != null && String(texto).trim() && !String(texto).startsWith('#')) o.push(String(texto).trim())
  return o.length ? o.join('. ') : null
}

const vacio = (fecha: string): DiaImportado => ({
  fecha, huevos_totales: 0, alimento_kg: 0, muertes: 0, causa_muerte: null, aves_en_dia: null, observaciones: null,
  huevos_c: 0, huevos_b: 0, huevos_a: 0, huevos_aa: 0, huevos_aaa: 0, huevos_jumbo: 0,
  huevos_rotos: 0, huevos_sucios: 0, huevos_deformes: 0,
})

/** Lee el libro entero. Si no encuentra la hoja de producción, avisa y no devuelve días. */
export function leerLibroAves(hojas: Hoja[]): LibroLeido {
  const avisos: string[] = []
  const usadas: string[] = []
  const dias = new Map<string, DiaImportado>()

  // Encabezado del lote (InformaciónLote): línea, nacimiento, inicio de producción y aves
  const lote: LibroLeido['lote'] = { linea: null, nacimiento: null, inicioProduccion: null, aves: null, pollitas: null }
  const info = hojaPor(hojas, 'INFORMACIONLOTE')
  if (info) {
    for (const fila of info.data) {
      for (let j = 0; j < fila.length - 1; j++) {
        const k = norm(fila[j])
        const v = fila.slice(j + 1).find(x => x != null && x !== '') ?? null
        if (k.startsWith('LINEA') && typeof v === 'string' && !lote.linea) lote.linea = v.trim()
        if (k.startsWith('FECHADENACIMIENTO') && !lote.nacimiento) lote.nacimiento = fechaDe(v)
        if (k.startsWith('FECHADEINICIODEPRODUCCION') || k.startsWith('FECHADEINICIOPRODUCCION')) lote.inicioProduccion = fechaDe(v) ?? lote.inicioProduccion
        if ((k.startsWith('NUMERODEAVESENCASETADAS')) && esNum(v)) lote.aves = v as number
        if (k.startsWith('NUMEROINICIALDEPOLLITAS') || k.startsWith('NUMEROINICIADEPOLLITAS')) { if (esNum(v) && !lote.pollitas) lote.pollitas = v as number }
      }
    }
  }

  // Producción diaria
  const prod = hojaPor(hojas, 'DIARIOPRODUCCION')
  const tp = prod && titulos(prod.data, ['CONSUMO', 'MORT', 'HUEVOS'])
  if (!prod || !tp) {
    avisos.push('No encontré la hoja "DiarioProducción" con sus títulos (Fecha, Consumo, Mort, Producción huevos). ¿Es el formato de registro de ponedoras?')
    return { dias: [], hojas: usadas, lote, diasClasificados: 0, avisos, avesAlFinal: null, primeraProduccion: null }
  }
  usadas.push(prod.sheet)
  const c = {
    fecha: tp.col(n => n === 'FECHA' || n === 'FECHADIA'),
    consumo: tp.col(n => n.startsWith('CONSUMO') && !n.includes('GR')),
    mort: tp.col(n => n.startsWith('MORT')),
    sel: tp.col(n => n === 'SEL' || n.startsWith('SELEC')),
    vent: tp.col(n => n.startsWith('VENT')),
    huevos: tp.col(n => n.includes('HUEVOS')),
    saldo: tp.col(n => n.startsWith('SALDO')),
    obs: tp.col(n => n.startsWith('OBSERV')),
  }
  let avesAlFinal: number | null = null
  for (const fila of prod.data.slice(tp.fila + 1)) {
    const fecha = fechaDe(fila[c.fecha])
    if (!fecha) continue
    if (!esNum(fila[c.huevos]) && !esNum(fila[c.consumo]) && !esNum(fila[c.mort])) continue
    const mort = num(fila[c.mort]), sel = c.sel >= 0 ? num(fila[c.sel]) : 0, vent = c.vent >= 0 ? num(fila[c.vent]) : 0
    const saldo = c.saldo >= 0 && esNum(fila[c.saldo]) ? (fila[c.saldo] as number) + vent : null
    if (c.saldo >= 0 && esNum(fila[c.saldo])) avesAlFinal = Math.round(fila[c.saldo] as number)
    const muertes = Math.round(mort + sel)
    dias.set(fecha, {
      ...vacio(fecha),
      huevos_totales: Math.round(num(fila[c.huevos])),
      alimento_kg: Math.round(num(fila[c.consumo]) * 100) / 100,
      muertes,
      causa_muerte: muertes > 0 && sel > 0 && mort === 0 ? 'Descarte' : null,
      aves_en_dia: saldo && saldo > 0 ? Math.round(saldo) : null,
      observaciones: observacion(mort, sel, vent, c.obs >= 0 ? fila[c.obs] : null),
    })
  }
  const primeraProduccion = [...dias.keys()].sort()[0]

  // Levante: los días antes de la producción, sin huevos ni aves contadas
  const lev = hojaPor(hojas, 'DIARIOLEVANTE')
  const tl = lev && titulos(lev.data, ['CONSUMO', 'MORT'])
  if (lev && tl && primeraProduccion) {
    const cl = {
      fecha: tl.col(n => n === 'FECHA' || n === 'FECHADIA'),
      consumo: tl.col(n => n.startsWith('CONSUMO') && !n.includes('GR')),
      mort: tl.col(n => n.startsWith('MORT')), sel: tl.col(n => n === 'SEL' || n.startsWith('SELEC')),
      vent: tl.col(n => n.startsWith('VENT')), obs: tl.col(n => n.startsWith('OBSERV')),
    }
    let antes = 0
    for (const fila of lev.data.slice(tl.fila + 1)) {
      const fecha = fechaDe(fila[cl.fecha])
      if (!fecha || fecha >= primeraProduccion || dias.has(fecha)) continue
      if (!esNum(fila[cl.consumo]) && !esNum(fila[cl.mort])) continue
      const mort = num(fila[cl.mort]), sel = cl.sel >= 0 ? num(fila[cl.sel]) : 0, vent = cl.vent >= 0 ? num(fila[cl.vent]) : 0
      const muertes = Math.round(mort + sel)
      dias.set(fecha, {
        ...vacio(fecha),
        alimento_kg: Math.round(num(fila[cl.consumo]) * 100) / 100,
        muertes, causa_muerte: muertes > 0 && sel > 0 && mort === 0 ? 'Descarte' : null,
        observaciones: observacion(mort, sel, vent, cl.obs >= 0 ? fila[cl.obs] : null),
      })
      antes++
    }
    if (antes > 0) usadas.push(lev.sheet)
  }

  // Clasificación por tamaño, el día en que se clasificó
  let diasClasificados = 0
  const cla = hojaPor(hojas, 'CLASIFICACIONDIARIA')
  if (cla) {
    let cols: { fecha: number; tam: [number, keyof DiaImportado][] } | null = null
    let fuera = 0
    for (const fila of cla.data) {
      const nombres = fila.map(norm)
      if (nombres.includes('SEMANA') && nombres.includes('FECHA')) {
        cols = { fecha: nombres.indexOf('FECHA'), tam: nombres.flatMap((n, j) => (TAMANO[n] ? [[j, TAMANO[n]] as [number, keyof DiaImportado]] : [])) }
        continue
      }
      if (!cols) continue
      const fecha = fechaDe(fila[cols.fecha])
      if (!fecha) continue
      const suma = cols.tam.reduce((s, [j]) => s + num(fila[j]), 0)
      if (suma <= 0) continue
      const dia = dias.get(fecha)
      if (!dia) { fuera += suma; continue }
      for (const [j, campo] of cols.tam) (dia[campo] as number) += Math.round(num(fila[j]))
      diasClasificados++
    }
    if (diasClasificados > 0) usadas.push(cla.sheet)
    if (fuera > 0) avisos.push(`${fuera.toLocaleString('es-CO')} huevos clasificados caen en fechas sin registro de producción: no se cargan.`)
  }

  return { dias: [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)), hojas: usadas, lote, diasClasificados, avisos, avesAlFinal, primeraProduccion: primeraProduccion ?? null }
}

/** Qué se va a cargar en un lote: solo días nuevos, desde la entrada y hasta hoy. */
export function planDeCarga(dias: DiaImportado[], existentes: Set<string>, fechaEntrada: string, hoy: string) {
  const nuevos = dias.filter(d => !existentes.has(d.fecha) && d.fecha >= fechaEntrada && d.fecha <= hoy)
  return {
    nuevos,
    yaRegistrados: dias.filter(d => existentes.has(d.fecha)).length,
    antesDeEntrada: dias.filter(d => !existentes.has(d.fecha) && d.fecha < fechaEntrada).length,
    futuros: dias.filter(d => d.fecha > hoy).length,
    primeraAntes: dias.find(d => !existentes.has(d.fecha) && d.fecha < fechaEntrada)?.fecha ?? null,
  }
}
