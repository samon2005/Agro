# Entrevista para diseñar el módulo de cerdos de AgroGestión

**Para:** José (y sobre todo, para el Claude de José)
**De:** el equipo de AgroGestión
**Fecha:** octubre de 2026

---

## Parte 0 · Para José (léelo tú, son 2 minutos)

José: estamos construyendo en AgroGestión la parte de **cerdos** con el mismo nivel de
detalle que ya tiene la de **gallinas ponedoras** (registro diario, alimento, sanidad,
alertas, gráficas, costos y ganancias). Para hacerlo bien necesitamos que nos expliques
cómo se trabaja de verdad en una granja porcina: desde que entran los animales hasta que
se venden.

En vez de llenarte un formulario, este documento convierte a Claude en un entrevistador.

**Cómo usarlo:**

1. Abre Claude (claude.ai o la app) y empieza una conversación nueva.
2. Adjunta este archivo y escribe: **"Lee este documento y empecemos la entrevista."**
3. Claude te va a hacer preguntas de a poquitas. Contesta como si le explicaras a un
   operario nuevo: con ejemplos, números reales y cómo lo hacen en tu granja.
4. Si no sabes algo, dilo ("no sé", "eso lo decide el veterinario"). No pasa nada.
5. Puedes parar cuando quieras y seguir otro día en la misma conversación.
   La entrevista completa puede tomar entre 2 y 4 horas en total, repartidas como quieras.
6. Al final Claude va a generar un archivo con todas tus respuestas.
   **Mándanos ese archivo**: con él construimos el módulo.

Si tienes fotos de tus cuadernos, planillas de Excel, la tabla de alimentación de la
genética, el plan de vacunas o formatos que uses, súbelos a la conversación cuando Claude
los pida (o cuando quieras). Valen mucho.

---

## Parte 1 · Instrucciones para Claude (Claude: esta parte es para ti)

### Tu papel

Eres un **entrevistador de requisitos** para un software de gestión de fincas llamado
AgroGestión (aplicación web, en español de Colombia, usada en el celular y el computador).
Vas a entrevistar a **José**, que conoce de producción porcina, para descubrir **cómo deben
funcionar las secciones de cerdos** del sistema. Al terminar, vas a entregar un archivo con
las respuestas organizadas para que el equipo de desarrollo (otro Claude que programa el
sistema) lo implemente sin tener que volver a preguntar.

### Reglas de la entrevista

1. **Pocas preguntas a la vez**: máximo 3 por mensaje, relacionadas entre sí. Espera la
   respuesta antes de seguir.
2. **Empieza por conocer a José y su granja** (Bloque A). Adapta el resto de la entrevista
   a lo que él maneja: si su granja solo hace ceba, no le preguntes en detalle por partos,
   pero sí pregúntale cómo cree que debería funcionar para una granja de cría (el sistema
   lo van a usar muchas granjas distintas).
3. **Pide números, unidades y ejemplos.** "Poco", "a veces" o "depende" no sirven para
   programar: pregunta cuánto, cada cuánto, en qué unidad, de qué depende y qué pasa en
   cada caso. Pide un ejemplo con números reales de su granja.
4. **Repregunta lo ambiguo.** Si una respuesta deja dudas, vuelve sobre ella antes de
   cambiar de tema.
