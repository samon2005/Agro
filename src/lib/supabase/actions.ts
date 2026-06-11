'use server'

import { createClient } from './server'
import { revalidatePath } from 'next/cache'

export async function getFincas() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('fincas')
    .select('*')
    .order('created_at', { ascending: true })

  return data ?? []
}

export async function crearFinca(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.from('fincas').insert({
    nombre: formData.get('nombre') as string,
    municipio: formData.get('municipio') as string,
    departamento: formData.get('departamento') as string,
    hectareas: formData.get('hectareas') ? Number(formData.get('hectareas')) : null,
    propietario_id: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function getEspecies() {
  const supabase = await createClient()
  const { data } = await supabase.from('especies').select('*').order('nombre')
  return data ?? []
}

export async function getRazasByEspecie(especieId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('razas')
    .select('*')
    .eq('especie_id', especieId)
    .order('nombre')
  return data ?? []
}

export async function getAnimales(fincaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('animales')
    .select(`*, especies(nombre), razas(nombre)`)
    .eq('finca_id', fincaId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function registrarAnimal(formData: FormData, fincaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.from('animales').insert({
    finca_id: fincaId,
    especie_id: formData.get('especie_id') as string || null,
    raza_id: formData.get('raza_id') as string || null,
    numero_arete: formData.get('numero_arete') as string || null,
    nombre: formData.get('nombre') as string || null,
    sexo: formData.get('sexo') as string || null,
    fecha_nacimiento: formData.get('fecha_nacimiento') as string || null,
    peso_actual: formData.get('peso_actual') ? Number(formData.get('peso_actual')) : null,
    estado: 'activo',
  })

  if (error) throw new Error(error.message)
  revalidatePath('/animales')
}

export async function getInventario(fincaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('inventario')
    .select(`*, inventario_categorias(nombre, color)`)
    .eq('finca_id', fincaId)
    .order('nombre')
  return data ?? []
}

export async function getCategorias(fincaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('inventario_categorias')
    .select('*')
    .eq('finca_id', fincaId)
    .order('nombre')
  return data ?? []
}

export async function registrarItemInventario(formData: FormData, fincaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.from('inventario').insert({
    finca_id: fincaId,
    categoria_id: formData.get('categoria_id') as string || null,
    nombre: formData.get('nombre') as string,
    descripcion: formData.get('descripcion') as string || null,
    unidad_medida: formData.get('unidad_medida') as string || null,
    cantidad_actual: Number(formData.get('cantidad_actual') ?? 0),
    cantidad_minima: Number(formData.get('cantidad_minima') ?? 0),
    precio_unitario: formData.get('precio_unitario') ? Number(formData.get('precio_unitario')) : null,
    proveedor: formData.get('proveedor') as string || null,
    fecha_vencimiento: formData.get('fecha_vencimiento') as string || null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/inventario')
}

export async function registrarMovimiento(inventarioId: string, tipo: 'entrada' | 'salida' | 'ajuste', cantidad: number, motivo: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.from('movimientos_inventario').insert({
    inventario_id: inventarioId,
    tipo,
    cantidad,
    motivo,
    usuario_id: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/inventario')
}
