'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useFinca } from '@/components/agro/FincaProvider'
import { useEsAdmin } from '@/components/agro/RolProvider'

/**
 * El administrador sin finca elegida solo tiene su Resumen de fincas: cualquier
 * otra sección necesita una finca, así que lo devuelve al Resumen.
 */
export default function GuardiaAdmin() {
  const esAdmin = useEsAdmin()
  const { fincaActual, loading } = useFinca()
  const pathname = usePathname()
  const router = useRouter()
  useEffect(() => {
    if (esAdmin && !loading && !fincaActual && pathname !== '/dashboard') router.replace('/dashboard')
  }, [esAdmin, loading, fincaActual, pathname, router])
  return null
}
