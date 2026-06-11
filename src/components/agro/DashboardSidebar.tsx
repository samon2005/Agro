'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import type { User } from '@supabase/supabase-js'

const navItems = [
  { href: '/dashboard', label: 'Resumen', icon: '📊' },
  { href: '/animales', label: 'Animales', icon: '🐄' },
  { href: '/inventario', label: 'Inventario', icon: '📦' },
  { href: '/produccion', label: 'Producción', icon: '🥛' },
  { href: '/aves-ponedoras', label: 'Aves Ponedoras', icon: '🐔' },
  { href: '/cerdos', label: 'Cerdos', icon: '🐷' },
  { href: '/pollo-engorde', label: 'Pollo Engorde', icon: '🐥' },
]

export default function DashboardSidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = (user.user_metadata?.full_name as string)
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? user.email?.[0].toUpperCase() ?? 'U'

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <div>
            <h1 className="font-bold text-green-900 text-lg leading-tight">AgroGestión</h1>
            <p className="text-xs text-green-600">Zootecnia Colombia</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-green-100 text-green-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </div>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <Separator className="mb-4" />
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-green-100 text-green-800 text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {(user.user_metadata?.full_name as string) ?? 'Usuario'}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-gray-600 border-gray-200 hover:border-red-200 hover:text-red-600"
          onClick={handleLogout}
        >
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  )
}
