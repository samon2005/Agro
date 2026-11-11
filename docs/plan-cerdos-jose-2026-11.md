# Plan · Módulo de cerdos con las respuestas de José

Fecha: 10 de noviembre de 2026
Fuente: `respuestas-cerdos-jose.md` (entrevista del 9 de noviembre) y revisión del código y la base actuales.

La idea es aprovechar que hoy casi no hay datos reales de cerdos para ordenar los cimientos **una sola vez**.
Hay 2 cerdas, 6 lotes, 1 parto y 4 lechones, todos de prueba.
Después todo lo demás (pantallas, gráficas, reportes, alertas y predicciones) se monta encima sin rehacer.

---

## 1. Cómo está hoy (lo que importa para el plan)

- **Corral = `instalaciones`** (especie `cerdos`, con `uso`: cría, precebo, levante o ceba). Cada corral tiene **un grupo activo** (`lotes_cerdos`). Las pantallas, el registro diario, el alimento, los costos y los reportes giran alrededor del grupo (`lote_id`).
- **Las naves solo existen dentro del corral de cría** (`naves_cerdos`, colgadas de un lote). Las cerdas apuntan a una nave (`reproductoras_cerdos.nave_id`).
- **Los números fijos están "quemados" en el código.** Los 114 días de gestación, la lactancia de 21 a 28, los 6 días destete-servicio y los 21 de ciclo viven en `src/lib/cerdos.ts` y se usan en **unos 40 lugares**. Las etapas y sus pesos (precebo 7–40, etc.) también están fijas.
- **El consumo de alimento es "lo que se sirvió".** No hay sobrante, así que la conversión y los costos asumen que todo se comió.
- **Lo genérico de especies** (`src/lib/especiesConfig.ts`): costos, ventas, equipos, sanidad y alimento comparten código con aves y pollo. Un cambio ahí afecta a las tres especies.
- **Reportes** (`src/lib/reportes.ts` + `TableroReportes`): calculan todo por grupo y por semana a partir de las tablas diarias.
- **Roles:** administrador, propietario y trabajador. No existe el rol "profesor/asesor".

## 2. Mapa de impacto: qué toca cada cambio de fondo

Esto es lo que hay que tener en cuenta para no hacer trabajo doble.

| Cambio de fondo | Qué arrastra |
|---|---|
| **Parámetros por finca** en vez de números fijos | Reproducción (servicio, parto, destete), ficha de la cerda, alertas, calendario, crecimiento, historial y predicciones. ~40 usos en 11 archivos. Se resuelve cambiando la fuente una vez (un `useConfigCerdos()`) y no pantalla por pantalla. |
| **Naves arriba de todo** (granja → nave → corrales o puestos) | Selector de la página de cerdos, crear y configurar lote, destete (destino), Resumen de la finca (`TableroInicio`, `ResumenGalponesFinca`, `GalponesFinca`), tareas por instalación, historial. |
| **Etapas configurables** (pesos y días) | Crear y configurar lote, cambio de etapa, clasificar por peso, curvas de crecimiento, indicadores de engorde, reportes. |
| **Consumo real con sobrante** | Conversión, costo por kg, consumo por animal en reportes (`consumoPorAnimal`, `alimentoPorTipo`, `balanceNutricional`), alerta "no comió", predicciones. La bodega **no** cambia: descuenta lo servido. |
| **Estados nuevos de la cerda** | Restricción en la base, colores y filtros de reproducción, ficha, indicadores (días no productivos), alertas. |
| **Ventas con forma de pago y cuentas por cobrar** | Código de ventas compartido por las tres especies, finanzas, reportes de dinero, Resumen. Conviene hacerlo genérico, como ya existe para el huevo (`pagos_ventas_huevos`). |
| **Rol profesor/asesor** | Permisos de todas las pantallas administrativas y destinatarios de alertas. |

**Regla para todo el plan:** cada cálculo vive en un solo lugar (una función en `src/lib/` o una vista en la base). Pantallas, gráficas, reportes y alertas leen de ahí. Así un cambio de fórmula o de dato se refleja en todas partes.

---

## 3. Fase 0 · Cimientos (va primero porque todo lo demás depende de esto)

