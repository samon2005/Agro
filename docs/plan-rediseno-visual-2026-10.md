# Plan de rediseño visual — Resumen, Galpones y Cerdos

Fecha: 13 de octubre de 2026 · Estado: en ejecución (sin subir a GitHub hasta que se apruebe)

## El problema

Las pantallas se leen como un documento largo: bloques de texto uno debajo del otro,
tarjetas grandes con un número y tres líneas de explicación, alertas en franjas anchas
y tablas al final. Todo tiene el mismo peso, así que nada se ve primero. La referencia
(el tablero oscuro) se ve organizada por tres razones:

1. **Cuadrícula de widgets ("bento")**: tarjetas de tamaños distintos que encajan en
   filas parejas. Cada tarjeta es una sola idea.
2. **Lo visual va primero**: anillos de %, barras de progreso, curvas y donas. El
   número grande se lee de un vistazo; la explicación queda en el globo o en "ver más".
3. **Poco texto y mucho aire**: rótulos cortos, sin párrafos dentro de las tarjetas.

## Reglas para todas las pantallas

- **No se pierde nada**: cada sección, alerta, botón y dato que existe hoy sigue estando.
  Lo que cambia es dónde vive (arriba, en un widget o a un clic).
- **Una cuadrícula de 12 columnas**: las filas tienen tarjetas de 3, 4, 6 u 8 columnas
  y la misma altura dentro de la fila. En celular todo va a una columna.
- **Alertas en una bandeja**: arriba, en una sola franja compacta con píldoras de color
  (rojo = urgente, ámbar = revisar). Al tocarla se abre la lista completa con su acción.
  Las sugerencias del galpón entran a la misma bandeja.
- **Acciones en una barra**: "Registrar día", "Configurar"… juntas, a la derecha del
  encabezado del galpón o corral, con el botón principal en verde.
- **Textos de ayuda**: pasan a un ícono (i) con globo, no a párrafos.
- **Colores**: el verde de la web en varias intensidades; rojo y ámbar solo para estados.

## Piezas nuevas (kit de widgets)

| Pieza | Para qué |
|---|---|
| `Widget` | La tarjeta base: título corto, acción opcional a la derecha, contenido |
| `Anillo` | % contra una meta o un límite (postura vs meta, mortalidad vs guía, ocupación) |
| `BarraMeta` | Progreso lineal (días de alimento que quedan, semana del ciclo, densidad) |
| `CifraWidget` | Número grande + cambio en pastilla + mini curva o mini barras |
| `MiniBarras` | Últimos 7–14 días en barras pequeñas (huevos, alimento) |
| `CalendarioMes` | El mes con los días registrados pintados (como el calendario de la referencia) |
| `LineaTiempo` | Hitos con anillos (semanas del ciclo, horarios de recolección) |
| `BandejaAlertas` | Todas las alertas del galpón/corral/finca en una franja |
| `SelectorUnidades` | Galpones/corrales como tarjetitas con su mini anillo de estado |

Todas las piezas reciben datos por props, así se pueden revisar con datos de ejemplo.

## 1. Resumen

**Hoy**: saludo · tarjeta de la finca con galpones · tarjetas por especie · radar ·
alimento por galpón · finanzas con filtros · 4 tarjetas sueltas (animales, inventario,
fincas, alertas de stock) · tus fincas · guía de inicio.

**Nuevo** (de arriba a abajo):

1. **Encabezado**: saludo, finca, ubicación y especie en píldoras; botón "Datos de la finca".
2. **Bandeja de alertas de la finca**: alimento que se acaba (≤ 7 días), galpones sin
   registro de hoy, alertas de stock.
3. **Fila de 4 widgets**: Animales en la finca (anillo de galpones ocupados) · Huevos
   de hoy (mini barras de 7 días) · Postura de hoy (anillo vs meta) · Utilidad del mes
   (cifra + mini curva).
4. **Fila**: Producción de los últimos 30 días (curva con relleno, 8 col) · Dinero del
   período (dona ingresos/costos + filtros de año y mes, 4 col).
5. **Fila**: Galpones/corrales (tarjetitas con anillo de postura, aves, semana y estado,
   8 col) · Alimento en bodega (barras de "días que alcanza" por galpón, 4 col).
6. **Fila**: Perfil frente a la guía (radar, 6 col) · Calendario del mes (días con
   registro, 3 col) · Inventario y fincas (cifras pequeñas + lista de fincas, 3 col).
