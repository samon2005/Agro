import * as React from 'react'
import {
  Pencil, TriangleAlert, Trash2, Settings2, Egg, Thermometer, ClipboardList, Check, Wheat,
  Syringe, Coins, Radio, Droplet, Receipt, CircleCheck, Package, Bird, Leaf, Wind, Lightbulb,
  Scale, PenLine, SprayCan, MapPin, Siren, Pill, Clock, Target, Milk, HardHat, RefreshCw,
  Wrench, Stethoscope, Calendar, Beef, TrendingUp, Lock, ChartColumn, Sprout, X, Activity,
  Bone, Utensils, HeartPulse, Brain, PawPrint, CircleHelp, Repeat, Flame, Bell, Bot, Hospital,
  Skull, LockOpen, Plug, Smartphone, Microscope, Snowflake, Hand, Fan, Droplets, House, Ban,
  Mountain, Cloud, CloudSun, CalendarDays, Link, DollarSign, Plus, Search, Sun, Mail, Circle,
  CircleDot, Heart, LayoutDashboard, Boxes, Users, LogOut, Drumstick, Info, CircleAlert, ChevronRight,
  type LucideProps,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Lucide no trae cerdo: uno propio con el mismo trazo. */
function Pig({ className, strokeWidth = 1.75, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} {...props}
    >
      <path d="M4.5 9.5c-1.2-.6-2-1.9-2-3.3 0-.3.3-.5.6-.4 1.2.4 2.2 1.2 2.8 2.2" />
      <path d="M19.5 9.5c1.2-.6 2-1.9 2-3.3 0-.3-.3-.5-.6-.4-1.2.4-2.2 1.2-2.8 2.2" />
      <path d="M5.2 8.3C6.8 6.9 9.2 6 12 6s5.2.9 6.8 2.3c1.5 1.3 2.2 3.1 2.2 5 0 3.5-3.5 5.7-9 5.7s-9-2.2-9-5.7c0-1.9.7-3.7 2.2-5Z" />
      <ellipse cx="12" cy="14" rx="3.2" ry="2.4" />
      <path d="M10.8 14h.01M13.2 14h.01" />
      <path d="M8.5 10.5h.01M15.5 10.5h.01" />
    </svg>
  )
}

/** El huevo de Lucide a tamaño pequeño se lee como una "O": este lleva la base
 *  más ancha y un brillo, así se reconoce como huevo incluso a 14 px. */
function Huevo({ className, strokeWidth = 1.75, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} {...props}
    >
      <path d="M12 2.5c-3.9 0-7 6.1-7 11.2 0 4.3 3.1 7.8 7 7.8s7-3.5 7-7.8c0-5.1-3.1-11.2-7-11.2Z" />
      <path d="M9 9.5c.5-1.5 1.3-2.8 2.2-3.5" />
    </svg>
  )
}

/** Gallina de perfil: la especie "aves ponedoras" en el menú y los resúmenes. */
function Gallina({ className, strokeWidth = 1.75, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} {...props}
    >
      <path d="M8.5 5.5c0-1.4 1.1-2.5 2.5-2.5.9 0 1.7.5 2.1 1.2" />
      <path d="M7 7.5a3 3 0 0 1 3-3c1.7 0 3 1.3 3 3v2.2c2.9.3 5.2 1.8 6.6 4.1.3.5 0 1.1-.6 1.2-1.3.1-2.5-.2-3.5-.8" />
      <path d="M7 7.5 4.5 8.6 7 9.6" />
      <path d="M7 9.6c-.8 1.2-1.2 2.6-1.2 4.1 0 3.5 2.8 5.8 6.2 5.8s6.2-2.3 6.2-5.3" />
      <path d="M10.5 19.5 10 22M13.5 19.5l.5 2.5" />
      <path d="M9.6 7.2h.01" />
    </svg>
  )
}

/**
 * Catálogo de iconos de la app. Cada nombre es lo que el icono significa aquí,
 * no cómo se llama en Lucide, así se puede cambiar el dibujo sin tocar los usos.
 */
export const ICONOS = {
  editar: Pencil,
  alerta: TriangleAlert,
  borrar: Trash2,
  ajustes: Settings2,
  huevo: Huevo,
  gallina: Gallina,
  flecha: ChevronRight,
  termometro: Thermometer,
  diario: ClipboardList,
  check: Check,
  alimento: Wheat,
  vacuna: Syringe,
  dinero: Coins,
  sensor: Radio,
  gota: Droplet,
  recibo: Receipt,
  listo: CircleCheck,
  caja: Package,
  ave: Bird,
  pollo: Drumstick,
  cerdo: Pig,
  hoja: Leaf,
  viento: Wind,
  idea: Lightbulb,
  bascula: Scale,
  manual: PenLine,
  desinfeccion: SprayCan,
  ubicacion: MapPin,
  sirena: Siren,
  medicamento: Pill,
  reloj: Clock,
  meta: Target,
  tetero: Milk,
  operario: HardHat,
  ciclo: RefreshCw,
  herramienta: Wrench,
  clinico: Stethoscope,
  calendario: Calendar,
  ganado: Beef,
  tendencia: TrendingUp,
  bloqueado: Lock,
  grafica: ChartColumn,
  brote: Sprout,
  x: X,
  respiratorio: Activity,
  locomotor: Bone,
  digestivo: Utensils,
  reproductivo: HeartPulse,
  nervioso: Brain,
  piel: PawPrint,
  duda: CircleHelp,
  repetir: Repeat,
  fuego: Flame,
  campana: Bell,
  robot: Bot,
  hospital: Hospital,
  muerte: Skull,
  abierto: LockOpen,
  enchufe: Plug,
  celular: Smartphone,
  laboratorio: Microscope,
  frio: Snowflake,
  saludo: Hand,
  ventilador: Fan,
  agua: Droplets,
  casa: House,
  prohibido: Ban,
  montana: Mountain,
  nube: Cloud,
  solnube: CloudSun,
  agenda: CalendarDays,
  enlace: Link,
  precio: DollarSign,
  mas: Plus,
  buscar: Search,
  sol: Sun,
  correo: Mail,
  circulo: Circle,
  punto: CircleDot,
  corazon: Heart,
  resumen: LayoutDashboard,
  inventario: Boxes,
  equipo: Users,
  salir: LogOut,
  info: Info,
  aviso: CircleAlert,
} as const

export type NombreIcono = keyof typeof ICONOS

interface Props extends Omit<LucideProps, 'ref'> {
  n: NombreIcono
}

/**
 * Icono en línea con el texto: mide lo que mide la letra y se alinea con ella,
 * para que reemplace a un emoji en cualquier sitio sin mover nada.
 */
export function Ic({ n, className, strokeWidth = 1.75, ...props }: Props) {
  const Icono = ICONOS[n]
  return (
    <Icono
      aria-hidden
      strokeWidth={strokeWidth}
      className={cn('inline-block size-[1em] shrink-0 align-[-0.15em]', className)}
      {...props}
    />
  )
}
