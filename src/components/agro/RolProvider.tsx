'use client'

import { createContext, useContext } from 'react'

type Rol = 'admin' | 'propietario' | 'trabajador'

const RolContext = createContext<{ rol: Rol; esAdmin: boolean } | null>(null)

export function useRol() {
  const ctx = useContext(RolContext)
  if (!ctx) throw new Error('useRol must be used inside RolProvider')
  return ctx.rol
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