### 0.1 Parámetros de cerdos por finca
- Nueva configuración por finca (`fincas.config_cerdos`, jsonb) con valores por defecto de literatura, editables:
  - **Reproducción:** gestación 114, lactancia objetivo 21 (rango 14–28), destete-servicio 5–7, ciclo 21, reinseminar a los 21 días, traslado a parideras 3 días antes.
  - **Etapas:** peso de entrada y salida y días de cada una. En la finca de José: precebo 6,5→30 kg en 49 días, levante →80, ceba →120, levante + ceba 80–85 días.
  - **Reemplazo:** ganancia máxima 600 g/día, edad mínima 210 días, peso 140 kg, servicio en el 3.er celo.
  - **Umbrales de alerta:** mortalidad por etapa, consumo bajo (%), bajo peso (%), temperatura y humedad por etapa, días de alimento en bodega (7).
  - **Metas:** kg destetados por cerda al año, costo por kg, conversión por etapa, etc.
  - **Opciones:** medir agua (sí/no), tamaño del bulto (40 kg), vacío sanitario (7, ya existe).
- `src/lib/cerdos.ts` deja de exportar constantes fijas: expone `useConfigCerdos()` y funciones que reciben la configuración (`fechaProbableParto(servicio, cfg)`).
- Pantalla **Ajustes de cerdos** en la configuración de la finca, con los valores y la fuente de cada uno.

### 0.2 Estructura de la granja: naves, corrales y puestos
- `instalaciones` gana `padre_id`. Una **nave** contiene **corrales**, y también puede tener **puestos individuales** (jaulas o parideras) con un número: `puestos` en la nave y `puesto` en la cerda. No hace falta crear 30 filas para 30 jaulas.
- Usos configurables: gestación, parideras, precebo, levante, ceba, clínica, berraco/celador, cuarentena. La lista sale de la configuración, no de un CHECK fijo.
- **Las cerdas siguen viviendo en un grupo**, el grupo de su nave (nave de gestación = un grupo, nave de parideras = otro). Así el registro diario, el alimento, los costos y los reportes, que trabajan por grupo, **siguen funcionando sin reescribirse**. Mover una cerda a parideras = cambiarla de grupo y de puesto, con historial.
- Se migran las naves de prueba que hay hoy dentro del lote de cría y se retira `naves_cerdos`.

### 0.3 Consumo real
- `nutricion_diaria_cerdos` gana `sobrante_kg`. Una vista o función única da el **consumo real** = servido − sobrante (si no hay sobrante, consumo = servido).
- Reportes, indicadores y alertas se conectan a esa fuente, no a `alimento_kg` directo.

### 0.4 Motor de indicadores y motor de alertas (una sola fuente)
- `src/lib/indicadoresCerdos.ts`: las fórmulas de la sección 13 de José (conversión, GDP, mortalidad por etapa, partos/cerda/año, destetados/cerda/año, tasa de parto, intervalo entre partos, días no productivos, uniformidad, costo por kg, etc.). Las usan la pantalla de cría, la de engorde, las fichas, los reportes y las predicciones.
- `src/lib/alertasCerdos.ts`: calcula todas las alertas de la sección 14 a partir de los datos y la configuración. La bandeja de alertas, el Resumen, las tareas automáticas y, más adelante, el aviso al celular leen de aquí.

---

### Avance de la Fase 0 (10 de noviembre de 2026)

- **0.1 Hecho.**
  - `src/lib/configCerdos.ts`, con los valores por defecto y su origen, y el hook `useConfigCerdos()`.
  - Columna `fincas.config_cerdos` (migración 069), que guarda solo lo que la granja cambia.
  - Botón **Parámetros** en la página de cerdos.
  - Reproducción, destete, servicio, ficha y crecimiento ya leen los parámetros: no queda ningún número fijo.
