'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFinca } from './FincaProvider'
import { useRolFinca, useRolListo } from './RolProvider'
import { permisos, seccionDeRuta, NOMBRE_ROL } from '@/lib/roles'
import { Ic } from '@/components/ui/icon'

/**
 * Cada rol solo entra a las secciones de su trabajo (lib/roles). Si alguien abre
 * una página que no le toca (con un enlace o escribiendo la dirección), ve un
 * aviso en vez de la página.
 */
export default function GuardiaSeccion({ children }: { children: React.ReactNode }) {
  const ruta = usePathname()
  const { fincaActual } = useFinca()
  const rol = useRolFinca()
  const listo = useRolListo()
  const seccion = seccionDeRuta(ruta)

  if (!fincaActual || !seccion) return <>{children}</>
  if (!listo) return <div className="p-8"><div data-slot="skeleton" className="h-64 rounded-xl" /></div>
  if (permisos(rol).ve(seccion)) return <>{children}</>
  return (
    <div className="p-4 md:p-8">
      <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
        <p className="mb-2 text-4xl text-gray-400"><Ic n="bloqueado" /></p>
        <p className="font-medium text-gray-700">Esta sección no es parte de tu rol</p>
        <p className="mt-1 text-sm text-gray-500">Tu rol en {fincaActual.nombre}: {NOMBRE_ROL[rol]}. Si la necesitas, pídesela al administrador de la finca.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-green-800 hover:underline">Ir al Resumen</Link>
      </div>
    </div>
  )
}
