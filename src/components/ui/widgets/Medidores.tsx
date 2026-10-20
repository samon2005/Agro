import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Estados de un medidor: el color va siempre con su texto al lado */
export type EstadoMedidor = 'normal' | 'suave' | 'bien' | 'revisar' | 'mal' | 'vacio'

const COLOR: Record<EstadoMedidor, string> = {
  normal: '#2a5d22',
  suave: '#8cbd78',
  bien: '#418b30',
  revisar: '#d39b1f',
  mal: '#d0453b',
  vacio: '#c9cec5',
}
const PISTA = '#eef3ea'

/**
 * Un anillo de "cuánto de algo": la postura frente a la meta, la mortalidad
 * frente a la guía, los galpones ocupados. El arco lleno es el valor; la marca
 * (si la hay) es la meta. En el centro, el número grande.
 */
export function Anillo({ pct, centro, sub, tamano = 112, grosor = 10, estado = 'normal', marca }: {
  /** 0 a 100 (se recorta a ese rango para dibujar) */
  pct: number | null
  centro: ReactNode
  sub?: ReactNode
  tamano?: number
  grosor?: number
  estado?: EstadoMedidor
  /** % donde va la meta, dibujada como una rayita sobre la pista */
  marca?: number | null
}) {
  const r = (tamano - grosor) / 2
  const c = 2 * Math.PI * r
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  const ang = marca != null ? (Math.max(0, Math.min(100, marca)) / 100) * 2 * Math.PI - Math.PI / 2 : null
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={PISTA} strokeWidth={grosor} />
        {p > 0 && (
          <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={COLOR[pct == null ? 'vacio' : estado]} strokeWidth={grosor}
            strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} />
        )}
      </svg>
      {ang != null && (
        <span className="absolute h-[3px] rounded-full bg-gray-800"
          style={{
            width: grosor + 6,
            left: tamano / 2 + Math.cos(ang) * r - (grosor + 6) / 2,
            top: tamano / 2 + Math.sin(ang) * r - 1.5,
            transform: `rotate(${(ang * 180) / Math.PI}deg)`,
          }} />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={cn('leading-none font-semibold tracking-tight text-gray-900 tabular-nums', tamano >= 100 ? 'text-xl' : 'text-base')}>{centro}</span>
        {sub && <span className="mt-1 text-[0.625rem] leading-tight text-gray-400">{sub}</span>}
      </div>
    </div>
  )
}

/**
 * Una barra de progreso con su rótulo y su valor: días de alimento que
 * quedan, semana del ciclo, densidad frente a la recomendada.
 */
export function BarraMeta({ etiqueta, valor, pct, estado = 'normal', marca, nota }: {
  etiqueta: ReactNode
  valor: ReactNode
  pct: number | null
  estado?: EstadoMedidor
  marca?: number | null
  nota?: ReactNode
}) {
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-gray-500">{etiqueta}</span>
        <span className="shrink-0 font-semibold text-gray-900 tabular-nums">{valor}</span>
      </div>
      <div className="relative h-2 rounded-full" style={{ background: PISTA }}>
        <div className="h-2 rounded-full" style={{ width: `${p}%`, background: COLOR[pct == null ? 'vacio' : estado] }} />
        {marca != null && <span className="absolute -top-1 h-4 w-[3px] rounded-full bg-gray-800" style={{ left: `calc(${Math.max(0, Math.min(100, marca))}% - 1.5px)` }} />}
      </div>
      {nota && <p className="mt-1 text-[0.6875rem] text-gray-400">{nota}</p>}
    </div>
  )
}

/** El texto que acompaña a un estado: "Bien", "Revisar", "Bajo la meta" */
export function TextoEstado({ estado, children }: { estado: EstadoMedidor; children: ReactNode }) {
  const t = { normal: 'text-gray-500', suave: 'text-gray-500', bien: 'text-green-700', revisar: 'text-amber-700', mal: 'text-red-600', vacio: 'text-gray-400' }[estado]
  const punto = { normal: 'bg-green-700', suave: 'bg-green-400', bien: 'bg-green-600', revisar: 'bg-amber-500', mal: 'bg-red-500', vacio: 'bg-gray-300' }[estado]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[0.6875rem] font-medium', t)}>
      <span className={cn('size-1.5 rounded-full', punto)} />{children}
    </span>
  )
}

/** Un número grande con su rótulo y, opcional, su cambio en pastilla */
export function Cifra({ etiqueta, valor, cambio, nota, grande }: {
  etiqueta: ReactNode
  valor: ReactNode
  cambio?: { texto: string; bueno: boolean | null } | null
  nota?: ReactNode
  grande?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-gray-500">{etiqueta}</p>
      <p className={cn('mt-1 leading-tight font-semibold tracking-tight whitespace-nowrap text-gray-900 tabular-nums', grande ? 'text-[1.75rem]' : 'text-lg')}>{valor}</p>
      {(cambio || nota) && (
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-gray-400">
          {cambio && (
            <span className={cn('rounded-full px-1.5 py-0.5 font-semibold',
              cambio.bueno == null ? 'bg-gray-100 text-gray-500' : cambio.bueno ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
              {cambio.texto}
            </span>
          )}
          {nota}
        </p>
      )}
    </div>
  )
}

/**
 * Los últimos días en barritas: las viejas más claras, la última más oscura.
 * Cada barra dice su valor al pasar el cursor.
 */
export function MiniBarras({ valores, etiquetas, alto = 48, formato = v => v.toLocaleString('es-CO') }: {
  valores: (number | null)[]
  etiquetas?: string[]
  alto?: number
  formato?: (v: number) => string
}) {
  const max = Math.max(1, ...valores.map(v => v ?? 0))
  const n = valores.length
  const tonos = ['#d9ead0', '#b6d6a6', '#8cbd78', '#62a24c', '#418b30', '#2a5d22']
  return (
    <div className="flex items-end gap-1" style={{ height: alto }}>
      {valores.map((v, i) => {
        const tono = tonos[Math.round((i / Math.max(1, n - 1)) * (tonos.length - 1))]
        return (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={`${etiquetas?.[i] ?? ''}${etiquetas?.[i] ? ': ' : ''}${v == null ? 'sin registro' : formato(v)}`}>
            <div className="w-full rounded-t-[5px] rounded-b-[2px] transition-opacity group-hover:opacity-80"
              style={{ height: v == null || v <= 0 ? 3 : `${Math.max(6, (v / max) * 100)}%`, background: v == null || v <= 0 ? '#eef3ea' : tono }} />
          </div>
        )
      })}
    </div>
  )
}