- **0.2 Hecho, con un ajuste frente a lo propuesto.**
  - Todas las cerdas van en **un solo grupo (pie de cría)**, y la nave y el puesto son su **ubicación**. Así su historia (servicio → parto → destete) no se parte en grupos distintos.
  - Las naves y los corrales son `instalaciones` (`tipo` nave o corral, `padre_id`, `puestos`). La cerda tiene `ubicacion_id` y `puesto` (migración 070).
  - Pantallas actualizadas:
    - "Naves y finca": nuevo editor `NavesFinca`.
    - Página de cerdos: navegación nave → corral.
    - Crear la finca, crear lote o pie de cría, registrar cerda, destete, historial.
    - Resumen: `NavesResumen`.
  - **Pendiente:** migración 071 para borrar `naves_cerdos` y `reproductoras_cerdos.nave_id`. Va **después de publicar** este código, porque la versión publicada todavía las lee.
- **0.3 Hecho.**
  - `sobrante_kg` y `consumo_real_kg`, calculado en la base (migración 069).
  - El registro del día pide el sobrante.
  - Diario, reportes y Resumen usan lo que de verdad comieron.
  - El agua aparece solo si la granja la mide.
- **0.4 Hecho.**
  - `src/lib/indicadoresCerdos.ts` y `src/lib/alertasCerdos.ts`, probados con los números de la sección 13.
  - Las alertas ya salen en la pestaña Cerdas (parto, traslado, celo, sin celo, destete) y en el Diario de cada grupo (día sin registrar, mortalidad alta, consumo bajo).
  - Los indicadores se conectan a las pantallas de cría y engorde en las Fases 1 y 2.

## 4. Fase 1 · Reproducción (imprescindible para José)

- **Estados de la cerda:** vacía, servida, gestante, lactante, descartada + **en cuarentena, en recuperación, abortó, repetidora**. Los estados se calculan desde los eventos, para que no se desincronicen.
- **Machos / celadores:** misma ficha que la cerda con `sexo` macho y `funcion` (celador, reproductor). Se identifican por nombre. Registro de **recolecciones de semen** (fecha, macho) para usarlas en el servicio como "semen propio: nombre + fecha".
- **Celos:** tabla de celos observados (fecha, cerda, método lordosis o celador, calidad). Alimenta el reemplazo (1.º, 2.º, 3.er celo), "en recuperación" y la alerta de celo esperado.
- **Servicio ampliado:** cada dosis con fecha y hora (ya existe), semen (PIC con código o propio), **quién inseminó**, **calidad del celo**, **grupo sincronizado**.
- **Grupos sincronizados:** tabla de grupos (nombre, cerdas, fecha objetivo de parto). Sirve de filtro en cría y reportes.
- **Gestación:** repetición, vacía y aborto como eventos (cuentan para descarte). Confirmación de preñez con método y día **configurables** (pendiente con profesores).
- **Parto ampliado:** hora de inicio y fin, asistido, nacidos totales, vivos, muertos y momias, peso y **sexo** de cada lechón (los lechones ya existen uno por uno), defectos.
- **Adopciones:** de qué cerda viene, a cuál va, lechones y razón. Los indicadores cuentan los destetados por la cerda que crió.
- **Manejo del lechón:** hierro (máximo día 2), tatuaje, chapeta, colmillos, cola, castración y papillas, como tareas con día configurable.
- **Destete:** lactancia según la configuración, peso individual y talla (ya existe), destino.
- **Descarte:** fecha, motivo, destino. Criterios configurables (los definen los profesores; mientras tanto, valores de literatura marcados como sugerencia).
- **Reemplazo:** ingreso (origen, nacimiento, peso), cuarentena, pesajes con su GDP (alerta si pasa de 600 g/día) y celos.
- **Ficha de la cerda / del macho:** historial completo. Edad, ingreso, partos, nacidos y destetados por parto, pesos al nacer y al destete, servicios con qué macho o semen, enfermedades, tratamientos, línea de tiempo e indicadores propios.

## 5. Fase 2 · Engorde (precebo, levante, ceba)

