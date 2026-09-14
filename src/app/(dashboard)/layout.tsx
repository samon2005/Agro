import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardSidebar from '@/components/agro/DashboardSidebar'
import FincaProvider from '@/components/agro/FincaProvider'
import RolProvider from '@/components/agro/RolProvider'
import PaginaEntra from '@/components/agro/PaginaEntra'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const rol = (profile?.rol ?? 'propietario') as 'admin' | 'propietario' | 'trabajador'

  return (
    <RolProvider rol={rol}>
      <FincaProvider>
        <div className="flex h-screen bg-background">
          <DashboardSidebar user={user} />
          <main className="flex-1 overflow-auto">
            <PaginaEntra>{children}</PaginaEntra>
          </main>
        </div>
      </FincaProvider>
    </RolProvider>
  )
}