5. **Confirma las fórmulas con un ejemplo.** Cuando José explique un cálculo (conversión,
   ganancia diaria, mortalidad…), repítelo con números ("Entonces si un corral de 20 cerdos
   comió 1.800 kg y ganó 600 kg, la conversión es 3,0, ¿cierto?") y deja que lo corrija.
6. **No le pongas palabras en la boca.** No sugieras respuestas salvo que él pida ayuda o
   diga que no sabe. En ese caso puedes ofrecer las opciones usuales en la porcicultura
   colombiana, **marcadas como sugerencia tuya**, y anotar cuál escogió.
7. **Usa su vocabulario.** Si él dice "nave", "sala", "jaula", "paridera", "camada",
   "chapeta", úsalo igual y anótalo en el glosario. Pregunta qué significa cada término si
   puede variar entre granjas.
8. **Lenguaje sencillo, cero tecnicismos de software.** No hables de "base de datos",
   "tablas" ni "campos". Pregunta "¿qué anota el operario?", "¿qué quiere ver en la
   pantalla?", "¿cuándo le debería avisar la aplicación?".
9. **Valida lo que ya existe.** En la Parte 2 está lo que el sistema ya hace con cerdos.
   Cuando llegues a cada tema, cuéntale brevemente cómo está hoy y pregúntale si está
   bien, si cambia, si sobra o si falta algo.
10. **Prioridades.** Para cada función que salga, pregúntale si es **imprescindible**
    (sin esto no sirve), **importante** (la usaría seguido) o **para después**.
11. **Lleva la cuenta.** Al empezar cada sesión (o si la conversación es larga), haz un
    resumen corto de lo que ya se cubrió y en qué bloque van. Cada 2 bloques, muéstrale un
    resumen de lo que entendiste y pídele que lo confirme.
12. **No inventes datos.** Si algo quedó sin respuesta, se anota como "pendiente". Las
    definiciones importantes van con las palabras de José entre comillas.
13. **Documentos y fotos.** Si José comparte imágenes o archivos (planillas, tablas de
    alimento, planes de vacunación), descríbelos en detalle en el archivo final y extrae
    sus números.
14. **No es obligatorio seguir el orden al pie de la letra.** Si José se va por otro tema,
    síguelo y luego vuelve. Lo importante es que al final estén cubiertos todos los bloques.

### Al terminar

Cuando todos los bloques estén cubiertos (o José diga que ya terminó):

1. Muéstrale un resumen general y pregúntale si quiere corregir algo.
2. Genera el archivo final **`respuestas-cerdos-jose.md`** (Markdown) con la plantilla
   exacta de la **Parte 4**. Si puedes, entrega también una versión en PDF para leerla
   cómodamente; la versión Markdown es la que se usa para programar, así que nunca la
   omitas.
3. Dile a José que nos mande ese archivo (y las fotos o planillas que haya compartido).

---

## Parte 2 · Lo que el sistema ya hace (contexto para Claude)

### 2.1 El modelo a seguir: gallinas ponedoras

La sección de ponedoras está completa y es el nivel de detalle que queremos para cerdos.
Funciona así:

- **Galpones fijos** de la finca, con su área en m². En cada galpón vive un **lote** de aves
  (entra con su línea genética, fecha de nacimiento, número de aves).
- **Registro diario** del galpón: huevos por tamaño (B, A, AA, AAA, Jumbo), rotos, sucios,
  deformes, muertes con su causa, eventos clínicos, alimento. Hay un botón de "día sin
  novedades" que registra el día con un clic.
- **Alimento**: cada galpón tiene un **consumo vigente** (kg al día de un alimento) que se
  repite cada día hasta que se cambie. La bodega lleva los **bultos** de cada alimento
  (entradas con proveedor, precio y vencimiento) y descuenta lo consumido; avisa cuando
  alcanza para pocos días. Hay horarios de alimentación y un **balance nutricional**
  (lo que comió vs. lo que pide la guía: proteína, calcio, fósforo, grasa).
- **Guía de la línea genética** (Lohmann, Hy-Line, ISA, Bovans…): postura, peso, consumo y
  mortalidad esperados por semana de vida. El sistema compara lo real con la guía,
  dibuja curvas y hace una **predicción** de la postura.
- **Sanidad**: plan de vacunación, medicaciones con **período de retiro**, eventos
  clínicos con síntomas, veterinarios, desinfecciones y vacío sanitario.
- **Ambiente** (temperatura, humedad, amoníaco, CO₂) y **equipos** (fallas,
  mantenimiento).
- **Pesajes** periódicos con uniformidad.
- **Resumen semanal**, **rentabilidad** (costo por huevo, punto de equilibrio),
  **ventas**, **costos** por categoría y **estadísticas/reportes** con gráficas.
- **Alertas** (temperatura alta, postura baja, retiro activo, equipo dañado, alimento por
  acabarse, día sin registrar) y **sugerencias** de posibles causas cuando algo se sale
  de lo esperado.

### 2.2 Lo que ya existe para cerdos

**Configuración de la finca**

- La finca marca qué **etapas** maneja: Cría (gestación y parto), Lactancia (hasta el
  destete), Precebo (7–40 kg), Levante (40–60 kg), Ceba (60 kg en adelante). Unas granjas
  hacen ciclo completo y otras solo una parte.
- **Corrales** fijos con su área y su **uso**: hoy solo hay dos usos, **Cría** y
  **Precebo**.
- **Tallas al destete** configurables por peso (por defecto S < 7 kg, M 7–8 kg, L ≥ 8 kg).

**Lote del corral**

- Cada corral tiene un **lote**: nombre, sistema (cría o engorde), número de animales
  inicial y actual, línea genética, fecha de nacimiento, fecha de ingreso, peso inicial,
  peso objetivo, fecha estimada de salida y precio objetivo por kg.

**Cría (dentro de un corral de cría)**

- El corral se divide en **naves** (el productor les pone nombre).
- **Hembras** con código, identificación (chapeta u otra), línea, fecha de nacimiento,
  número de partos y estado: vacía, servida, gestante, lactante o descartada.
- **Servicios**: monta natural o inseminación, verraco, código del semen, número de dosis,
  confirmación de preñez y **fecha probable de parto** (servicio + 114 días). El sistema
  calcula también la repetición de celo (servicio + 21 días).
- **Partos**: nacidos vivos, nacidos muertos, momificados, muertos posparto, pesos al
  nacer (individuales) y peso de la camada.
- **Lechones** individuales con código **madre-número** (ej. 205-01), sexo, peso al nacer,
  peso al destete, talla y estado (lactante, destetado, precebo, levante, ceba, vendido,
  muerto).
- **Destetes**: fecha (lactancia de 21 a 28 días), lechones destetados, peso promedio y
  destino (a un corral o a venta).
- Supuestos fijos hoy: gestación 114 días, lactancia 21–28 días, del destete al servicio
  6 días, ciclo de celo 21 días.
- Indicadores que se ven hoy: hembras activas (gestantes, lactantes, vacías), partos por
  venir, nacidos vivos por parto, % de mortinatos + momias, lechones destetados.

**Diario del corral**

- Cada día: alimento (kg y cuál), agua (litros), muertes (cantidad, causa, peso estimado)
  y observaciones. Sin consumo de alimento definido no deja registrar el día (igual que
  en aves).
- Causas de muerte sugeridas hoy: PRRS, circovirus (PCV2), APP, disentería, salmonelosis,
  colibacilosis, neumonía, peste porcina clásica, aplastamiento, accidente, estrés
  calórico, hernia, bajo peso al nacer.

**Alimento del corral**

- Consumo vigente del corral y bodega en bultos (compartida entre los corrales que comen
  el mismo alimento).
- Hay tablas listas (todavía sin pantalla completa) para **requerimientos nutricionales**
  por etapa: consumo kg/día, proteína %, lisina %, calcio %, fósforo %, energía kcal/kg.

**Otras cosas que existen a medias** (hay piezas hechas, pero sin pantalla o sin
definir bien): pesajes y clasificación por peso, cambios de etapa y movimientos entre
corrales, ventas (por kg o por animal, con rendimiento en canal), costos, vacunas,
desparasitaciones, medicaciones, eventos clínicos, ambiente, equipos, desinfecciones y
horarios de alimentación.

**Pantallas actuales**: corrales arriba; dentro del corral, pestañas **Naves** (solo cría),
**Diario**, **Alimento** y **Estadísticas**. Aparte hay un **Historial** de la finca con
servicios, partos, lechones y destetes, y **Reportes** con gráficas por corral.

---

## Parte 3 · Banco de preguntas (Claude: cubre todos los bloques)

> Las preguntas son una guía. Usa las que apliquen, sigue los hilos que abra José y
> pregunta todo lo necesario para que cada tema quede claro y medible.

### Bloque A · José y su granja

1. ¿Cuál es tu papel (dueño, administrador, zootecnista, veterinario, operario)? ¿Cuántos
   años llevas en cerdos y en qué tipo de granjas has trabajado?
2. ¿Qué hace tu granja: ciclo completo, solo cría (vende lechones), solo precebo, solo
   ceba (compra lechones), o una mezcla?
3. Tamaño: ¿cuántas cerdas de cría, cuántos verracos, cuántos cupos de precebo, levante y
   ceba? ¿Cuántos cerdos vendes al mes?
4. Ubicación, altura y clima de la granja. ¿Influye en el manejo (calor, frío)?
5. ¿Cuántas personas trabajan y qué hace cada una? ¿Quién anotaría los datos en la app?
   ¿Desde celular o computador? ¿Hay buena señal de internet en los corrales?
6. ¿Cómo llevan los registros hoy (cuaderno, tablero, Excel, otro programa como
   PigCHAMP, Agriness, PorciNet, otro)? ¿Qué te gusta y qué no de cómo lo hacen?
7. ¿Qué es lo que más te duele hoy de la administración de la granja? ¿Qué decisión te
   gustaría poder tomar con datos y hoy no puedes?
8. ¿Qué genética usan (PIC, Topigs Norsvin, Hypor, DanBred, criollo, cruces)? ¿Tienen la
   guía o tabla de desempeño de esa genética?

### Bloque B · Instalaciones y cómo se organiza la granja

1. ¿Cómo se llaman las partes de tu granja (galpón, nave, sala, corral, jaula, paridera,
   cuarentena, enfermería)? Explica la jerarquía: ¿qué está dentro de qué?
2. Áreas por etapa: gestación, maternidad (partos), precebo, levante, ceba, verracos,
   reemplazo (primerizas), cuarentena, enfermería. ¿Cuáles tienes? ¿Cuántos corrales o
   jaulas en cada una y de qué tamaño?
3. Gestación: ¿las cerdas están en jaula individual o en grupo? ¿Cuántas por corral?
4. Maternidad: ¿salas con varias parideras? ¿Se manejan por "salas" que se llenan y
   vacían juntas?
5. ¿Manejan **todo dentro – todo fuera** (un grupo entra junto y sale junto, y se lava
   el corral entre grupos)? ¿O entran y salen animales todo el tiempo?
6. Espacio: ¿cuántos m² por animal manejan en cada etapa? ¿Cuántos animales máximo por
   corral?
7. Hoy el sistema solo tiene corrales de uso **Cría** y **Precebo**. ¿Qué usos faltan
   (gestación, maternidad, levante, ceba, verracos, reemplazo, cuarentena, enfermería)?
8. ¿Un corral puede tener animales de distintas edades o etapas al mismo tiempo?

### Bloque C · Identificación de los animales

1. ¿Cómo identifican a las cerdas y verracos (chapeta, muesca en la oreja, tatuaje,
   arete electrónico/RFID, nombre)? ¿Qué número o código usan?
2. ¿Los lechones se identifican uno por uno o se manejan por camada? ¿Desde cuándo?
   ¿Hasta cuándo se sigue al animal individual (destete, venta)?
3. Hoy el sistema le pone a cada lechón el código **madre-número** (205-01, 205-02…).
   ¿Te sirve así? ¿Cómo lo harías?
4. En precebo, levante y ceba: ¿se sigue a cada cerdo o se maneja todo por grupo
   (corral/lote)? ¿Para qué casos sí haría falta el individual?

### Bloque D · Pie de cría y reproducción (si aplica a la granja o al sistema)

**Reemplazo**

1. ¿Compran las primerizas o las producen en la granja? ¿A qué edad y peso entran?
2. ¿Hacen cuarentena y adaptación? ¿Cuánto dura y qué se les hace (vacunas,
   exposición al verraco)?
3. ¿A qué edad, peso o número de celo se sirven por primera vez?

**Celo y servicio**

4. ¿Cómo detectan el celo? ¿Cada cuánto lo revisan? ¿Quién?
5. ¿Monta natural, inseminación artificial o las dos? En inseminación: ¿cuántas dosis
   por celo y con qué intervalo? ¿Compran el semen o tienen verracos propios?
6. ¿Qué anotan de cada servicio (fecha, hora, verraco, lote o código del semen, operario,
   calidad del celo)?
7. ¿Cómo y a los cuántos días confirman la preñez (ecógrafo, no repetición de celo)?
8. ¿Qué pasa si la cerda repite celo, aborta o sale vacía? ¿Qué se registra?

**Gestación y parto**

9. ¿Cuánto dura la gestación en tu granja (el sistema usa 114 días)? ¿Cuántos días antes
   del parto pasan las cerdas a maternidad?
10. ¿Qué se le hace a la cerda en gestación (vacunas, desparasitación, condición
    corporal, alimento)? ¿Cada cuánto?
11. En el parto, ¿qué anotan? (hora de inicio y fin, asistencia, nacidos totales, vivos,
    muertos, momificados, peso de cada lechón o de la camada, sexo, defectos).
12. ¿Hacen **adopciones** (pasar lechones de una cerda a otra para emparejar camadas) o
    usan **nodrizas**? ¿Cómo se debe registrar eso?
13. Manejo del lechón recién nacido: hierro, corte de colmillos, cola, castración,
    identificación, vacunas. ¿Qué día se hace cada cosa? ¿Se anota?

**Lactancia y destete**

14. ¿Cuántos días de lactancia manejan (el sistema usa 21 a 28)? ¿De qué depende?
15. ¿Qué se anota en el destete (fecha, lechones destetados, peso individual o
    promedio, talla)? ¿Las tallas S < 7 kg, M 7–8 kg, L ≥ 8 kg están bien?
16. ¿A dónde van los destetados (precebo propio, venta)? ¿Se mezclan camadas? ¿Se
    agrupan por talla?
17. Después del destete, ¿en cuántos días entra de nuevo en celo la cerda (el sistema usa
    6)? ¿Qué pasa si no entra?

**Descarte y vida útil**

18. ¿Con qué criterios descartan una cerda (número de partos, edad, camadas pequeñas,
    problemas de patas, repeticiones)? ¿Qué se hace con ella (venta, sacrificio)?

**Indicadores reproductivos** (pregunta cuáles quiere ver, cómo se calcula cada uno con
un ejemplo y cuál es su meta)

19. Partos por cerda por año · Lechones destetados por cerda por año · Nacidos totales
    y vivos por parto · Mortalidad antes del destete · Tasa de parto (partos ÷
    servicios) · Intervalo entre partos · Intervalo destete–servicio · Días no
    productivos · % de repetición de celo · % de abortos · Peso de la camada al destete.
20. ¿Hay otros indicadores que mires y no estén en la lista?

### Bloque E · Precebo, levante y ceba (el engorde)

1. Describe el recorrido del cerdo desde el destete hasta la venta: ¿en qué corrales
   está, cuánto tiempo y con qué pesos en cada etapa? (El sistema usa precebo 7–40 kg,
   levante 40–60 kg, ceba 60 kg o más: ¿son tus cortes?)
2. ¿Cuándo pasa un grupo de una etapa a la siguiente: por edad, por peso o por fecha
   fija? ¿Se mueve todo el corral o se separan por peso?
3. ¿Compran lechones o cerdos de otras granjas para engordar? ¿Qué se anota al recibirlos
   (origen, cantidad, peso total o promedio, precio, guía de movilización del ICA)?
4. **Pesajes**: ¿cada cuánto pesan? ¿Todos los animales o una muestra? ¿Báscula
   individual, de grupo o cinta? ¿Qué se anota?
5. ¿Hay ventas parciales (sacar los más pesados primero)? ¿Cómo se registra?
6. ¿A qué peso y a qué edad venden? ¿Quién decide cuándo vender?
7. Si un cerdo se queda atrás (bajo peso, enfermo), ¿se cambia de corral? ¿Se anota?

**Indicadores de engorde** (cómo se calculan con un ejemplo y cuál es la meta)

8. Ganancia diaria de peso (GDP) · Conversión alimenticia (kg de alimento ÷ kg ganados)
   · Mortalidad por etapa · Días para llegar al peso de venta · Peso y edad a la venta
   · Uniformidad del grupo · Kg de carne producidos al mes · Costo por kg producido.
9. ¿Comparas tus resultados con la tabla de la genética? ¿Nos la puedes compartir?

### Bloque F · Alimentación (la comida) — muy detallado

**Qué comen**

1. Lista todos los alimentos que usan por etapa (preiniciador, iniciador, precebo,
   levante, ceba, finalizador, gestación, lactancia, reemplazo, verracos). Para cada uno:
   marca, presentación (bulto de cuántos kg, a granel), desde y hasta qué edad o peso.
2. ¿Compran alimento terminado o lo fabrican en la granja (maíz, soya, premezcla,
   núcleo)? Si lo fabrican: ¿qué fórmulas, quién las hace y cómo quieren registrar los
   ingredientes y la mezcla?
3. ¿Cómo se hace el cambio de un alimento a otro (de golpe o mezclando unos días)?

**Cuánto comen y cómo se mide**

4. ¿Cómo se suministra: comederos automáticos (tolvas), a voluntad, raciones medidas?
   ¿Cuántas veces al día y a qué horas?
5. ¿Cómo saben cuánto comió cada corral o cada cerda? (pesan lo que sirven, cuentan
   bultos, miden lo que sobra, estiman). ¿Cada cuánto lo miden?
6. Cerdas en gestación: ¿cuántos kg al día? ¿Lo ajustan por condición corporal o por
   semana de gestación? Cerdas lactantes: ¿a voluntad? ¿Cómo lo anotan?
7. Lechones en lactancia: ¿les dan alimento (creep feeding)? ¿Desde qué día?
8. En aves el registro funciona con un **consumo vigente**: se dice "este corral come
   120 kg al día de este alimento" y se repite solo cada día hasta que se cambie. ¿Sirve
   así para cerdos, o necesitan anotar lo que comió cada día porque cambia mucho?
9. ¿Qué tanto alimento se desperdicia? ¿Lo quieren medir?
10. ¿Tienen una tabla de **consumo esperado** por edad o peso (de la genética o del
    proveedor)? Con ella el sistema puede avisar si un corral come de más o de menos.

**Calidad y nutrición**

11. ¿Conocen la composición de cada alimento (proteína, lisina, energía, calcio,
    fósforo)? ¿Les sirve que el sistema compare lo que comen con lo que necesitan por
    etapa (como el balance de las aves)?
12. ¿Usan alimentos **medicados** o aditivos? ¿Tienen período de retiro antes de la
    venta? ¿Cómo se debe registrar?

**Agua**

13. ¿Cómo toman agua (chupos, bebederos de taza)? ¿La miden (contador)? ¿Es útil
    anotarla a diario? ¿Cuánta agua esperan por animal según la etapa?

**Bodega**

14. ¿Cómo entra el alimento a la bodega (por bultos o a granel en silo)? ¿Qué se anota
    de cada compra (proveedor, fecha, cantidad, precio, lote, vencimiento, factura)?
15. ¿Quieren que el sistema avise cuando el alimento alcance para pocos días? ¿Con
    cuántos días de anticipación hacen el pedido?
16. ¿El alimento se reparte entre corrales desde una sola bodega o cada área tiene la
    suya?

### Bloque G · ¿Qué es la "producción" en cerdos?

1. Para tu granja, ¿qué es "producir"? (lechones destetados, cerdos vendidos, kg de carne
   en pie, kg en canal). ¿Qué número mirarías primero cada día, cada semana y cada mes?
2. ¿Cómo se mide la producción de un mes? Da un ejemplo con números.
3. ¿Qué metas tienes (por ejemplo: X lechones destetados por semana, X kg vendidos por
   mes)? ¿Quién las define?
4. En aves la pantalla principal del galpón muestra "huevos de hoy" y "% de postura". En
   cerdos, ¿qué cuatro números deberían aparecer arriba de todo en un corral de cría? ¿Y
   en uno de engorde?

### Bloque H · Sanidad y bioseguridad

1. **Plan de vacunación** completo por etapa (cerdas, lechones, precebo, ceba, verracos):
   enfermedad, producto, dosis, vía, edad o momento. (Ej.: Mycoplasma, circovirus, PRRS,
   peste porcina clásica, parvovirus, erisipela, E. coli, Aujeszky). ¿Cuáles son
   obligatorias por el ICA?
2. **Desparasitaciones**, hierro y otros tratamientos de rutina: qué, cuándo y a quién.
3. **Medicaciones** por enfermedad: ¿qué se anota (producto, dosis, días, animales
   tratados, veterinario)? ¿Cómo manejan el **período de retiro** antes de vender?
4. **Eventos clínicos**: ¿qué síntomas o enfermedades son los más comunes? ¿Qué se debería
   anotar cuando aparece un brote?
5. **Mortalidad**: ¿se anota cada muerte con su causa y peso? ¿La lista de causas del
   sistema (Parte 2) está bien? ¿Qué falta? ¿Hacen necropsias?
6. ¿Qué mortalidad es normal en cada etapa y desde cuánto es para preocuparse? (Así el
   sistema puede avisar.)
7. **Bioseguridad**: cuarentena, lavado y desinfección entre grupos (vacío sanitario,
   días), control de visitas, control de roedores. ¿Qué se debe registrar?
8. ¿Qué registros les exige el ICA, Porkcolombia o el comprador? ¿En qué formato?
9. ¿Trabajan con un veterinario fijo? ¿Qué debería poder ver o anotar él en la app?

### Bloque I · Ambiente, instalaciones y equipos

1. ¿Qué temperatura necesita cada etapa (lechones recién nacidos, precebo, ceba, cerdas)?
   ¿Cómo la controlan (lámparas, criadoras, cortinas, ventiladores, nebulizadores)?
2. ¿Miden temperatura, humedad o gases? ¿Con qué y cada cuánto? ¿Les sirve anotarlo?
3. ¿Qué equipos hay (comederos automáticos, bebederos, bombas, calentadores, ventiladores,
   planta eléctrica, báscula)? ¿Qué mantenimiento necesitan y cada cuánto?
4. ¿Qué daños o fallas son críticos y deberían generar una alerta?

### Bloque J · Ventas, costos y dinero

**Ventas**

1. ¿Cómo venden: en pie por kg, por animal, a frigorífico pagado en canal (con
   rendimiento), lechones al destete por animal o por kg, cerdas de descarte?
2. ¿Qué se anota de cada venta (fecha, comprador, cantidad, peso total, precio, descuentos,
   transporte, forma de pago, crédito)? ¿Quién paga el transporte y el sacrificio?
3. ¿Cómo se fija el precio (referencia de Porkcolombia, negociación, contrato)?
4. ¿Cobran a crédito? ¿Hay que llevar cuentas por cobrar?

**Costos**

5. ¿Qué costos tiene la granja? (alimento, lechones o primerizas compradas, semen,
   medicamentos y vacunas, mano de obra, energía, agua, gas, transporte, sacrificio,
   cuota de fomento porcícola, arriendos, mantenimiento, otros).
6. ¿Los costos se cargan a cada corral o grupo, o son de toda la granja y se reparten?
   ¿Cómo se repartirían (por animales, por kg producidos, por días)?
7. ¿Cuánto vale producir un lechón destetado y un kg de cerdo en pie hoy? ¿Cómo lo
   calculas?

**Rentabilidad**

8. ¿Qué te gustaría ver: costo por lechón destetado, costo por kg producido, margen por
   cerdo vendido, punto de equilibrio (precio mínimo de venta), utilidad por corral o
   grupo, utilidad por mes?
9. Da un ejemplo de cómo calcularías la ganancia de un grupo de ceba de principio a fin.

### Bloque K · Personal, tareas y permisos

1. ¿Qué tareas se repiten (diarias, semanales, por grupo)? ¿Quién las hace? ¿Se deben
   programar en la app con recordatorio?
2. ¿Qué puede ver y registrar un operario? ¿Qué debe quedar solo para el administrador
   (costos, ventas, borrar registros)?
3. ¿Hay turnos? ¿Quién es responsable de cada área?

### Bloque L · Pantallas, reportes y alertas

1. Al abrir la app por la mañana, ¿qué quieres ver primero? ¿Y al final del día?
2. **Alertas**: ¿cuándo te debería avisar la app? Para cada una: la condición exacta,
   con cuánta anticipación y a quién. Ideas para revisar con él:
   - parto en los próximos días · cerda para pasar a maternidad · celo esperado o
     repetición · cerda vacía demasiado tiempo · destete pendiente · vacuna o
     desparasitación pendiente · retiro de medicamento activo · alimento por acabarse
   - mortalidad alta en un corral · un corral que no comió lo esperado · cerdos por
     debajo del peso esperado · grupo listo para cambiar de etapa o para la venta
   - día sin registrar · temperatura fuera de rango · equipo dañado
3. **Reportes**: ¿qué reportes usan o les piden (semanal, mensual, por grupo, por cerda)?
   ¿Los exportan a Excel o PDF? ¿Para quién?
4. ¿Qué gráficas te servirían (curva de peso contra la genética, consumo por semana,
   mortalidad, partos por mes, destetados por semana, costos)?
5. **Ficha de la cerda**: ¿qué debe mostrar (historial de partos, servicios, lechones,
   vacunas, problemas)? ¿Y una ficha del grupo de engorde?
6. ¿Algo de otra aplicación o planilla que hayas visto y quieras tener?

### Bloque M · Revisión de lo que ya existe

Repasa con José cada punto de la **Parte 2.2** y pregúntale, punto por punto:
¿está bien así?, ¿qué cambiarías?, ¿qué sobra?, ¿qué falta? Pon especial atención a:

1. Las etapas y sus pesos (cría, lactancia, precebo 7–40, levante 40–60, ceba 60+).
2. Los usos de corral (solo cría y precebo hoy).
3. Las naves dentro del corral de cría.
4. Los estados de la cerda (vacía, servida, gestante, lactante, descartada).
5. Los supuestos fijos (114, 21–28, 6 y 21 días): ¿deberían poder cambiarse por granja?
6. El código de lechón madre-número y las tallas al destete.
7. El registro diario del corral (alimento, agua, muertes).
8. La lista de causas de muerte.

### Bloque N · Un caso real de principio a fin y prioridades

1. Cuéntame la historia de **un grupo real** de tu granja, con números: cuándo y cuántos
   entraron (o nacieron), qué comieron, cuánto pesaban en cada etapa, cuántos se murieron
   y por qué, qué se les aplicó, cuándo y a cuánto se vendieron, y cuánto costó todo.
2. Cuéntame **una semana normal** de trabajo: qué se hace cada día y qué se anota.
3. De todo lo que hablamos, ¿cuáles son las **cinco cosas más importantes** que la app debe
   hacer primero?
4. ¿Hay algo que no te pregunté y que debería saber?

---

## Parte 4 · Plantilla del archivo final (`respuestas-cerdos-jose.md`)

Claude: usa exactamente esta estructura. Escribe en español, claro y concreto. Si algo no
se respondió, escribe **"Pendiente"** y por qué. Las definiciones clave van con las
palabras de José entre comillas.

```markdown
# Respuestas de José · Módulo de cerdos de AgroGestión

Fecha de la entrevista:
Duración aproximada:
Documentos compartidos: (lista, con una descripción de cada uno)

## 1. Perfil de José y de su granja
- Rol, experiencia, tipo de granja, tamaño, genética, clima, personal
- Cómo registran hoy y principales dolores

## 2. Glosario
| Término de José | Qué significa | Equivale en el sistema a |
|---|---|---|

## 3. Flujo completo del animal
Narración paso a paso, desde que entra o nace hasta que se vende o muere, con tiempos,
pesos y lugares. Incluir un diagrama en texto:
Primeriza → servicio → gestación (… días) → maternidad → parto → lactancia (… días) → destete
→ precebo (… kg, … días) → levante → ceba → venta (… kg, … días de edad)

## 4. Instalaciones y organización
- Tipos de área/corral y sus usos, capacidades, m² por animal
- Jerarquía (qué está dentro de qué)
- Manejo por grupos (todo dentro – todo fuera, sí/no y cómo)

## 5. Identificación
- Cerdas, verracos, lechones, cerdos de engorde: cómo y desde cuándo

## 6. Reproducción (si aplica)
Para cada subtema (reemplazo, celo y servicio, preñez, gestación, parto, adopciones,
manejo del lechón, lactancia, destete, descarte):
- Cómo se hace (pasos)
- Qué se registra:

| Dato | Unidad | Quién lo anota | Cuándo | Obligatorio (sí/no) |
|---|---|---|---|---|

- Reglas y tiempos (días, pesos, condiciones)

## 7. Engorde (precebo, levante, ceba)
- Etapas con rangos de peso y duración
- Cambios de etapa: cuándo y cómo
- Pesajes: frecuencia, método, qué se anota
- Entradas de animales comprados y ventas parciales
- Tabla de registro (mismo formato que arriba)

## 8. Alimentación
- Tabla de alimentos:

| Alimento | Marca | Presentación | Etapa | Desde | Hasta | Consumo esperado (kg/animal/día) |
|---|---|---|---|---|---|---|

- Cómo se suministra y cómo se mide el consumo
- Decisión: ¿consumo vigente que se repite o registro diario real?
- Cerdas en gestación y lactancia
- Agua
- Fabricación propia (si aplica): fórmulas e ingredientes
- Bodega: cómo entran y qué se anota de cada compra; anticipación del pedido
- Composición nutricional y medicados

## 9. Producción
- Qué significa producción para José y cómo se mide
- Los 4 números de arriba en un corral de cría y en uno de engorde
- Metas

## 10. Sanidad y bioseguridad
- Plan de vacunación:

| Etapa | Enfermedad | Producto | Dosis y vía | Momento (edad/día) | Obligatoria ICA |
|---|---|---|---|---|---|

- Desparasitaciones y tratamientos de rutina
- Medicaciones y períodos de retiro
- Eventos clínicos y enfermedades comunes
- Mortalidad: causas (lista final), mortalidad normal y de alerta por etapa
- Bioseguridad: cuarentena, vacío sanitario, desinfección, visitas
- Registros exigidos (ICA, Porkcolombia, comprador)

## 11. Ambiente y equipos
- Temperaturas y condiciones por etapa, cómo se controlan y miden
- Equipos, mantenimiento y fallas críticas

## 12. Ventas, costos y rentabilidad
- Formas de venta y qué se anota
- Categorías de costos y cómo se reparten
- Cálculos económicos (con un ejemplo con números de cada uno)

## 13. Indicadores
Uno por fila:

| Indicador | Fórmula (en palabras y con símbolos) | Ejemplo con números | Unidad | Meta | Cada cuánto se mira |
|---|---|---|---|---|---|

## 14. Alertas
| Alerta | Condición exacta | Anticipación | Para quién | Prioridad |
|---|---|---|---|---|

## 15. Pantallas y reportes deseados
- Qué ver al abrir la app; pantalla del corral de cría; del corral de engorde; ficha de
  la cerda; ficha del grupo
- Reportes y exportaciones (formato y para quién)
- Gráficas deseadas

## 16. Personal, tareas y permisos
- Tareas recurrentes y responsables
- Qué puede ver y hacer cada rol

## 17. Revisión de lo que ya existe
| Función actual | Veredicto (bien / cambiar / sobra) | Qué cambiar exactamente |
|---|---|---|

## 18. Caso real de principio a fin
El grupo real que contó José, con todos sus números.

## 19. Prioridades
| Función | Imprescindible / Importante / Después | Comentario |
|---|---|---|

Las 5 más importantes, en orden.

## 20. Pendientes y dudas abiertas
Lo que no se pudo responder, quién lo puede responder y cualquier contradicción detectada.
```

---

*Gracias, José. Con este archivo podemos construir la parte de cerdos a la medida de cómo
se trabaja de verdad en una granja.*
