'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinca } from '@/components/agro/FincaProvider'
import RegistrarAnimalModal from '@/components/agro/RegistrarAnimalModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Animal = {
  id: string
  numero_arete: string | null
  nombre: string | null
  sexo: string | null
  fecha_nacimiento: string | null
  peso_actual: number | null
  estado: string
  especies: { nombre: string } | null
  razas: { nombre: string } | null
}

export default function AnimalesPage() {
  const { fincaActual, loading: fincaLoading } = useFinca()
  const [animales, setAnimales] = useState<Animal[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  async function fetchAnimales() {
    if (!fincaActual) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('animales')
      .select('*, especies(nombre), razas(nombre)')
      .eq('finca_id', fincaActual.id)
      .order('created_at', { ascending: false })
    setAnimales(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAnimales() }, [fincaActual])

  const activos = animales.filter(a => a.estado === 'activo')
  const hembras = activos.filter(a => a.sexo === 'H')
  const machos = activos.filter(a => a.sexo === 'M')

  if (fincaLoading) return <PageSkeleton />

  return (
    <>
      <RegistrarAnimalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        fincaId={fincaActual?.id ?? ''}
        onCreated={fetchAnimales}
      />

      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>🐄</span> Gestión de Animales
            </h2>
            <p className="text-gray-500 mt-1">
              {fincaActual ? `Finca: ${fincaActual.nombre}` : 'Selecciona una finca'}
            </p>
          </div>
          <Button
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={() => setModalOpen(true)}
            disabled={!fincaActual}
          >
            + Registrar Animal
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-4 flex justify-between items-center">
              <span className="text-sm text-green-700 font-medium">Total Activos</span>
              <Badge className="bg-green-700 text-white">{activos.length}</Badge>
            </CardContent>
          </Card>
          <Card className="border-pink-200 bg-pink-50">
            <CardContent className="pt-4 pb-4 flex justify-between items-center">
              <span className="text-sm text-pink-700 font-medium">Hembras</span>
              <Badge className="bg-pink-600 text-white">{hembras.length}</Badge>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4 pb-4 flex justify-between items-center">
              <span className="text-sm text-blue-700 font-medium">Machos</span>
              <Badge className="bg-blue-600 text-white">{machos.length}</Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listado de Animales</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : animales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-5xl mb-4">🐄</span>
                <p className="text-lg font-semibold text-gray-700">No hay animales registrados</p>
                <p className="text-sm text-gray-400 mt-1 mb-6">Comienza registrando el primer animal de tu finca</p>
                <Button className="bg-green-700 hover:bg-green-800 text-white" onClick={() => setModalOpen(true)}>
                  Registrar Primer Animal
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arete</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Especie / Raza</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead>Peso (kg)</TableHead>
                    <TableHead>Nacimiento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {animales.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-sm">{a.numero_arete ?? '—'}</TableCell>
                      <TableCell className="font-medium">{a.nombre ?? '—'}</TableCell>
                      <TableCell>
                        <span className="text-gray-900">{a.especies?.nombre ?? '—'}</span>
                        {a.razas?.nombre && <span className="text-gray-400 text-xs block">{a.razas.nombre}</span>}
                      </TableCell>
                      <TableCell>
                        {a.sexo === 'H' ? <Badge variant="outline" className="text-pink-600 border-pink-300">Hembra</Badge>
                          : a.sexo === 'M' ? <Badge variant="outline" className="text-blue-600 border-blue-300">Macho</Badge>
                          : '—'}
                      </TableCell>
                      <TableCell>{a.peso_actual ? `${a.peso_actual} kg` : '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {a.fecha_nacimiento ? new Date(a.fecha_nacimiento).toLocaleDateString('es-CO') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          a.estado === 'activo' ? 'bg-green-100 text-green-800' :
                          a.estado === 'vendido' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {a.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function PageSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