- **Pesaje semanal:** se anota cada peso y la app calcula promedio, mínimo, máximo, **uniformidad** y GDP. Se puede pesar todo o una muestra (umbral configurable). Programación "un grupo distinto cada día" como tarea.
- **Precebo individual:** sigue con los lechones uno por uno (ya existe la tabla). Desde levante se maneja por grupo.
- **Cambio de etapa programado:** fecha fija sugerida por días y peso, que se puede adelantar o atrasar. Al mover el grupo de corral se aplica **todo dentro – todo fuera** y el corral queda en **vacío sanitario** (7 días).
- **Clínica:** pasar uno o varios animales al corral de clínica con anotación individual. Desenlace: recuperado (vuelve o se vende aparte), vendido o sacrificado. El conteo del grupo se ajusta.
- **Ventas parciales o totales** del grupo, y venta al salir de precebo.
- **Ficha del grupo:** destete y camadas de origen, pesos semanales, consumo, conversión, mortalidad, tratamientos y costos.

## 6. Fase 3 · Alimento

- **Sobrante** en el registro diario y **consumo real** (de la Fase 0).
- **Consumo vigente que se repite** (ya existe), más **ración por cerda o por grupo de cerdas** en gestación y lactancia (la indica el profesional).
- **Bodega única en bultos de 40 kg.** Compras con proveedor, fecha, cantidad, precio, lote, vencimiento y factura (revisar qué falta de lo que ya hay). Alerta a los 7 días.
- **Balance nutricional** por etapa como en aves, con la tabla de alimentos por etapa: papilla, preiniciador, iniciador, precebo, levante, ceba, gestación y lactancia.
- **Agua** solo si la finca la mide (opción de la Fase 0).
- Medicados y forma de cambiar de alimento: quedan como campos opcionales hasta tener el dato.

## 7. Fase 4 · Sanidad, bioseguridad y ambiente

- **Plan de vacunación y desparasitación configurable por etapa** (cerdas por días de gestación o posparto, lechones por edad, engorde, machos), con alerta **5 días antes** para pedir el producto. Se carga una propuesta de literatura y normativa ICA, marcada como "por validar con los profesores".
- **Medicaciones:** producto, dosis, días, animales, quién la indicó y **retiro con recordatorio diario** (ya existe la base de recordatorios).
- **Brotes:** enfermedad, signos, áreas afectadas (naves o corrales) y tratamiento. **Necropsia** en la mortalidad (quién la hizo y hallazgos).
- **Bioseguridad:** registro de **visitas** (quién, de dónde viene, motivo, último contacto con cerdos, ducha, cambio de ropa, desinfección). Lo hago genérico para las tres especies.
- **Ambiente:** temperatura y humedad del termohigrómetro **dentro del registro diario**, con rango por etapa y alerta.
- **Equipos:** reportar una falla → alerta inmediata (ya existe la base de equipos).
- **Registros que exigen el ICA, Porkcolombia y los compradores:** investigarlos y cubrirlos (José lo pidió explícitamente).

## 8. Fase 5 · Pantallas, alertas, tareas y permisos

- **Inicio de cerdos:** producción, nacimientos, próximos partos y ganancia de peso, con filtros por etapa, ciclo, nave y grupo sincronizado. Se arma con el kit de widgets que ya usamos en el Resumen.
- **Pantalla de cría:** partos de hoy, partos del periodo, lechones, cerdas por estado, calendario de partos y destetes.
- **Pantalla de engorde:** conversión y GDP por corral, pesos contra la meta, grupos próximos a cambio de etapa o venta.
- **Cierre del día:** qué se registró, qué falta ("día sin registrar") y qué tareas completó cada persona.
- **Alertas** (motor de la Fase 0) en la bandeja, con prioridad y destinatario por rol. Las urgentes se marcan para el aviso al celular, que llega con la integración de WhatsApp o notificaciones, **pendiente para después** como estaba acordado.
- **Tareas automáticas** desde las alertas y el calendario: pesaje del día, celos por revisar, traslados, destetes, vacunas, manejo del lechón. Asignadas al encargado de cada etapa.
- **Rol "profesor / asesor":** ve todo lo administrativo y todas las alertas. Operarios y practicantes ven lo operativo con menos detalle.

## 9. Fase 6 · Dinero

