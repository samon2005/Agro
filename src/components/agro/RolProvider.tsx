'use client'

import { createContext, useContext } from 'react'
import { permisos, type RolFinca } from '@/lib/roles'

type Rol = 'admin' | 'propietario' | 'trabajador'

const RolContext = createContext<{ rol: Rol; esAdmin: boolean } | null>(null)

/**
 * El rol de quien entra en la finca que está viendo (lo pone FincaProvider; lib/roles).
 * undefined mientras llega de la base; null sin finca.
 */
export const RolFincaContext = createContext<RolFinca | null | undefined>(null)

/**
 * El rol de siempre, para lo que solo distingue si se ve la plata: "propietario"
 * para el administrador de la finca y "trabajador" para el resto. Sale del rol en
 * la finca que se está viendo; sin finca, del perfil.
 */
export function useRol(): Rol {
  const ctx = useContext(RolContext)
  const rolFinca = useContext(RolFincaContext)
  if (!ctx) throw new Error('useRol must be used inside RolProvider')
  if (ctx.esAdmin) return 'propietario'
  if (rolFinca) return permisos(rolFinca).verDinero ? 'propietario' : 'trabajador'
  return ctx.rol
}

/**
 * El rol detallado en la finca que se está viendo (zootecnista, recolector…).
 * Mientras llega de la base, el del perfil.
 */
export function useRolFinca(): RolFinca {
  const ctx = useContext(RolContext)
  const rolFinca = useContext(RolFincaContext)
  if (ctx?.esAdmin) return 'propietario'
  return rolFinca ?? (ctx?.rol === 'trabajador' ? 'trabajador' : 'propietario')
}

/** false mientras el rol de la finca todavía no llega de la base */
export function useRolListo(): boolean {
  const ctx = useContext(RolContext)
  const rolFinca = useContext(RolFincaContext)
  return !!ctx?.esAdmin || rolFinca !== undefined
}

/** El administrador de fincas ve y edita todas las fincas (tabla administradores). */
export function useEsAdmin() {
  const ctx = useContext(RolContext)
  if (!ctx) throw new Error('useEsAdmin must be used inside RolProvider')
  return ctx.esAdmin
}

export default function RolProvider({ rol, esAdmin = false, children }: { rol: Rol; esAdmin?: boolean; children: React.ReactNode }) {
  return <RolContext.Provider value={{ rol, esAdmin }}>{children}</RolContext.Provider>
}
