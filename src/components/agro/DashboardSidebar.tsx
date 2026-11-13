'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Ic, type NombreIcono } from '@/components/ui/icon'
import type { User } from '@supabase/supabase-js'
import { useFinca } from './FincaProvider'
import { useRol, useEsAdmin } from './RolProvider'
import NotificacionesPanel from './NotificacionesPanel'
import { ESPECIES_FINCA, nombreSeccion, type EspecieFinca } from '@/lib/especies'

interface Item { href: string; label: string; icon: NombreIcono }

const BASE_NAV_ITEMS: Item[] = [
  { href: '/dashboard', label: 'Resumen', icon: 'resumen' },
  { href: '/inventario', label: 'Inventario', icon: 'inventario' },
]

export default function DashboardSidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { fincas, fincaActual, setFincaActual, salirDeFinca } = useFinca()
  const rol = useRol()
  const esAdmin = useEsAdmin()
  // El administrador dentro de una finca ajena lo ve en el menú
  const fincaAjena = esAdmin && fincaActual != null && fincaActual.propietario_id !== user.id
  // En celular el menú es un cajón que se abre con el botón de arriba; en computador siempre está visible
  const [abierto, setAbierto] = useState(false)

  const especiesFinca = (fincaActual?.tipo_produccion ?? []) as EspecieFinca[]
  // El administrador fuera de una finca solo tiene su Resumen de fincas
  const navItems: Item[] = esAdmin && !fincaActual ? [{ href: '/dashboard', label: 'Resumen de fincas', icon: 'admin' }] : [
    ...BASE_NAV_ITEMS,
    ...(rol !== 'trabajador' ? [{ href: '/finanzas', label: 'Finanzas', icon: 'dinero' as const }] : []),
    ...(rol !== 'trabajador' && especiesFinca.length > 0 ? [{ href: '/reportes', label: fincaActual?.sin_registro_ventas ? 'Análisis de producción' : 'Reportes', icon: 'grafica' as const }] : []),
    ...(especiesFinca.length > 0 ? [{ href: '/alimento', label: 'Alimento', icon: 'alimento' as const }] : []),
    ...ESPECIES_FINCA
      .filter(esp => especiesFinca.includes(esp.value))
      // Con una sola especie el menú dice el lugar ("Galpones", "Naves"):
      // nombrar la especie sobra cuando la finca solo trabaja esa.
      .map(esp => ({ href: esp.href, icon: esp.icon, label: nombreSeccion(esp.value, fincaActual?.tipo_produccion) })),
    // Huevos y ventas son de la finca entera, no de un galpón: van debajo de Galpones
    ...(especiesFinca.includes('aves_ponedoras')
      ? [
          { href: '/huevos', label: 'Huevos de la finca', icon: 'huevo' as const },
          { href: '/calendario', label: 'Calendario sanitario', icon: 'calendario' as const },
          ...(rol !== 'trabajador' ? [{ href: '/ventas', label: 'Ventas de la finca', icon: 'recibo' as const }] : []),
        ]
      : []),
    // La historia de la cría (servicios, partos, destetes y lechones) va debajo de Naves
    ...(especiesFinca.includes('cerdos') ? [{ href: '/historial', label: 'Historial', icon: 'agenda' as const }] : []),
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
    <>
      {/* Celular: barra superior con el botón del menú */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-black/5 bg-sidebar px-3 md:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex size-9 items-center justify-center rounded-lg text-gray-700 hover:bg-white"
        >
          <Menu className="size-5" />
        </button>
        <span className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-green-600 text-white">
            <Ic n="hoja" className="size-3.5" strokeWidth={2} />
          </span>
          <span className="font-heading text-lg font-medium tracking-tight text-gray-900">AgroGestión</span>
        </span>
        {fincaActual && <span className="ml-auto truncate text-xs text-gray-500">{fincaActual.nombre}</span>}
      </header>

      {/* Fondo oscuro que cierra el menú del celular */}
      {abierto && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setAbierto(false)} aria-hidden />
      )}

      <aside className={cn(
        'flex w-60 shrink-0 flex-col bg-sidebar',
        'fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:translate-x-0',
        abierto ? 'translate-x-0 shadow-xl' : '-translate-x-full',
      )}>
      {/* Marca */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-green-600 text-white">
            <Ic n="hoja" className="size-4" strokeWidth={2} />
          </span>
          <span className="font-heading text-[1.35rem] font-medium tracking-tight text-gray-900">
            AgroGestión
          </span>
        </Link>
        <NotificacionesPanel />
      </div>

      {esAdmin && !fincaActual && (
        <div className="superficie mx-3 mb-4 rounded-xl px-3 py-2.5">
          <p className="flex items-center gap-1 text-[0.6875rem] font-medium text-gray-500"><Ic n="admin" className="size-3" /> Administrador de fincas</p>
          <p className="text-sm font-medium text-gray-800">{fincas.length} {fincas.length === 1 ? 'finca' : 'fincas'} a cargo</p>
        </div>
      )}

      {esAdmin && fincaActual && (
        <button
          type="button"
          onClick={() => { salirDeFinca(); setAbierto(false); router.push('/dashboard') }}
          className="mx-3 mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-green-800 hover:bg-white"
        >
          <Ic n="flecha" className="size-3.5 rotate-180" /> Todas mis fincas
        </button>
      )}

      {fincaActual && (
        <div className={cn('superficie mx-3 mb-4 rounded-xl px-3 py-2.5', fincaAjena && 'ring-1 ring-amber-300')}>
          <p className="text-[0.6875rem] font-medium text-gray-500">Finca</p>
          {fincas.length > 1 ? (
            <select
              value={fincaActual.id}
              onChange={e => {
                const f = fincas.find(x => x.id === e.target.value)
                if (f) { setFincaActual(f); setAbierto(false) }
              }}
              aria-label="Cambiar de finca"
              className="-ml-1 w-full truncate rounded-md bg-transparent py-0.5 text-sm font-medium text-gray-800 outline-none hover:bg-white"
            >
              {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          ) : (
            <p className="truncate text-sm font-medium text-gray-800">{fincaActual.nombre}</p>
          )}
          {fincaAjena && (
            <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-amber-700">
              <Ic n="admin" className="size-3" /> Entraste como administrador
            </p>
          )}
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
              onClick={() => setAbierto(false)}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.875rem] font-medium transition-colors',
                activo
                  ? 'bg-green-700 text-white shadow-[0_6px_16px_-8px_rgb(42_93_34/60%)]'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              )}
            >
              <Ic
                n={item.icon}
                className={cn('size-[18px] transition-colors', activo ? 'text-white' : 'text-gray-400 group-hover:text-green-700')}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Usuario */}
      <div className="p-3">
        <div className="superficie flex items-center gap-3 rounded-xl px-2.5 py-2">
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
    </>
  )
}
