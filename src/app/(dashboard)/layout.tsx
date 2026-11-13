import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardSidebar from '@/components/agro/DashboardSidebar'
import FincaProvider from '@/components/agro/FincaProvider'
import RolProvider from '@/components/agro/RolProvider'
import PaginaEntra from '@/components/agro/PaginaEntra'
import ElegirEspecieFinca from '@/components/agro/ElegirEspecieFinca'
import GuardiaAdmin from '@/components/agro/admin/GuardiaAdmin'
import { dbGenerico } from '@/lib/especiesConfig'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const rol = (profile?.rol ?? 'propietario') as 'admin' | 'propietario' | 'trabajador'
  // El administrador de fincas se marca en la base (tabla administradores), no en el perfil
  const { data: esAdmin } = await dbGenerico(supabase).rpc('es_admin')

  return (
    <RolProvider rol={rol} esAdmin={esAdmin === true}>
      <FincaProvider>
        <div className="flex h-screen bg-background">
          <DashboardSidebar user={user} />
          {/* En celular deja lugar para la barra superior del menú */}
          <main className="flex-1 overflow-auto pt-14 md:pt-0">
            <PaginaEntra>{children}</PaginaEntra>
          </main>
          {/* La finca sin especie elige la suya antes de seguir */}
          <ElegirEspecieFinca />
          <GuardiaAdmin />
        </div>
      </FincaProvider>
    </RolProvider>
  )
}
