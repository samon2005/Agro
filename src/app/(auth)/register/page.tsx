'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registrarCuenta } from '@/lib/supabase/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-4xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold text-green-900">AgroGestión</h1>
          <p className="text-green-700 mt-1">Crea tu cuenta gratuita</p>
        </div>

        <Card className="border-green-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-green-900">Registro</CardTitle>
            <CardDescription>Completa los datos para comenzar a gestionar tu finca</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                  Nombre Completo
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="border-green-200 focus:border-green-500"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Correo Electrónico
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-green-200 focus:border-green-500"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="border-green-200 focus:border-green-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-800 text-white"
                disabled={loading}
              >
                {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-600 mt-4">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-green-700 font-medium hover:underline">
                Ingresa aquí
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
