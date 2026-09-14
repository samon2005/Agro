'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registrarCuenta } from '@/lib/supabase/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Ic } from '@/components/ui/icon'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const data = new FormData()
      data.set('full_name', fullName)
      data.set('email', email)
      data.set('password', password)
      await registrarCuenta(data)

      const supabase = createClient()
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) throw loginError

      toast.success('¡Cuenta creada!')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la cuenta')
    }
    setLoading(false)
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-green-900 p-12 text-green-50 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-green-50/10 ring-1 ring-green-50/20">
            <Ic n="hoja" className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="font-heading text-2xl font-medium tracking-tight">AgroGestión</span>
        </div>
        <div className="pagina-entra max-w-md">
          <h1 className="font-heading text-[2.75rem] leading-[1.05] font-medium tracking-tight text-white">
            Empieza con una finca. Crece con las que vengan.
          </h1>
          <p className="mt-5 text-[0.9375rem] leading-relaxed text-green-100/80">
            Crea tu cuenta, registra tu primera finca y elige con qué especies trabajas.
            Lo demás lo vas llenando día a día.
          </p>
        </div>
        <p className="text-xs text-green-100/50">Hecho para fincas colombianas</p>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 28px)' }}
        />
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="pagina-entra w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-green-700 text-white">
              <Ic n="hoja" className="size-4" strokeWidth={2} />
            </span>
            <span className="font-heading text-xl font-medium tracking-tight text-gray-900">AgroGestión</span>
          </div>

          <h2 className="text-3xl font-medium text-gray-900">Crear cuenta</h2>
          <p className="mt-1.5 text-sm text-gray-500">Toma un minuto. Después creas tu finca.</p>

          <form onSubmit={handleRegister} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-medium text-gray-700">Nombre completo</label>
              <Input id="fullName" type="text" placeholder="Juan Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">Correo electrónico</label>
              <Input id="email" type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Contraseña</label>
              <Input id="password" type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className="h-10" />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-green-800 underline-offset-4 hover:underline">
              Ingresa
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
