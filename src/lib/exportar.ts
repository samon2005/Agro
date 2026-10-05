/**
 * Exportar tablas a Excel (.xlsx real, sin librerías) e imprimirlas.
 *
 * Un .xlsx es un ZIP con unos XML adentro; aquí se arma el ZIP sin comprimir
 * (método "store"), que Excel, LibreOffice y Google Sheets abren sin problema.
 */

export type Celda = string | number | null | undefined

export interface Hoja {
  nombre: string
  columnas: string[]
  filas: Celda[][]
}

// ── CRC32 (lo pide el formato ZIP) ──
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** ZIP sin compresión con los archivos dados (nombre → contenido). */
export function armarZip(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre)
    const crc = crc32(a.datos)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // nombres en UTF-8
    local.setUint16(8, 0, true)      // sin compresión
    local.setUint16(10, 0, true)
    local.setUint16(12, 0x21, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, a.datos.length, true)
    local.setUint32(22, a.datos.length, true)
    local.setUint16(26, nombre.length, true)
    local.setUint16(28, 0, true)
    partes.push(new Uint8Array(local.buffer), nombre, a.datos)

    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true)
    cen.setUint16(4, 20, true)
    cen.setUint16(6, 20, true)
    cen.setUint16(8, 0x0800, true)
    cen.setUint16(10, 0, true)
    cen.setUint16(12, 0, true)
    cen.setUint16(14, 0x21, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, a.datos.length, true)
    cen.setUint32(24, a.datos.length, true)
    cen.setUint16(28, nombre.length, true)
    cen.setUint32(42, offset, true)
    central.push(new Uint8Array(cen.buffer), nombre)
    offset += 30 + nombre.length + a.datos.length
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, offset, true)
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0))
  let pos = 0
  for (const p of todo) { salida.set(p, pos); pos += p.length }
  return salida
}

const escapar = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Caracteres de control que el XML no admite
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

function letraColumna(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

function hojaXml(h: Hoja): string {
  const fila = (celdas: Celda[], r: number, estilo?: number) => `<row r="${r}">${celdas.map((c, i) => {
    const ref = `${letraColumna(i)}${r}`
    const s = estilo ? ` s="${estilo}"` : ''
    if (c == null || c === '') return `<c r="${ref}"${s}/>`
    if (typeof c === 'number' && Number.isFinite(c)) return `<c r="${ref}"${s}><v>${c}</v></c>`
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escapar(String(c))}</t></is></c>`
  }).join('')}</row>`
  const anchos = h.columnas.map((col, i) => {
    const largo = Math.max(col.length, ...h.filas.slice(0, 200).map(f => String(f[i] ?? '').length))
    return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(8, largo + 2))}" customWidth="1"/>`
  }).join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${anchos}</cols>`
    + `<sheetData>${fila(h.columnas, 1, 1)}${h.filas.map((f, i) => fila(f, i + 2)).join('')}</sheetData>`
    + '</worksheet>'
}

/** El archivo .xlsx con una hoja por tabla. */
export function armarXlsx(hojas: Hoja[]): Uint8Array {
  const enc = new TextEncoder()
  // Excel no admite estos caracteres ni más de 31 letras en el nombre de una hoja
  const nombres = hojas.map((h, i) => (h.nombre.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || `Hoja ${i + 1}`))
  const archivos = [
    {
      nombre: '[Content_Types].xml',
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
        + '</Types>',
    },
    {
      nombre: '_rels/.rels',
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      nombre: 'xl/workbook.xml',
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + nombres.map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
        + '</sheets></workbook>',
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
        + '</Relationships>',
    },
    {
      // Estilo 1: encabezado en negrilla con fondo
      nombre: 'xl/styles.xml',
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F3E8"/><bgColor indexed="64"/></patternFill></fill></fills>'
        + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'
        + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        + '</styleSheet>',
    },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, xml: hojaXml(h) })),
  ]
  return armarZip(archivos.map(a => ({ nombre: a.nombre, datos: enc.encode(a.xml) })))
}

/** Descarga las tablas como un archivo de Excel. */
export function descargarExcel(nombreArchivo: string, hojas: Hoja[]) {
  const datos = armarXlsx(hojas)
  const blob = new Blob([datos as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Imprime solo un pedazo de la página (una tabla, un reporte) con un estilo
 * limpio, sin el menú ni los botones.
 */
export function imprimirElemento(elemento: HTMLElement, titulo: string, subtitulo?: string) {
  const marco = document.createElement('iframe')
  marco.style.position = 'fixed'
  marco.style.right = '0'
  marco.style.bottom = '0'
  marco.style.width = '0'
  marco.style.height = '0'
  marco.style.border = '0'
  document.body.appendChild(marco)
  const doc = marco.contentDocument!
  const copia = elemento.cloneNode(true) as HTMLElement
  copia.querySelectorAll('[data-no-imprimir]').forEach(n => n.remove())
  doc.open()
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1f2937; margin: 24px; font-size: 11px; }
  h1 { font-size: 18px; margin: 0 0 2px; } p.sub { color: #6b7280; margin: 0 0 14px; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; }
  th { background: #f3f4f6; } td { font-variant-numeric: tabular-nums; }
  button, input, select { display: none !important; } svg { max-width: 100%; }
  @page { margin: 12mm; }
</style></head><body><h1>${escapar(titulo)}</h1><p class="sub">${escapar(subtitulo ?? '')} · impreso el ${new Date().toLocaleString('es-CO')}</p>${copia.outerHTML}</body></html>`)
  doc.close()
  const imprimir = () => {
    marco.contentWindow?.focus()
    marco.contentWindow?.print()
    setTimeout(() => marco.remove(), 1500)
  }
  // Se espera a que el marco pinte antes de imprimir
  setTimeout(imprimir, 250)
}
