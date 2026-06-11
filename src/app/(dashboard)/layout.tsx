import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardSidebar from '@/components/agro/DashboardSidebar'
import FincaProvider from '@/components/agro/FincaProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <FincaProvider>
      <div className="flex h-screen bg-gray-50">
        <DashboardSidebar user={user} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </FincaProvider>
  )
}
