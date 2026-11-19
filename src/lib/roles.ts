/**
 * Los roles de cada finca y lo que puede hacer cada uno (migraciones 085 y 087).
 * Es la única fuente de la matriz de permisos: el menú, el bloqueo de páginas, el
 * Resumen y los botones leen de aquí. En la base, el rol vive en
 * finca_miembros.rol y solo lo cambia el administrador de la finca.
 *
 * Cada rol solo ve las secciones de su trabajo. La matriz completa, explicada
 * para José, está en la propuesta de roles (para-jose/) y en el plan de Obsidian.
 */
export type RolFinca =
  | 'propietario' | 'administrador' | 'zootecnista' | 'operario' | 'recolector' | 'contador' | 'trabajador'
/** Los roles que se pueden dar con un código o al invitar */
export type RolAsignable = 'administrador' | 'zootecnista' | 'operario' | 'recolector' | 'contador'

/** Las secciones de la app */
export type Seccion =
  | 'resumen'      // Resumen de la finca
  | 'galpones'     // Galpones, naves y pollo: el día a día de los animales
  | 'huevos'       // Huevos de la finca (bodega)
  | 'alimento'     // Alimento
  | 'inventario'   // Inventario de insumos y equipos
  | 'sanidad'      // Calendario sanitario
  | 'historial'    // Historial de cría de cerdos
  | 'reportes'     // Reportes y análisis
  | 'ventas'       // Ventas de la finca
  | 'finanzas'     // Finanzas: costos, ingresos, utilidad
  | 'equipo'       // Operarios: invitar, códigos, roles, turnos y tareas de todos
  | 'nomina'       // Desempeño y pago del equipo
  | 'misTareas'    // Las tareas y turnos propios

export const ROLES_ASIGNABLES: { v: RolAsignable; t: string; d: string }[] = [
  { v: 'operario', t: 'Operario', d: 'El día a día: registra producción, alimento y sanidad, y hace sus tareas' },
  { v: 'recolector', t: 'Recolector', d: 'Recoge y registra los huevos, y hace sus tareas' },
  { v: 'zootecnista', t: 'Zootecnista', d: 'La parte técnica: galpones, metas, sanidad y reportes de producción, sin la plata' },
  { v: 'contador', t: 'Contabilidad y nómina', d: 'Solo la plata: ventas, finanzas, reportes de dinero y el pago del equipo' },
  { v: 'administrador', t: 'Administrador de finca', d: 'Acceso total: todo lo de la finca, la plata y el equipo' },
]

export const NOMBRE_ROL: Record<RolFinca, string> = {
  propietario: 'Administrador de finca',
  administrador: 'Administrador de finca',
  zootecnista: 'Zootecnista',
  operario: 'Operario',
  recolector: 'Recolector',
  contador: 'Contabilidad y nómina',
  trabajador: 'Operario',
}

const TODAS: Seccion[] = ['resumen', 'galpones', 'huevos', 'alimento', 'inventario', 'sanidad', 'historial', 'reportes', 'ventas', 'finanzas', 'equipo', 'nomina', 'misTareas']

/** Las secciones que ve cada rol */
export const SECCIONES_ROL: Record<RolFinca, Seccion[]> = {
  propietario: TODAS,
  administrador: TODAS,
  zootecnista: ['resumen', 'galpones', 'huevos', 'alimento', 'inventario', 'sanidad', 'historial', 'reportes', 'misTareas'],
  operario: ['resumen', 'galpones', 'huevos', 'alimento', 'inventario', 'sanidad', 'historial', 'misTareas'],
  recolector: ['resumen', 'galpones', 'huevos', 'misTareas'],
  contador: ['resumen', 'reportes', 'ventas', 'finanzas', 'nomina'],
  trabajador: ['resumen', 'galpones', 'huevos', 'alimento', 'inventario', 'sanidad', 'historial', 'misTareas'],
}

export const esAdministrador = (r: RolFinca | null) => r === 'propietario' || r === 'administrador'

/** Lo que puede hacer cada rol. */
export function permisos(r: RolFinca | null) {
  const rol: RolFinca = r ?? 'trabajador'
  const secciones = SECCIONES_ROL[rol]
  const ve = (s: Seccion) => secciones.includes(s)
  const admin = esAdministrador(rol)
  return {
    ve,
    /** Plata: costos, ventas, utilidad, precios (también dentro de otras secciones) */
    verDinero: admin || rol === 'contador',
    /** Ve la producción de los animales (huevos, postura, mortalidad, alimento) */
    verProduccion: ve('galpones'),
    verReportes: ve('reportes'),
    /** Invitar, códigos y roles */
    manejarEquipo: ve('equipo'),
    /** Ver y anotar el pago del equipo */
    verNomina: ve('nomina'),
    /** Datos de la finca, galpones, precios */
    configurarFinca: admin,
    /** Registrar aves, importar, cerrar lotes, cambiar la salida, ajustar metas */
    manejarLotes: admin || rol === 'zootecnista',
    /** En el galpón, solo la pestaña de producción (el recolector) */
    soloProduccion: rol === 'recolector',
  }
}

/** La sección de cada página (para bloquear la que no le toca al rol) */
export function seccionDeRuta(ruta: string): Seccion | null {
  const r = (p: string) => ruta === p || ruta.startsWith(p + '/')
  if (r('/dashboard')) return 'resumen'
  if (r('/aves-ponedoras') || r('/cerdos') || r('/pollo-engorde') || r('/animales') || r('/produccion')) return 'galpones'
  if (r('/huevos')) return 'huevos'
  if (r('/alimento')) return 'alimento'
  if (r('/inventario')) return 'inventario'
  if (r('/calendario')) return 'sanidad'
  if (r('/historial')) return 'historial'
  if (r('/reportes')) return 'reportes'
  if (r('/ventas')) return 'ventas'
  if (r('/finanzas')) return 'finanzas'
  // Operarios: cada rol ve ahí lo suyo (el equipo, la nómina o sus tareas)
  return null
}
