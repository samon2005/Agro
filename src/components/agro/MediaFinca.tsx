'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Clips libres de Pexels (licencia Pexels: uso libre, sin atribución obligatoria).
 * Se reproducen en silencio, uno tras otro, con fundido entre ellos. Solo se
 * carga el que suena y el que viene, para no bajar 40 MB al abrir el login.
 */
const CLIPS = [
  {
    src: 'https://videos.pexels.com/video-files/9026085/9026085-hd_1920_1080_30fps.mp4',
    poster: 'https://images.pexels.com/videos/9026085/pexels-photo-9026085.jpeg?auto=compress&w=1400',
    alt: 'Gallinas y un gallo pastando al sol',
  },
  {
    src: 'https://videos.pexels.com/video-files/13693035/13693035-sd_960_540_25fps.mp4',
    poster: 'https://images.pexels.com/videos/13693035/pexels-photo-13693035.jpeg?auto=compress&w=1400',
    alt: 'Cerdos en un corral con heno',
  },
  {
    src: 'https://videos.pexels.com/video-files/28647429/12442016_1920_1080_30fps.mp4',
    poster: 'https://images.pexels.com/videos/28647429/chicken-pen-chickens-farm-animals-field-28647429.jpeg?auto=compress&w=1400',
    alt: 'Gallinas en un corral de finca',
  },
]

/** Cuántos segundos de cada clip se ven antes de pasar al siguiente. */
const SEGUNDOS_POR_CLIP = 9

export default function MediaFinca({ className }: { className?: string }) {
  const [activo, setActivo] = useState(0)
  const [listo, setListo] = useState<boolean[]>(() => CLIPS.map(() => false))
  const timer = useRef<number | null>(null)

  // Al montar y en cada cambio, el clip activo arranca desde cero y programa el siguiente
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setActivo(a => (a + 1) % CLIPS.length), SEGUNDOS_POR_CLIP * 1000)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [activo])

  const siguiente = (activo + 1) % CLIPS.length

  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-green-950', className)} aria-hidden>
      {CLIPS.map((clip, i) => {
        const esActivo = i === activo
        const esSiguiente = i === siguiente
        if (!esActivo && !esSiguiente) return null
        return (
          <video
            key={clip.src}
            src={clip.src}
            poster={clip.poster}
            muted
            playsInline
            autoPlay={esActivo}
            loop
            preload={esActivo ? 'auto' : 'metadata'}
            onCanPlay={() => setListo(l => (l[i] ? l : l.map((v, k) => (k === i ? true : v))))}
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              esActivo && listo[i] ? 'opacity-100' : 'opacity-0'
            )}
          />
        )
      })}

      {/* Mientras carga el primero, la foto de portada evita el negro */}
      <img
        src={CLIPS[activo].poster}
        alt=""
        className={cn(
          'absolute inset-0 size-full object-cover transition-opacity duration-700',
          listo[activo] ? 'opacity-0' : 'opacity-100'
        )}
      />

      {/* Velo para que el texto encima se lea, más oscuro abajo donde va el titular */}
      <div className="absolute inset-0 bg-gradient-to-b from-green-950/55 via-green-950/35 to-green-950/85" />
      <div className="absolute inset-0 bg-green-900/20 mix-blend-multiply" />

      {/* Puntos de progreso */}
      <div className="absolute right-12 bottom-12 flex gap-1.5">
        {CLIPS.map((_, i) => (
          <span
            key={i}
            className={cn('h-1 rounded-full bg-white transition-all duration-500', i === activo ? 'w-6 opacity-90' : 'w-1.5 opacity-40')}
          />
        ))}
      </div>
    </div>
  )
}
