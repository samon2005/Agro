'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { dbGenerico } from '@/lib/especiesConfig'
import { ROLES_ASIGNABLES, NOMBRE_ROL, type RolAsignable } from '@/lib/roles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Ic } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

type Codigo = {
  id: string
  codigo: string
  rol: RolAsignable
  vence: string | null
  usos_max: number | null
  usos: number
  activa: boolean
  created_at: string
}

const VIGENCIAS = [
  { d: 1, t: '1 día' },
  { d: 7, t: '7 días' },
  { d: 30, t: '30 días' },
  { d: 0, t: 'Sin vencer' },
]

function estado(c: Codigo): { t: string; ok: boolean } {
  if (!c.activa) return { t: 'Pausado', ok: false }
  if (c.vence && new Date(c.vence) < new Date()) return { t: 'Vencido', ok: false }
  if (c.usos_max != null && c.usos >= c.usos_max) return { t: 'Usado', ok: false }
  return { t: 'Sirve', ok: true }
}

/**
 * Códigos para entrar a la finca: el administrador crea uno por rol, se lo dicta
 * o lo manda a la persona, y ella lo escribe al crear su cuenta (o en "Tengo un
 * código"). La base valida todo (usar_codigo_finca, migración 085).
 */
export default function CodigosFinca({ fincaId }: { fincaId: string }) {
  const [codigos, setCodigos] = useState<Codigo[]>([])
  const [rol, setRol] = useState<RolAsignable>('operario')
  const [dias, setDias] = useState(7)
  const [usos, setUsos] = useState('')
  const [creando, setCreando] = useState(false)

  // Cambia para volver a leer la lista después de crear o pausar
  const [version, setVersion] = useState(0)
  const cargar = () => setVersion(v => v + 1)

  useEffect(() => {
    let vigente = true
    dbGenerico(createClient())
      .from('invitaciones_finca')
      .select('id, codigo, rol, vence, usos_max, usos, activa, created_at')
      .eq('finca_id', fincaId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (vigente) setCodigos((data ?? []) as Codigo[]) })
    return () => { vigente = false }
  }, [fincaId, version])

  async function crear() {
    setCreando(true)
    const { data, error } = await dbGenerico(createClient()).rpc('crear_codigo_finca', {
      p_finca: fincaId,
      p_rol: rol,
      p_dias: dias || null,
      p_usos: usos ? Number(usos) : null,
    })
    setCreando(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Código ${data} creado`)
    copiar(String(data))
    cargar()
  }

  async function pausar(c: Codigo) {
    const { error } = await dbGenerico(createClient()).from('invitaciones_finca').update({ activa: !c.activa }).eq('id', c.id)
    if (error) { toast.error(error.message); return }
    cargar()
  }

  function copiar(codigo: string) {
    navigator.clipboard?.writeText(codigo).then(() => toast.success('Código copiado'), () => {})
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Códigos para entrar a la finca</CardTitle>
        <p className="text-sm text-gray-500">
          La persona crea su propia cuenta y escribe el código: entra a esta finca con el rol del código. Así nadie pasa contraseñas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-600">Rol</span>
            <select value={rol} onChange={e => setRol(e.target.value as RolAsignable)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
              {ROLES_ASIGNABLES.map(r => <option key={r.v} value={r.v}>{r.t}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-600">Vence en</span>
            <select value={dias} onChange={e => setDias(Number(e.target.value))}
              className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
              {VIGENCIAS.map(v => <option key={v.d} value={v.d}>{v.t}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-600">Cuántas personas</span>
            <input type="number" min={1} value={usos} onChange={e => setUsos(e.target.value)} placeholder="Sin límite"
              className="h-9 w-28 rounded-lg border border-gray-200 bg-white px-2 text-sm" />
          </label>
          <Button onClick={crear} disabled={creando} className="bg-green-700 text-white hover:bg-green-800">
            {creando ? 'Creando…' : 'Crear código'}
          </Button>
        </div>
        <p className="text-xs text-gray-500">{ROLES_ASIGNABLES.find(r => r.v === rol)?.d}</p>

        {codigos.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {codigos.map(c => {
              const e = estado(c)
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <button onClick={() => copiar(c.codigo)} title="Copiar"
                    className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono font-semibold tracking-wider',
                      e.ok ? 'bg-green-50 text-green-900 hover:bg-green-100' : 'bg-gray-50 text-gray-400 line-through')}>
                    {c.codigo} <Ic n="enlace" className="size-3.5" />
                  </button>
                  <span className="text-gray-700">{NOMBRE_ROL[c.rol]}</span>
                  <span className="text-gray-500">
                    {c.usos}{c.usos_max != null ? ` de ${c.usos_max}` : ''} {c.usos === 1 ? 'persona' : 'personas'}
                    {c.vence ? ` · vence ${new Date(c.vence).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : ' · no vence'}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', e.ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>{e.t}</span>
                  {(c.activa ? e.ok : true) && (
                    <button onClick={() => pausar(c)} className="ml-auto text-xs text-gray-500 hover:text-gray-800">
                      {c.activa ? 'Pausar' : 'Activar'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
