import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ReactNode } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Mapa value→label para el prop `items` de `<Select>` (Base UI): sin esto, el trigger
 * muestra el `value` crudo en vez de la etiqueta del item seleccionado.
 */
export function toSelectItems(lista: { value: string; label: ReactNode }[]): Record<string, ReactNode> {
  return Object.fromEntries(lista.map(x => [x.value, x.label]))
}
