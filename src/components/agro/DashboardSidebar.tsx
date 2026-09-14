'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import type { User } from '@supabase/supabase-js'
import { useFinca } from './FincaProvider'
import { useRol } from './RolProvider'
import NotificacionesPanel from './NotificacionesPanel'
import { ESPECIES_FINCA, type EspecieFinca } from '@/lib/especies'

interface Item { href: string; label: string; icon: NombreIcono }

const BASE_NAV_ITEMS: Item[] = [
  { href: '/dashboard', label: 'Resumen', icon: 'resumen' },
  { href: '/inventario', label: 'Inventario', icon: 'inventario' },
]

export default function DashboardSidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { fincaActual } = useFinca()
  const rol = useRol()

  const especiesFinca = (fincaActual?.tipo_produccion ?? []) as EspecieFinca[]
  const navItems: Item[] = [
    ...BASE_NAV_ITEMS,
    ...(especiesFinca.length > 0 ? [{ href: '/alimento', label: 'Alimento', icon: 'alimento' as const }] : []),
    ...ESPECIES_FINCA
      .filter(esp => especiesFinca.includes(esp.value))
      .map(esp => ({ href: esp.href, icon: esp.icon, label: esp.labelNav ?? esp.label })),
    ...(rol !== 'trabajador' ? [{ href: '/operarios', label: 'Operarios', icon: 'operario' as const }] : []),
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nombre = (user.user_metadata?.full_name as string) ?? 'Usuario'
  const initials = nombre
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || (user.email?.[0].toUpperCase() ?? 'U')

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Marca */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-green-700 text-white">
            <Ic n="hoja" className="size-4" strokeWidth={2} />
          </span>
          <span className="font-heading text-[1.35rem] font-medium tracking-tight text-gray-900">
            AgroGestión
          </span>
        </Link>
        <NotificacionesPanel />
      </div>

      {fincaActual && (
        <div className="mx-4 mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-gray-400">Finca</p>
          <p className="truncate text-sm font-medium text-gray-800">{fincaActual.nombre}</p>
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map(item => {
          const activo = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.875rem] font-medium transition-colors',
                activo
                  ? 'bg-green-50 text-green-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              {/* Marca lateral del ítem activo */}
              <span
                aria-hidden
                className={cn(
                  'absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r bg-green-700 transition-opacity',
                  activo ? 'opacity-100' : 'opacity-0'
                )}
              />
              <Ic
                n={item.icon}
                className={cn('size-[18px] transition-colors', activo ? 'text-green-700' : 'text-gray-400 group-hover:text-gray-600')}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Usuario */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[0.6875rem] font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{nombre}</p>
            <p className="truncate text-xs text-gray-400">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Ic n="salir" className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
