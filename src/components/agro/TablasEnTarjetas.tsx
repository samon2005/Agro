'use client'

import { useEffect } from 'react'

/**
 * En celular, toda tabla de la app se ve como tarjetas: cada fila es una
 * tarjeta y cada dato lleva el nombre de su columna, para no tener que mover la
 * pantalla de lado (Samuel, 22 nov 2026). En computador siguen siendo tablas.
 *
 * Aquí solo se le pone a cada celda el nombre de su columna (data-label); el
 * estilo está en globals.css (`.tabla-tarjetas`). Una tabla que deba quedarse
 * como tabla lleva `data-tabla-fija`.
 */
function etiquetar() {
  document.querySelectorAll<HTMLTableElement>('table:not([data-tabla-fija])').forEach(tabla => {
    const filaTitulos = tabla.tHead?.rows[0]
    if (!filaTitulos) return
    // Los títulos de cada columna, contando las que ocupan varias
    const titulos: string[] = []
    for (const th of Array.from(filaTitulos.cells)) {
      const limpio = (th.textContent ?? '').replace(/\s+/g, ' ').trim()
      const texto = limpio ? limpio[0].toUpperCase() + limpio.slice(1) : ''
      for (let i = 0; i < (th.colSpan || 1); i++) titulos.push(texto)
    }
    tabla.classList.add('tabla-tarjetas')
    const filas = [...Array.from(tabla.tBodies).flatMap(b => Array.from(b.rows)), ...Array.from(tabla.tFoot?.rows ?? [])]
    for (const fila of filas) {
      let col = 0
      for (const celda of Array.from(fila.cells)) {
        const titulo = (celda.colSpan || 1) > 1 ? '' : titulos[col] ?? ''
        if (celda.getAttribute('data-label') !== titulo) celda.setAttribute('data-label', titulo)
        col += celda.colSpan || 1
      }
    }
  })
}

export default function TablasEnTarjetas() {
  useEffect(() => {
    let pendiente = 0
    const programar = () => {
      cancelAnimationFrame(pendiente)
      pendiente = requestAnimationFrame(etiquetar)
    }
    etiquetar()
    // Las tablas aparecen y cambian al navegar y al cargar datos
    const obs = new MutationObserver(programar)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => { obs.disconnect(); cancelAnimationFrame(pendiente) }
  }, [])
  return null
}
