'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ic } from '@/components/ui/icon'
import MediaFinca from '@/components/agro/MediaFinca'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Credenciales incorrectas. Intenta de nuevo.')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Lado de marca: un plano de color, tipografía grande y una frase */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-green-950 p-12 text-green-50 lg:flex">
        <MediaFinca />
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-green-50/10 ring-1 ring-green-50/20">
            <Ic n="hoja" className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="font-heading text-2xl font-medium tracking-tight">AgroGestión</span>
        </div>

        <div className="pagina-entra relative z-10 max-w-md">
          <h1 className="font-heading text-[2.75rem] leading-[1.05] font-medium tracking-tight text-white [text-shadow:0_2px_24px_rgb(0_0_0/35%)]">
            Lo que pasa en la finca, anotado el mismo día.
          </h1>
          <p className="mt-5 text-[0.9375rem] leading-relaxed text-green-100/80">
            Producción, alimento, sanidad y ventas de tus galpones y corrales, en un solo
            lugar y sin cuadernos.
          </p>
        </div>

        <p className="relative z-10 text-xs text-green-100/60">Hecho para fincas colombianas · video: Pexels</p>

      </aside>

      {/* Formulario */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="pagina-entra w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-green-700 text-white">
              <Ic n="hoja" className="size-4" strokeWidth={2} />
            </span>
            <span className="font-heading text-xl font-medium tracking-tight text-gray-900">AgroGestión</span>
          </div>

          <h2 className="text-3xl font-medium text-gray-900">Iniciar sesión</h2>
          <p className="mt-1.5 text-sm text-gray-500">Entra con el correo de tu cuenta.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">Correo electrónico</label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Contraseña</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="font-medium text-green-800 underline-offset-4 hover:underline">
              Regístrate
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
