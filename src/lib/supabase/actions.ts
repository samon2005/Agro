'use server'

import { createClient } from './server'
import { createAdminClient } from './admin'
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

  const tipoProduccion = formData.getAll('tipo_produccion') as string[]

  const { error } = await supabase.from('fincas').insert({
    nombre: formData.get('nombre') as string,
    municipio: formData.get('municipio') as string,
    departamento: formData.get('departamento') as string,
    hectareas: formData.get('hectareas') ? Number(formData.get('hectareas')) : null,
    tipo_produccion: tipoProduccion.length > 0 ? tipoProduccion : null,
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

function generarPasswordTemporal() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pass = ''
  for (let i = 0; i < 10; i++) pass += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  return pass
}

export async function invitarOperario(formData: FormData, fincaId: string) {
  await verificarPropietario(fincaId)

  const fullName = formData.get('full_name') as string
  const email = formData.get('email') as string
  const cargo = formData.get('cargo') as string

  if (!fullName?.trim() || !email?.trim()) throw new Error('Nombre y correo son requeridos')

  const admin = createAdminClient()
  const password = generarPasswordTemporal()

  const { data: nuevoUsuario, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim() },
  })
  if (createError) throw new Error(createError.message)

  const operarioId = nuevoUsuario.user.id

  const { error: profileError } = await admin
    .from('profiles')
    .update({ rol: 'trabajador', cargo: cargo?.trim() || null })
    .eq('id', operarioId)
  if (profileError) throw new Error(profileError.message)

  const { error: miembroError } = await admin
    .from('finca_miembros')
    .insert({ finca_id: fincaId, perfil_id: operarioId, rol: 'trabajador' })
  if (miembroError) throw new Error(miembroError.message)

  revalidatePath('/operarios')
  return { email: email.trim(), password }
}

async function verificarPropietario(fincaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: membresia } = await supabase
    .from('finca_miembros')
    .select('rol')
    .eq('finca_id', fincaId)
    .eq('perfil_id', user.id)
    .maybeSingle()
  if (!membresia || membresia.rol !== 'propietario') throw new Error('No autorizado')
}

export async function getOperarios(fincaId: string) {
  await verificarPropietario(fincaId)
  const admin = createAdminClient()
  const { data: miembros } = await admin
    .from('finca_miembros')
    .select('perfil_id')
    .eq('finca_id', fincaId)
    .eq('rol', 'trabajador')

  const ids = (miembros ?? []).map(m => m.perfil_id)
  if (ids.length === 0) return []

  const { data: perfiles } = await admin
    .from('profiles')
    .select('id, full_name, cargo, activo')
    .in('id', ids)

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map(authUsers.users.map(u => [u.id, u.email]))

  return (perfiles ?? []).map(p => ({ ...p, email: emailById.get(p.id) ?? null }))
}

export async function actualizarEstadoOperario(fincaId: string, operarioId: string, activo: boolean) {
  await verificarPropietario(fincaId)
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ activo }).eq('id', operarioId)
  if (error) throw new Error(error.message)
  revalidatePath('/operarios')
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
