# Plan de mejoras — octubre 2026

Las ideas recibidas, ordenadas por categoría y por dependencia: primero lo que
otras partes necesitan (referencias, configuración del lote), luego lo que se
construye encima (predicción, costos, diagnóstico) y al final lo que depende de
servicios externos. Cada bloque dice qué otras partes de la web toca.

Principio para todo lo que predice o diagnostica: **nunca son veredictos, solo
sugerencias**, con su fuente y el texto "posible", y sin llenar la pantalla:
cada sugerencia aparece solo cuando un dato se sale de lo esperado.

---

## 1. Referencias por línea genética (la base de todo lo demás)

Una tabla de lo esperado por semana de vida para cada línea (Lohmann Brown,
Hy-Line Brown, ISA Brown...): % de postura, consumo g/ave/día, peso corporal,
peso del huevo y mortalidad acumulada. Viene precargada con los estándares de
las guías de manejo y cada finca la puede ajustar (clima, altura).

- Toca: Resumen semanal (columnas "esperado"), gráfica de postura, alimento,
  pesajes, diagnóstico, predicción.

## 2. Configuración del lote al entrar al galpón

- **Propósito del lote**: ciclo completo, vender en postura (con fecha
  aproximada) o solo levante y venta (p. ej. semana 16).
- **Configuración preestablecida**: al registrar aves, usar una plantilla
  (línea, ciclo, meta de pico, programa de alimentación) en vez de llenar todo.
- **Salida del galpón ≠ eliminar**: cerrar el lote (vendido/descartado) deja
  todos sus registros, vacía el galpón y arranca el **vacío sanitario**
  (días de limpieza y desinfección) antes de recibir aves nuevas.
- Toca: registro de aves, galpones, Resumen, Finanzas (el lote cerrado sigue
  contando), ventas de aves (cierre ya existente), alertas.

## 3. Programa de alimentación por edad

El consumo cambia con la edad (p. ej. día 1: 18 g/ave; semana 45: ~115 g/ave).
Cada lote sigue un programa (de la referencia o propio) y se compara el consumo
real contra el esperado, por ave y por día.

- Toca: Alimento del galpón, días que alcanza el bulto, Resumen semanal.

## 4. Costo por huevo, precio y utilidad

- Costo de producción por huevo (costos ÷ huevos) del período y del lote, y
  repartido por tamaño (por peso).
- Precio sugerido para una utilidad objetivo y utilidad real por venta.
- Utilidad junto a la producción (semana a semana).
- **Punto de equilibrio**: el % de postura con el que los ingresos apenas
  cubren los costos.
- Toca: Finanzas, Ventas, Resumen semanal, predicción (descarte).

## 5. Predicción de producción

- Curva de postura con el modelo compartimental (Sharifi et al., 2022,
  Poultry Science 101:101766): `Y = A·e^(−B·x) / (1 + e^(−C·(x−D)))`;
  A: nivel, B: caída semanal (persistencia), C y D: subida al pico.
- Se ajusta con los datos reales de cada semana: estima el pico (semana y %),
  la persistencia (semanas sobre 90 %) y la producción de las próximas semanas.
- Los eventos clínicos restan: `producción estimada = curva × (1 − efecto)`.
- Con el costo por huevo: **semana en que se llega al punto de equilibrio** →
  sugerencia de descarte (no decisión).
- Toca: Producción, gráfica, Resumen, Finanzas.

## 6. Diagnóstico y sugerencias

- Reglas con referencias: deformes, sucios o rotos por encima de lo normal,
  baja postura, mortalidad alta, consumo fuera de rango → "puede deberse a…"
  (estrés calórico, calcio, Newcastle, bronquitis, Marek…), con la fuente.
- Ambiental: con las lecturas (temperatura, humedad, NH₃) sugerir acciones
  (subir cortinas, ventilar) y su posible efecto en la postura.
- Veterinarios: directorio de la finca con el historial de casos atendidos.
- Toca: Producción, Sanitario, Ambiental, notificaciones.

## 7. Ventas de huevo