- **Venta:** comprador, cantidad, peso total, precio, **transporte**, **forma de pago**. En pie o por canal (ya existe) con el cálculo de rendimiento explicado.
- **Cuentas por cobrar:** pagos y saldos. Lo hago genérico para las tres especies, siguiendo lo que ya existe para el huevo.
- **Costos de la finca cargados a cada grupo** con una regla de reparto configurable (por animales, por kg o por días). La regla final la decide el profesor.
- **Cálculos:** costo por lechón destetado, costo por kg producido, margen por cerdo vendido, punto de equilibrio, utilidad por grupo y por mes.

## 10. Fase 7 · Predicciones y sugerencias ("que me sorprendan")

Van al final porque necesitan los datos de las fases anteriores. Se diseñan desde ya para que los datos se guarden bien.

- **Peso futuro por lechón, camada y grupo** a partir del peso al nacer y al destete. Curva de crecimiento ajustada con los propios pesajes; ya tenemos un ajuste de curvas para la postura en `src/lib/prediccion.ts`.
- **Fecha estimada de salida** de cada grupo y kg que se venderán en el mes.
- **Cerdas candidatas a descarte:** puntaje con partos, tamaño de camada, repeticiones, abortos y días no productivos. Siempre como sugerencia.
- **Impacto de la temperatura y de los casos clínicos** en la ganancia de peso y en la plata.
- **Sugerencias de literatura** cuando un indicador se sale de la meta, y **acompañamiento** cuando baja la producción. Se muestran "como sugerencia, no como establecidas".

## 11. Fase 8 · Precio de la carne tipo "trader"

- Precio del cerdo en pie y en canal en Colombia (fuente: Porkcolombia y otras), diario y semanal, comparado con el precio de las ventas propias, con enlace a la fuente.
- Primero hay que confirmar de dónde se puede sacar el dato de forma confiable. Si no hay una fuente automática, empieza con carga manual semanal.

---

## 12. Decisiones que propongo (para confirmar antes de empezar)

1. **Naves arriba de todo y las cerdas agrupadas por nave** (sección 0.2). Así se cumple lo que pidió José sin reescribir registro diario, alimento, costos y reportes.
2. **Puestos individuales como número** dentro de la nave, no como filas aparte.
3. **Todo lo que José dejó pendiente** (vacunas, metas, criterios de descarte, umbrales) se arranca con valores de literatura, marcados "por validar" y editables por la granja.
4. **Ventas, pagos y visitas genéricos** para las tres especies, no solo para cerdos.
5. **Aviso al celular** se deja para la fase de integraciones (WhatsApp), como estaba acordado. Mientras tanto las alertas viven en la app.

## 13. Orden de trabajo sugerido

1. **Fase 0, cimientos.** Se nota poco en pantalla, pero evita rehacer todo lo demás.
2. **Fase 1, reproducción**, y **Fase 2, engorde**: lo imprescindible de José.
3. **Fase 3, alimento**, y **Fase 4, sanidad y ambiente.**
4. **Fase 5:** pantallas, alertas y tareas, y **Fase 6:** dinero.
5. **Fase 7, predicciones**, y **Fase 8, precio tipo trader.**

Cada fase termina con: migración aplicada, pantallas probadas en el navegador, gráficas y reportes revisados contra el mapa de impacto, y commit.

---

## 14. Estado al 10 de noviembre de 2026 (para retomar en otro equipo)

- **Fase 0 terminada, probada en el navegador y subida** (commit "Add pig farm setup from José's answers"). Migraciones 069 y 070 ya aplicadas en Supabase.
- **Datos de prueba:** finca "Prueba1" con 6 naves, pie de cría (cerdas 205 y 206), grupo en Precebo · Corral 1 con 11 cerdos y alimento Italcol Precebo.
- **Pendientes:**
  1. Cuando la versión nueva esté desplegada en Vercel, migración de limpieza: borrar la tabla vieja `naves_cerdos` y la columna `reproductoras_cerdos.nave_id`.
  2. Decidir si el conteo del pie de cría se pasa a un disparador en la base (hoy lo hace la app con `sincronizarPieDeCria` en `src/lib/cerdos.ts`). El intento anterior fue bloqueado por permisos; pedir aprobación antes.
  3. En celular el menú lateral nunca se oculta y ocupa media pantalla (pasa en toda la app). Propuesta: menú que se abre con un botón.
  4. Seguir con la Fase 1 (reproducción) según este plan.
