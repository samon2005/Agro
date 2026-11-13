'use client'

import { Widget, ANCHO } from '@/components/ui/widgets/Widget'
import { Cifra } from '@/components/ui/widgets/Medidores'
import { Button } from '@/components/ui/button'
import { Ic } from '@/components/ui/icon'
import { TAMANOS_HUEVO } from '@/lib/huevos'
import { semanaDeVida } from '@/lib/referencias'
import type { Database } from '@/types/database'

type ProduccionDiaria = Database['public']['Tables']['produccion_diaria_aves']['Row']
type EventoClinico = Database['public']['Tables']['eventos_clinicos_aves']['Row']

const mil = (v: number) => v.toLocaleString('es-CO')
const n1 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })

/**
 * Todo lo de un día del galpón: lo registrado (aves, huevos por tamaño, postura,
 * alimento, muertes, notas) y los eventos clínicos. Si el día no tiene registro
 * lo dice y deja registrarlo ahí mismo, para cargar días atrás.
 */
export default function DiaDelGalpon({
  fecha, esHoy, registro, eventos, consumoQueRegia, enPostura, fechaNacimiento, fechaEntrada, avesActuales, onRegistrar, onEditar, bloqueo,
}: {
  fecha: string
  esHoy: boolean
  registro: ProduccionDiaria | undefined
  eventos: EventoClinico[]
  /** El consumo que regía ese día aunque no tenga registro propio */
  consumoQueRegia: number | null
  enPostura: boolean
  fechaNacimiento: string | null
  fechaEntrada: string
  avesActuales: number
  onRegistrar: () => void
  onEditar: () => void
  /** Por qué todavía no se puede registrar (sin alimento del galpón), o null */
  bloqueo: string | null
}) {
  const largo = new Date(fecha + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const semana = semanaDeVida(fechaNacimiento, fecha)
  const diaGalpon = Math.floor((new Date(fecha + 'T00:00:00').getTime() - new Date(fechaEntrada + 'T00:00:00').getTime()) / 86_400_000) + 1
  const antesDeEntrar = fecha < fechaEntrada
  const postura = registro && registro.aves_en_dia && registro.aves_en_dia > 0 ? (registro.huevos_totales / registro.aves_en_dia) * 100 : null
  const tamanos = registro ? TAMANOS_HUEVO.map(t => ({ ...t, v: registro[`huevos_${t.key}` as const] ?? 0 })).filter(t => t.v > 0) : []
  const malos = registro ? [
    { t: 'Rotos', v: registro.huevos_rotos }, { t: 'Sucios', v: registro.huevos_sucios }, { t: 'Deformes', v: registro.huevos_deformes },
  ].filter(x => x.v > 0) : []

  return (
    <Widget className={ANCHO.todo} titulo={esHoy ? 'Lo de hoy' : 'Lo de ese día'} icono="calendario"
      info="Todo lo que se registró ese día en el galpón. Cambia de día con las flechas de arriba o tocando el calendario"
      accion={registro
        ? <Button size="sm" variant="outline" onClick={onEditar}><Ic n="editar" /> Editar este día</Button>
        : <Button size="sm" onClick={onRegistrar} disabled={antesDeEntrar || bloqueo != null}
            title={antesDeEntrar ? 'Primero cambia la fecha de entrada en Configurar galpón' : bloqueo ?? undefined}><Ic n="mas" /> Registrar este día</Button>}>
      <p className="mb-3 text-sm text-gray-600 first-letter:uppercase">
        {largo}
        {semana != null && semana > 0 && <span className="text-gray-400"> · semana {semana} de vida</span>}
        {!antesDeEntrar && <span className="text-gray-400"> · día {mil(diaGalpon)} en el galpón</span>}
      </p>

      {antesDeEntrar && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Este día es de antes de que el lote entrara al galpón. Para registrarlo, cambia primero la fecha de entrada en Configurar galpón.
        </p>
      )}

      {registro ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Cifra etiqueta="Aves ese día" valor={registro.aves_en_dia != null ? mil(registro.aves_en_dia) : '—'} />
            {enPostura && <Cifra etiqueta="Huevos" valor={mil(registro.huevos_totales)} />}
            {enPostura && <Cifra etiqueta="Postura" valor={postura != null ? `${n1(postura)} %` : '—'} />}
            <Cifra etiqueta="Alimento" valor={`${n1(Number(registro.alimento_kg) || consumoQueRegia || 0)} kg`}
              nota={!Number(registro.alimento_kg) && consumoQueRegia ? 'el consumo que venía' : registro.aves_en_dia ? `${Math.round(((Number(registro.alimento_kg) || 0) * 1000) / registro.aves_en_dia)} g por ave` : undefined} />
            <Cifra etiqueta="Muertes" valor={mil(registro.muertes)} nota={registro.muertes > 0 ? registro.causa_muerte ?? 'Sin causa' : undefined} />
          </div>
          {enPostura && (tamanos.length > 0 || malos.length > 0) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {tamanos.map(t => <span key={t.key} className="rounded-full bg-green-50 px-2.5 py-1 text-green-900">{t.label}: <strong>{mil(t.v)}</strong></span>)}
              {malos.map(m => <span key={m.t} className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900">{m.t}: <strong>{mil(m.v)}</strong></span>)}
            </div>
          )}
          {registro.observaciones && <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"><Ic n="manual" className="mr-1 text-gray-400" />{registro.observaciones}</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
          <p className="text-sm font-medium text-gray-700">{esHoy ? 'Todavía no se registra hoy' : 'Ese día no tiene registro'}</p>
          <p className="mt-1 text-xs text-gray-400">
            {consumoQueRegia ? `El consumo que regía era de ${n1(consumoQueRegia)} kg al día. ` : ''}
            Al registrarlo, pon las aves que había ese día (hoy hay {mil(avesActuales)}).
          </p>
        </div>
      )}

      {eventos.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500">Eventos clínicos de ese día</p>
          {eventos.map(ev => (
            <div key={ev.id} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
              <strong className="capitalize">{ev.tipo_evento}</strong>{ev.causa ? ` · ${ev.causa}` : ''}
              {(ev.aves_afectadas || ev.aves_muertas) ? <span className="text-red-700"> · {ev.aves_afectadas ? `${mil(ev.aves_afectadas)} afectadas` : ''}{ev.aves_afectadas && ev.aves_muertas ? ', ' : ''}{ev.aves_muertas ? `${mil(ev.aves_muertas)} muertas` : ''}</span> : null}
              {ev.descripcion && <p className="text-xs text-red-800/80">{ev.descripcion}</p>}
              {ev.accion_tomada && <p className="text-xs text-red-800/80">Se hizo: {ev.accion_tomada}</p>}
            </div>
          ))}
        </div>
      )}
    </Widget>
  )
}