- La venta sale del huevo de **toda la finca**, no de un galpón (en Huevos de
  la finca sí se ve cuánto produce cada uno). **Decidido:** el ingreso del huevo
  queda a nivel finca ("Toda la finca"); por galpón se ven sus costos.
- Clientes con precio propio o contrato, clientes frecuentes, y variación de
  precios por cliente.
- Toca: inventario de huevo (hoy por galpón), encargos, Finanzas (ingresos por
  galpón pasan a repartirse por producción), notificaciones.

## 8. Calendario sanitario

Calendario con un color por categoría: vacunas, medicamentos, retiros,
tratamientos, desinfecciones, pesajes, inicio de postura, salidas.

- Toca: Sanitario de cada galpón, plan de vacunación, notificaciones.

## 9. Reportes y visualización

- Reportes de la finca comparando en el tiempo: postura, producción,
  mortalidad, enfermedades, costos.
- Cada tabla con vistas (tabla / gráfica) y con **imprimir y exportar a Excel**.
- Resumen con una **gráfica de radar** por galpón: postura, consumo, mortalidad,
  peso y conversión contra lo esperado.
- **Tablero de análisis estilo Power BI** dentro de la app: panel de filtros
  (finca, galpón, período), indicadores arriba y gráficas conectadas entre sí.
  Un Power BI real incrustado necesita licencias de Microsoft (Pro/Embedded):
  queda como opción, y todo se puede exportar a Excel para usarlo allá.

## 10. Operarios

- Tareas del equipo (asignar, marcar hechas) y turnos.
- **Después (decidido):** WhatsApp (recordatorios y marcar tareas desde el chat)
  y tarjeta RFID en cada puesto. No se hacen todavía.

## 11. Plataforma

- Migraciones: que la carpeta `supabase/migrations` reproduzca la base completa.
- Seguridad: revisión de RLS, funciones y avisos de Supabase; claves y sesiones.

## 12. Investigación (documentos, no código)

- Agriness y otros (Fancom FarmManager, SKOV, Trouw IntelEgg): qué hacen y
  cómo competir.
- Power BI: qué datos exportar y cómo.
- Sondeos con estudiantes; estudio de ciberseguridad.

---

## Orden de trabajo

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 (solo tareas) → 11 → 12. Cada bloque se verifica en el navegador y se sube por
separado.

## Avance

| Bloque | Estado |
|---|---|
| 1. Referencias por línea | hecho: Hy-Line Brown y Lohmann Brown-Classic (100 semanas), edad de las aves, copia ajustable por finca, comparación en Resumen semanal y Pesajes. Isa Brown, Bovans y Babcock sin guía pública confiable: se copia una parecida y se ajusta |
| 2. Configuración del lote | hecho: propósito (ciclo completo, venta en postura, levante y venta) con fecha de salida por semana de vida, plantillas de configuración, cierre del lote sin borrar (venta de las aves que quedan) con vacío sanitario, lotes anteriores y avisos de salida |
| 3. Programa de alimentación | hecho: fases de Hy-Line Brown (por edad y peso en levante, por % de postura en producción), consumo esperado vs real del galpón, aviso de cambio de alimento, fases ajustables en copias de la finca. Lohmann sin fases publicadas en su tabla |
| 4. Costo por huevo | hecho: pestaña Rentabilidad del galpón (alimento consumido, costos directos, parte de la finca y amortización de la inversión en las aves), costo y precio sugerido por tamaño, utilidad semana a semana junto a la producción, punto de equilibrio; tabla por galpón en Finanzas. La utilidad por venta va con el bloque 7 |
| 5. Predicción | hecho: curva MCM ajustada a las semanas reales partiendo de la guía (con pocas semanas, la guía), pico, persistencia sobre 90 %, huevos que faltan hasta el fin del ciclo, efecto del último bache y eventos clínicos, y semana de descarte a revisar con el punto de equilibrio |
| 6. Diagnóstico | pendiente |
| 7. Ventas de huevo | pendiente |
| 8. Calendario sanitario | pendiente |
| 9. Reportes | pendiente |
| 10. Operarios | pendiente (WhatsApp y RFID después) |
| 11. Plataforma | pendiente |
| 12. Investigación | pendiente |
