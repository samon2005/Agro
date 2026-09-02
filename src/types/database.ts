// Regenerar con: npx supabase gen types typescript --project-id lzchcenzufnfwrxrfrsc > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; rol: string; telefono: string | null; cargo: string | null; activo: boolean; pago_monto: number | null; pago_periodo: string | null; created_at: string }
        Insert: { id: string; full_name?: string | null; rol?: string; telefono?: string | null; cargo?: string | null; activo?: boolean; pago_monto?: number | null; pago_periodo?: string | null; created_at?: string }
        Update: { id?: string; full_name?: string | null; rol?: string; telefono?: string | null; cargo?: string | null; activo?: boolean; pago_monto?: number | null; pago_periodo?: string | null; created_at?: string }
        Relationships: []
      }
      fincas: {
        Row: { id: string; nombre: string; municipio: string | null; departamento: string | null; hectareas: number | null; area_valor: number | null; area_unidad: string | null; tipo_produccion: string[] | null; propietario_id: string | null; altitud_msnm: number | null; velocidad_viento_kmh: number | null; clima_predominante: string | null; temperatura_promedio_ext: number | null; latitud: number | null; longitud: number | null; created_at: string }
        Insert: { id?: string; nombre: string; municipio?: string | null; departamento?: string | null; hectareas?: number | null; area_valor?: number | null; area_unidad?: string | null; tipo_produccion?: string[] | null; propietario_id?: string | null; altitud_msnm?: number | null; velocidad_viento_kmh?: number | null; clima_predominante?: string | null; temperatura_promedio_ext?: number | null; latitud?: number | null; longitud?: number | null; created_at?: string }
        Update: { id?: string; nombre?: string; municipio?: string | null; departamento?: string | null; hectareas?: number | null; area_valor?: number | null; area_unidad?: string | null; tipo_produccion?: string[] | null; propietario_id?: string | null; altitud_msnm?: number | null; velocidad_viento_kmh?: number | null; clima_predominante?: string | null; temperatura_promedio_ext?: number | null; latitud?: number | null; longitud?: number | null; created_at?: string }
        Relationships: []
      }
      unidades_area_personalizadas: {
        Row: { id: string; propietario_id: string; nombre: string; created_at: string }
        Insert: { id?: string; propietario_id: string; nombre: string; created_at?: string }
        Update: { id?: string; propietario_id?: string; nombre?: string; created_at?: string }
        Relationships: []
      }
      finca_miembros: {
        Row: { finca_id: string; perfil_id: string; rol: string }
        Insert: { finca_id: string; perfil_id: string; rol?: string }
        Update: { finca_id?: string; perfil_id?: string; rol?: string }
        Relationships: []
      }
      especies: {
        Row: { id: string; nombre: string }
        Insert: { id?: string; nombre: string }
        Update: { id?: string; nombre?: string }
        Relationships: []
      }
      razas: {
        Row: { id: string; nombre: string; especie_id: string }
        Insert: { id?: string; nombre: string; especie_id: string }
        Update: { id?: string; nombre?: string; especie_id?: string }
        Relationships: []
      }
      animales: {
        Row: { id: string; finca_id: string; especie_id: string | null; raza_id: string | null; numero_arete: string | null; nombre: string | null; sexo: string | null; fecha_nacimiento: string | null; peso_actual: number | null; estado: string; madre_id: string | null; padre_id: string | null; created_at: string }
        Insert: { id?: string; finca_id: string; especie_id?: string | null; raza_id?: string | null; numero_arete?: string | null; nombre?: string | null; sexo?: string | null; fecha_nacimiento?: string | null; peso_actual?: number | null; estado?: string; madre_id?: string | null; padre_id?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string; especie_id?: string | null; raza_id?: string | null; numero_arete?: string | null; nombre?: string | null; sexo?: string | null; fecha_nacimiento?: string | null; peso_actual?: number | null; estado?: string; madre_id?: string | null; padre_id?: string | null; created_at?: string }
        Relationships: []
      }
      pesos_animales: {
        Row: { id: string; animal_id: string; peso: number; fecha: string; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; animal_id: string; peso: number; fecha?: string; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; animal_id?: string; peso?: number; fecha?: string; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      registros_sanitarios: {
        Row: { id: string; animal_id: string; tipo: string; producto: string | null; dosis: string | null; via_administracion: string | null; fecha_aplicacion: string; fecha_proxima: string | null; veterinario: string | null; costo: number | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; animal_id: string; tipo: string; producto?: string | null; dosis?: string | null; via_administracion?: string | null; fecha_aplicacion?: string; fecha_proxima?: string | null; veterinario?: string | null; costo?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; animal_id?: string; tipo?: string; producto?: string | null; dosis?: string | null; via_administracion?: string | null; fecha_aplicacion?: string; fecha_proxima?: string | null; veterinario?: string | null; costo?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      registros_produccion: {
        Row: { id: string; finca_id: string; animal_id: string | null; tipo: string; cantidad: number; unidad: string; fecha: string; calidad: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; finca_id: string; animal_id?: string | null; tipo: string; cantidad: number; unidad: string; fecha?: string; calidad?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string; animal_id?: string | null; tipo?: string; cantidad?: number; unidad?: string; fecha?: string; calidad?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      inventario_categorias: {
        Row: { id: string; finca_id: string; nombre: string; color: string | null }
        Insert: { id?: string; finca_id: string; nombre: string; color?: string | null }
        Update: { id?: string; finca_id?: string; nombre?: string; color?: string | null }
        Relationships: []
      }
      inventario: {
        Row: { id: string; finca_id: string; categoria_id: string | null; nombre: string; descripcion: string | null; unidad_medida: string | null; cantidad_actual: number; cantidad_minima: number; precio_unitario: number | null; proveedor: string | null; fecha_vencimiento: string | null; created_at: string }
        Insert: { id?: string; finca_id: string; categoria_id?: string | null; nombre: string; descripcion?: string | null; unidad_medida?: string | null; cantidad_actual?: number; cantidad_minima?: number; precio_unitario?: number | null; proveedor?: string | null; fecha_vencimiento?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string; categoria_id?: string | null; nombre?: string; descripcion?: string | null; unidad_medida?: string | null; cantidad_actual?: number; cantidad_minima?: number; precio_unitario?: number | null; proveedor?: string | null; fecha_vencimiento?: string | null; created_at?: string }
        Relationships: []
      }
      movimientos_inventario: {
        Row: { id: string; inventario_id: string; tipo: string; cantidad: number; motivo: string | null; fecha: string; usuario_id: string | null; created_at: string }
        Insert: { id?: string; inventario_id: string; tipo: string; cantidad: number; motivo?: string | null; fecha?: string; usuario_id?: string | null; created_at?: string }
        Update: { id?: string; inventario_id?: string; tipo?: string; cantidad?: number; motivo?: string | null; fecha?: string; usuario_id?: string | null; created_at?: string }
        Relationships: []
      }
      gastos: {
        Row: { id: string; finca_id: string; categoria: string | null; descripcion: string; monto: number; fecha: string; comprobante_url: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; finca_id: string; categoria?: string | null; descripcion: string; monto: number; fecha?: string; comprobante_url?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string; categoria?: string | null; descripcion?: string; monto?: number; fecha?: string; comprobante_url?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      turnos_operarios: {
        Row: { id: string; finca_id: string; operario_id: string; fecha: string; hora_inicio: string; hora_fin: string | null; area: string | null; observaciones: string | null; created_at: string }
        Insert: { id?: string; finca_id: string; operario_id: string; fecha?: string; hora_inicio: string; hora_fin?: string | null; area?: string | null; observaciones?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string; operario_id?: string; fecha?: string; hora_inicio?: string; hora_fin?: string | null; area?: string | null; observaciones?: string | null; created_at?: string }
        Relationships: []
      }
      tareas_operarios: {
        Row: { id: string; finca_id: string; operario_id: string | null; descripcion: string; fecha: string; hora_inicio: string | null; hora_fin: string | null; estado: string; created_at: string }
        Insert: { id?: string; finca_id: string; operario_id?: string | null; descripcion: string; fecha?: string; hora_inicio?: string | null; hora_fin?: string | null; estado?: string; created_at?: string }
        Update: { id?: string; finca_id?: string; operario_id?: string | null; descripcion?: string; fecha?: string; hora_inicio?: string | null; hora_fin?: string | null; estado?: string; created_at?: string }
        Relationships: []
      }
      // ── Aves Ponedoras ────────────────────────────────────────────────
      lotes_aves: {
        Row: { id: string; finca_id: string; nombre: string; linea_genetica: string | null; fecha_inicio: string; fecha_fin: string | null; aves_iniciales: number; aves_actuales: number; origen_aves: string | null; estado: string; observaciones: string | null; area_galpon_m2: number | null; fecha_inicio_postura: string | null; semanas_ciclo_postura: number | null; meta_postura_pct: number | null; meta_huevos_diaria: number | null; precio_huevo: number | null; precio_huevo_b: number | null; precio_huevo_a: number | null; precio_huevo_aa: number | null; precio_huevo_aaa: number | null; precio_huevo_jumbo: number | null; precio_gramo_alimento: number | null; peso_bulto_alimento_kg: number | null; alimento_activo_id: string | null; consumo_activo_kg: number | null; consumo_estimado_kg_dia: number | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; finca_id: string; nombre: string; linea_genetica?: string | null; fecha_inicio?: string; fecha_fin?: string | null; aves_iniciales?: number; aves_actuales?: number; origen_aves?: string | null; estado?: string; observaciones?: string | null; area_galpon_m2?: number | null; fecha_inicio_postura?: string | null; semanas_ciclo_postura?: number | null; meta_postura_pct?: number | null; meta_huevos_diaria?: number | null; precio_huevo?: number | null; precio_huevo_b?: number | null; precio_huevo_a?: number | null; precio_huevo_aa?: number | null; precio_huevo_aaa?: number | null; precio_huevo_jumbo?: number | null; precio_gramo_alimento?: number | null; peso_bulto_alimento_kg?: number | null; alimento_activo_id?: string | null; consumo_activo_kg?: number | null; consumo_estimado_kg_dia?: number | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string; nombre?: string; linea_genetica?: string | null; fecha_inicio?: string; fecha_fin?: string | null; aves_iniciales?: number; aves_actuales?: number; origen_aves?: string | null; estado?: string; observaciones?: string | null; area_galpon_m2?: number | null; fecha_inicio_postura?: string | null; semanas_ciclo_postura?: number | null; meta_postura_pct?: number | null; meta_huevos_diaria?: number | null; precio_huevo?: number | null; precio_huevo_b?: number | null; precio_huevo_a?: number | null; precio_huevo_aa?: number | null; precio_huevo_aaa?: number | null; precio_huevo_jumbo?: number | null; precio_gramo_alimento?: number | null; peso_bulto_alimento_kg?: number | null; alimento_activo_id?: string | null; consumo_activo_kg?: number | null; consumo_estimado_kg_dia?: number | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      horarios_alimentacion_aves: {
        Row: { id: string; lote_id: string; finca_id: string; hora: string; descripcion: string | null; cantidad_kg: number | null; activo: boolean; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; hora: string; descripcion?: string | null; cantidad_kg?: number | null; activo?: boolean; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; hora?: string; descripcion?: string | null; cantidad_kg?: number | null; activo?: boolean; created_at?: string }
        Relationships: []
      }
      horarios_alimentacion_completados: {
        Row: { id: string; horario_id: string; lote_id: string; finca_id: string; fecha: string; created_at: string }
        Insert: { id?: string; horario_id: string; lote_id: string; finca_id: string; fecha?: string; created_at?: string }
        Update: { id?: string; horario_id?: string; lote_id?: string; finca_id?: string; fecha?: string; created_at?: string }
        Relationships: []
      }
      horarios_recoleccion_aves: {
        Row: { id: string; lote_id: string; finca_id: string; hora: string; descripcion: string | null; activo: boolean; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; hora: string; descripcion?: string | null; activo?: boolean; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; hora?: string; descripcion?: string | null; activo?: boolean; created_at?: string }
        Relationships: []
      }
      produccion_diaria_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; huevos_totales: number; huevos_b: number; huevos_a: number; huevos_aa: number; huevos_aaa: number; huevos_jumbo: number; huevos_rotos: number; huevos_sucios: number; huevos_deformes: number; aves_en_dia: number | null; alimento_kg: number; muertes: number; causa_muerte: string | null; observaciones: string | null; tipo_alimento_id: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; huevos_totales?: number; huevos_b?: number; huevos_a?: number; huevos_aa?: number; huevos_aaa?: number; huevos_jumbo?: number; huevos_rotos?: number; huevos_sucios?: number; huevos_deformes?: number; aves_en_dia?: number | null; alimento_kg?: number; muertes?: number; causa_muerte?: string | null; observaciones?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; huevos_totales?: number; huevos_b?: number; huevos_a?: number; huevos_aa?: number; huevos_aaa?: number; huevos_jumbo?: number; huevos_rotos?: number; huevos_sucios?: number; huevos_deformes?: number; aves_en_dia?: number | null; alimento_kg?: number; muertes?: number; causa_muerte?: string | null; observaciones?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      tipos_alimento_aves: {
        Row: { id: string; finca_id: string; nombre: string; marca: string | null; tipo_alimento_categoria: string | null; proteina_bruta_pct: number | null; grasa_pct: number | null; calcio_pct: number | null; fosforo_pct: number | null; precio_bulto: number | null; peso_bulto_kg: number; cantidad_entrada: number | null; fecha_entrada: string | null; activo: boolean; created_at: string }
        Insert: { id?: string; finca_id: string; nombre: string; marca?: string | null; tipo_alimento_categoria?: string | null; proteina_bruta_pct?: number | null; grasa_pct?: number | null; calcio_pct?: number | null; fosforo_pct?: number | null; precio_bulto?: number | null; peso_bulto_kg?: number; cantidad_entrada?: number | null; fecha_entrada?: string | null; activo?: boolean; created_at?: string }
        Update: { id?: string; finca_id?: string; nombre?: string; marca?: string | null; tipo_alimento_categoria?: string | null; proteina_bruta_pct?: number | null; grasa_pct?: number | null; calcio_pct?: number | null; fosforo_pct?: number | null; precio_bulto?: number | null; peso_bulto_kg?: number; cantidad_entrada?: number | null; fecha_entrada?: string | null; activo?: boolean; created_at?: string }
        Relationships: []
      }
      requerimientos_nutricionales_aves: {
        Row: { id: string; lote_id: string; finca_id: string; mant_proteina_g: number; mant_calcio_g: number; mant_fosforo_g: number; mant_grasa_g: number; prod_proteina_g: number; prod_calcio_g: number; prod_fosforo_g: number; prod_grasa_g: number; vigente_desde: string; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; mant_proteina_g?: number; mant_calcio_g?: number; mant_fosforo_g?: number; mant_grasa_g?: number; prod_proteina_g?: number; prod_calcio_g?: number; prod_fosforo_g?: number; prod_grasa_g?: number; vigente_desde?: string; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; mant_proteina_g?: number; mant_calcio_g?: number; mant_fosforo_g?: number; mant_grasa_g?: number; prod_proteina_g?: number; prod_calcio_g?: number; prod_fosforo_g?: number; prod_grasa_g?: number; vigente_desde?: string; created_at?: string }
        Relationships: []
      }
      parametros_ambientales_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; hora: string | null; temperatura_interior: number | null; temperatura_exterior: number | null; humedad_interior: number | null; humedad_exterior: number | null; nh3_ppm: number | null; co2_ppm: number | null; lux_intensidad: number | null; fuente: string; sensor_id: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; hora?: string | null; temperatura_interior?: number | null; temperatura_exterior?: number | null; humedad_interior?: number | null; humedad_exterior?: number | null; nh3_ppm?: number | null; co2_ppm?: number | null; lux_intensidad?: number | null; fuente?: string; sensor_id?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; hora?: string | null; temperatura_interior?: number | null; temperatura_exterior?: number | null; humedad_interior?: number | null; humedad_exterior?: number | null; nh3_ppm?: number | null; co2_ppm?: number | null; lux_intensidad?: number | null; fuente?: string; sensor_id?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      vacunaciones_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha_aplicacion: string; vacuna: string; lote_vacuna: string | null; via_administracion: string | null; dosis: string | null; laboratorio: string | null; numero_aves: number | null; costo: number | null; proxima_dosis: string | null; veterinario: string | null; proveedor: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha_aplicacion?: string; vacuna: string; lote_vacuna?: string | null; via_administracion?: string | null; dosis?: string | null; laboratorio?: string | null; numero_aves?: number | null; costo?: number | null; proxima_dosis?: string | null; veterinario?: string | null; proveedor?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha_aplicacion?: string; vacuna?: string; lote_vacuna?: string | null; via_administracion?: string | null; dosis?: string | null; laboratorio?: string | null; numero_aves?: number | null; costo?: number | null; proxima_dosis?: string | null; veterinario?: string | null; proveedor?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      medicaciones_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha_inicio: string; fecha_fin: string | null; medicamento: string; principio_activo: string | null; via_administracion: string | null; dosis: string | null; periodo_retiro_dias: number | null; motivo: string | null; costo: number | null; veterinario: string | null; proveedor: string | null; observaciones: string | null; evento_clinico_id: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha_inicio?: string; fecha_fin?: string | null; medicamento: string; principio_activo?: string | null; via_administracion?: string | null; dosis?: string | null; periodo_retiro_dias?: number | null; motivo?: string | null; costo?: number | null; veterinario?: string | null; proveedor?: string | null; observaciones?: string | null; evento_clinico_id?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha_inicio?: string; fecha_fin?: string | null; medicamento?: string; principio_activo?: string | null; via_administracion?: string | null; dosis?: string | null; periodo_retiro_dias?: number | null; motivo?: string | null; costo?: number | null; veterinario?: string | null; proveedor?: string | null; observaciones?: string | null; evento_clinico_id?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      eventos_clinicos_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; tipo_evento: string; descripcion: string; aves_afectadas: number | null; aves_muertas: number | null; accion_tomada: string | null; veterinario: string | null; resuelto: boolean; observaciones: string | null; requiere_medicamento: boolean; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; tipo_evento: string; descripcion: string; aves_afectadas?: number | null; aves_muertas?: number | null; accion_tomada?: string | null; veterinario?: string | null; resuelto?: boolean; observaciones?: string | null; requiere_medicamento?: boolean; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; tipo_evento?: string; descripcion?: string; aves_afectadas?: number | null; aves_muertas?: number | null; accion_tomada?: string | null; veterinario?: string | null; resuelto?: boolean; observaciones?: string | null; requiere_medicamento?: boolean; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      costos_lote_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; categoria: string; descripcion: string; monto: number; proveedor: string | null; observaciones: string | null; equipo_id: string | null; medicacion_id: string | null; vacunacion_id: string | null; desinfeccion_id: string | null; tipo_alimento_id: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; categoria: string; descripcion: string; monto: number; proveedor?: string | null; observaciones?: string | null; equipo_id?: string | null; medicacion_id?: string | null; vacunacion_id?: string | null; desinfeccion_id?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; categoria?: string; descripcion?: string; monto?: number; proveedor?: string | null; observaciones?: string | null; equipo_id?: string | null; medicacion_id?: string | null; vacunacion_id?: string | null; desinfeccion_id?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      ventas_huevos_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; cantidad_b: number; cantidad_a: number; cantidad_aa: number; cantidad_aaa: number; cantidad_jumbo: number; precio_b: number | null; precio_a: number | null; precio_aa: number | null; precio_aaa: number | null; precio_jumbo: number | null; cliente: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; cantidad_b?: number; cantidad_a?: number; cantidad_aa?: number; cantidad_aaa?: number; cantidad_jumbo?: number; precio_b?: number | null; precio_a?: number | null; precio_aa?: number | null; precio_aaa?: number | null; precio_jumbo?: number | null; cliente?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; cantidad_b?: number; cantidad_a?: number; cantidad_aa?: number; cantidad_aaa?: number; cantidad_jumbo?: number; precio_b?: number | null; precio_a?: number | null; precio_aa?: number | null; precio_aaa?: number | null; precio_jumbo?: number | null; cliente?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      equipos_aves: {
        Row: { id: string; lote_id: string; finca_id: string; nombre: string; tipo: string; estado: string; marca: string | null; modelo: string | null; numero_serie: string | null; fecha_instalacion: string | null; horas_operacion: number | null; ultima_revision: string | null; proximo_mantenimiento: string | null; ubicacion: string | null; sensor_id: string | null; observaciones: string | null; costo_compra: number | null; fecha_compra: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; nombre: string; tipo: string; estado?: string; marca?: string | null; modelo?: string | null; numero_serie?: string | null; fecha_instalacion?: string | null; horas_operacion?: number | null; ultima_revision?: string | null; proximo_mantenimiento?: string | null; ubicacion?: string | null; sensor_id?: string | null; observaciones?: string | null; costo_compra?: number | null; fecha_compra?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; nombre?: string; tipo?: string; estado?: string; marca?: string | null; modelo?: string | null; numero_serie?: string | null; fecha_instalacion?: string | null; horas_operacion?: number | null; ultima_revision?: string | null; proximo_mantenimiento?: string | null; ubicacion?: string | null; sensor_id?: string | null; observaciones?: string | null; costo_compra?: number | null; fecha_compra?: string | null; created_at?: string }
        Relationships: []
      }
      desinfecciones_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; producto: string; previene: string | null; dosis: string | null; responsable: string | null; costo: number | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; producto: string; previene?: string | null; dosis?: string | null; responsable?: string | null; costo?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; producto?: string; previene?: string | null; dosis?: string | null; responsable?: string | null; costo?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      equipos_aves_logs: {
        Row: { id: string; equipo_id: string; finca_id: string; fecha: string; estado_registrado: string; horas_dia: number | null; lectura_sensor: Record<string, unknown> | null; alerta: boolean | null; descripcion_alerta: string | null; fuente: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; equipo_id: string; finca_id: string; fecha?: string; estado_registrado: string; horas_dia?: number | null; lectura_sensor?: Record<string, unknown> | null; alerta?: boolean | null; descripcion_alerta?: string | null; fuente?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; equipo_id?: string; finca_id?: string; fecha?: string; estado_registrado?: string; horas_dia?: number | null; lectura_sensor?: Record<string, unknown> | null; alerta?: boolean | null; descripcion_alerta?: string | null; fuente?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      costos_predefinidos_aves: {
        Row: { id: string; finca_id: string; categoria: string; monto_referencia: number; created_at: string }
        Insert: { id?: string; finca_id: string; categoria: string; monto_referencia?: number; created_at?: string }
        Update: { id?: string; finca_id?: string; categoria?: string; monto_referencia?: number; created_at?: string }
        Relationships: []
      }
      recordatorios_medicacion_aves: {
        Row: { id: string; medicacion_id: string; lote_id: string; finca_id: string; fecha: string; hora: string | null; completado: boolean; canal: string; created_at: string }
        Insert: { id?: string; medicacion_id: string; lote_id: string; finca_id: string; fecha: string; hora?: string | null; completado?: boolean; canal?: string; created_at?: string }
        Update: { id?: string; medicacion_id?: string; lote_id?: string; finca_id?: string; fecha?: string; hora?: string | null; completado?: boolean; canal?: string; created_at?: string }
        Relationships: []
      }
      revisiones_calidad_huevo_aves: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; cantidad_b: number; cantidad_a: number; cantidad_aa: number; cantidad_aaa: number; cantidad_jumbo: number; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; cantidad_b?: number; cantidad_a?: number; cantidad_aa?: number; cantidad_aaa?: number; cantidad_jumbo?: number; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; cantidad_b?: number; cantidad_a?: number; cantidad_aa?: number; cantidad_aaa?: number; cantidad_jumbo?: number; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      // ── Cerdos ───────────────────────────────────────────────────────
      lotes_cerdos: {
        Row: { id: string; finca_id: string; nombre: string; linea_genetica: string | null; fecha_ingreso: string; etapa_actual: string; numero_animales: number; animales_actuales: number; peso_promedio_inicial: number | null; origen_animales: string | null; corral: string | null; estado: string; observaciones: string | null; area_corral_m2: number | null; peso_objetivo_kg: number | null; fecha_salida_estimada: string | null; precio_kg_objetivo: number | null; alimento_activo_id: string | null; consumo_activo_kg: number | null; consumo_estimado_kg_dia: number | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; finca_id: string; nombre: string; linea_genetica?: string | null; fecha_ingreso?: string; etapa_actual?: string; numero_animales?: number; animales_actuales?: number; peso_promedio_inicial?: number | null; origen_animales?: string | null; corral?: string | null; estado?: string; observaciones?: string | null; area_corral_m2?: number | null; peso_objetivo_kg?: number | null; fecha_salida_estimada?: string | null; precio_kg_objetivo?: number | null; alimento_activo_id?: string | null; consumo_activo_kg?: number | null; consumo_estimado_kg_dia?: number | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string; nombre?: string; linea_genetica?: string | null; fecha_ingreso?: string; etapa_actual?: string; numero_animales?: number; animales_actuales?: number; peso_promedio_inicial?: number | null; origen_animales?: string | null; corral?: string | null; estado?: string; observaciones?: string | null; area_corral_m2?: number | null; peso_objetivo_kg?: number | null; fecha_salida_estimada?: string | null; precio_kg_objetivo?: number | null; alimento_activo_id?: string | null; consumo_activo_kg?: number | null; consumo_estimado_kg_dia?: number | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      etapas_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; etapa_anterior: string | null; etapa_nueva: string; peso_promedio: number | null; numero_animales: number | null; corral_destino: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; etapa_anterior?: string | null; etapa_nueva: string; peso_promedio?: number | null; numero_animales?: number | null; corral_destino?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; etapa_anterior?: string | null; etapa_nueva?: string; peso_promedio?: number | null; numero_animales?: number | null; corral_destino?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      pesos_lote_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; peso_promedio: number; peso_minimo: number | null; peso_maximo: number | null; numero_pesados: number | null; metodo: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; peso_promedio: number; peso_minimo?: number | null; peso_maximo?: number | null; numero_pesados?: number | null; metodo?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; peso_promedio?: number; peso_minimo?: number | null; peso_maximo?: number | null; numero_pesados?: number | null; metodo?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      mortalidad_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; cantidad: number; causa: string | null; descripcion: string | null; peso_estimado: number | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; cantidad?: number; causa?: string | null; descripcion?: string | null; peso_estimado?: number | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; cantidad?: number; causa?: string | null; descripcion?: string | null; peso_estimado?: number | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      movimientos_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; tipo: string; cantidad: number; peso_promedio: number | null; destino_origen: string | null; precio_unitario: number | null; valor_total: number | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; tipo: string; cantidad: number; peso_promedio?: number | null; destino_origen?: string | null; precio_unitario?: number | null; valor_total?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; tipo?: string; cantidad?: number; peso_promedio?: number | null; destino_origen?: string | null; precio_unitario?: number | null; valor_total?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      vacunaciones_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha_aplicacion: string; vacuna: string; lote_vacuna: string | null; via_administracion: string | null; dosis: string | null; laboratorio: string | null; numero_animales: number | null; costo: number | null; proxima_dosis: string | null; veterinario: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha_aplicacion?: string; vacuna: string; lote_vacuna?: string | null; via_administracion?: string | null; dosis?: string | null; laboratorio?: string | null; numero_animales?: number | null; costo?: number | null; proxima_dosis?: string | null; veterinario?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha_aplicacion?: string; vacuna?: string; lote_vacuna?: string | null; via_administracion?: string | null; dosis?: string | null; laboratorio?: string | null; numero_animales?: number | null; costo?: number | null; proxima_dosis?: string | null; veterinario?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      desparasitaciones_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; producto: string; principio_activo: string | null; via_administracion: string | null; dosis: string | null; numero_animales: number | null; periodo_retiro_dias: number | null; costo: number | null; veterinario: string | null; proxima_aplicacion: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; producto: string; principio_activo?: string | null; via_administracion?: string | null; dosis?: string | null; numero_animales?: number | null; periodo_retiro_dias?: number | null; costo?: number | null; veterinario?: string | null; proxima_aplicacion?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; producto?: string; principio_activo?: string | null; via_administracion?: string | null; dosis?: string | null; numero_animales?: number | null; periodo_retiro_dias?: number | null; costo?: number | null; veterinario?: string | null; proxima_aplicacion?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      nutricion_diaria_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; alimento_kg: number; tipo_alimento: string | null; tipo_alimento_id: string | null; agua_litros: number | null; aditivos: string | null; costo_alimento: number | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; alimento_kg?: number; tipo_alimento?: string | null; tipo_alimento_id?: string | null; agua_litros?: number | null; aditivos?: string | null; costo_alimento?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; alimento_kg?: number; tipo_alimento?: string | null; tipo_alimento_id?: string | null; agua_litros?: number | null; aditivos?: string | null; costo_alimento?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      parametros_ambientales_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; hora: string | null; temperatura_interior: number | null; temperatura_exterior: number | null; humedad_interior: number | null; nh3_ppm: number | null; co2_ppm: number | null; fuente: string; sensor_id: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; hora?: string | null; temperatura_interior?: number | null; temperatura_exterior?: number | null; humedad_interior?: number | null; nh3_ppm?: number | null; co2_ppm?: number | null; fuente?: string; sensor_id?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; hora?: string | null; temperatura_interior?: number | null; temperatura_exterior?: number | null; humedad_interior?: number | null; nh3_ppm?: number | null; co2_ppm?: number | null; fuente?: string; sensor_id?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      equipos_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; nombre: string; tipo: string; estado: string; marca: string | null; modelo: string | null; numero_serie: string | null; fecha_instalacion: string | null; horas_operacion: number | null; ultima_revision: string | null; proximo_mantenimiento: string | null; ubicacion: string | null; sensor_id: string | null; observaciones: string | null; costo_compra: number | null; fecha_compra: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; nombre: string; tipo: string; estado?: string; marca?: string | null; modelo?: string | null; numero_serie?: string | null; fecha_instalacion?: string | null; horas_operacion?: number | null; ultima_revision?: string | null; proximo_mantenimiento?: string | null; ubicacion?: string | null; sensor_id?: string | null; observaciones?: string | null; costo_compra?: number | null; fecha_compra?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; nombre?: string; tipo?: string; estado?: string; marca?: string | null; modelo?: string | null; numero_serie?: string | null; fecha_instalacion?: string | null; horas_operacion?: number | null; ultima_revision?: string | null; proximo_mantenimiento?: string | null; ubicacion?: string | null; sensor_id?: string | null; observaciones?: string | null; costo_compra?: number | null; fecha_compra?: string | null; created_at?: string }
        Relationships: []
      }
      desinfecciones_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; producto: string; previene: string | null; dosis: string | null; responsable: string | null; costo: number | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; producto: string; previene?: string | null; dosis?: string | null; responsable?: string | null; costo?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; producto?: string; previene?: string | null; dosis?: string | null; responsable?: string | null; costo?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      equipos_cerdos_logs: {
        Row: { id: string; equipo_id: string; finca_id: string; fecha: string; estado_registrado: string; horas_dia: number | null; lectura_sensor: Record<string, unknown> | null; alerta: boolean | null; descripcion_alerta: string | null; fuente: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; equipo_id: string; finca_id: string; fecha?: string; estado_registrado: string; horas_dia?: number | null; lectura_sensor?: Record<string, unknown> | null; alerta?: boolean | null; descripcion_alerta?: string | null; fuente?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; equipo_id?: string; finca_id?: string; fecha?: string; estado_registrado?: string; horas_dia?: number | null; lectura_sensor?: Record<string, unknown> | null; alerta?: boolean | null; descripcion_alerta?: string | null; fuente?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      // ── Pollo de Engorde ─────────────────────────────────────────────
      lotes_pollo: {
        Row: { id: string; finca_id: string; nombre: string; linea_genetica: string | null; fecha_ingreso: string; fecha_salida: string | null; pollos_iniciales: number; pollos_actuales: number; peso_promedio_inicial: number | null; origen_pollos: string | null; galpone: string | null; estado: string; observaciones: string | null; area_galpon_m2: number | null; peso_objetivo_kg: number | null; dias_ciclo: number | null; precio_kg_objetivo: number | null; alimento_activo_id: string | null; consumo_activo_kg: number | null; consumo_estimado_kg_dia: number | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; finca_id: string; nombre: string; linea_genetica?: string | null; fecha_ingreso?: string; fecha_salida?: string | null; pollos_iniciales?: number; pollos_actuales?: number; peso_promedio_inicial?: number | null; origen_pollos?: string | null; galpone?: string | null; estado?: string; observaciones?: string | null; area_galpon_m2?: number | null; peso_objetivo_kg?: number | null; dias_ciclo?: number | null; precio_kg_objetivo?: number | null; alimento_activo_id?: string | null; consumo_activo_kg?: number | null; consumo_estimado_kg_dia?: number | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string; nombre?: string; linea_genetica?: string | null; fecha_ingreso?: string; fecha_salida?: string | null; pollos_iniciales?: number; pollos_actuales?: number; peso_promedio_inicial?: number | null; origen_pollos?: string | null; galpone?: string | null; estado?: string; observaciones?: string | null; area_galpon_m2?: number | null; peso_objetivo_kg?: number | null; dias_ciclo?: number | null; precio_kg_objetivo?: number | null; alimento_activo_id?: string | null; consumo_activo_kg?: number | null; consumo_estimado_kg_dia?: number | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      produccion_diaria_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; alimento_kg: number; agua_litros: number | null; muertes: number; causa_muerte: string | null; observaciones: string | null; tipo_alimento_id: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; alimento_kg?: number; agua_litros?: number | null; muertes?: number; causa_muerte?: string | null; observaciones?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; alimento_kg?: number; agua_litros?: number | null; muertes?: number; causa_muerte?: string | null; observaciones?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      pesos_lote_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; peso_promedio: number; peso_minimo: number | null; peso_maximo: number | null; numero_pesados: number | null; dia_vida: number | null; metodo: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; peso_promedio: number; peso_minimo?: number | null; peso_maximo?: number | null; numero_pesados?: number | null; dia_vida?: number | null; metodo?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; peso_promedio?: number; peso_minimo?: number | null; peso_maximo?: number | null; numero_pesados?: number | null; dia_vida?: number | null; metodo?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      parametros_ambientales_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; hora: string | null; temperatura_interior: number | null; temperatura_exterior: number | null; humedad_interior: number | null; nh3_ppm: number | null; co2_ppm: number | null; fuente: string; sensor_id: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; hora?: string | null; temperatura_interior?: number | null; temperatura_exterior?: number | null; humedad_interior?: number | null; nh3_ppm?: number | null; co2_ppm?: number | null; fuente?: string; sensor_id?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; hora?: string | null; temperatura_interior?: number | null; temperatura_exterior?: number | null; humedad_interior?: number | null; nh3_ppm?: number | null; co2_ppm?: number | null; fuente?: string; sensor_id?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      vacunaciones_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha_aplicacion: string; vacuna: string; lote_vacuna: string | null; via_administracion: string | null; dosis: string | null; laboratorio: string | null; numero_aves: number | null; costo: number | null; proxima_dosis: string | null; veterinario: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha_aplicacion?: string; vacuna: string; lote_vacuna?: string | null; via_administracion?: string | null; dosis?: string | null; laboratorio?: string | null; numero_aves?: number | null; costo?: number | null; proxima_dosis?: string | null; veterinario?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha_aplicacion?: string; vacuna?: string; lote_vacuna?: string | null; via_administracion?: string | null; dosis?: string | null; laboratorio?: string | null; numero_aves?: number | null; costo?: number | null; proxima_dosis?: string | null; veterinario?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      medicaciones_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha_inicio: string; fecha_fin: string | null; medicamento: string; principio_activo: string | null; via_administracion: string | null; dosis: string | null; periodo_retiro_dias: number | null; motivo: string | null; costo: number | null; veterinario: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha_inicio?: string; fecha_fin?: string | null; medicamento: string; principio_activo?: string | null; via_administracion?: string | null; dosis?: string | null; periodo_retiro_dias?: number | null; motivo?: string | null; costo?: number | null; veterinario?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha_inicio?: string; fecha_fin?: string | null; medicamento?: string; principio_activo?: string | null; via_administracion?: string | null; dosis?: string | null; periodo_retiro_dias?: number | null; motivo?: string | null; costo?: number | null; veterinario?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      eventos_clinicos_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; tipo_evento: string; descripcion: string; aves_afectadas: number | null; aves_muertas: number | null; accion_tomada: string | null; veterinario: string | null; resuelto: boolean; observaciones: string | null; requiere_medicamento: boolean; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; tipo_evento: string; descripcion: string; aves_afectadas?: number | null; aves_muertas?: number | null; accion_tomada?: string | null; veterinario?: string | null; resuelto?: boolean; observaciones?: string | null; requiere_medicamento?: boolean; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; tipo_evento?: string; descripcion?: string; aves_afectadas?: number | null; aves_muertas?: number | null; accion_tomada?: string | null; veterinario?: string | null; resuelto?: boolean; observaciones?: string | null; requiere_medicamento?: boolean; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      costos_lote_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; categoria: string; descripcion: string; monto: number; proveedor: string | null; observaciones: string | null; equipo_id: string | null; medicacion_id: string | null; vacunacion_id: string | null; desinfeccion_id: string | null; tipo_alimento_id: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; categoria: string; descripcion: string; monto: number; proveedor?: string | null; observaciones?: string | null; equipo_id?: string | null; medicacion_id?: string | null; vacunacion_id?: string | null; desinfeccion_id?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; categoria?: string; descripcion?: string; monto?: number; proveedor?: string | null; observaciones?: string | null; equipo_id?: string | null; medicacion_id?: string | null; vacunacion_id?: string | null; desinfeccion_id?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      desinfecciones_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; producto: string; previene: string | null; dosis: string | null; responsable: string | null; costo: number | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; producto: string; previene?: string | null; dosis?: string | null; responsable?: string | null; costo?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; producto?: string; previene?: string | null; dosis?: string | null; responsable?: string | null; costo?: number | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      equipos_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; nombre: string; tipo: string; estado: string; marca: string | null; modelo: string | null; numero_serie: string | null; fecha_instalacion: string | null; horas_operacion: number | null; ultima_revision: string | null; proximo_mantenimiento: string | null; ubicacion: string | null; sensor_id: string | null; observaciones: string | null; costo_compra: number | null; fecha_compra: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; nombre: string; tipo: string; estado?: string; marca?: string | null; modelo?: string | null; numero_serie?: string | null; fecha_instalacion?: string | null; horas_operacion?: number | null; ultima_revision?: string | null; proximo_mantenimiento?: string | null; ubicacion?: string | null; sensor_id?: string | null; observaciones?: string | null; costo_compra?: number | null; fecha_compra?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; nombre?: string; tipo?: string; estado?: string; marca?: string | null; modelo?: string | null; numero_serie?: string | null; fecha_instalacion?: string | null; horas_operacion?: number | null; ultima_revision?: string | null; proximo_mantenimiento?: string | null; ubicacion?: string | null; sensor_id?: string | null; observaciones?: string | null; costo_compra?: number | null; fecha_compra?: string | null; created_at?: string }
        Relationships: []
      }
      equipos_pollo_logs: {
        Row: { id: string; equipo_id: string; finca_id: string; fecha: string; estado_registrado: string; horas_dia: number | null; lectura_sensor: Record<string, unknown> | null; alerta: boolean | null; descripcion_alerta: string | null; fuente: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; equipo_id: string; finca_id: string; fecha?: string; estado_registrado: string; horas_dia?: number | null; lectura_sensor?: Record<string, unknown> | null; alerta?: boolean | null; descripcion_alerta?: string | null; fuente?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; equipo_id?: string; finca_id?: string; fecha?: string; estado_registrado?: string; horas_dia?: number | null; lectura_sensor?: Record<string, unknown> | null; alerta?: boolean | null; descripcion_alerta?: string | null; fuente?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      // ── Cerdos: finanzas, ventas, sanidad clínica y alimento ──────────
      eventos_clinicos_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; tipo_evento: string; descripcion: string; animales_afectados: number | null; animales_muertos: number | null; accion_tomada: string | null; veterinario: string | null; resuelto: boolean; requiere_medicamento: boolean; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; tipo_evento: string; descripcion: string; animales_afectados?: number | null; animales_muertos?: number | null; accion_tomada?: string | null; veterinario?: string | null; resuelto?: boolean; requiere_medicamento?: boolean; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; tipo_evento?: string; descripcion?: string; animales_afectados?: number | null; animales_muertos?: number | null; accion_tomada?: string | null; veterinario?: string | null; resuelto?: boolean; requiere_medicamento?: boolean; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      medicaciones_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha_inicio: string; fecha_fin: string | null; medicamento: string; principio_activo: string | null; via_administracion: string | null; dosis: string | null; periodo_retiro_dias: number | null; numero_animales: number | null; motivo: string | null; costo: number | null; veterinario: string | null; proveedor: string | null; observaciones: string | null; evento_clinico_id: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha_inicio?: string; fecha_fin?: string | null; medicamento: string; principio_activo?: string | null; via_administracion?: string | null; dosis?: string | null; periodo_retiro_dias?: number | null; numero_animales?: number | null; motivo?: string | null; costo?: number | null; veterinario?: string | null; proveedor?: string | null; observaciones?: string | null; evento_clinico_id?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha_inicio?: string; fecha_fin?: string | null; medicamento?: string; principio_activo?: string | null; via_administracion?: string | null; dosis?: string | null; periodo_retiro_dias?: number | null; numero_animales?: number | null; motivo?: string | null; costo?: number | null; veterinario?: string | null; proveedor?: string | null; observaciones?: string | null; evento_clinico_id?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      recordatorios_medicacion_cerdos: {
        Row: { id: string; medicacion_id: string; lote_id: string; finca_id: string; fecha: string; hora: string | null; completado: boolean; canal: string; created_at: string }
        Insert: { id?: string; medicacion_id: string; lote_id: string; finca_id: string; fecha: string; hora?: string | null; completado?: boolean; canal?: string; created_at?: string }
        Update: { id?: string; medicacion_id?: string; lote_id?: string; finca_id?: string; fecha?: string; hora?: string | null; completado?: boolean; canal?: string; created_at?: string }
        Relationships: []
      }
      costos_lote_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; categoria: string; descripcion: string; monto: number; proveedor: string | null; observaciones: string | null; equipo_id: string | null; medicacion_id: string | null; vacunacion_id: string | null; desinfeccion_id: string | null; tipo_alimento_id: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; categoria: string; descripcion: string; monto: number; proveedor?: string | null; observaciones?: string | null; equipo_id?: string | null; medicacion_id?: string | null; vacunacion_id?: string | null; desinfeccion_id?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; categoria?: string; descripcion?: string; monto?: number; proveedor?: string | null; observaciones?: string | null; equipo_id?: string | null; medicacion_id?: string | null; vacunacion_id?: string | null; desinfeccion_id?: string | null; tipo_alimento_id?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      costos_predefinidos_cerdos: {
        Row: { id: string; finca_id: string; categoria: string; monto_referencia: number; created_at: string }
        Insert: { id?: string; finca_id: string; categoria: string; monto_referencia?: number; created_at?: string }
        Update: { id?: string; finca_id?: string; categoria?: string; monto_referencia?: number; created_at?: string }
        Relationships: []
      }
      ventas_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; cantidad: number; peso_promedio_kg: number | null; modo_precio: string; precio_kg: number | null; precio_animal: number | null; tipo_venta: string; rendimiento_canal_pct: number | null; cliente: string | null; destino: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; cantidad?: number; peso_promedio_kg?: number | null; modo_precio?: string; precio_kg?: number | null; precio_animal?: number | null; tipo_venta?: string; rendimiento_canal_pct?: number | null; cliente?: string | null; destino?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; cantidad?: number; peso_promedio_kg?: number | null; modo_precio?: string; precio_kg?: number | null; precio_animal?: number | null; tipo_venta?: string; rendimiento_canal_pct?: number | null; cliente?: string | null; destino?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      tipos_alimento_cerdos: {
        Row: { id: string; finca_id: string; nombre: string; marca: string | null; tipo_alimento_categoria: string | null; proteina_bruta_pct: number | null; grasa_pct: number | null; calcio_pct: number | null; fosforo_pct: number | null; lisina_pct: number | null; energia_kcal_kg: number | null; precio_bulto: number | null; peso_bulto_kg: number; cantidad_entrada: number | null; fecha_entrada: string | null; activo: boolean; created_at: string }
        Insert: { id?: string; finca_id: string; nombre: string; marca?: string | null; tipo_alimento_categoria?: string | null; proteina_bruta_pct?: number | null; grasa_pct?: number | null; calcio_pct?: number | null; fosforo_pct?: number | null; lisina_pct?: number | null; energia_kcal_kg?: number | null; precio_bulto?: number | null; peso_bulto_kg?: number; cantidad_entrada?: number | null; fecha_entrada?: string | null; activo?: boolean; created_at?: string }
        Update: { id?: string; finca_id?: string; nombre?: string; marca?: string | null; tipo_alimento_categoria?: string | null; proteina_bruta_pct?: number | null; grasa_pct?: number | null; calcio_pct?: number | null; fosforo_pct?: number | null; lisina_pct?: number | null; energia_kcal_kg?: number | null; precio_bulto?: number | null; peso_bulto_kg?: number; cantidad_entrada?: number | null; fecha_entrada?: string | null; activo?: boolean; created_at?: string }
        Relationships: []
      }
      requerimientos_nutricionales_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; etapa: string; consumo_kg_dia: number; proteina_pct: number; lisina_pct: number; calcio_pct: number; fosforo_pct: number; energia_kcal_kg: number; vigente_desde: string; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; etapa?: string; consumo_kg_dia?: number; proteina_pct?: number; lisina_pct?: number; calcio_pct?: number; fosforo_pct?: number; energia_kcal_kg?: number; vigente_desde?: string; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; etapa?: string; consumo_kg_dia?: number; proteina_pct?: number; lisina_pct?: number; calcio_pct?: number; fosforo_pct?: number; energia_kcal_kg?: number; vigente_desde?: string; created_at?: string }
        Relationships: []
      }
      horarios_alimentacion_cerdos: {
        Row: { id: string; lote_id: string; finca_id: string; hora: string; descripcion: string | null; cantidad_kg: number | null; activo: boolean; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; hora: string; descripcion?: string | null; cantidad_kg?: number | null; activo?: boolean; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; hora?: string; descripcion?: string | null; cantidad_kg?: number | null; activo?: boolean; created_at?: string }
        Relationships: []
      }
      horarios_alimentacion_cerdos_completados: {
        Row: { id: string; horario_id: string; lote_id: string; finca_id: string; fecha: string; created_at: string }
        Insert: { id?: string; horario_id: string; lote_id: string; finca_id: string; fecha?: string; created_at?: string }
        Update: { id?: string; horario_id?: string; lote_id?: string; finca_id?: string; fecha?: string; created_at?: string }
        Relationships: []
      }
      // ── Pollo de engorde: ventas, alimento y recordatorios ────────────
      ventas_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fecha: string; cantidad: number; peso_promedio_kg: number | null; modo_precio: string; precio_kg: number | null; precio_animal: number | null; tipo_venta: string; rendimiento_canal_pct: number | null; cliente: string | null; destino: string | null; observaciones: string | null; registrado_por: string | null; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fecha?: string; cantidad?: number; peso_promedio_kg?: number | null; modo_precio?: string; precio_kg?: number | null; precio_animal?: number | null; tipo_venta?: string; rendimiento_canal_pct?: number | null; cliente?: string | null; destino?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fecha?: string; cantidad?: number; peso_promedio_kg?: number | null; modo_precio?: string; precio_kg?: number | null; precio_animal?: number | null; tipo_venta?: string; rendimiento_canal_pct?: number | null; cliente?: string | null; destino?: string | null; observaciones?: string | null; registrado_por?: string | null; created_at?: string }
        Relationships: []
      }
      recordatorios_medicacion_pollo: {
        Row: { id: string; medicacion_id: string; lote_id: string; finca_id: string; fecha: string; hora: string | null; completado: boolean; canal: string; created_at: string }
        Insert: { id?: string; medicacion_id: string; lote_id: string; finca_id: string; fecha: string; hora?: string | null; completado?: boolean; canal?: string; created_at?: string }
        Update: { id?: string; medicacion_id?: string; lote_id?: string; finca_id?: string; fecha?: string; hora?: string | null; completado?: boolean; canal?: string; created_at?: string }
        Relationships: []
      }
      costos_predefinidos_pollo: {
        Row: { id: string; finca_id: string; categoria: string; monto_referencia: number; created_at: string }
        Insert: { id?: string; finca_id: string; categoria: string; monto_referencia?: number; created_at?: string }
        Update: { id?: string; finca_id?: string; categoria?: string; monto_referencia?: number; created_at?: string }
        Relationships: []
      }
      tipos_alimento_pollo: {
        Row: { id: string; finca_id: string; nombre: string; marca: string | null; tipo_alimento_categoria: string | null; proteina_bruta_pct: number | null; grasa_pct: number | null; calcio_pct: number | null; fosforo_pct: number | null; lisina_pct: number | null; energia_kcal_kg: number | null; precio_bulto: number | null; peso_bulto_kg: number; cantidad_entrada: number | null; fecha_entrada: string | null; activo: boolean; created_at: string }
        Insert: { id?: string; finca_id: string; nombre: string; marca?: string | null; tipo_alimento_categoria?: string | null; proteina_bruta_pct?: number | null; grasa_pct?: number | null; calcio_pct?: number | null; fosforo_pct?: number | null; lisina_pct?: number | null; energia_kcal_kg?: number | null; precio_bulto?: number | null; peso_bulto_kg?: number; cantidad_entrada?: number | null; fecha_entrada?: string | null; activo?: boolean; created_at?: string }
        Update: { id?: string; finca_id?: string; nombre?: string; marca?: string | null; tipo_alimento_categoria?: string | null; proteina_bruta_pct?: number | null; grasa_pct?: number | null; calcio_pct?: number | null; fosforo_pct?: number | null; lisina_pct?: number | null; energia_kcal_kg?: number | null; precio_bulto?: number | null; peso_bulto_kg?: number; cantidad_entrada?: number | null; fecha_entrada?: string | null; activo?: boolean; created_at?: string }
        Relationships: []
      }
      requerimientos_nutricionales_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; fase: string; dia_desde: number; dia_hasta: number | null; consumo_g_dia: number; proteina_pct: number; lisina_pct: number; calcio_pct: number; fosforo_pct: number; energia_kcal_kg: number; vigente_desde: string; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; fase?: string; dia_desde?: number; dia_hasta?: number | null; consumo_g_dia?: number; proteina_pct?: number; lisina_pct?: number; calcio_pct?: number; fosforo_pct?: number; energia_kcal_kg?: number; vigente_desde?: string; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; fase?: string; dia_desde?: number; dia_hasta?: number | null; consumo_g_dia?: number; proteina_pct?: number; lisina_pct?: number; calcio_pct?: number; fosforo_pct?: number; energia_kcal_kg?: number; vigente_desde?: string; created_at?: string }
        Relationships: []
      }
      horarios_alimentacion_pollo: {
        Row: { id: string; lote_id: string; finca_id: string; hora: string; descripcion: string | null; cantidad_kg: number | null; activo: boolean; created_at: string }
        Insert: { id?: string; lote_id: string; finca_id: string; hora: string; descripcion?: string | null; cantidad_kg?: number | null; activo?: boolean; created_at?: string }
        Update: { id?: string; lote_id?: string; finca_id?: string; hora?: string; descripcion?: string | null; cantidad_kg?: number | null; activo?: boolean; created_at?: string }
        Relationships: []
      }
      horarios_alimentacion_pollo_completados: {
        Row: { id: string; horario_id: string; lote_id: string; finca_id: string; fecha: string; created_at: string }
        Insert: { id?: string; horario_id: string; lote_id: string; finca_id: string; fecha?: string; created_at?: string }
        Update: { id?: string; horario_id?: string; lote_id?: string; finca_id?: string; fecha?: string; created_at?: string }
        Relationships: []
      }
      // ── Datos de referencia por especie (plantillas del sistema) ──────
      curvas_referencia: {
        Row: { id: string; finca_id: string | null; especie: string; linea_genetica: string; dia: number; peso_g: number | null; consumo_acum_g: number | null; conversion: number | null; created_at: string }
        Insert: { id?: string; finca_id?: string | null; especie: string; linea_genetica: string; dia: number; peso_g?: number | null; consumo_acum_g?: number | null; conversion?: number | null; created_at?: string }
        Update: { id?: string; finca_id?: string | null; especie?: string; linea_genetica?: string; dia?: number; peso_g?: number | null; consumo_acum_g?: number | null; conversion?: number | null; created_at?: string }
        Relationships: []
      }
      planes_sanitarios: {
        Row: { id: string; finca_id: string | null; especie: string; nombre: string; descripcion: string | null; created_at: string }
        Insert: { id?: string; finca_id?: string | null; especie: string; nombre: string; descripcion?: string | null; created_at?: string }
        Update: { id?: string; finca_id?: string | null; especie?: string; nombre?: string; descripcion?: string | null; created_at?: string }
        Relationships: []
      }
      planes_sanitarios_items: {
        Row: { id: string; plan_id: string; edad_dias: number; tipo: string; producto: string; previene: string | null; via_administracion: string | null; dosis: string | null; obligatoria: boolean; notas: string | null; created_at: string }
        Insert: { id?: string; plan_id: string; edad_dias: number; tipo?: string; producto: string; previene?: string | null; via_administracion?: string | null; dosis?: string | null; obligatoria?: boolean; notas?: string | null; created_at?: string }
        Update: { id?: string; plan_id?: string; edad_dias?: number; tipo?: string; producto?: string; previene?: string | null; via_administracion?: string | null; dosis?: string | null; obligatoria?: boolean; notas?: string | null; created_at?: string }
        Relationships: []
      }
      rangos_ambientales: {
        Row: { id: string; finca_id: string | null; especie: string; etapa: string; semana: number | null; temp_min: number | null; temp_max: number | null; humedad_min: number | null; humedad_max: number | null; nh3_max_ppm: number | null; co2_max_ppm: number | null; densidad_max_animales_m2: number | null; area_min_m2_animal: number | null; created_at: string }
        Insert: { id?: string; finca_id?: string | null; especie: string; etapa: string; semana?: number | null; temp_min?: number | null; temp_max?: number | null; humedad_min?: number | null; humedad_max?: number | null; nh3_max_ppm?: number | null; co2_max_ppm?: number | null; densidad_max_animales_m2?: number | null; area_min_m2_animal?: number | null; created_at?: string }
        Update: { id?: string; finca_id?: string | null; especie?: string; etapa?: string; semana?: number | null; temp_min?: number | null; temp_max?: number | null; humedad_min?: number | null; humedad_max?: number | null; nh3_max_ppm?: number | null; co2_max_ppm?: number | null; densidad_max_animales_m2?: number | null; area_min_m2_animal?: number | null; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
