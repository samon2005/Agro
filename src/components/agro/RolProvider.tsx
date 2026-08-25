'use client'

import { createContext, useContext } from 'react'

type Rol = 'admin' | 'propietario' | 'trabajador'

const RolContext = createContext<Rol | null>(null)

export function useRol() {
  const ctx = useContext(RolContext)
  if (!ctx) throw new Error('useRol must be used inside RolProvider')
  return ctx
}

export default function RolProvider({ rol, children }: { rol: Rol; children: React.ReactNode }) {
  return <RolContext.Provider value={rol}>{children}</RolContext.Provider>
}
