'use client'

import { usePathname } from 'next/navigation'

/**
 * Cada cambio de sección entra con un fundido corto desde abajo. La clave por
 * ruta hace que la animación vuelva a correr al navegar, no al re-renderizar.
 */
export default function PaginaEntra({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="pagina-entra min-h-full">
      {children}
    </div>
  )
}