7. **Guía de inicio**: solo aparece mientras falten pasos, como una barra de progreso.

## 2. Galpones

**Hoy**: encabezado · alertas en franjas anchas · selector de galpones · línea de texto
con datos del lote · pestañas · dentro de Producción: título, 4 botones, sugerencias,
franja de alimento, "Estado del lote" (4 tarjetas grandes), "Alimento" (tarjeta ancha
con 3 cifras), horarios, revisión de calidad, historial, gráficas y predicción.

**Nuevo**:

1. **Encabezado del galpón** (una sola franja): selector de galpones como tarjetitas con
   mini anillo; debajo el galpón elegido con línea, aves, semana de vida, propósito y
   salida en píldoras; a la derecha la barra de acciones.
2. **Bandeja de alertas** (cruzadas + sugerencias + "falta alimento").
3. **Pestañas** compactas.
4. **Producción — en postura**:
   - Fila de 4: Huevos hoy (anillo de cumplimiento de la meta) · Postura hoy (anillo vs
     meta, puntos vs guía) · Ciclo (barra semana X de N + fin estimado) · Mortalidad
     acumulada (anillo vs lote inicial).
   - Fila: Curva de postura (8 col) · Huevos de hoy por tamaño (dona, 4 col).
   - Fila de 3: Dinero de hoy (ingreso, pérdida hoy y 30 días como barras) · Alimento
     (g/ave, kg/día, bultos; con anillo vs guía) · Galpón (densidad, HAA).
   - Fila de 3: Calendario de registros · Horarios de recolección (línea de tiempo) ·
     Revisión de calidad (resumen + botón).
   - Predicción de postura (ancho completo).
   - Historial: tabla con el estilo nuevo, plegable, con los últimos 14 días a la vista.
5. **Producción — en preparación**: Semana de preparación (barra hacia la postura) ·
   Faltan para postura · Densidad (barra vs recomendado) · Mortalidad (anillo); alimento;
   calendario; historial.

## 3. Cerdos

1. Encabezado del corral igual que el de galpones (selector con tarjetitas, píldoras,
   acciones, bandeja de alertas con "falta el consumo").
2. **Diario**: fila de 4 (Hoy registrado sí/no · Alimento 7 días con mini barras ·
   Mortalidad acumulada en anillo · Días registrados) · curva de alimento de 30 días ·
   dona de causas de muerte · calendario · historial con estilo nuevo.
3. **Alimento y Naves**: mismas piezas (widgets y tablas nuevas).

## 4. Las demás pestañas del galpón

Alimento, Ambiental, Sanitario, Equipos, Pesajes, Resumen semanal: misma cuadrícula,
widgets y tablas. Se hacen después de las tres pantallas principales.

## Cómo se revisa

- Cada pieza se revisa con datos de ejemplo en una página temporal y con captura.
- Las pantallas reales se revisan cargando cada pestaña: sin errores en consola, sin
  textos cortados, en escritorio y en celular.
- `tsc` y `eslint` limpios. Nada se sube a GitHub hasta que se apruebe.

## Avance (13 de octubre de 2026)

- [x] Kit de widgets: `src/components/ui/widgets/` (Widget, Anillo, BarraMeta, Cifra,
      MiniBarras, CalendarioMes, BandejaAlertas, SelectorUnidades, CurvaArea).
- [x] Tablas de toda la app: encabezado verde suave, filas que se resaltan, más aire.
- [x] Tarjetas e indicadores de toda la app: misma sombra que los widgets y un solo color
      de íconos (verde), con rojo y ámbar solo para estados.
- [x] Resumen: tablero nuevo (`src/components/agro/resumen/TableroInicio.tsx`).
- [x] Galpones: encabezado (selector con mini anillos, píldoras, alertas en bandeja,
      pestañas compactas) y pestaña Producción en cuadrícula (en postura y en preparación).
- [x] Sugerencias del galpón en una franja que se abre con un clic.
- [x] Cerdos: encabezado igual al de galpones y pestaña Diario en cuadrícula.
- [ ] Pestañas Alimento, Ambiental, Sanitario, Equipos, Pesajes del galpón en cuadrícula.
- [ ] Cerdos: Naves y Alimento en cuadrícula.
- [ ] Revisión final con capturas en escritorio y celular de las pantallas reales.

Nada de esto está subido a GitHub.
