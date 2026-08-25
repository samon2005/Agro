'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Finca = {
  id: string
  nombre: string
  municipio: string | null
  departamento: string | null
  hectareas: number | null
  tipo_produccion: string[] | null
  altitud_msnm: number | null
  velocidad_viento_kmh: number | null
  clima_predominante: string | null
  temperatura_promedio_ext: number | null
  latitud: number | null
  longitud: number | null
}

type FincaContextType = {
  fincas: Finca[]
  fincaActual: Finca | null
  setFincaActual: (f: Finca) => void
  loading: boolean
  refetch: () => void
}

const FincaContext = createContext<FincaContextType | null>(null)

export function useFinca() {
  const ctx = useContext(FincaContext)
  if (!ctx) throw new Error('useFinca must be used inside FincaProvider')
  return ctx
}

export default function FincaProvider({ children }: { children: React.ReactNode }) {
  const [fincas, setFincas] = useState<Finca[]>([])
  const [fincaActual, setFincaActual] = useState<Finca | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchFincas() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('fincas')
      .select('*')
      .order('created_at', { ascending: true })

    const list = data ?? []
    setFincas(list)
    setFincaActual(prev => {
      if (!prev) return list[0] ?? null
      return list.find(f => f.id === prev.id) ?? prev
    })
    setLoading(false)
  }

  useEffect(() => { fetchFincas() }, [])

  return (
    <FincaContext.Provider value={{ fincas, fincaActual, setFincaActual, loading, refetch: fetchFincas }}>
      {children}
    </FincaContext.Provider>
  )
}
